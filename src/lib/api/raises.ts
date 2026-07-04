/**
 * Raise/Launchpad API queries
 */

import type { Raise } from "../../types";
import { api, type ApiRequestOptions } from "./client";

export interface FetchRaisesParams {
    daoId?: string;
}

export interface UserContribution {
    hasInvested: boolean;
    amount: string;
    percentage: string;
    rank: number;
}

export async function fetchRaises(params: FetchRaisesParams = {}, options?: ApiRequestOptions): Promise<Raise[]> {
    const searchParams = new URLSearchParams();
    if (params.daoId) searchParams.set("dao_id", params.daoId);
    const query = searchParams.toString();
    return api.get<Raise[]>(`/api/raises${query ? `?${query}` : ""}`, options);
}

export async function fetchRaise(id: string, options?: ApiRequestOptions): Promise<Raise> {
    return api.get<Raise>(`/api/launchpads/${encodeURIComponent(id)}`, options);
}

export async function fetchUserContribution(
    raiseId: string,
    address: string,
    options?: ApiRequestOptions
): Promise<UserContribution> {
    return api.get<UserContribution>(
        `/api/launchpads/${encodeURIComponent(raiseId)}/contribution?address=${encodeURIComponent(address)}`,
        options
    );
}

export interface UserReservation {
    hasReservation: boolean;
    amount: string;
    accepted: boolean;
}

export async function fetchUserReservation(
    raiseId: string,
    address: string,
    options?: ApiRequestOptions
): Promise<UserReservation> {
    return api.get<UserReservation>(
        `/api/launchpads/${encodeURIComponent(raiseId)}/reservation?address=${encodeURIComponent(address)}`,
        options
    );
}
