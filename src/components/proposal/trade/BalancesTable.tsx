import type { ReactNode } from "react";
import { getOutcomeClass, getOutcomeColor } from "@/lib/outcomes";
import { formatNumber } from "@/lib/formatNumber";
import { OutcomeBadge } from "../OutcomeBadge";

interface Balance {
    message: string;
    tokenBalance?: number;
    usdcBalance?: number;
}

interface Props {
    balances: Balance[];
    totalOutcomes: number;
    selectedOutcome?: number;
    title?: ReactNode | string;
    dimAll?: boolean;
    getOriginalIndex?: (index: number) => number;
    className?: string;
    onOutcomeClick?: (index: number) => void;
}

export function BalancesTable(props: Props) {
    const {
        balances,
        totalOutcomes,
        selectedOutcome,
        title,
        dimAll = false,
        getOriginalIndex,
        className = "",
        onOutcomeClick,
    } = props;

    const headerClass = "text-[9px] uppercase tracking-wide font-medium opacity-40";
    return (
        <table className={`w-full ${className}`}>
            <thead>
                <tr>
                    {title && <th className={headerClass + " text-left"}>{title}</th>}
                    <th className={headerClass + " text-right"}>TOKEN</th>
                    <th className={headerClass + " text-right"}>USDC</th>
                </tr>
            </thead>
            <tbody>
                {balances.map((balance, index) => {
                    const originalIndex = getOriginalIndex ? getOriginalIndex(index) : index;
                    const outcomeClass = getOutcomeClass(originalIndex, totalOutcomes, "normal");
                    const isSelected = selectedOutcome !== undefined && index === selectedOutcome;
                    const outcomeColor = getOutcomeColor(originalIndex, totalOutcomes, "normal");
                    const dimmed = dimAll || (selectedOutcome !== undefined && !isSelected);

                    return (
                        <tr
                            key={index}
                            onClick={() => onOutcomeClick?.(originalIndex)}
                            className={`border-b border-border/20 last:border-0 transition-all duration-200 ${isSelected ? "bg-card-elevated" : "hover:bg-card-elevated/50"} ${onOutcomeClick ? "cursor-pointer" : ""}`}
                        >
                            <td
                                className={`py-2 px-3 border-l-2 transition-all duration-200 ${isSelected ? "" : "pl-0"} ${onOutcomeClick ? "cursor-pointer" : ""}`}
                                style={{
                                    borderLeftColor: isSelected
                                        ? outcomeColor
                                        : onOutcomeClick
                                          ? "var(--color-border)"
                                          : "transparent",
                                }}
                            >
                                <OutcomeBadge
                                    outcomeName={balance.message}
                                    outcomeClass={outcomeClass}
                                    dimmed={dimmed}
                                />
                            </td>
                            <td className={`text-right transition-all duration-200 ${dimmed ? "opacity-50" : ""}`}>
                                <span className="font-mono text-xs">{formatNumber(balance.tokenBalance || 0)}</span>
                            </td>
                            <td className={`text-right transition-all pl-3 duration-200 ${dimmed ? "opacity-50" : ""}`}>
                                <span className="font-mono text-xs">{formatNumber(balance.usdcBalance || 0)}</span>
                            </td>
                        </tr>
                    );
                })}
            </tbody>
        </table>
    );
}
