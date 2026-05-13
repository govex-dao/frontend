import { useQuery } from '@tanstack/react-query';
import { fetchProposalPriceHistory } from '../../lib/api';

export const priceHistoryKeys = {
  all: ['price-history'] as const,
  proposal: (proposalId: string) => [...priceHistoryKeys.all, 'proposal', proposalId] as const,
};

export function useProposalPriceHistory(proposalId: string | undefined) {
  return useQuery({
    queryKey: priceHistoryKeys.proposal(proposalId!),
    queryFn: () => fetchProposalPriceHistory(proposalId!),
    enabled: !!proposalId,
    refetchInterval: 10000,
  });
}
