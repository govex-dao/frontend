import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@/lib/sui/dapp-kit-compat";
import type { CoinMetadata } from "@/lib/api/coins";

/**
 * Fetch coin metadata directly through the Sui gRPC Core API.
 * for coin types not covered by the backend /api/coins endpoint.
 */
export function useOnChainCoinMetadata(coinTypes: string[], backendCoins?: CoinMetadata[]) {
    const client = useSuiClient();

    const missing = useMemo(
        () => coinTypes.filter((ct) => ct && !backendCoins?.some((c) => c.coin_type === ct)),
        [backendCoins, coinTypes]
    );
    const missingKey = useMemo(() => [...missing].sort(), [missing]);

    return useQuery({
        queryKey: ["onchain-coin-metadata", ...missingKey],
        queryFn: async (): Promise<CoinMetadata[]> => {
            const results = await Promise.all(
                missingKey.map(async (coinType): Promise<CoinMetadata | null> => {
                    try {
                        const meta = await client.getCoinMetadata({ coinType });
                        if (!meta) {
                            return null;
                        }

                        const coinMetadata: CoinMetadata = {
                            coin_type: coinType,
                            name: meta.name || coinType.split("::").pop() || "Unknown",
                            symbol: meta.symbol || coinType.split("::").pop() || "???",
                            decimals: meta.decimals ?? 9,
                            description: meta.description || "",
                            icon_url: meta.iconUrl || null,
                            icon_cache_path: null,
                        };

                        return coinMetadata;
                    } catch {
                        return null;
                    }
                })
            );

            return results.filter((result): result is CoinMetadata => result !== null);
        },
        enabled: missingKey.length > 0,
        staleTime: 5 * 60 * 1000,
    });
}

/** Merge backend coins with onchain fallback coins */
export function useMergedCoinMetadata(coinTypes: string[], backendCoins?: CoinMetadata[]): CoinMetadata[] | undefined {
    const { data: onChainCoins } = useOnChainCoinMetadata(coinTypes, backendCoins);

    return useMemo(() => {
        if (!backendCoins && !onChainCoins) return undefined;

        const merged = [...(backendCoins ?? [])];
        if (onChainCoins) {
            for (const oc of onChainCoins) {
                if (!merged.some((c) => c.coin_type === oc.coin_type)) {
                    merged.push(oc);
                }
            }
        }
        return merged;
    }, [backendCoins, onChainCoins]);
}
