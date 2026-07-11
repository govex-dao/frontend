/**
 * React Query hooks for DAO data
 */

import { useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchDAOs, fetchDAO } from "../../lib/api";
import type { DAO, DAODisplay } from "../../types";
import { toDAODisplay } from "../../types";
import { REFRESH_INTERVALS } from "./refresh";

export const daoKeys = {
    all: ["daos"] as const,
    lists: () => [...daoKeys.all, "list"] as const,
    list: () => [...daoKeys.lists()] as const,
    details: () => [...daoKeys.all, "detail"] as const,
    detail: (id: string) => [...daoKeys.details(), id] as const,
};

/**
 * Fetch all DAOs (raw backend type)
 */
export function useDAOs() {
    return useQuery<DAO[]>({
        queryKey: daoKeys.list(),
        queryFn: ({ signal }) => fetchDAOs({ signal }),
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch all DAOs transformed for display
 */
export function useDAOsDisplay() {
    const query = useDAOs();
    const data = useMemo(() => query.data?.map(toDAODisplay), [query.data]);
    return { ...query, data };
}

/**
 * Fetch a single DAO by ID (raw backend type)
 */
export function useDAO(id: string | undefined) {
    const queryClient = useQueryClient();

    return useQuery<DAO>({
        queryKey: daoKeys.detail(id!),
        queryFn: ({ signal }) => fetchDAO(id!, { signal }),
        enabled: !!id,
        initialData: () => queryClient.getQueryData<DAO[]>(daoKeys.list())?.find((dao) => dao.id === id),
        initialDataUpdatedAt: () => queryClient.getQueryState(daoKeys.list())?.dataUpdatedAt,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch a single DAO for display
 */
export function useDAODisplay(id: string | undefined) {
    const query = useDAO(id);
    const data = useMemo(() => (query.data ? toDAODisplay(query.data) : undefined), [query.data]);
    return { ...query, data };
}

/**
 * Find a DAO by ID from the list (avoids extra request if list is cached)
 */
export function useDAOFromList(id: string | undefined) {
    const { data: daos, ...rest } = useDAOs();
    const dao = daos?.find((d: DAO) => d.id === id);
    return { data: dao, ...rest };
}

/**
 * Create a lookup map from DAO ID to DAODisplay
 */
export function useDAOMap() {
    const { data: daos, ...rest } = useDAOs();
    const map = useMemo(() => {
        if (!daos) return new Map<string, DAODisplay>();
        return new Map(daos.map((dao) => [dao.id, toDAODisplay(dao)]));
    }, [daos]);
    return { data: map, ...rest };
}
