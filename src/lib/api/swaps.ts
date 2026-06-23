/**
 * Swap API queries
 */

import { api, type ApiRequestOptions } from "./client";

export interface ConditionalSwap {
    id: string;
    outcome: number;
    is_buy: boolean;
    amount_in: string;
    amount_out: string;
    price: string;
    price_raw: string;
    sender: string;
    asset_reserve: string;
    stable_reserve: string;
    timestamp: string;
    tx_digest: string;
}

export interface ProposalSwapsResponse {
    swaps: ConditionalSwap[];
    outcome_count: number;
    message?: string;
}

export async function fetchProposalSwaps(
    proposalId: string,
    options?: ApiRequestOptions
): Promise<ProposalSwapsResponse> {
    return api.get<ProposalSwapsResponse>(`/api/proposals/${encodeURIComponent(proposalId)}/swaps`, options);
}
