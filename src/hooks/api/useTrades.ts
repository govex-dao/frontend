/**
 * Hooks for proposal trades
 */

import { useQuery } from "@tanstack/react-query";
import { fetchProposalTrades } from "@/lib/api";
import { REFRESH_INTERVALS } from "./refresh";

// Query keys
export const tradeKeys = {
    all: ["trades"] as const,
    lists: () => [...tradeKeys.all, "list"] as const,
    list: (proposalId: string, limit?: number, offset?: number) =>
        [...tradeKeys.lists(), proposalId, { limit, offset }] as const,
};

/**
 * Hook to fetch trades for a proposal
 */
export function useProposalTrades(proposalId: string | undefined, limit = 100, offset = 0) {
    return useQuery({
        queryKey: tradeKeys.list(proposalId!, limit, offset),
        queryFn: ({ signal }) => fetchProposalTrades(proposalId!, limit, offset, { signal }),
        enabled: !!proposalId,
        staleTime: REFRESH_INTERVALS.LIVE, // Trades update frequently
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}
