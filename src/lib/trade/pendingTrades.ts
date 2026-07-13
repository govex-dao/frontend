import type { QueryClient } from "@tanstack/react-query";
import type { Trade, TradesResponse } from "@/lib/api/trades";

type PendingTrade = Trade;

const pendingTradeKey = (proposalId: string) => ["confirmed-trades", proposalId] as const;

function activePendingTrades(queryClient: QueryClient, proposalId: string): PendingTrade[] {
    return queryClient.getQueryData<PendingTrade[]>(pendingTradeKey(proposalId)) ?? [];
}

export function registerPendingTrades(queryClient: QueryClient, proposalId: string, trades: Trade[]): void {
    if (trades.length === 0) return;
    const pending = trades;
    const digests = new Set(trades.map((trade) => trade.tx_digest));
    queryClient.setQueryData<PendingTrade[]>(pendingTradeKey(proposalId), (previous = []) => [
        ...pending,
        ...previous.filter((candidate) => !digests.has(candidate.tx_digest)),
    ]);

    for (const [key, response] of queryClient.getQueriesData<TradesResponse>({
        queryKey: ["trades", "list", proposalId],
    })) {
        if (!response) continue;
        const page = key[3] as { offset?: number } | undefined;
        if ((page?.offset ?? 0) > 0) continue;
        const indexedDigests = new Set(response.trades.map((trade) => trade.tx_digest));
        const additions = trades.filter((trade) => !indexedDigests.has(trade.tx_digest));
        queryClient.setQueryData<TradesResponse>(key, {
            ...response,
            trades: [...additions, ...response.trades.filter((candidate) => !digests.has(candidate.tx_digest))],
            total: response.total + additions.length,
        });
    }
}

/** Preserve confirmed local events until the backend response contains their digest. */
export function mergePendingTrades(
    queryClient: QueryClient,
    proposalId: string,
    response: TradesResponse
): TradesResponse {
    const pending = activePendingTrades(queryClient, proposalId);
    if (pending.length === 0) return response;

    const indexedDigests = new Set(response.trades.map((trade) => trade.tx_digest));
    const unindexed = pending.filter((trade) => !indexedDigests.has(trade.tx_digest));
    if (unindexed.length !== pending.length) {
        queueMicrotask(() => queryClient.setQueryData(pendingTradeKey(proposalId), unindexed));
    }
    if (unindexed.length === 0) return response;
    return {
        ...response,
        trades: [...unindexed, ...response.trades],
        total: response.total + unindexed.length,
    };
}
