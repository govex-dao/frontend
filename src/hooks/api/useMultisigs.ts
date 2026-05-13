/**
 * React Query hooks for multisig data
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { fetchMyMultisigs, fetchMultisigDetail } from '../../lib/api';
import type { MultisigListItem, MultisigDetailApi } from '../../lib/api';

export const multisigKeys = {
  all: ['multisigs'] as const,
  lists: () => [...multisigKeys.all, 'list'] as const,
  list: (address: string) => [...multisigKeys.lists(), address] as const,
  details: () => [...multisigKeys.all, 'detail'] as const,
  detail: (id: string) => [...multisigKeys.details(), id] as const,
};

/**
 * Fetch multisigs for the connected wallet
 */
export function useMyMultisigs() {
  const account = useCurrentAccount();
  const address = account?.address;

  return useQuery<MultisigListItem[]>({
    queryKey: multisigKeys.list(address || ''),
    queryFn: () => fetchMyMultisigs(address!),
    enabled: !!address,
  });
}

/**
 * Fetch multisig detail from backend
 */
export function useMultisigDetail(accountId: string | undefined) {
  return useQuery<MultisigDetailApi>({
    queryKey: multisigKeys.detail(accountId!),
    queryFn: () => fetchMultisigDetail(accountId!),
    enabled: !!accountId,
  });
}
