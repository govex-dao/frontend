/**
 * Trades API functions
 */

import { api } from './client';

export interface Trade {
    id: string;
    time: string;
    type: "Buy" | "Sell";
    outcome: string;
    outcome_index: number;
    price: number;
    volume: string;
    priceImpact: number;
    trader: string;
    tx_digest: string;
}

export interface TradesResponse {
    trades: Trade[];
    total: number;
    limit: number;
    offset: number;
    message?: string;
    stable_decimals?: number;
    stable_symbol?: string;
}

/**
 * Fetch trades for a proposal
 */
export async function fetchProposalTrades(
    proposalId: string,
    limit = 100,
    offset = 0
): Promise<TradesResponse> {
    return api.get<TradesResponse>(`/api/proposals/${proposalId}/trades?limit=${limit}&offset=${offset}`);
}
