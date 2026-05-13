/**
 * Hooks for proposal trades
 */

import { useQuery } from '@tanstack/react-query';
import { fetchProposalTrades } from '@/lib/api';

// Query keys
export const tradeKeys = {
    all: ['trades'] as const,
    lists: () => [...tradeKeys.all, 'list'] as const,
    list: (proposalId: string, limit?: number, offset?: number) =>
        [...tradeKeys.lists(), proposalId, { limit, offset }] as const,
};

/**
 * Hook to fetch trades for a proposal
 */
export function useProposalTrades(
    proposalId: string | undefined,
    limit = 100,
    offset = 0
) {
    return useQuery({
        queryKey: tradeKeys.list(proposalId!, limit, offset),
        queryFn: () => fetchProposalTrades(proposalId!, limit, offset),
        enabled: !!proposalId,
        staleTime: 10 * 1000, // Trades update frequently
        refetchInterval: 10 * 1000,
    });
}
