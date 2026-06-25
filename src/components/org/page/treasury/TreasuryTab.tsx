import { useState } from "react";
import type { Org } from "@/types/Org";
import { Card, CardContent } from "@/components/Card";
import { TreasuryChart } from "@/components/org/page/treasury/TreasuryChart";
import { formatNumber } from "@/lib/formatNumber";
import { MetricItem } from "@/components/MetricItem";
import { Table, TableHead, TableBody, TableRow, TableHeaderCell, TableCell } from "@/components/Table";
import { ExplorerLink } from "@/components/ExplorerLink";
import { CoinAvatar } from "@/components/CoinAvatar";
import { useTreasuryHoldings, type TreasuryHolding } from "@/hooks/api";

function HoldingsTable({ holdings, isLoading }: { holdings?: TreasuryHolding[]; isLoading: boolean }) {
    if (isLoading) {
        return <p className="text-text-muted text-sm py-8 text-center">Loading treasury balances...</p>;
    }

    if (!holdings || holdings.length === 0) {
        return <p className="text-text-muted text-sm py-8 text-center">No treasury holdings found</p>;
    }

    return (
        <Table>
            <TableHead>
                <TableRow>
                    <TableHeaderCell>Asset</TableHeaderCell>
                    <TableHeaderCell align="right">Balance</TableHeaderCell>
                </TableRow>
            </TableHead>
            <TableBody>
                {holdings.map((holding) => (
                    <TableRow key={holding.coinType} hover>
                        <TableCell>
                            <div className="flex items-center gap-3">
                                <CoinAvatar
                                    coinType={holding.coinType}
                                    symbol={holding.symbol}
                                    iconUrl={holding.logo}
                                    size="lg"
                                />
                                <div>
                                    <p className="font-medium">{holding.token}</p>
                                    <p className="text-xs text-text-muted">{holding.symbol}</p>
                                </div>
                            </div>
                        </TableCell>
                        <TableCell align="right">
                            <span className="font-mono font-medium text-white">{formatNumber(holding.balance)}</span>
                        </TableCell>
                    </TableRow>
                ))}
            </TableBody>
        </Table>
    );
}

interface TreasuryTabProps {
    org: Org;
}

const TreasuryMetricCard = ({ org }: { org: Org }) => (
    <Card variant="glass" className="glass-flow-panel-accent min-w-[280px] h-full rounded-2xl overflow-hidden relative">
        <div className="absolute inset-0 engineering-grid engineering-grid-fade pointer-events-none opacity-40" />
        <CardContent className="flex flex-col gap-4 h-full relative z-10 justify-between">
            <div className="flex flex-col gap-2">
                <MetricItem size="3xl" label="Total Value" value={`$${formatNumber(org.treasuryValue)}`} />
            </div>
            <div className="grid grid-cols-2 gap-4">
                <MetricItem size="lg" label="Revenue" value={org.monthlyRevenue > 0 ? `$${formatNumber(org.monthlyRevenue / 1000)}k` : "\u2014"} />
                <MetricItem size="lg" label="Allowance" value={org.monthlyAllowance > 0 ? `$${formatNumber(org.monthlyAllowance / 1000)}k` : "\u2014"} />
            </div>
        </CardContent>
    </Card>
);

export function TreasuryTab({ org }: TreasuryTabProps) {
    const [treasuryCardIndex, setTreasuryCardIndex] = useState(0);
    const { data: holdings, isLoading } = useTreasuryHoldings(org.id);

    return (
        <div className="flex flex-col gap-2 sm:gap-6">
            <h4>Treasury</h4>

            <div className="md:hidden -mx-4">
                <div
                    className="flex gap-4 overflow-x-auto snap-x snap-mandatory px-4 scrollbar-hide pb-2"
                    onScroll={(e) => {
                        const scrollLeft = e.currentTarget.scrollLeft;
                        const cardWidth = e.currentTarget.clientWidth;
                        const index = Math.round(scrollLeft / cardWidth);
                        setTreasuryCardIndex(index);
                    }}
                >
                    <div className="min-w-[calc(100vw-2rem)] snap-center shrink-0">
                        <TreasuryMetricCard org={org} />
                    </div>
                    <div className="min-w-[calc(100vw-2rem)] snap-center shrink-0 flex">
                        <TreasuryChart treasuryValue={org.treasuryValue} />
                    </div>
                </div>
                <div className="flex justify-center gap-2 mt-4">
                    <div
                        className={`w-2 h-2 rounded-full transition-colors ${treasuryCardIndex === 0 ? "bg-primary" : "bg-border"}`}
                    />
                    <div
                        className={`w-2 h-2 rounded-full transition-colors ${treasuryCardIndex === 1 ? "bg-primary" : "bg-border"}`}
                    />
                </div>
            </div>

            <div className="hidden md:flex gap-4 flex-wrap h-[260px]">
                <TreasuryMetricCard org={org} />
                <div className="min-w-[320px] h-full flex-1">
                    <TreasuryChart treasuryValue={org.treasuryValue} />
                </div>
            </div>

            <div className="flex flex-col gap-4">
                <HoldingsTable holdings={holdings} isLoading={isLoading} />
            </div>

            {org.treasuryAddress && (
                <div className="flex justify-center pt-2">
                    <ExplorerLink id={org.treasuryAddress} type="object" />
                </div>
            )}
        </div>
    );
}
