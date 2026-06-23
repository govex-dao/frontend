/**
 * Base API client for backend requests
 */

import { backendUrl } from "../config";

export interface ApiRequestOptions {
    signal?: AbortSignal;
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === "object" && value !== null;
}

export class ApiError extends Error {
    status: number;

    constructor(status: number, message: string) {
        super(message);
        this.name = "ApiError";
        this.status = status;
    }
}

// BCS parsing can strip 0x prefix from addresses. Normalize all strings in API responses.
function normalizeAddresses(obj: unknown): unknown {
    if (obj === null || obj === undefined) return obj;
    if (typeof obj === "string") {
        if (!obj.startsWith("0x") && /^[0-9a-f]{64}(::.*)?$/i.test(obj)) return `0x${obj}`;
        return obj;
    }
    if (Array.isArray(obj)) return obj.map(normalizeAddresses);
    if (isRecord(obj)) {
        const result: Record<string, unknown> = {};
        for (const [key, value] of Object.entries(obj)) {
            result[key] = normalizeAddresses(value);
        }
        return result;
    }
    return obj;
}

async function fetchApi<T>(endpoint: string, options: ApiRequestOptions = {}): Promise<T> {
    const url = `${backendUrl}${endpoint}`;
    const response = await fetch(url, { signal: options.signal });

    if (!response.ok) {
        const body = await response.text();
        let message = `API error: ${response.status}`;
        try {
            const json = JSON.parse(body) as { error?: string };
            if (json.error) message = json.error;
        } catch {
            if (body) message = body;
        }
        throw new ApiError(response.status, message);
    }

    const data: unknown = await response.json();
    return normalizeAddresses(data) as T;
}

export const api = {
    get: fetchApi,
};
