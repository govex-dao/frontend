/**
 * Coin metadata API functions
 */

import { api, type ApiRequestOptions } from "./client";

export interface CoinMetadata {
    coin_type: string;
    name: string;
    symbol: string;
    decimals: number;
    description: string;
    icon_url: string | null;
    icon_cache_path: string | null;
}

/**
 * Fetch all coin metadata
 */
export async function fetchCoins(options?: ApiRequestOptions): Promise<CoinMetadata[]> {
    return api.get<CoinMetadata[]>("/api/coins", options);
}

/**
 * Fetch single coin metadata by type
 */
export async function fetchCoin(coinType: string, options?: ApiRequestOptions): Promise<CoinMetadata> {
    return api.get<CoinMetadata>(`/api/coins/${encodeURIComponent(coinType)}`, options);
}
