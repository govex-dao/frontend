/**
 * React Query hooks for Raise/Launchpad data
 */

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchRaises, fetchRaise, fetchUserContribution, fetchUserReservation } from "../../lib/api";
import type { Raise } from "../../types";
import { raiseListRefreshInterval, raiseRefreshInterval } from "./refresh";
import {
    mergePendingContribution,
    mergePendingRaise,
    mergePendingRaises,
    mergePendingReservation,
} from "@/lib/raise/pendingRaiseEffects";

export const raiseKeys = {
    all: ["raises"] as const,
    list: (daoId?: string) => [...raiseKeys.all, "list", daoId ?? "all"] as const,
    details: () => [...raiseKeys.all, "detail"] as const,
    detail: (id: string) => [...raiseKeys.details(), id] as const,
    contribution: (raiseId: string, address: string) => [...raiseKeys.all, "contribution", raiseId, address] as const,
    reservation: (raiseId: string, address: string) => [...raiseKeys.all, "reservation", raiseId, address] as const,
};

/**
 * Fetch all raises
 */
export function useRaises(daoId?: string, options: { enabled?: boolean } = {}) {
    const queryClient = useQueryClient();
    return useQuery<Raise[]>({
        queryKey: raiseKeys.list(daoId),
        queryFn: async ({ signal }) => mergePendingRaises(queryClient, await fetchRaises({ daoId }, { signal })),
        enabled: options.enabled ?? true,
        refetchInterval: (query) => raiseListRefreshInterval(query.state.data),
    });
}

/**
 * Fetch a single raise by ID
 */
export function useRaise(id: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery<Raise>({
        queryKey: raiseKeys.detail(id!),
        queryFn: async ({ signal }) => mergePendingRaise(queryClient, await fetchRaise(id!, { signal })),
        enabled: !!id,
        initialData: () => {
            for (const [, raises] of queryClient.getQueriesData<Raise[]>({ queryKey: [...raiseKeys.all, "list"] })) {
                const raise = raises?.find((candidate) => candidate.id === id);
                if (raise) return raise;
            }
            return undefined;
        },
        refetchInterval: (query) => raiseRefreshInterval(query.state.data),
    });
}

/**
 * Fetch user's contribution to a raise
 */
export function useUserContribution(raiseId: string | undefined, address: string | undefined) {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: raiseKeys.contribution(raiseId!, address!),
        queryFn: async ({ signal }) =>
            mergePendingContribution(
                queryClient,
                raiseId!,
                address!,
                await fetchUserContribution(raiseId!, address!, { signal })
            ),
        enabled: !!raiseId && !!address,
        refetchInterval: 10_000,
    });
}

/**
 * Fetch user's reservation on a raise
 */
export function useUserReservation(raiseId: string | undefined, address: string | undefined) {
    const queryClient = useQueryClient();
    return useQuery({
        queryKey: raiseKeys.reservation(raiseId!, address!),
        queryFn: async ({ signal }) =>
            mergePendingReservation(
                queryClient,
                raiseId!,
                address!,
                await fetchUserReservation(raiseId!, address!, { signal })
            ),
        enabled: !!raiseId && !!address,
        refetchInterval: 10_000,
    });
}
