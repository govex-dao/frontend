/**
 * React Query hook for TWAP history data
 */

import { useQuery } from '@tanstack/react-query';
import { fetchProposalTwapHistory } from '../../lib/api';

export const twapHistoryKeys = {
  all: ['twapHistory'] as const,
  proposal: (proposalId: string) => [...twapHistoryKeys.all, proposalId] as const,
};

/**
 * Fetch TWAP snapshot history for a proposal
 */
export function useProposalTwapHistory(proposalId: string | undefined) {
  return useQuery({
    queryKey: twapHistoryKeys.proposal(proposalId!),
    queryFn: () => fetchProposalTwapHistory(proposalId!),
    enabled: !!proposalId,
    // Refetch every 5 minutes (matches poller interval)
    refetchInterval: 5 * 60 * 1000,
  });
}
