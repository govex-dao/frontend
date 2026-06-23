/**
 * React Query hooks for Raise/Launchpad data
 */

import { useQuery } from "@tanstack/react-query";
import { fetchRaises, fetchRaise, fetchUserContribution, fetchUserReservation } from "../../lib/api";
import type { Raise } from "../../types";
import { raiseListRefreshInterval, raiseRefreshInterval } from "./refresh";

export const raiseKeys = {
    all: ["raises"] as const,
    list: () => [...raiseKeys.all, "list"] as const,
    details: () => [...raiseKeys.all, "detail"] as const,
    detail: (id: string) => [...raiseKeys.details(), id] as const,
    contribution: (raiseId: string, address: string) => [...raiseKeys.all, "contribution", raiseId, address] as const,
    reservation: (raiseId: string, address: string) => [...raiseKeys.all, "reservation", raiseId, address] as const,
};

/**
 * Fetch all raises
 */
export function useRaises() {
    return useQuery<Raise[]>({
        queryKey: raiseKeys.list(),
        queryFn: ({ signal }) => fetchRaises({ signal }),
        refetchInterval: (query) => raiseListRefreshInterval(query.state.data),
    });
}

/**
 * Fetch a single raise by ID
 */
export function useRaise(id: string | undefined) {
    return useQuery<Raise>({
        queryKey: raiseKeys.detail(id!),
        queryFn: ({ signal }) => fetchRaise(id!, { signal }),
        enabled: !!id,
        refetchInterval: (query) => raiseRefreshInterval(query.state.data),
    });
}

/**
 * Fetch user's contribution to a raise
 */
export function useUserContribution(raiseId: string | undefined, address: string | undefined) {
    return useQuery({
        queryKey: raiseKeys.contribution(raiseId!, address!),
        queryFn: ({ signal }) => fetchUserContribution(raiseId!, address!, { signal }),
        enabled: !!raiseId && !!address,
        refetchInterval: 10_000,
    });
}

/**
 * Fetch user's reservation on a raise
 */
export function useUserReservation(raiseId: string | undefined, address: string | undefined) {
    return useQuery({
        queryKey: raiseKeys.reservation(raiseId!, address!),
        queryFn: ({ signal }) => fetchUserReservation(raiseId!, address!, { signal }),
        enabled: !!raiseId && !!address,
        refetchInterval: 10_000,
    });
}
