/**
 * Coin metadata API functions
 */

import { api } from './client';

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
export async function fetchCoins(): Promise<CoinMetadata[]> {
    return api.get<CoinMetadata[]>('/api/coins');
}

/**
 * Fetch single coin metadata by type
 */
export async function fetchCoin(coinType: string): Promise<CoinMetadata> {
    return api.get<CoinMetadata>(`/api/coins/${encodeURIComponent(coinType)}`);
}
