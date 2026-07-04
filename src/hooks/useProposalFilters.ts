import { useMemo } from "react";
import type { Proposal } from "@/types/Proposal";

export type FilterType = "all" | "traded" | "favorites" | "positions";
export type SortType = "volume" | "traders" | "date";

interface UseProposalFiltersOptions {
    proposals: Proposal[];
    filter: FilterType;
    sort: SortType;
    favorites: string[];
    selectedOrgId?: string | null;
}

export function useProposalFilters({ proposals, filter, sort, favorites, selectedOrgId }: UseProposalFiltersOptions) {
    return useMemo(() => {
        let filtered = [...proposals];

        // Apply organization filter
        if (selectedOrgId) {
            filtered = filtered.filter((p) => (p.orgId || p.dao_id) === selectedOrgId);
        }

        // Apply filter
        if (filter === "traded") {
            filtered = filtered.filter((p) => Boolean(p.tradedByMe));
        } else if (filter === "favorites") {
            filtered = filtered.filter((p) => favorites.includes(p.orgId || p.dao_id));
        } else if (filter === "positions") {
            filtered = filtered.filter((p) => {
                if (!p.outcomes || p.outcomes.length === 0) return false;

                // Check if any outcome has a balance
                return p.outcomes.some(
                    (outcome) =>
                        (outcome.tokenBalance && outcome.tokenBalance > 0) ||
                        (outcome.usdcBalance && outcome.usdcBalance > 0)
                );
            });
        }

        // Apply sort
        filtered.sort((a, b) => {
            switch (sort) {
                case "volume":
                    return Number(b.volume ?? 0) - Number(a.volume ?? 0);
                case "traders":
                    return (b.traderCount ?? b.trader_count ?? 0) - (a.traderCount ?? a.trader_count ?? 0);
                case "date":
                    return (
                        (b.start?.getTime() ?? Number(b.timestamp ?? 0)) -
                        (a.start?.getTime() ?? Number(a.timestamp ?? 0))
                    );
                default:
                    return 0;
            }
        });

        return filtered;
    }, [filter, sort, favorites, selectedOrgId, proposals]);
}
