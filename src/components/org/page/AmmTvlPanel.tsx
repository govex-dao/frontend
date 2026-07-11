import { Loader2 } from "lucide-react";
import type { AmmTvlData } from "@/hooks/useAmmTvl";
import { formatUnits } from "@/lib/units";
import type { DAO } from "@/types";

interface AmmTvlPanelProps {
    dao: DAO;
    data?: AmmTvlData;
    isLoading: boolean;
    isError: boolean;
}

interface TvlTableRow {
    key: string;
    label: string;
    caption?: string;
    assetRaw: bigint;
    stableRaw: bigint;
    tvlStableRaw: bigint;
    emphasis?: boolean;
}

export function AmmTvlPanel({ dao, data, isLoading, isError }: AmmTvlPanelProps) {
    const assetSymbol = dao.asset_symbol || "Asset";
    const stableSymbol = dao.stable_symbol || "USDC";

    if (!dao.spot_pool_id) return null;

    return (
        <div className="glass-flow-panel rounded-xl p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                    <h2 className="text-lg font-semibold">AMM TVL</h2>
                    <p className="text-sm text-text-muted">
                        {data?.proposal.active ? "Spot plus live proposal max reserves" : "Spot AMM reserves"}
                    </p>
                </div>
                <div className="sm:text-right">
                    <p className="text-2xl font-bold tabular-nums">
                        {data ? formatStableValue(data.totalTvlStableRaw, dao.stable_decimals, stableSymbol) : "-"}
                    </p>
                    <p className="text-xs text-text-muted">
                        {data?.spotPriceFormatted
                            ? `$${data.spotPriceFormatted} / ${assetSymbol}`
                            : "Price unavailable"}
                    </p>
                </div>
            </div>

            {isLoading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                </div>
            ) : isError || !data ? (
                <p className="py-6 text-sm text-text-muted">AMM TVL unavailable.</p>
            ) : (
                <AmmTvlTable
                    data={data}
                    assetDecimals={dao.asset_decimals}
                    stableDecimals={dao.stable_decimals}
                    assetSymbol={assetSymbol}
                    stableSymbol={stableSymbol}
                />
            )}
        </div>
    );
}

function AmmTvlTable({
    data,
    assetDecimals,
    stableDecimals,
    assetSymbol,
    stableSymbol,
}: {
    data: AmmTvlData;
    assetDecimals: number;
    stableDecimals: number;
    assetSymbol: string;
    stableSymbol: string;
}) {
    const rows: TvlTableRow[] = [
        {
            key: "spot",
            label: "Spot AMM",
            caption: "counted",
            assetRaw: data.spot.assetRaw,
            stableRaw: data.spot.stableRaw,
            tvlStableRaw: data.spot.tvlStableRaw,
            emphasis: true,
        },
    ];

    if (data.proposal.active) {
        rows.push({
            key: "proposal-max",
            label: "Live proposal max",
            caption: "counted",
            assetRaw: data.proposal.assetRaw,
            stableRaw: data.proposal.stableRaw,
            tvlStableRaw: data.proposal.tvlStableRaw,
            emphasis: true,
        });

        for (const pool of data.proposal.pools) {
            const outcome = pool.outcomeIdx === null ? "?" : String(pool.outcomeIdx);
            rows.push({
                key: pool.poolId ?? `outcome-${outcome}`,
                label: `Outcome ${outcome} AMM`,
                caption: "not summed",
                assetRaw: pool.asset,
                stableRaw: pool.stable,
                tvlStableRaw: pool.tvlStableRaw,
            });
        }
    }

    return (
        <div className="mt-5 overflow-x-auto">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-border-light">
                        <th className="py-2 pr-4 text-left text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                            Source
                        </th>
                        <th className="py-2 px-4 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                            {assetSymbol}
                        </th>
                        <th className="py-2 px-4 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                            {stableSymbol}
                        </th>
                        <th className="py-2 pl-4 text-right text-[10px] font-semibold uppercase tracking-wider text-text-muted">
                            TVL
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => (
                        <tr key={row.key} className="border-b border-border-light last:border-b-0">
                            <td className="py-3 pr-4">
                                <p
                                    className={
                                        row.emphasis ? "font-medium text-text-primary" : "text-sm text-text-light"
                                    }
                                >
                                    {row.label}
                                </p>
                                {row.caption && <p className="text-xs text-text-muted">{row.caption}</p>}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-sm text-text-primary">
                                {formatTokenAmount(row.assetRaw, assetDecimals)} {assetSymbol}
                            </td>
                            <td className="py-3 px-4 text-right font-mono text-sm text-text-primary">
                                {formatTokenAmount(row.stableRaw, stableDecimals)} {stableSymbol}
                            </td>
                            <td className="py-3 pl-4 text-right font-mono text-sm font-medium text-text-primary">
                                {formatStableValue(row.tvlStableRaw, stableDecimals, stableSymbol)}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

function formatTokenAmount(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals, {
        maxFractionDigits: Math.min(decimals, 4),
    });
}

function formatStableValue(amount: bigint, decimals: number, symbol: string): string {
    const formatted = formatUnits(amount, decimals, {
        maxFractionDigits: Math.min(decimals, 2),
    });
    return symbol.toUpperCase() === "USDC" ? `$${formatted}` : `${formatted} ${symbol}`;
}
