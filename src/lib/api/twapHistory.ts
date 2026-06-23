/**
 * TWAP History API queries
 */

import { api, type ApiRequestOptions } from "./client";

export interface TwapSnapshot {
    timestamp: string;
    is_final: boolean;
    twaps: Record<number, string>;
}

export interface TwapHistoryResponse {
    proposal_id: string;
    snapshots: TwapSnapshot[];
}

export async function fetchProposalTwapHistory(
    proposalId: string,
    options?: ApiRequestOptions
): Promise<TwapHistoryResponse> {
    return api.get<TwapHistoryResponse>(`/api/proposals/${encodeURIComponent(proposalId)}/twap-history`, options);
}
