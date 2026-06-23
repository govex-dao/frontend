/**
 * DAO API queries
 */

import type { DAO } from "../../types";
import { api, type ApiRequestOptions } from "./client";

export async function fetchDAOs(options?: ApiRequestOptions): Promise<DAO[]> {
    return api.get<DAO[]>("/api/daos", options);
}

export async function fetchDAO(id: string, options?: ApiRequestOptions): Promise<DAO> {
    return api.get<DAO>(`/api/daos/${id}`, options);
}
