/**
 * React Query hooks for Raise/Launchpad data
 */

import { useQuery } from '@tanstack/react-query';
import { fetchRaises, fetchRaise, fetchUserContribution, fetchUserReservation } from '../../lib/api';

export const raiseKeys = {
  all: ['raises'] as const,
  list: () => [...raiseKeys.all, 'list'] as const,
  details: () => [...raiseKeys.all, 'detail'] as const,
  detail: (id: string) => [...raiseKeys.details(), id] as const,
  contribution: (raiseId: string, address: string) => [...raiseKeys.all, 'contribution', raiseId, address] as const,
  reservation: (raiseId: string, address: string) => [...raiseKeys.all, 'reservation', raiseId, address] as const,
};

/**
 * Fetch all raises
 */
export function useRaises() {
  return useQuery({
    queryKey: raiseKeys.list(),
    queryFn: fetchRaises,
  });
}

/**
 * Fetch a single raise by ID
 */
export function useRaise(id: string | undefined) {
  return useQuery({
    queryKey: raiseKeys.detail(id!),
    queryFn: () => fetchRaise(id!),
    enabled: !!id,
  });
}

/**
 * Fetch user's contribution to a raise
 */
export function useUserContribution(raiseId: string | undefined, address: string | undefined) {
  return useQuery({
    queryKey: raiseKeys.contribution(raiseId!, address!),
    queryFn: () => fetchUserContribution(raiseId!, address!),
    enabled: !!raiseId && !!address,
  });
}

/**
 * Fetch user's reservation on a raise
 */
export function useUserReservation(raiseId: string | undefined, address: string | undefined) {
  return useQuery({
    queryKey: raiseKeys.reservation(raiseId!, address!),
    queryFn: () => fetchUserReservation(raiseId!, address!),
    enabled: !!raiseId && !!address,
  });
}
