import { useState, useMemo, type CSSProperties } from "react";
import { useCurrentAccount } from "@/lib/sui/dapp-kit-compat";
import { ChevronDown } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import { getOutcomeColor, hexToRgba } from "@/lib/outcomes";
import { useProposalTrades } from "@/hooks/api";
import { ExplorerLink } from "../../ExplorerLink";
import { Table, TableBody, TableRow, TableCell } from "../../Table";
import { Input } from "../../inputs/Input";
import { FilterGroup } from "../FilterButtons";
import { SortableTableHeader, type SortConfig } from "../SortableTableHeader";

type SortField = "time" | "price" | "volume" | "priceImpact";

interface RecentTradesProps {
    proposalId: string;
    proposer?: string | null;
    outcomeCount?: number;
}

function getTradeOutcomeStyle(outcomeIndex: number, totalOutcomes: number): CSSProperties {
    const normalizedOutcomeCount = Math.max(totalOutcomes, outcomeIndex + 1, 1);
    const color = getOutcomeColor(outcomeIndex, normalizedOutcomeCount, "normal");
    const lightColor = getOutcomeColor(outcomeIndex, normalizedOutcomeCount, "light");

    return {
        backgroundColor: hexToRgba(color, 0.16),
        borderColor: hexToRgba(color, 0.36),
        color: lightColor,
    };
}

