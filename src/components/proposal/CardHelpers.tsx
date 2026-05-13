import { Coins } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import { getOutcomeClass } from "@/lib/outcomes";
import { getStatusColor } from "@lib/getStatusColor";
import { getTimeRemaining, formatTimeRemaining } from "@/lib/time";
import { getWinningOutcome } from "@/lib/outcomeUtils";
import type { Proposal } from "@/types";
import { BalancesTable } from "./trade/BalancesTable";
import { Tooltip } from "../overlays/Tooltip";

interface OutcomesTooltipContentProps {
    proposal: Proposal;
}

export function OutcomesTooltipContent(props: OutcomesTooltipContentProps) {
    const { proposal } = props;
    if (!proposal.outcomes || proposal.outcomes.length === 0) return null;

    const totalTwap = proposal.outcomes.reduce((sum, o) => sum + (o.twap ?? 0), 0);
    const maxTwap = Math.max(...proposal.outcomes.map((o) => o.twap ?? 0));
    const sortedOutcomes = proposal.outcomes
        .map((outcome, originalIndex) => ({ outcome, originalIndex }))
        .sort((a, b) => (b.outcome.twap ?? 0) - (a.outcome.twap ?? 0));

    const formatPercentage = (value: number) => {
        const sign = value >= 0 ? "+" : "";
        return `${sign}${formatNumber(value)}%`;
    };

    return (
        <div className="space-y-4">
            {/* Progress bar */}
            <div className="flex h-2 w-full rounded-sm overflow-hidden bg-card">
                {proposal.outcomes.map((outcome, index) => {
                    const isLeading = (outcome.twap ?? 0) === maxTwap;
                    return (
                        <div
                            key={index}
                            className={`${getOutcomeClass(index, proposal.outcomes?.length || 0, "normal")} transition-all duration-200`}
                            style={{ width: `${totalTwap > 0 ? ((outcome.twap ?? 0) / totalTwap) * 100 : 0}%`, opacity: isLeading ? 1 : 0.7 }}
                        />
                    );
                })}
            </div>

            {/* Labels with TWAP values and percentages */}
            <div className="space-y-1">
                {sortedOutcomes.map(({ outcome, originalIndex }, sortedIndex) => {
                    const isLeading = (outcome.twap ?? 0) === maxTwap;
                    const nextTwap =
                        sortedIndex < sortedOutcomes.length - 1 ? sortedOutcomes[sortedIndex + 1].outcome.twap : null;
                    const difference =
                        nextTwap != null && nextTwap !== 0 && outcome.twap != null ? ((outcome.twap - nextTwap) / nextTwap) * 100 : null;

                    return (
                        <div
                            key={originalIndex}
                            className={`flex items-center justify-between gap-3 text-xs transition-opacity duration-200 ${!isLeading ? "opacity-45" : "opacity-100"}`}
                        >
                            <div className="flex items-center gap-1.5">
                                <div
                                    className={`w-1.5 h-1.5 rounded-full ${getOutcomeClass(originalIndex, proposal.outcomes?.length || 0, "normal")} transition-all duration-200`}
                                />
                                <p className="text-text-secondary font-medium whitespace-nowrap">{outcome.message}</p>
                            </div>
                            <div className="flex items-center gap-2">
                                <p className="text-text-primary font-mono font-semibold">
                                    {outcome.twap != null ? `$${formatNumber(outcome.twap)}` : "--"}
                                </p>
                                <p className="text-text-tertiary font-mono text-[10px] w-6">
                                    {difference ? formatPercentage(difference) : ""}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

interface PositionBadgeProps {
    proposal: Proposal;
    isEnded: boolean;
}

export function PositionBadge(props: PositionBadgeProps) {
    const { proposal, isEnded } = props;
    if (!proposal.outcomes || proposal.outcomes.length === 0) return null;

    if (isEnded) {
        // Use backend's authoritative winning_outcome when available (accounts for thresholds/sponsorship)
        const winningIndex = ('winningOutcome' in proposal && typeof proposal.winningOutcome === 'number')
            ? proposal.winningOutcome
            : null;
        const winningOutcome = winningIndex != null && proposal.outcomes?.[winningIndex]
            ? proposal.outcomes[winningIndex]
            : getWinningOutcome(proposal.outcomes);
        if (!winningOutcome || (!winningOutcome.tokenBalance && !winningOutcome.usdcBalance)) {
            return null;
        }

        return (
            <Tooltip
                content={
                    <BalancesTable
                        balances={[winningOutcome]}
                        totalOutcomes={proposal.outcomes.length}
                        title="Redeemable"
                        getOriginalIndex={() => proposal.outcomes!.indexOf(winningOutcome)}
                    />
                }
            >
                <div
                    className="relative p-px rounded-lg bg-linear-to-r from-primary/15 via-primary/30 to-primary/15 animate-[shimmer_4s_linear_infinite] group"
                    style={{ backgroundSize: "200% 100%" }}
                >
                    <div className="relative flex items-center px-3 py-1 gap-1.5 text-xs bg-card rounded-lg overflow-hidden">
                        <div
                            className="absolute inset-0 bg-linear-to-r from-transparent via-primary/10 to-transparent opacity-0 group-hover:opacity-100 animate-[shimmer-smooth_4s_linear_infinite] transition-opacity duration-300"
                            style={{ backgroundSize: "200% 100%" }}
                        />
                        <Coins className="w-3.5 h-3.5 text-primary/80 group-hover:text-primary relative z-10 transition-colors duration-300" />
                        <span className="font-medium text-primary/80 group-hover:text-primary relative z-10 transition-colors duration-300">
                            Redeemable
                        </span>
                    </div>
                </div>
            </Tooltip>
        );
    }

    // Active proposals - show positions
    const outcomesWithBalances = proposal.outcomes.filter(
        (outcome) =>
            (outcome.tokenBalance && outcome.tokenBalance > 0) || (outcome.usdcBalance && outcome.usdcBalance > 0)
    );

    if (outcomesWithBalances.length === 0) return null;

    return (
        <Tooltip
            content={
                <BalancesTable
                    balances={outcomesWithBalances}
                    totalOutcomes={proposal.outcomes.length}
                    title="Positions"
                    getOriginalIndex={(i) => proposal.outcomes!.indexOf(outcomesWithBalances[i])}
                    className="-m-1"
                />
            }
        >
            <div className="flex items-center px-3 py-1 gap-1 text-xs bg-card-elevated border border-border-light rounded-lg">
                <Coins className="w-3 h-3" />
                <span className="font-medium">{outcomesWithBalances.length === 1 ? "Position" : "Positions"}</span>
            </div>
        </Tooltip>
    );
}

interface StatusBadgeProps {
    proposal: Proposal;
    isActive: boolean;
    isEnded: boolean;
    isPreTrading: boolean;
}

export function StatusBadge(props: StatusBadgeProps) {
    const { proposal, isActive, isEnded, isPreTrading } = props;
    const timeUntilEnd = getTimeRemaining(proposal.end);

    let statusText: string = proposal.status;
    let statusColor = getStatusColor(proposal.status);

    if (isPreTrading) {
        statusText = "pre-trading";
        statusColor = "bg-purple-500/20 text-purple-400";
    } else if (isActive) {
        statusText = `${formatTimeRemaining(timeUntilEnd)} left`;
        statusColor = "bg-primary/20 text-primary";
    }

    const formattedText = statusText.charAt(0).toUpperCase() + statusText.slice(1).replace("-", " ");
    const badgeElement = (
        <p className={`px-3 py-1 rounded-full text-xs font-semibold ${statusColor}`}>{formattedText}</p>
    );

    // Show tooltip with outcomes for active/ended proposals
    if ((isActive || isEnded) && proposal.outcomes && proposal.outcomes.length > 0) {
        return (
            <Tooltip
                position="top"
                className="whitespace-normal"
                content={<OutcomesTooltipContent proposal={proposal} />}
            >
                {badgeElement}
            </Tooltip>
        );
    }

    return badgeElement;
}
