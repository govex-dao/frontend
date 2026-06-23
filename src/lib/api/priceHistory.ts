import { api, type ApiRequestOptions } from "./client";

export interface ConditionalPricePoint {
    id: string;
    outcome: number;
    source: string;
    price: string;
    price_raw: string;
    asset_reserve: string;
    stable_reserve: string;
    timestamp: string;
    tx_digest: string;
}

export interface ProposalPriceHistoryResponse {
    price_points: ConditionalPricePoint[];
    outcome_count: number;
    trading_started_at?: string | null;
    trading_ended_at?: string | null;
    trading_period_ms?: string | null;
    message?: string;
}

export async function fetchProposalPriceHistory(
    proposalId: string,
    options?: ApiRequestOptions
): Promise<ProposalPriceHistoryResponse> {
    return api.get<ProposalPriceHistoryResponse>(
        `/api/proposals/${encodeURIComponent(proposalId)}/price-history`,
        options
    );
}
