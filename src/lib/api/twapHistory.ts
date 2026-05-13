/**
 * TWAP History API queries
 */

import { api } from './client';

export interface TwapSnapshot {
  timestamp: string;
  is_final: boolean;
  twaps: Record<number, string>;
}

export interface TwapHistoryResponse {
  proposal_id: string;
  snapshots: TwapSnapshot[];
}

export async function fetchProposalTwapHistory(proposalId: string): Promise<TwapHistoryResponse> {
  return api.get<TwapHistoryResponse>(`/api/proposals/${proposalId}/twap-history`);
}
