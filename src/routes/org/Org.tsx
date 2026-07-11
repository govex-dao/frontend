import { useParams, useSearchParams } from "react-router";
import { Helmet } from "react-helmet-async";
import { StarIcon, Loader2, Wallet, Coins } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { NotFound } from "@/components/navigation/NotFound";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { SidebarNav, type SidebarNavItem } from "@/components/navigation/SidebarNav";
import { AmmTvlPanel } from "@/components/org/page/AmmTvlPanel";
import { ProposalsTab } from "@/components/org/page/ProposalsTab";
import { SpotSwapCard } from "@/components/org/page/SpotSwapCard";
import { OrdersTab } from "@/components/org/page/OrdersTab";
import { VerifiedBadge } from "@/components/badges/VerifiedBadge";
import { Button } from "@/components/inputs/Button";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
import { useFavorites } from "@/hooks/useFavorites";
import { useSpotPrice } from "@/hooks/useSpotPrice";
import { useDAO, useDAOProposalsDisplay, useCoins } from "@/hooks/api";
import { useMultisigVaultBalances } from "@/hooks/useMultisig";
import { DepositModal } from "@/components/multisig/DepositModal";
import { CoinAvatar } from "@/components/CoinAvatar";
import { RaiseActionSections } from "@/components/raise/ActionSections";
import { useMergedCoinMetadata } from "@/hooks/useOnChainCoinMetadata";
import { getProtocolVersionForDAO } from "@/lib/sdk";
import { formatUnits, normalizeUnitsForSort } from "@/lib/units";
import { toDAODisplay, type DAO, type DAODisplay } from "@/types";
import type { VaultCoinBalance } from "@/lib/sui/multisig";
import type { CoinMetadata } from "@/lib/api/coins";

interface OrgHeaderProps {
    dao: DAODisplay;
    isFavorited: boolean;
    onToggleFavorite: () => void;
}

const COMPACT_ID_EDGE_CHARS = 4;

function compactMiddle(value: string, edgeChars = COMPACT_ID_EDGE_CHARS): string {
    const text = value.trim();
    if (text.length <= edgeChars * 2 + 3) return text;
    return `${text.slice(0, edgeChars)}...${text.slice(-edgeChars)}`;
}

function OrgIdentifier({
    label,
    value,
    copyLabel,
    toastMessage,
}: {
    label: string;
    value: string;
    copyLabel: string;
    toastMessage: string;
}) {
    return (
        <div className="min-w-0">
            <p className="text-text-muted">{label}</p>
            <CopyableAddress
                address={value}
                displayText={compactMiddle(value)}
                className="mt-1 text-sm"
                textClassName="font-medium tabular-nums text-text-primary"
                copyLabel={copyLabel}
                toastMessage={toastMessage}
            />
        </div>
    );
}

