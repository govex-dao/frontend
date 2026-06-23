import type { Proposal, Raise } from "../../types";

export const REFRESH_INTERVALS = {
    LIVE: 10_000,
    DISCOVERY: 30_000,
    SLOW: 60_000,
    TWAP_HISTORY: 5 * 60_000,
    STATIC: 5 * 60_000,
} as const;

function isLiveProposal(proposal: Pick<Proposal, "state">): boolean {
    return (
        proposal.state === "created" ||
        proposal.state === "initialized" ||
        proposal.state === "active" ||
        proposal.state === "awaiting_execution"
    );
}

function isLiveRaise(raise: Pick<Raise, "state">): boolean {
    return raise.state !== "successful" && raise.state !== "failed";
}

export function proposalRefreshInterval(proposal?: Pick<Proposal, "state">): number | false {
    if (!proposal) return REFRESH_INTERVALS.LIVE;
    return isLiveProposal(proposal) ? REFRESH_INTERVALS.LIVE : false;
}

export function proposalListRefreshInterval(proposals?: Array<Pick<Proposal, "state">>): number {
    if (!proposals || proposals.length === 0) return REFRESH_INTERVALS.DISCOVERY;
    return proposals.some(isLiveProposal) ? REFRESH_INTERVALS.LIVE : REFRESH_INTERVALS.DISCOVERY;
}

export function raiseRefreshInterval(raise?: Pick<Raise, "state">): number | false {
    if (!raise) return REFRESH_INTERVALS.LIVE;
    return isLiveRaise(raise) ? REFRESH_INTERVALS.LIVE : false;
}

export function raiseListRefreshInterval(raises?: Array<Pick<Raise, "state">>): number {
    if (!raises || raises.length === 0) return REFRESH_INTERVALS.DISCOVERY;
    return raises.some(isLiveRaise) ? REFRESH_INTERVALS.LIVE : REFRESH_INTERVALS.DISCOVERY;
}
