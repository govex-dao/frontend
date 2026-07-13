import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it, vi } from "vitest";

import type { GovexSuiClient } from "@govex/futarchy-sdk/types";
import {
    reconcileConfirmedEffects,
    registerConfirmedEffects,
    withConfirmedBalanceDelta,
} from "@/lib/sui/confirmedEffects";

const owner = "0xabc";
const coinType = "0x2::sui::SUI";

function queryClient(): QueryClient {
    return new QueryClient({ defaultOptions: { queries: { retry: false } } });
}

function result(digest: string, amount: string) {
    return {
        digest,
        effects: { status: { status: "success" as const } },
        balanceChanges: [{ owner, coinType, amount }],
        events: [],
    };
}

function snapshot(digest: string, totalBalance: string) {
    return {
        digest,
        checkpoint: "10",
        observedCheckpoint: "12",
        owner,
        balances: [{ coinType, totalBalance, addressBalance: "0", coinBalance: totalBalance }],
    };
}

describe("confirmed effect reconciliation", () => {
    it("never adds a confirmed delta to an unknown network baseline", async () => {
        const client = queryClient();
        await registerConfirmedEffects(client, result("tx-1", "-10"));

        expect(withConfirmedBalanceDelta(client, owner, coinType, 90n)).toBe(90n);
    });

    it("preserves the specific cache value that was patched", async () => {
        const client = queryClient();
        const key = ["coin-balance", owner, coinType] as const;
        client.setQueryData(key, 100n);
        await registerConfirmedEffects(client, result("tx-1", "-10"));

        const patched = client.getQueryData<bigint>(key);
        expect(patched).toBe(90n);
        expect(withConfirmedBalanceDelta(client, owner, coinType, 100n, patched)).toBe(90n);
    });

    it("serializes concurrent commits so an older snapshot cannot win", async () => {
        const cache = queryClient();
        const key = ["coin-balance", owner, coinType] as const;
        cache.setQueryData(key, 100n);
        await registerConfirmedEffects(cache, result("tx-a", "-10"));
        await registerConfirmedEffects(cache, result("tx-b", "-20"));

        let releaseA!: () => void;
        const aGate = new Promise<void>((resolve) => {
            releaseA = resolve;
        });
        const snapshotStarts: string[] = [];
        const chain = {
            waitForTransactionBlock: vi.fn(async () => ({ digest: "indexed" })),
            waitForTransactionSnapshot: vi.fn(async ({ digest }: { digest: string }) => {
                snapshotStarts.push(digest);
                if (digest === "tx-a") await aGate;
                return snapshot(digest, digest === "tx-a" ? "90" : "70");
            }),
        } as unknown as GovexSuiClient;

        const first = reconcileConfirmedEffects({ queryClient: cache, client: chain, result: result("tx-a", "-10") });
        const second = reconcileConfirmedEffects({ queryClient: cache, client: chain, result: result("tx-b", "-20") });

        await vi.waitFor(() => expect(snapshotStarts).toEqual(["tx-a"]));
        releaseA();
        await Promise.all([first, second]);

        expect(snapshotStarts).toEqual(["tx-a", "tx-b"]);
        expect(cache.getQueryData(key)).toBe(70n);
    });

    it("retains the confirmed overlay when every consistency source is unavailable", async () => {
        const cache = queryClient();
        const key = ["coin-balance", owner, coinType] as const;
        cache.setQueryData(key, 100n);
        const tx = result("tx-deferred", "-10");
        await registerConfirmedEffects(cache, tx);
        const chain = {
            waitForTransactionBlock: vi.fn(async () => {
                throw new Error("gRPC unavailable");
            }),
            waitForTransactionSnapshot: vi.fn(async () => {
                throw new Error("GraphQL unavailable");
            }),
        } as unknown as GovexSuiClient;

        const reconciliation = await reconcileConfirmedEffects({ queryClient: cache, client: chain, result: tx });

        expect(reconciliation.status).toBe("deferred");
        expect(withConfirmedBalanceDelta(cache, owner, coinType, 100n, cache.getQueryData(key))).toBe(90n);
    });

    it("defers object-changing flows until the SDK object reader is indexed", async () => {
        const cache = queryClient();
        const key = ["coin-balance", owner, coinType] as const;
        cache.setQueryData(key, 100n);
        const tx = {
            ...result("tx-object", "-10"),
            objectChanges: [{ type: "mutated" as const, objectId: "0xwrapper" }],
        };
        await registerConfirmedEffects(cache, tx);
        const chain = {
            waitForTransactionBlock: vi.fn(async () => ({ digest: tx.digest })),
            waitForTransactionSnapshot: vi.fn(async () => snapshot(tx.digest, "90")),
        } as unknown as GovexSuiClient;
        const objectReader = {
            waitForTransactionBlock: vi.fn(async () => {
                throw new Error("object reader unavailable");
            }),
        } as unknown as GovexSuiClient;

        const reconciliation = await reconcileConfirmedEffects({
            queryClient: cache,
            client: chain,
            sdkClient: objectReader,
            result: tx,
        });

        expect(reconciliation.status).toBe("deferred");
        expect(objectReader.waitForTransactionBlock).toHaveBeenCalledTimes(2);
        expect(withConfirmedBalanceDelta(cache, owner, coinType, 100n, cache.getQueryData(key))).toBe(90n);
    });

    it("does not seed a partial multisig vault cache from a delta event", async () => {
        const cache = queryClient();
        await registerConfirmedEffects(cache, {
            digest: "tx-vault",
            balanceChanges: [],
            events: [
                {
                    id: { txDigest: "tx-vault", eventSeq: "0" },
                    type: "0x1::vault::VaultDeposited",
                    parsedJson: {
                        account_id: "0xaccount",
                        vault_name: "treasury",
                        coin_type: { name: coinType },
                        amount: "10",
                    },
                },
            ],
        });

        expect(cache.getQueryData(["multisig-rpc", "vault-balances", "0xaccount"])).toBeUndefined();
    });
});
