/**
 * Base API client for backend requests
 */

import { backendUrl } from "../config";

const API_TIMEOUT_MS = 8_000;

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
    const timeoutController = new AbortController();
    const timeoutId = globalThis.setTimeout(
        () => timeoutController.abort(new DOMException("API request timed out", "TimeoutError")),
        API_TIMEOUT_MS
    );
    const signal = options.signal
        ? AbortSignal.any([options.signal, timeoutController.signal])
        : timeoutController.signal;

    let response: Response;
    try {
        response = await fetch(url, { signal });
    } catch (error) {
        if (timeoutController.signal.aborted && !options.signal?.aborted) {
            throw new ApiError(0, "The Govex API did not respond in time");
        }
        throw error;
    } finally {
        globalThis.clearTimeout(timeoutId);
    }

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
