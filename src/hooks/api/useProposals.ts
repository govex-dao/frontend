/**
 * React Query hooks for Proposal data
 */

import { useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchProposals, fetchProposal } from '../../lib/api';
import type { Proposal } from '../../types';
import { toProposalDisplay } from '../../types';
import type { ProposalFilters } from '../../lib/api/proposals';

export const proposalKeys = {
  all: ['proposals'] as const,
  lists: () => [...proposalKeys.all, 'list'] as const,
  list: (filters?: ProposalFilters) => [...proposalKeys.lists(), filters] as const,
  details: () => [...proposalKeys.all, 'detail'] as const,
  detail: (id: string) => [...proposalKeys.details(), id] as const,
};

/**
 * Fetch all proposals, optionally filtered by DAO index (raw backend type)
 */
export function useProposals(filters: ProposalFilters = {}, enabled = true) {
  return useQuery({
    queryKey: proposalKeys.list(filters),
    queryFn: () => fetchProposals(filters),
    enabled,
  });
}

/**
 * Fetch all proposals transformed for display
 */
export function useProposalsDisplay(daoIndex?: number) {
  const query = useProposals({ daoIndex });
  const data = useMemo(() => query.data?.map(toProposalDisplay), [query.data]);
  return { ...query, data };
}

/**
 * Fetch a single proposal by ID (raw backend type)
 */
export function useProposal(id: string | undefined) {
  return useQuery({
    queryKey: proposalKeys.detail(id!),
    queryFn: () => fetchProposal(id!),
    enabled: !!id,
    refetchInterval: 10_000,
  });
}

/**
 * Fetch a single proposal for display
 */
export function useProposalDisplay(id: string | undefined) {
  const query = useProposal(id);
  const data = useMemo(() => (query.data ? toProposalDisplay(query.data) : undefined), [query.data]);
  return { ...query, data };
}

/**
 * Find a proposal by ID from the list (avoids extra request if list is cached)
 */
export function useProposalFromList(id: string | undefined) {
  const { data: proposals, ...rest } = useProposals();
  const proposal = proposals?.find((p: Proposal) => p.id === id);
  return { data: proposal, ...rest };
}

/**
 * Get proposals for a specific DAO (raw backend type)
 */
export function useDAOProposals(daoId: string | undefined, canonicalDaoId?: string | null) {
  void canonicalDaoId;
  const { data: proposals, ...rest } = useProposals(daoId ? { daoId } : {}, !!daoId);
  return { data: proposals, ...rest };
}

/**
 * Get proposals for a specific DAO transformed for display
 */
export function useDAOProposalsDisplay(daoId: string | undefined, canonicalDaoId?: string | null) {
  void canonicalDaoId;
  const { data: proposals, ...rest } = useProposals(daoId ? { daoId } : {}, !!daoId);
  const daoProposals = useMemo(() => {
    if (!proposals) return undefined;
    return proposals.map(toProposalDisplay);
  }, [proposals]);
  return { data: daoProposals, ...rest };
}