function OrgInfo({
    dao,
    daoRaw,
    spotPriceFormatted,
}: {
    dao: DAODisplay;
    daoRaw: DAO;
    spotPriceFormatted?: string | null;
}) {
    const daoAccountId = daoRaw.id;

    return (
        <div className="glass-flow-panel rounded-xl p-6">
            <div className="mb-4">
                <h3 className="text-lg font-semibold mb-1">{dao.name}</h3>
                <p className="text-text-muted text-sm">{dao.description || "No description"}</p>
            </div>
            <div className="space-y-4">
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
                    {spotPriceFormatted && (
                        <div>
                            <p className="text-text-muted">{dao.assetSymbol || "Asset"} Price</p>
                            <p className="font-medium tabular-nums">${spotPriceFormatted}</p>
                        </div>
                    )}
                    <div>
                        <p className="text-text-muted">Decisions</p>
                        <p className="font-medium">{dao.proposalCount}</p>
                    </div>
                    <div>
                        <p className="text-text-muted">Created</p>
                        <p className="font-medium">
                            {dao.createdAt.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                        </p>
                    </div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 border-t border-border-light pt-4 text-sm">
                    <OrgIdentifier
                        label="Asset Type"
                        value={daoRaw.asset_type}
                        copyLabel="Copy asset type"
                        toastMessage="Asset type copied"
                    />
                    <OrgIdentifier
                        label="DAO Account ID"
                        value={daoAccountId}
                        copyLabel="Copy DAO account ID"
                        toastMessage="DAO account ID copied"
                    />
                </div>
            </div>
        </div>
    );
}

function OrgHeader({ dao, isFavorited, onToggleFavorite }: OrgHeaderProps) {
    const [imgError, setImgError] = useState(false);

    return (
        <div className="p-4 space-y-3 relative">
            <div className="absolute top-4 right-4 flex items-center gap-2">
                <Button
                    variant="outline"
                    square
                    size="sm"
                    onClick={onToggleFavorite}
                    className="hover:bg-card-elevated"
                >
                    <StarIcon
                        className={`w-4 h-4 transition-all ${isFavorited ? "text-yellow-400 fill-yellow-400" : "fill-none"}`}
                    />
                </Button>
            </div>

            <div className="flex items-center gap-3 pr-10">
                <div className="size-14 shrink-0 rounded-xl overflow-hidden bg-background border border-border shadow-md">
                    {dao.iconUrl && !imgError ? (
                        <img
                            src={dao.iconUrl}
                            alt={`${dao.name} logo`}
                            className="w-full h-full object-cover"
                            onError={() => setImgError(true)}
                        />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-xl font-bold bg-gradient-to-br from-primary/80 to-primary text-white">
                            {dao.name[0]}
                        </div>
                    )}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex flex-col items-start gap-1">
                        <h1 className="text-2xl font-bold truncate">{dao.name}</h1>
                        {dao.verified && <VerifiedBadge variant="full" />}
                    </div>
                </div>
            </div>
        </div>
    );
}

type TabType = "overview" | "proposals" | "trade" | "orders";

function OrgVaultHoldings({
    balances,
    coins,
    isLoading,
}: {
    balances?: VaultCoinBalance[];
    coins?: CoinMetadata[];
    isLoading: boolean;
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (!balances || balances.length === 0) {
        return <p className="text-text-muted text-sm py-4">No coins in vaults.</p>;
    }

    // Aggregate by coinType across vaults
    const map = new Map<string, { amount: bigint; vaults: Set<string> }>();
    for (const b of balances) {
        const entry = map.get(b.coinType) ?? { amount: 0n, vaults: new Set<string>() };
        entry.amount += b.amount;
        entry.vaults.add(b.vaultName);
        map.set(b.coinType, entry);
    }

    const rows = Array.from(map.entries())
        .map(([coinType, { amount, vaults }]) => {
            const meta = coins?.find((c) => c.coin_type === coinType);
            return {
                coinType,
                symbol: meta?.symbol ?? coinType.split("::").pop() ?? "???",
                name: meta?.name ?? coinType.split("::").pop() ?? "Unknown",
                iconUrl: meta?.icon_url ?? null,
                decimals: meta?.decimals ?? 9,
                amount,
                vaults: Array.from(vaults).sort(),
            };
        })
        .sort((a, b) => {
            const aVal = normalizeUnitsForSort(a.amount, a.decimals);
            const bVal = normalizeUnitsForSort(b.amount, b.decimals);
            return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        });

    return (
        <div className="glass-flow-panel overflow-x-auto rounded-xl">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border bg-white/[0.035]">
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Asset
                        </th>
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Vaults
                        </th>
                        <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Balance
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const formatted = formatUnits(row.amount, row.decimals, {
                            maxFractionDigits: Math.min(row.decimals, 9),
                        });
                        return (
                            <tr
                                key={row.coinType}
                                className="border-b border-border last:border-b-0 hover:bg-card-elevated/50 transition-colors"
                            >
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                        <CoinAvatar
                                            coinType={row.coinType}
                                            symbol={row.symbol}
                                            iconUrl={row.iconUrl}
                                            size="lg"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-text-primary">{row.name}</p>
                                            <p className="text-xs text-text-muted">{row.symbol}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="flex gap-1.5 flex-wrap">
                                        {row.vaults.map((v) => (
                                            <span
                                                key={v}
                                                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                                            >
                                                {v}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className="font-mono font-medium text-text-primary">{formatted}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function OrgCreationActions({ daoRaw }: { daoRaw: DAO }) {
    const actionContext = {
        assetType: daoRaw.asset_type,
        stableType: daoRaw.stable_type,
        assetSymbol: daoRaw.asset_symbol,
        stableSymbol: daoRaw.stable_symbol,
        assetDecimals: daoRaw.asset_decimals,
        stableDecimals: daoRaw.stable_decimals,
    };

    return (
        <RaiseActionSections
            title="DAO creation actions"
            sections={[
                {
                    title: "Launch actions",
                    caption: daoRaw.init_execution_at ? "Executed" : "Staged at creation",
                    actions: daoRaw.init_actions,
                },
            ]}
            context={actionContext}
        />
    );
}

export function Org() {
    const { orgId } = useParams<{ orgId: string }>();
    const [searchParams, setSearchParams] = useSearchParams();
    const [showLeftFade, setShowLeftFade] = useState(false);
    const [showRightFade, setShowRightFade] = useState(true);
    const activeTab = (searchParams.get("tab") as TabType) || "overview";
    const isOverviewTab = activeTab === "overview";

    const { data: daoRaw, isLoading: daoLoading, error: daoError } = useDAO(orgId);
    const dao = useMemo(() => (daoRaw ? toDAODisplay(daoRaw) : undefined), [daoRaw]);
    const effectiveOrgId = daoRaw?.id ?? orgId;
    const canonicalOrgId = daoRaw?.canonical_uuid ?? null;
    const { data: proposals, isLoading: proposalsLoading } = useDAOProposalsDisplay(
        effectiveOrgId,
        canonicalOrgId,
        activeTab === "proposals"
    );

    const { data: vaultBalances, isLoading: vaultBalancesLoading } = useMultisigVaultBalances(effectiveOrgId, {
        enabled: isOverviewTab,
    });
    const { data: backendCoins } = useCoins({ enabled: isOverviewTab });
    const vaultCoinTypes = useMemo(() => (vaultBalances ?? []).map((b) => b.coinType), [vaultBalances]);
    const coinMetadata = useMergedCoinMetadata(vaultCoinTypes, backendCoins);
    const [showDepositModal, setShowDepositModal] = useState(false);

    // Reset ephemeral UI state when navigating between orgs
    useEffect(() => {
        setShowDepositModal(false);
        setShowLeftFade(false);
        setShowRightFade(true);
    }, [orgId]);

    const { data: spotPrice } = useSpotPrice(daoRaw, isOverviewTab || activeTab === "trade");
    const protocolVersion = getProtocolVersionForDAO(daoRaw);
    const { isFavorited, toggleFavorite } = useFavorites();
    const setActiveTab = (tab: TabType) => setSearchParams({ tab });
    const handleNavItemClick = (id: string) => setActiveTab(id as TabType);

    const mainNavItems: SidebarNavItem[] = useMemo(
        () => [
            { id: "overview", label: "Overview" },
            { id: "proposals", label: "Decisions" },
            { id: "trade", label: "Trade spot" },
            { id: "orders", label: "Orders" },
        ],
        []
    );

    if (daoLoading) {
        return (
            <div className="route-container h-full flex items-center justify-center">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    if (daoError || !dao || !daoRaw) {
        return <NotFound name="Organization" />;
    }

    return (
        <div className="route-container h-full flex flex-col gap-3 scrollbar-gutter-stable">
            <Helmet>
                <title>{dao.name}</title>
            </Helmet>
            <Breadcrumbs
                items={[{ label: "Home", href: "/" }, { label: "Orgs", href: "/orgs" }, { label: dao.name }]}
            />

            <div className="glass-flow-panel flex flex-col rounded-xl -mx-2 overflow-hidden md:mx-0 md:h-[calc(100vh-7rem)] md:flex-row">
                {/* Mobile Header */}
                <div className="shrink-0 border-b border-border-light bg-transparent md:hidden">
                    <OrgHeader
                        dao={dao}
                        isFavorited={isFavorited(dao.id)}
                        onToggleFavorite={() => toggleFavorite(dao.id)}
                    />

                    <div className="relative border-t border-border">
                        {showLeftFade && (
                            <div className="absolute left-0 top-0 bottom-0 w-8 bg-linear-to-r from-primary/20 to-transparent pointer-events-none z-10 transition-opacity duration-200" />
                        )}
                        {showRightFade && (
                            <div className="absolute right-0 top-0 bottom-0 w-8 bg-linear-to-l from-primary/20 to-transparent pointer-events-none z-10 transition-opacity duration-200" />
                        )}

                        <div
                            className="flex py-2 px-1 overflow-x-auto scrollbar-hide snap-x snap-mandatory"
                            onScroll={(e) => {
                                const target = e.currentTarget;
                                const scrollLeft = target.scrollLeft;
                                const maxScroll = target.scrollWidth - target.clientWidth;
                                setShowLeftFade(scrollLeft > 5);
                                setShowRightFade(scrollLeft < maxScroll - 5);
                            }}
                        >
                            {mainNavItems.map((item) => (
                                <button
                                    key={item.id}
                                    onClick={() => handleNavItemClick(item.id)}
                                    className={`px-4 py-2 text-sm font-medium rounded-lg whitespace-nowrap transition-colors snap-center shrink-0 ${
                                        activeTab === item.id
                                            ? "bg-primary text-white"
                                            : "text-text-muted hover:bg-card-elevated hover:text-text-light"
                                    }`}
                                >
                                    {item.label}
                                </button>
                            ))}
                        </div>
                    </div>
                </div>

                {/* Desktop Sidebar */}
                <div className="hidden md:block md:w-72 shrink-0 h-full overflow-hidden">
                    <div className="h-full overflow-hidden rounded-l-xl border-r border-border-light bg-white/[0.025] shadow-lg flex flex-col">
                        <OrgHeader
                            dao={dao}
                            isFavorited={isFavorited(dao.id)}
                            onToggleFavorite={() => toggleFavorite(dao.id)}
                        />

                        <div className="border-t border-border-light shrink-0" />

                        <div className="flex-1 overflow-y-auto">
                            <SidebarNav
                                className="bg-transparent"
                                items={mainNavItems}
                                activeItem={activeTab}
                                onItemClick={handleNavItemClick}
                            />
                        </div>
                    </div>
                </div>

                <div className="flex flex-col flex-1 gap-3 min-w-0 p-4 md:p-8 lg:p-5 xl:p-8 2xl:p-10 relative h-full overflow-y-auto">
                    {activeTab === "overview" && (
                        <div className="flex flex-col gap-6">
                            <OrgInfo dao={dao} daoRaw={daoRaw} spotPriceFormatted={spotPrice?.formatted} />

                            <AmmTvlPanel dao={daoRaw} />

                            <OrgCreationActions daoRaw={daoRaw} />

                            {/* Vault Holdings */}
                            <div>
                                <div className="flex items-center justify-between mb-3">
                                    <h2 className="text-lg font-semibold flex items-center gap-2">
                                        <Coins className="w-5 h-5 text-primary" />
                                        Vault Holdings
                                    </h2>
                                    <button
                                        onClick={() => setShowDepositModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors"
                                    >
                                        <Wallet className="w-3.5 h-3.5" />
                                        Deposit
                                    </button>
                                </div>
                                <OrgVaultHoldings
                                    balances={vaultBalances}
                                    coins={coinMetadata}
                                    isLoading={vaultBalancesLoading}
                                />
                            </div>
                        </div>
                    )}

                    {activeTab === "proposals" && (
                        <>
                            {proposalsLoading ? (
                                <div className="flex items-center justify-center py-24">
                                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                                </div>
                            ) : (
                                <ProposalsTab proposals={proposals || []} />
                            )}
                        </>
                    )}

                    {activeTab === "trade" && (
                        <div className="flex flex-col gap-4 max-w-lg">
                            {spotPrice?.formatted && (
                                <div className="flex items-baseline gap-2">
                                    <span className="text-2xl font-bold tabular-nums">${spotPrice.formatted}</span>
                                    <span className="text-sm text-text-muted">per {dao.assetSymbol || "Asset"}</span>
                                </div>
                            )}
                            <SpotSwapCard dao={daoRaw} />
                        </div>
                    )}

                    {activeTab === "orders" && <OrdersTab dao={daoRaw} />}
                </div>
            </div>

            {effectiveOrgId && (
                <DepositModal
                    isOpen={showDepositModal}
                    onClose={() => setShowDepositModal(false)}
                    accountId={effectiveOrgId}
                    accountType="futarchy"
                    protocolVersion={protocolVersion}
                />
            )}
        </div>
    );
}
