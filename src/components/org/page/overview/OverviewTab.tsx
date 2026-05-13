import { Vote, Droplets, HandCoins, Vault } from "lucide-react";
import { useNavigate } from "react-router";
import { OverviewCard } from "@/components/org/page/overview/OverviewCard";
import { TokenPriceChart } from "@/components/org/page/overview/TokenPriceChart";
import { ExplorerLink } from "@/components/ExplorerLink";
import { formatNumber } from "@/lib/formatNumber";
import type { Org, Raise, Pool } from "@/types";
import { LiveChip } from "@/components/badges/LiveChip";
import { MetricItem } from "@/components/MetricItem";

interface OverviewTabProps {
    org: Org;
    pool?: Pool;
    raise?: Raise;
    setActiveTab: (tab: string) => void;
}

export function OverviewTab({ org, pool, raise, setActiveTab }: OverviewTabProps) {
    const navigate = useNavigate();
    const hasActiveProposal = org.proposals?.some((p) => p.status === "active");
    const proposalsCount = org.proposals?.length || 0;

    return (
        <div className="flex flex-col gap-4 sm:gap-6 flex-1 h-full">
            <div className="relative -mx-4 md:-mx-8 lg:-mx-5 xl:-mx-10 2xl:-mx-12 -mt-4 md:-mt-8 lg:-mt-5 xl:-mt-10 2xl:-mt-12 bg-linear-to-br from-card-more-elevated to-card-elevated">
                <div className="relative px-4 md:px-8 lg:px-12 pt-6 md:pt-8 pb-6 md:pb-8 space-y-1">
                    <p className="text-sm text-text-muted/60 font-medium">
                        Created{" "}
                        {org.createdAt.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </p>
                    <p className="text-text-secondary text-base leading-relaxed max-w-4xl">{org.description}</p>
                </div>
            </div>

            <div
                className={`grid gap-2 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 ${raise ? "xl:grid-cols-4" : "xl:grid-cols-3"}`}
            >
                <OverviewCard
                    title="Activity"
                    icon={Vote}
                    mainMetricLabel="Total Markets"
                    mainMetricValue={proposalsCount}
                    clickable
                    onClick={() => setActiveTab("proposals")}
                    badge={hasActiveProposal && <LiveChip label="Live" size="small" color="blue" />}
                    secondaryMetrics={[
                        { label: "Volume", value: pool?.tvl ? `$${formatNumber(pool.tvl)}` : "—" },
                    ]}
                />
                <OverviewCard
                    title="Treasury"
                    icon={Vault}
                    mainMetricLabel="Total Value"
                    mainMetricValue={`$${formatNumber(org.treasuryValue)}`}
                    clickable
                    onClick={() => setActiveTab("treasury")}
                    className="h-full"
                    secondaryMetrics={[
                        { label: "Revenue", value: `$${formatNumber(org.monthlyRevenue)}` },
                        { label: "Allowance", value: `$${formatNumber(org.monthlyAllowance)}` },
                    ]}
                />

                <OverviewCard
                    title="Liquidity"
                    icon={Droplets}
                    mainMetricLabel="TVL"
                    mainMetricValue={`$${formatNumber(pool?.tvl || 0)}`}
                    clickable
                    onClick={() => setActiveTab("liquidity")}
                    secondaryMetrics={[
                        { label: pool?.stableCurrency || "USDC", value: formatNumber(pool?.totalStable || 0) },
                        { label: pool?.assetCurrency || "GOVEX", value: formatNumber(pool?.totalAsset || 0) },
                    ]}
                />
                {raise && (
                    <OverviewCard
                        title="Raise"
                        icon={HandCoins}
                        mainMetricLabel="Total Raised"
                        mainMetricValue={`$${formatNumber(Number(raise?.raised || 0))}`}
                        clickable
                        onClick={() => navigate(`/raises/${raise?.id}`)}
                    />
                )}
            </div>

            <div className="relative bg-linear-to-br from-card-elevated to-card border border-primary/10 rounded-2xl flex-1 flex">
                <div className="absolute inset-0 bg-linear-to-br from-primary/[0.06] via-blue-500/[0.03] to-transparent pointer-events-none" />
                <div className="absolute inset-0 bg-linear-to-tr from-transparent via-blue-300/[0.03] to-transparent pointer-events-none" />
                <div className="relative flex flex-row flex-wrap gap-4 flex-1">
                    <div className="flex flex-col gap-6 md:w-[280px] shrink-0 p-4 md:p-6">
                        <div className="space-y-2">
                            <p className="text-sm font-medium text-text-muted">${pool?.assetCurrency || "GOVEX"}</p>
                            {org.tokenPrice > 0 ? (
                                <p className="text-4xl font-bold tracking-tight">${formatNumber(org.tokenPrice)}</p>
                            ) : (
                                <div className="space-y-1">
                                    <div className="text-4xl font-bold tracking-tight text-text-muted/30">$0.0000</div>
                                    <p className="text-xs text-text-muted/40 italic">Price data unavailable</p>
                                </div>
                            )}
                        </div>
                        <div className="flex items-start flex-1">
                            <ExplorerLink id={org.tokenAddress} type="object" />
                        </div>
                        <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border/50">
                            <MetricItem label="Market Cap" value={`$${formatNumber(org.marketCap)}`} size="lg" />
                            <MetricItem label="Holders" value={formatNumber(org.holders)} size="lg" />
                        </div>
                    </div>
                    <div className="flex-1 -m-px bg-card-elevated min-w-[320px]">
                        <TokenPriceChart />
                    </div>
                </div>
            </div>
        </div>
    );
}