export function RecentTrades({ proposalId, proposer, outcomeCount }: RecentTradesProps) {
    const account = useCurrentAccount();
    const { data, isLoading } = useProposalTrades(proposalId, 100, 0);
    const trades = useMemo(() => data?.trades ?? [], [data?.trades]);
    const totalOutcomes = useMemo(() => {
        const highestTradeOutcome = trades.reduce((max, trade) => Math.max(max, trade.outcome_index), -1);
        return Math.max(outcomeCount ?? 0, highestTradeOutcome + 1);
    }, [outcomeCount, trades]);

    const [searchTerm, setSearchTerm] = useState("");
    const [accountFilter, setAccountFilter] = useState<"All" | "My Trades" | "Proposer">("All");
    const [outcomeFilter, setOutcomeFilter] = useState<"All" | string>("All");
    const [typeFilter, setTypeFilter] = useState<"All" | "Buy" | "Sell">("All");
    const [sortConfig, setSortConfig] = useState<SortConfig<SortField>>({
        field: "time",
        direction: "descending",
    });

    const handleSort = (field: SortField) => {
        setSortConfig((current) => ({
            field,
            direction: current.field === field && current.direction === "descending" ? "ascending" : "descending",
        }));
    };

    // Get unique outcomes for filter
    const uniqueOutcomes = useMemo(() => {
        const outcomes = new Set(trades.map((t) => t.outcome));
        return Array.from(outcomes);
    }, [trades]);

    // Filter and sort trades
    const filteredAndSortedTrades = useMemo(() => {
        let filtered = trades;

        // Filter by outcome
        if (outcomeFilter !== "All") {
            filtered = filtered.filter((t) => t.outcome === outcomeFilter);
        }

        // Filter by type
        if (typeFilter !== "All") {
            filtered = filtered.filter((t) => t.type === typeFilter);
        }

        if (accountFilter === "My Trades") {
            const address = account?.address?.toLowerCase();
            filtered = address ? filtered.filter((t) => t.trader.toLowerCase() === address) : [];
        } else if (accountFilter === "Proposer") {
            const proposerAddress = proposer?.toLowerCase();
            filtered = proposerAddress ? filtered.filter((t) => t.trader.toLowerCase() === proposerAddress) : [];
        }

        // Filter by search term (address)
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(
                (t) => t.trader.toLowerCase().includes(term) || t.outcome.toLowerCase().includes(term)
            );
        }

        // Sort
        return [...filtered].sort((a, b) => {
            let aValue: string | number;
            let bValue: string | number;

            switch (sortConfig.field) {
                case "time":
                    aValue = a.time;
                    bValue = b.time;
                    break;
                case "price":
                    aValue = a.price;
                    bValue = b.price;
                    break;
                case "volume":
                    aValue = Number(a.volume);
                    bValue = Number(b.volume);
                    break;
                case "priceImpact":
                    aValue = a.priceImpact;
                    bValue = b.priceImpact;
                    break;
                default:
                    return 0;
            }

            if (typeof aValue === "string" && typeof bValue === "string") {
                return sortConfig.direction === "descending"
                    ? bValue.localeCompare(aValue)
                    : aValue.localeCompare(bValue);
            }

            return sortConfig.direction === "descending"
                ? (bValue as number) - (aValue as number)
                : (aValue as number) - (bValue as number);
        });
    }, [trades, sortConfig, outcomeFilter, typeFilter, accountFilter, account?.address, proposer, searchTerm]);

    // Format timestamp for display
    const formatTime = (isoTime: string) => {
        const date = new Date(isoTime);
        return date.toLocaleString("en-US", {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        });
    };

    if (isLoading) {
        return (
            <div className="px-4">
                <div className="flex items-center justify-center py-8">
                    <span className="text-text-tertiary">Loading trades...</span>
                </div>
            </div>
        );
    }

    return (
        <div className="px-4">
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold text-text-primary">Recent Trades</h3>
                <div className="flex items-center gap-3">
                    <Input
                        size="sm"
                        className="w-96"
                        placeholder="Search by address or outcome"
                        value={searchTerm}
                        onChange={(value) => setSearchTerm(value)}
                    />
                    <span className="text-sm text-text-light">{data?.total || 0} trades</span>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="flex flex-wrap gap-6 mb-4 text-sm">
                <FilterGroup
                    label="Account"
                    options={["All", "My Trades", "Proposer"] as const}
                    selected={accountFilter}
                    onChange={setAccountFilter}
                />

                <FilterGroup
                    label="Outcome"
                    options={["All", ...uniqueOutcomes] as const}
                    selected={outcomeFilter}
                    onChange={setOutcomeFilter}
                    variant="colored"
                    getColor={(option) => {
                        if (option.toLowerCase().includes("accept") || option.toLowerCase().includes("approve"))
                            return { bg: "bg-green-900/30", text: "text-green-400", border: "border-green-900/30" };
                        if (option.toLowerCase().includes("reject"))
                            return { bg: "bg-red-900/30", text: "text-red-400", border: "border-red-900/30" };
                        return null;
                    }}
                />

                <FilterGroup
                    label="Type"
                    options={["All", "Buy", "Sell"] as const}
                    selected={typeFilter}
                    onChange={setTypeFilter}
                    variant="colored"
                    getColor={(option) => {
                        if (option === "Buy") return { bg: "bg-green-900/30", text: "text-green-400" };
                        if (option === "Sell") return { bg: "bg-red-900/30", text: "text-red-400" };
                        return null;
                    }}
                />
            </div>

            {/* Table */}
            <Table>
                <SortableTableHeader
                    columns={[
                        { field: "time" as SortField, label: "Time", sortable: true },
                        { label: "Type", sortable: false },
                        { label: "Outcome", sortable: false },
                        { field: "price" as SortField, label: "Price", align: "right", sortable: true },
                        { field: "volume" as SortField, label: "Volume", align: "right", sortable: true },
                        { field: "priceImpact" as SortField, label: "Price Impact", align: "right", sortable: true },
                        { label: "Trader", align: "right", sortable: false },
                    ]}
                    sortConfig={sortConfig}
                    onSort={handleSort}
                />

                <TableBody>
                    {filteredAndSortedTrades.length === 0 ? (
                        <TableRow>
                            <TableCell colSpan={7} className="text-center py-8 text-text-tertiary">
                                No trades yet
                            </TableCell>
                        </TableRow>
                    ) : (
                        filteredAndSortedTrades.map((trade) => (
                            <TableRow key={trade.id} hover>
                                <TableCell className="text-text-tertiary">{formatTime(trade.time)}</TableCell>
                                <TableCell>
                                    <div className="inline-flex items-center gap-1 text-xs">
                                        <ChevronDown
                                            className={`w-3.5 h-3.5 ${trade.type === "Buy" ? "text-green-400 rotate-180" : "text-red-400"}`}
                                        />
                                        <span className={trade.type === "Buy" ? "text-green-400" : "text-red-400"}>
                                            {trade.type}
                                        </span>
                                    </div>
                                </TableCell>
                                <TableCell>
                                    <span
                                        className="inline-flex items-center gap-1.5 rounded-md border px-2.5 py-1 text-xs font-medium"
                                        style={getTradeOutcomeStyle(trade.outcome_index, totalOutcomes)}
                                    >
                                        {trade.outcome}
                                    </span>
                                </TableCell>
                                <TableCell align="right" className="text-text-primary">
                                    ${formatNumber(trade.price)}
                                </TableCell>
                                <TableCell align="right" className="text-text-primary">
                                    {formatNumber(Number(trade.volume) / Math.pow(10, data?.stable_decimals ?? 6))}
                                    <span className="text-xs text-text-tertiary"> {data?.stable_symbol ?? "USDC"}</span>
                                </TableCell>
                                <TableCell
                                    align="right"
                                    className={trade.priceImpact >= 0 ? "text-green-400" : "text-red-400"}
                                >
                                    {trade.priceImpact >= 0 ? "+" : ""}
                                    {formatNumber(trade.priceImpact)}%
                                </TableCell>
                                <TableCell align="right" className="flex items-center justify-end">
                                    <ExplorerLink id={trade.trader} type="address" />
                                </TableCell>
                            </TableRow>
                        ))
                    )}
                </TableBody>
            </Table>
        </div>
    );
}
