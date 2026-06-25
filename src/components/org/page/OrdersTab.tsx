import { useMemo } from "react";
import { useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";

import type { DAO } from "@/types";
import { useCoins } from "@/hooks/api";
import { getProtocolVersionForDAO, getSDKForDAO, isLegacyV2DAO } from "@/lib/sdk";

const NAV_PRECISION = 1_000_000_000_000n;

interface OrderDisplay {
    id: string;
    side: "Ask" | "Bid";
    active: boolean;
    remainingRaw: bigint;
    remainingDecimals: number;
    remainingSymbol: string;
    wallNavRaw: bigint | null;
    feeBps: number | null;
    mintedRaw?: bigint;
    maxMintRaw?: bigint;
}

interface OrdersData {
    orders: OrderDisplay[];
}

// ── helpers ──────────────────────────────────────────────────────────────────

function decodeVectorId(raw: number[]): string[] {
    try {
        const parsed = bcs.vector(bcs.Address).parse(new Uint8Array(raw));
        return Array.isArray(parsed) ? parsed.map((v) => String(v)) : [];
    } catch {
        return [];
    }
}

function decodeU64(raw: number[]): bigint {
    return BigInt(bcs.u64().parse(new Uint8Array(raw)));
}

function formatAmount(raw: bigint, decimals: number): string {
    if (decimals <= 0) return raw.toString();
    const str = raw.toString().padStart(decimals + 1, "0");
    const intPart = str.slice(0, -decimals) || "0";
    let fracPart = str.slice(-decimals);
    fracPart = fracPart.replace(/0+$/, "");
    const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fracPart ? `${intWithCommas}.${fracPart}` : intWithCommas;
}

function formatNavPrice(navRaw: bigint, assetDecimals: number, stableDecimals: number): string | null {
    if (navRaw === 0n) return null;
    const displayPrecision = 6;
    const numerator = navRaw * 10n ** BigInt(assetDecimals + displayPrecision);
    const denominator = NAV_PRECISION * 10n ** BigInt(stableDecimals);
    if (denominator === 0n) return null;
    const scaled = numerator / denominator;
    const str = scaled.toString().padStart(displayPrecision + 1, "0");
    const intPart = str.slice(0, -displayPrecision) || "0";
    let fracPart = str.slice(-displayPrecision);
    fracPart = fracPart.replace(/0+$/, "");
    const intWithCommas = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return fracPart ? `${intWithCommas}.${fracPart}` : intWithCommas;
}

function getU64Field(fields: Record<string, unknown>, key: string): bigint {
    const v = fields[key];
    if (typeof v === "string") return BigInt(v);
    if (typeof v === "number") return BigInt(v);
    return 0n;
}

function getBoolField(fields: Record<string, unknown>, key: string): boolean {
    return fields[key] === true;
}

function getBalanceValue(fields: Record<string, unknown>, key: string): bigint {
    const v = fields[key];
    if (typeof v === "string") return BigInt(v);
    if (typeof v === "number") return BigInt(v);
    if (v && typeof v === "object" && "fields" in v) {
        const inner = (v as { fields: Record<string, unknown> }).fields;
        if ("value" in inner) {
            const val = inner.value;
            if (typeof val === "string") return BigInt(val);
            if (typeof val === "number") return BigInt(val);
        }
    }
    return 0n;
}

// ── data fetching ────────────────────────────────────────────────────────────

async function fetchOrders(
    suiClient: ReturnType<typeof useSuiClient>,
    dao: DAO,
): Promise<OrdersData> {
    const sdk = getSDKForDAO(dao);
    const packageRegistryId = sdk.sharedObjects.packageRegistry.id;
    const marketsCorePackageId = sdk.packages.futarchyMarketsCore;
    const futarchyCorePackageId = sdk.packages.futarchyCore;

    const poolId = dao.spot_pool_id;
    const lpType = dao.lp_type;
    if (!poolId || !lpType) return { orders: [] };

    const configType = `${futarchyCorePackageId}::futarchy_config::FutarchyConfig`;

    const tx = new Transaction();
    tx.moveCall({
        target: `${marketsCorePackageId}::protective_ask_registry::ask_ids`,
        arguments: [tx.object(dao.id), tx.object(packageRegistryId)],
    });
    tx.moveCall({
        target: `${marketsCorePackageId}::protective_bid_registry::bid_ids`,
        arguments: [tx.object(dao.id), tx.object(packageRegistryId)],
    });

    const inspectResult = await suiClient.devInspectTransactionBlock({
        sender: "0x0000000000000000000000000000000000000000000000000000000000000000",
        transactionBlock: tx,
    });

    const askIds = inspectResult.results?.[0]?.returnValues?.[0]?.[0]
        ? decodeVectorId(inspectResult.results[0].returnValues[0][0])
        : [];
    const bidIds = inspectResult.results?.[1]?.returnValues?.[0]?.[0]
        ? decodeVectorId(inspectResult.results[1].returnValues[0][0])
        : [];

    if (askIds.length === 0 && bidIds.length === 0) return { orders: [] };

    const allIds = [...askIds, ...bidIds];
    const objectResults = await suiClient.multiGetObjects({ ids: allIds, options: { showContent: true } });

    // NAV per wall
    const navTx = new Transaction();
    const navMap: { idx: number; wallId: string; side: "Ask" | "Bid" }[] = [];
    let ci = 0;
    for (const id of askIds) {
        navTx.moveCall({
            target: `${marketsCorePackageId}::protective_ask::calculate_nav`,
            typeArguments: [configType, dao.asset_type, dao.stable_type, lpType],
            arguments: [navTx.object(id), navTx.object(dao.id), navTx.object(packageRegistryId), navTx.object(poolId)],
        });
        navMap.push({ idx: ci++, wallId: id, side: "Ask" });
    }
    for (const id of bidIds) {
        navTx.moveCall({
            target: `${marketsCorePackageId}::protective_bid::calculate_nav`,
            typeArguments: [configType, dao.asset_type, dao.stable_type, lpType],
            arguments: [navTx.object(id), navTx.object(dao.id), navTx.object(packageRegistryId), navTx.object(poolId)],
        });
        navMap.push({ idx: ci++, wallId: id, side: "Bid" });
    }

    const navResults: Record<string, bigint> = {};
    if (navMap.length > 0) {
        try {
            const navInspect = await suiClient.devInspectTransactionBlock({
                sender: "0x0000000000000000000000000000000000000000000000000000000000000000",
                transactionBlock: navTx,
            });
            for (const { idx, wallId } of navMap) {
                const raw = navInspect.results?.[idx]?.returnValues?.[0]?.[0];
                if (raw) navResults[wallId] = decodeU64(raw);
            }
        } catch { /* ok */ }
    }

    const orders: OrderDisplay[] = [];
    for (let i = 0; i < askIds.length; i++) {
        const content = objectResults[i]?.data?.content;
        if (!content || content.dataType !== "moveObject") continue;
        const f = content.fields as Record<string, unknown>;
        const maxMint = getU64Field(f, "max_mint_amount");
        const minted = getU64Field(f, "minted_amount");
        orders.push({
            id: askIds[i], side: "Ask", active: getBoolField(f, "active"),
            remainingRaw: maxMint - minted, remainingDecimals: dao.asset_decimals,
            remainingSymbol: dao.asset_symbol || "ASSET",
            wallNavRaw: navResults[askIds[i]] ?? null, feeBps: null,
            mintedRaw: minted, maxMintRaw: maxMint,
        });
    }
    for (let i = 0; i < bidIds.length; i++) {
        const content = objectResults[askIds.length + i]?.data?.content;
        if (!content || content.dataType !== "moveObject") continue;
        const f = content.fields as Record<string, unknown>;
        orders.push({
            id: bidIds[i], side: "Bid", active: getBoolField(f, "active"),
            remainingRaw: getBalanceValue(f, "stable_vault"), remainingDecimals: dao.stable_decimals,
            remainingSymbol: dao.stable_symbol || "STABLE",
            wallNavRaw: navResults[bidIds[i]] ?? null,
            feeBps: Number(getU64Field(f, "base_fee_bps")),
        });
    }

    return { orders };
}

// ── component ────────────────────────────────────────────────────────────────

export function OrdersTab({ dao }: { dao: DAO }) {
    const suiClient = useSuiClient();
    const { data: coinMetadata } = useCoins();
    const protocolVersion = getProtocolVersionForDAO(dao);
    const isLegacyV2 = isLegacyV2DAO(dao);

    const stableSymbol = useMemo(() => {
        const meta = coinMetadata?.find((c) => c.coin_type === dao.stable_type);
        return meta?.symbol || dao.stable_symbol || "STABLE";
    }, [coinMetadata, dao.stable_type, dao.stable_symbol]);

    const { data, isLoading, error } = useQuery({
        queryKey: ["orders", dao.id, dao.spot_pool_id, protocolVersion],
        queryFn: () => fetchOrders(suiClient, dao),
        enabled: !!dao.spot_pool_id && !!dao.lp_type && !isLegacyV2,
        staleTime: 30_000,
        retry: 1,
    });

    if (!dao.spot_pool_id || !dao.lp_type || isLegacyV2) {
        return (
            <div className="glass-flow-panel rounded-lg p-4 text-sm text-text-muted">
                No spot pool configured for this organization.
            </div>
        );
    }

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-12">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (error) {
        return (
            <div className="glass-flow-panel rounded-lg p-4 text-sm text-error">
                Failed to load orders: {error instanceof Error ? error.message : "Unknown error"}
            </div>
        );
    }

    const activeOrders = data?.orders.filter((o) => o.active) ?? [];

    if (!data || activeOrders.length === 0) {
        return (
            <div className="glass-flow-panel flex items-center justify-center rounded-lg px-4 py-12 text-text-light">
                No bid or ask orders active for this organization.
            </div>
        );
    }

    // Only show active orders in the book — closed walls are removed from registries
    // on close, but the active flag may go false before cleanup.
    const asks = data.orders.filter((o) => o.side === "Ask" && o.active);
    const bids = data.orders.filter((o) => o.side === "Bid" && o.active);

    // Compute max remaining per side for depth bar scaling.
    // For asks remaining is in asset units, for bids in stable units — not directly
    // comparable, so we scale each side independently.
    const maxAskRemaining = asks.reduce((m, o) => (o.remainingRaw > m ? o.remainingRaw : m), 0n);
    const maxBidRemaining = bids.reduce((m, o) => (o.remainingRaw > m ? o.remainingRaw : m), 0n);

    const depthPct = (raw: bigint, max: bigint) => {
        if (max === 0n) return 0;
        // Minimum 8% so even tiny amounts show a sliver
        return Math.max(8, Number((raw * 100n) / max));
    };

    return (
        <div className="glass-flow-panel flex max-w-2xl flex-col gap-0 rounded-xl py-2">
            {/* Header row */}
            <div className="grid grid-cols-3 px-4 py-2 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                <span>Price ({stableSymbol})</span>
                <span className="text-right">Size</span>
                <span className="text-right">Fee</span>
            </div>

            {/* Asks — red, sorted highest price first (top) */}
            {asks.length > 0 && (
                <div className="flex flex-col">
                    {[...asks]
                        .sort((a, b) => {
                            const an = a.wallNavRaw ?? 0n;
                            const bn = b.wallNavRaw ?? 0n;
                            return bn > an ? 1 : bn < an ? -1 : 0;
                        })
                        .map((order) => {
                            const price = order.wallNavRaw != null
                                ? formatNavPrice(order.wallNavRaw, dao.asset_decimals, dao.stable_decimals)
                                : null;
                            const pct = depthPct(order.remainingRaw, maxAskRemaining);
                            return (
                                <div
                                    key={order.id}
                                    className="relative grid grid-cols-3 px-4 py-2 items-center"
                                >
                                    {/* depth bar */}
                                    <div
                                        className="absolute inset-y-0 right-0 bg-red-500/10"
                                        style={{ width: `${pct}%` }}
                                    />
                                    <span className="relative font-mono text-sm text-red-400 tabular-nums">
                                        {price ?? "\u2014"}
                                    </span>
                                    <div className="relative text-right">
                                        <span className="font-mono text-sm text-text-primary tabular-nums">
                                            {formatAmount(order.remainingRaw, order.remainingDecimals)}
                                        </span>
                                        <span className="text-[10px] text-text-muted ml-1">{order.remainingSymbol}</span>
                                        {order.maxMintRaw != null && order.mintedRaw != null && (
                                            <div className="text-[10px] text-text-muted">
                                                {formatAmount(order.mintedRaw, dao.asset_decimals)}/{formatAmount(order.maxMintRaw, dao.asset_decimals)} minted
                                            </div>
                                        )}
                                    </div>
                                    <span className="relative text-right font-mono text-xs text-text-muted tabular-nums">
                                        {"\u2014"}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            )}

            {/* Separator between asks and bids */}
            {asks.length > 0 && bids.length > 0 && (
                <div className="border-y border-border" />
            )}

            {/* Bids — green, sorted highest price first (top) */}
            {bids.length > 0 && (
                <div className="flex flex-col">
                    {[...bids]
                        .sort((a, b) => {
                            const an = a.wallNavRaw ?? 0n;
                            const bn = b.wallNavRaw ?? 0n;
                            return bn > an ? 1 : bn < an ? -1 : 0;
                        })
                        .map((order) => {
                            const price = order.wallNavRaw != null
                                ? formatNavPrice(order.wallNavRaw, dao.asset_decimals, dao.stable_decimals)
                                : null;
                            const pct = depthPct(order.remainingRaw, maxBidRemaining);
                            return (
                                <div
                                    key={order.id}
                                    className="relative grid grid-cols-3 px-4 py-2 items-center"
                                >
                                    {/* depth bar */}
                                    <div
                                        className="absolute inset-y-0 right-0 bg-green-500/10"
                                        style={{ width: `${pct}%` }}
                                    />
                                    <span className="relative font-mono text-sm text-green-400 tabular-nums">
                                        {price ?? "\u2014"}
                                    </span>
                                    <span className="relative text-right font-mono text-sm text-text-primary tabular-nums">
                                        {formatAmount(order.remainingRaw, order.remainingDecimals)}{" "}
                                        <span className="text-[10px] text-text-muted">{order.remainingSymbol}</span>
                                    </span>
                                    <span className="relative text-right font-mono text-xs text-text-muted tabular-nums">
                                        {order.feeBps != null ? `${(order.feeBps / 100).toFixed(2)}%` : "\u2014"}
                                    </span>
                                </div>
                            );
                        })}
                </div>
            )}
        </div>
    );
}
