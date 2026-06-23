/**
 * Proposal API queries
 */

import type { Proposal } from "../../types";
import { api, type ApiRequestOptions } from "./client";

export interface ProposalFilters {
    daoIndex?: number;
    daoId?: string;
}

export async function fetchProposals(filters: ProposalFilters = {}, options?: ApiRequestOptions): Promise<Proposal[]> {
    const params = new URLSearchParams();
    if (filters.daoIndex !== undefined) params.set("dao", String(filters.daoIndex));
    if (filters.daoId) params.set("dao_id", filters.daoId);
    const query = params.toString();
    return api.get<Proposal[]>(`/api/proposals${query ? `?${query}` : ""}`, options);
}

export async function fetchProposal(id: string, options?: ApiRequestOptions): Promise<Proposal> {
    return api.get<Proposal>(`/api/proposals/${encodeURIComponent(id)}`, options);
}
