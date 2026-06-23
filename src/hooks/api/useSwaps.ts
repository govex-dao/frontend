/**
 * React Query hooks for Swap data
 */

import { useQuery } from "@tanstack/react-query";
import { fetchProposalSwaps } from "../../lib/api";
import { REFRESH_INTERVALS } from "./refresh";

export const swapKeys = {
    all: ["swaps"] as const,
    proposal: (proposalId: string) => [...swapKeys.all, "proposal", proposalId] as const,
};

/**
 * Fetch all conditional swaps for a proposal
 */
export function useProposalSwaps(proposalId: string | undefined) {
    return useQuery({
        queryKey: swapKeys.proposal(proposalId!),
        queryFn: ({ signal }) => fetchProposalSwaps(proposalId!, { signal }),
        enabled: !!proposalId,
        // Refetch every 10 seconds for live data during active trading
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}
