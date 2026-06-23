/**
 * Hooks for coin metadata
 */

import { useQuery } from "@tanstack/react-query";
import { fetchCoins, fetchCoin } from "@/lib/api";
import { REFRESH_INTERVALS } from "./refresh";

// Query keys
export const coinKeys = {
    all: ["coins"] as const,
    lists: () => [...coinKeys.all, "list"] as const,
    list: () => [...coinKeys.lists()] as const,
    details: () => [...coinKeys.all, "detail"] as const,
    detail: (coinType: string) => [...coinKeys.details(), coinType] as const,
};

/**
 * Hook to fetch all coin metadata
 */
export function useCoins() {
    return useQuery({
        queryKey: coinKeys.list(),
        queryFn: ({ signal }) => fetchCoins({ signal }),
        staleTime: REFRESH_INTERVALS.STATIC, // Coin metadata is fairly static
    });
}

/**
 * Hook to fetch single coin metadata
 */
export function useCoin(coinType: string | undefined) {
    return useQuery({
        queryKey: coinKeys.detail(coinType!),
        queryFn: ({ signal }) => fetchCoin(coinType!, { signal }),
        enabled: !!coinType,
        staleTime: REFRESH_INTERVALS.STATIC,
    });
}

/**
 * Hook to get a coin by symbol from the cached list
 */
export function useCoinBySymbol(symbol: string | undefined) {
    const { data: coins } = useCoins();
    return coins?.find((c) => c.symbol === symbol);
}
