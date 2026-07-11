/**
 * React Query hooks for multisig data
 */

import { useQuery } from "@tanstack/react-query";
import { useCurrentAccount } from "@/lib/sui/dapp-kit-compat";
import { fetchMyMultisigs, fetchMultisigDetail } from "../../lib/api";
import type { MultisigListItem, MultisigDetailApi } from "../../lib/api";
import { REFRESH_INTERVALS } from "./refresh";

export const multisigKeys = {
    all: ["multisigs"] as const,
    lists: () => [...multisigKeys.all, "list"] as const,
    list: (address: string) => [...multisigKeys.lists(), address] as const,
    details: () => [...multisigKeys.all, "detail"] as const,
    detail: (id: string) => [...multisigKeys.details(), id] as const,
};

/**
 * Fetch multisigs for the connected wallet
 */
export function useMyMultisigs() {
    const account = useCurrentAccount();
    const address = account?.address;

    return useQuery<MultisigListItem[]>({
        queryKey: multisigKeys.list(address || ""),
        queryFn: ({ signal }) => fetchMyMultisigs(address!, { signal }),
        enabled: !!address,
        retry: false,
        staleTime: REFRESH_INTERVALS.DISCOVERY,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch multisig detail from backend
 */
export function useMultisigDetail(accountId: string | undefined) {
    return useQuery<MultisigDetailApi>({
        queryKey: multisigKeys.detail(accountId!),
        queryFn: ({ signal }) => fetchMultisigDetail(accountId!, { signal }),
        enabled: !!accountId,
        retry: false,
        staleTime: REFRESH_INTERVALS.DISCOVERY,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}
