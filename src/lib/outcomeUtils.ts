type OutcomeLike = { twap?: number | null };

export type OutcomeWithIndex<T extends OutcomeLike = OutcomeLike> = T & {
    originalIndex: number;
};

export function getSortedOutcomes<T extends OutcomeLike>(outcomes?: T[]): OutcomeWithIndex<T>[] {
    if (!outcomes) return [];

    return [...outcomes]
        .map((outcome, index) => ({ ...outcome, originalIndex: index }))
        .sort((a, b) => (b.twap ?? 0) - (a.twap ?? 0));
}

/**
 * Get outcome with highest TWAP (for display hints only).
 * WARNING: This does NOT account for sponsorship thresholds or the TWAP margin
 * used by Move's calculate_winning_outcome_with_twaps. For authoritative winning
 * outcome, use proposal.winning_outcome from the backend API.
 */
export function getWinningOutcome<T extends OutcomeLike>(outcomes?: T[]): T | null {
    if (!outcomes || outcomes.length === 0) return null;
    return outcomes.reduce((prev, current) => ((prev.twap ?? 0) > (current.twap ?? 0) ? prev : current));
}

export function hasBalances(outcome: { tokenBalance?: number; usdcBalance?: number }): boolean {
    return Boolean(
        (outcome.tokenBalance && outcome.tokenBalance > 0) || (outcome.usdcBalance && outcome.usdcBalance > 0)
    );
}

export function getTotalBalance(outcome: { tokenBalance?: number; usdcBalance?: number }): number {
    return (outcome.tokenBalance || 0) + (outcome.usdcBalance || 0);
}

// Utilities for proposal creation outcomes

import { FAIL_OUTCOME_KEYWORDS } from "./proposalConstants";

/**
 * Checks if an outcome represents a failure/rejection outcome
 * based on its name or message
 */
export function isFailureOutcome(outcome: { name?: string; message?: string }): boolean {
    const text = (outcome.name || outcome.message || "").toLowerCase();
    return FAIL_OUTCOME_KEYWORDS.some((keyword) => text.includes(keyword));
}

/**
 * Gets the display color class for an outcome based on its index
 */
export function getOutcomeColorClass(index: number): string {
    const colors = [
        "bg-green-500/20 border-green-500/30",
        "bg-blue-500/20 border-blue-500/30",
        "bg-purple-500/20 border-purple-500/30",
        "bg-orange-500/20 border-orange-500/30",
        "bg-pink-500/20 border-pink-500/30",
        "bg-yellow-500/20 border-yellow-500/30",
    ];
    return colors[index % colors.length];
}

/**
 * Gets the text color class for an outcome based on its index
 */
export function getOutcomeTextColor(index: number): string {
    const colors = [
        "text-green-400",
        "text-blue-400",
        "text-purple-400",
        "text-orange-400",
        "text-pink-400",
        "text-yellow-400",
    ];
    return colors[index % colors.length];
}
