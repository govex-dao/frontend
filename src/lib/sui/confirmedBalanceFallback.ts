import type { GovexSuiClient, GovexTransactionOptions, GovexTransactionSnapshot } from "@govex/futarchy-sdk/types";
import { clearChainReadCache } from "@govex/futarchy-sdk/utils";
import { normalizeStructTag } from "@mysten/sui/utils";

export function groupWalletBalanceChanges(changes: Array<{ owner: string; coinType: string }>): Map<string, string[]> {
    const grouped = new Map<string, string[]>();
    for (const change of changes) {
        const owner = change.owner.trim().toLowerCase();
        let coinType = change.coinType.trim();
        try {
            coinType = normalizeStructTag(coinType);
        } catch {
            // Preserve custom/local type strings that the Sui normalizer rejects.
        }
        const types = grouped.get(owner) ?? [];
        if (!types.includes(coinType)) types.push(coinType);
        grouped.set(owner, types);
    }
    return grouped;
}

export async function retryObjectIndexBarrier(
    client: GovexSuiClient,
    digest: string,
    options: GovexTransactionOptions,
    timeout: number
): Promise<{ indexed: boolean; warning?: string }> {
    try {
        await client.waitForTransactionBlock({ digest, options, timeout });
        clearChainReadCache(client);
        return { indexed: true };
    } catch (error) {
        return { indexed: false, warning: error instanceof Error ? error.message : String(error) };
    }
}

export async function readIndexedBalanceFallback(
    client: GovexSuiClient,
    digest: string,
    grouped: Map<string, string[]>
): Promise<GovexTransactionSnapshot[]> {
    const snapshots: GovexTransactionSnapshot[] = [];
    for (const [owner, coinTypes] of grouped) {
        const balances = await Promise.all(
            coinTypes.map(async (coinType) => {
                const balance = await client.getBalance({ owner, coinType });
                return {
                    coinType,
                    totalBalance: balance.totalBalance,
                    addressBalance: balance.fundsInAddressBalance ?? "0",
                    coinBalance: balance.totalBalance,
                };
            })
        );
        snapshots.push({
            digest,
            checkpoint: "grpc-indexed",
            observedCheckpoint: "grpc-indexed",
            owner,
            balances,
        });
    }
    return snapshots;
}
