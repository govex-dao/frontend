import { useQuery } from "@tanstack/react-query";
import { fetchStats } from "../../lib/api";
import type { Stats } from "../../lib/api";
import { REFRESH_INTERVALS } from "./refresh";

export function useStats() {
    return useQuery<Stats>({
        queryKey: ["stats"],
        queryFn: ({ signal }) => fetchStats({ signal }),
        refetchInterval: REFRESH_INTERVALS.SLOW,
    });
}
