import type { Proposal, ProposalState } from "@/types/Proposal";

function hasExecutionTimestamp(raw: string | null | undefined): boolean {
    if (raw == null) return false;
    const parsed = Number(raw);
    return Number.isFinite(parsed);
}

export function getEffectiveProposalState(
    proposal: Pick<Proposal, "state" | "execution_at">
): ProposalState {
    return hasExecutionTimestamp(proposal.execution_at) ? "executed" : proposal.state;
}

export function withEffectiveProposalState(proposal: Proposal): Proposal {
    const state = getEffectiveProposalState(proposal);
    return state === proposal.state ? proposal : { ...proposal, state };
}
