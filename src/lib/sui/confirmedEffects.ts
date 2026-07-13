import type { QueryClient, QueryKey } from "@tanstack/react-query";
import { normalizeStructTag } from "@mysten/sui/utils";
import type {
    GovexBalance,
    GovexBalanceChange,
    GovexConfirmedBalance,
    GovexSuiClient,
    GovexTransactionSnapshot,
    SuiEvent,
    SuiTransactionBlockResponse,
} from "@govex/futarchy-sdk/types";
import type { ProposalBalances } from "@govex/futarchy-sdk";
import { clearChainReadCache } from "@govex/futarchy-sdk/utils";
import { registerPendingRaiseEffects, type RaiseProjectionBaseline } from "@/lib/raise/pendingRaiseEffects";
import {
    groupWalletBalanceChanges,
    readIndexedBalanceFallback,
    retryObjectIndexBarrier,
} from "@/lib/sui/confirmedBalanceFallback";
import { patchMultisigEventCaches } from "@/lib/sui/confirmedMultisigEffects";
import { formatUnitsForInput } from "@/lib/units";

export const confirmedEffectsQueryKey = ["confirmed-transaction-effects"] as const;
const RECONCILIATION_WAIT_MS = 20_000;
const PROJECTION_QUERY_KEYS = [
    ["balances"],
    ["coin-balance"],
    ["allBalances"],
    ["wallet-balances"],
    ["multisig-rpc"],
    ["raises"],
    ["trades"],
] as const;
const reconciliationQueues = new WeakMap<QueryClient, Promise<void>>();

interface ConfirmedEffectEntry {
    digest: string;
    balanceChanges: GovexBalanceChange[];
    events: SuiEvent[];
}

type ConfirmedEffectState = Record<string, ConfirmedEffectEntry>;

export interface ConfirmedTransactionResult extends SuiTransactionBlockResponse {
    balanceChanges?: GovexBalanceChange[] | null;
    events?: SuiEvent[] | null;
}

export interface ReconciliationResult {
    snapshots: GovexTransactionSnapshot[];
    usedGraphqlFallback: boolean;
    status: "reconciled" | "fallback" | "deferred";
    warnings: string[];
}

export interface ConfirmedProjectionContext {
    raiseBaselines?: RaiseProjectionBaseline[];
}

function normalizeAddress(value: string): string {
    return value.trim().toLowerCase();
}

function normalizeCoinType(value: string): string {
    try {
        return normalizeStructTag(value);
    } catch {
        return value.trim();
    }
}

function currentEffects(queryClient: QueryClient): ConfirmedEffectState {
    return queryClient.getQueryData<ConfirmedEffectState>(confirmedEffectsQueryKey) ?? {};
}

function liveEffects(queryClient: QueryClient): ConfirmedEffectEntry[] {
    return Object.values(currentEffects(queryClient));
}

export function getConfirmedBalanceDelta(
    queryClient: QueryClient,
    owner: string,
    coinType: string,
    excludingDigest?: string
): bigint {
    const normalizedOwner = normalizeAddress(owner);
    const normalizedType = normalizeCoinType(coinType);
    let delta = 0n;
    for (const entry of liveEffects(queryClient)) {
        if (entry.digest === excludingDigest) continue;
        for (const change of entry.balanceChanges) {
            if (
                normalizeAddress(change.owner) === normalizedOwner &&
                normalizeCoinType(change.coinType) === normalizedType
            ) {
                delta += BigInt(change.amount);
            }
        }
    }
    return delta;
}

/**
 * Preserve this query's already-patched value while its checkpoint barrier is
 * pending. Never add a delta to an unknown network baseline: that response may
 * already include the transaction.
 */
export function withConfirmedBalanceDelta(
    queryClient: QueryClient,
    owner: string,
    coinType: string,
    networkBalance: bigint,
    cachedBalance?: bigint
): bigint {
    const delta = getConfirmedBalanceDelta(queryClient, owner, coinType);
    if (delta === 0n) return networkBalance;
    return cachedBalance ?? networkBalance;
}

export function withConfirmedAllBalances(
    queryClient: QueryClient,
    owner: string,
    balances: GovexBalance[],
    cachedBalances?: GovexBalance[]
): GovexBalance[] {
    const byType = new Map(balances.map((balance) => [normalizeCoinType(balance.coinType), balance]));
    const cachedByType = new Map(
        (cachedBalances ?? []).map((balance) => [normalizeCoinType(balance.coinType), balance])
    );
    const pendingTypes = new Set<string>();
    for (const entry of liveEffects(queryClient)) {
        for (const change of entry.balanceChanges) {
            if (normalizeAddress(change.owner) === normalizeAddress(owner)) {
                pendingTypes.add(normalizeCoinType(change.coinType));
            }
        }
    }
    for (const coinType of pendingTypes) {
        const previous = byType.get(coinType);
        const cached = cachedByType.get(coinType);
        if (!cached) continue;
        byType.set(coinType, {
            ...previous,
            ...cached,
            coinType: previous?.coinType ?? cached.coinType,
        });
    }
    return [...byType.values()];
}

function formatBalance(raw: bigint, decimals: number): string {
    if (decimals === 0) return raw.toString();
    const divisor = 10n ** BigInt(decimals);
    const whole = raw / divisor;
    const fraction = (raw % divisor).toString().padStart(decimals, "0").slice(0, 4);
    return `${whole}.${fraction}`;
}

function updateProposalCoinBalance(
    balance: ProposalBalances["spot"]["asset"],
    change: bigint
): ProposalBalances["spot"]["asset"] {
    const raw = balance.raw + change;
    const safeRaw = raw < 0n ? 0n : raw;
    return {
        ...balance,
        raw: safeRaw,
        formatted: formatBalance(safeRaw, balance.decimals),
    };
}

function applyProposalBalanceChange(data: ProposalBalances, change: GovexBalanceChange): ProposalBalances {
    const coinType = normalizeCoinType(change.coinType);
    const amount = BigInt(change.amount);
    const update = (balance: ProposalBalances["spot"]["asset"]) =>
        normalizeCoinType(balance.coinType) === coinType ? updateProposalCoinBalance(balance, amount) : balance;

    return {
        ...data,
        spot: { asset: update(data.spot.asset), stable: update(data.spot.stable) },
        outcomes: data.outcomes.map((outcome) => ({
            ...outcome,
            conditionalAsset: update(outcome.conditionalAsset),
            conditionalStable: update(outcome.conditionalStable),
        })),
    };
}

function proposalCoinRaw(data: ProposalBalances, coinType: string): bigint | undefined {
    const normalizedType = normalizeCoinType(coinType);
    return [
        data.spot.asset,
        data.spot.stable,
        ...data.outcomes.flatMap((outcome) => [outcome.conditionalAsset, outcome.conditionalStable]),
    ].find((balance) => normalizeCoinType(balance.coinType) === normalizedType)?.raw;
}

export function withConfirmedProposalBalances(
    queryClient: QueryClient,
    owner: string,
    balances: ProposalBalances,
    cachedBalances?: ProposalBalances
): ProposalBalances {
    if (!cachedBalances) return balances;
    let next = balances;
    const pendingTypes = new Set<string>();
    for (const entry of liveEffects(queryClient)) {
        for (const change of entry.balanceChanges) {
            if (normalizeAddress(change.owner) === normalizeAddress(owner)) {
                pendingTypes.add(normalizeCoinType(change.coinType));
            }
        }
    }
    for (const coinType of pendingTypes) {
        const current = proposalCoinRaw(next, coinType);
        const cached = proposalCoinRaw(cachedBalances, coinType);
        if (current === undefined || cached === undefined) continue;
        next = applyProposalBalanceChange(next, {
            owner,
            coinType,
            amount: (cached - current).toString(),
        });
    }
    return next;
}

async function cancelProjectionQueries(queryClient: QueryClient): Promise<void> {
    await Promise.all(PROJECTION_QUERY_KEYS.map((queryKey) => queryClient.cancelQueries({ queryKey })));
}

function keyPart(key: QueryKey, index: number): string {
    return typeof key[index] === "string" ? key[index] : "";
}

function patchKnownBalanceCaches(queryClient: QueryClient, changes: GovexBalanceChange[]): void {
    for (const change of changes) {
        const owner = normalizeAddress(change.owner);
        const coinType = normalizeCoinType(change.coinType);
        const amount = BigInt(change.amount);

        for (const [key, value] of queryClient.getQueriesData<unknown>({})) {
            const namespace = keyPart(key, 0);
            if (namespace === "coin-balance" && normalizeAddress(keyPart(key, 1)) === owner) {
                if (normalizeCoinType(keyPart(key, 2)) === coinType && typeof value === "bigint") {
                    queryClient.setQueryData(key, value + amount < 0n ? 0n : value + amount);
                }
                continue;
            }

            if (
                namespace === "balances" &&
                keyPart(key, 1) === "wallet" &&
                normalizeAddress(keyPart(key, 2)) === owner
            ) {
                if (normalizeCoinType(keyPart(key, 3)) === coinType && value && typeof value === "object") {
                    const wallet = value as { raw?: bigint; display?: string; decimals?: number };
                    if (typeof wallet.raw === "bigint") {
                        const raw = wallet.raw + amount < 0n ? 0n : wallet.raw + amount;
                        queryClient.setQueryData(key, {
                            ...wallet,
                            raw,
                            display:
                                wallet.decimals === undefined
                                    ? wallet.display
                                    : formatUnitsForInput(raw, wallet.decimals),
                        });
                    }
                }
                continue;
            }

            if (namespace === "allBalances" && normalizeAddress(keyPart(key, 1)) === owner && Array.isArray(value)) {
                queryClient.setQueryData(key, patchBalanceArray(value, coinType, amount));
                continue;
            }

            if (
                namespace === "wallet-balances" &&
                normalizeAddress(keyPart(key, 1)) === owner &&
                Array.isArray(value)
            ) {
                queryClient.setQueryData(key, patchBalanceArray(value, coinType, amount));
            }
        }

        // Proposal balance queries are keyed by the wallet owner at index 2.
        for (const [key, value] of queryClient.getQueriesData<ProposalBalances>({
            queryKey: ["balances", "proposal"],
        })) {
            if (!value || normalizeAddress(keyPart(key, 2)) !== owner) continue;
            queryClient.setQueryData(key, applyProposalBalanceChange(value, change));
        }
    }
}

function patchBalanceArray(value: unknown[], coinType: string, amount: bigint): unknown[] {
    let found = false;
    const next = value.map((balance: unknown) => {
        if (!balance || typeof balance !== "object") return balance;
        const item = balance as { coinType?: string; totalBalance?: string };
        if (!item.coinType || normalizeCoinType(item.coinType) !== coinType) return balance;
        found = true;
        const total = BigInt(item.totalBalance ?? "0") + amount;
        return { ...item, totalBalance: (total < 0n ? 0n : total).toString() };
    });
    if (!found && amount > 0n) {
        next.push({
            coinType,
            totalBalance: amount.toString(),
            coinObjectCount: 0,
            lockedBalance: {},
        });
    }
    return next;
}

export async function registerConfirmedEffects(
    queryClient: QueryClient,
    result: ConfirmedTransactionResult,
    projections?: ConfirmedProjectionContext
): Promise<void> {
    const balanceChanges = result.balanceChanges ?? [];
    const events = result.events ?? [];
    await cancelProjectionQueries(queryClient);
    queryClient.setQueryData<ConfirmedEffectState>(confirmedEffectsQueryKey, (previous = {}) => ({
        ...previous,
        [result.digest]: {
            digest: result.digest,
            balanceChanges,
            events,
        },
    }));
    patchKnownBalanceCaches(queryClient, balanceChanges);
    patchMultisigEventCaches(queryClient, events);
    registerPendingRaiseEffects(queryClient, result.digest, events, projections?.raiseBaselines);
}

function applyExactKnownBalanceCaches(
    queryClient: QueryClient,
    owner: string,
    balances: GovexConfirmedBalance[],
    excludingDigest: string
): void {
    for (const balance of balances) {
        // If another confirmed transaction still affects this balance, keep the
        // already-patched cache until the final transaction reconciles.
        if (getConfirmedBalanceDelta(queryClient, owner, balance.coinType, excludingDigest) !== 0n) continue;
        const exact = BigInt(balance.totalBalance);
        for (const [key, value] of queryClient.getQueriesData<unknown>({})) {
            if (
                keyPart(key, 0) === "coin-balance" &&
                normalizeAddress(keyPart(key, 1)) === normalizeAddress(owner) &&
                normalizeCoinType(keyPart(key, 2)) === normalizeCoinType(balance.coinType)
            ) {
                queryClient.setQueryData(key, exact);
                continue;
            }
            if (
                keyPart(key, 0) === "balances" &&
                keyPart(key, 1) === "wallet" &&
                normalizeAddress(keyPart(key, 2)) === normalizeAddress(owner) &&
                normalizeCoinType(keyPart(key, 3)) === normalizeCoinType(balance.coinType) &&
                value &&
                typeof value === "object"
            ) {
                const wallet = value as { decimals?: number; display?: string };
                queryClient.setQueryData(key, {
                    ...wallet,
                    raw: exact,
                    display:
                        wallet.decimals === undefined ? wallet.display : formatUnitsForInput(exact, wallet.decimals),
                });
                continue;
            }
            if (
                (keyPart(key, 0) === "allBalances" || keyPart(key, 0) === "wallet-balances") &&
                normalizeAddress(keyPart(key, 1)) === normalizeAddress(owner) &&
                Array.isArray(value)
            ) {
                queryClient.setQueryData(
                    key,
                    value.map((item: { coinType?: string; totalBalance?: string }) =>
                        item.coinType && normalizeCoinType(item.coinType) === normalizeCoinType(balance.coinType)
                            ? {
                                  ...item,
                                  totalBalance: exact.toString(),
                                  fundsInAddressBalance: balance.addressBalance,
                              }
                            : item
                    )
                );
            }
        }

        for (const [key, proposal] of queryClient.getQueriesData<ProposalBalances>({
            queryKey: ["balances", "proposal"],
        })) {
            if (!proposal || normalizeAddress(keyPart(key, 2)) !== normalizeAddress(owner)) continue;
            const candidates = [
                proposal.spot.asset,
                proposal.spot.stable,
                ...proposal.outcomes.flatMap((outcome) => [outcome.conditionalAsset, outcome.conditionalStable]),
            ];
            const current = candidates.find(
                (candidate) => normalizeCoinType(candidate.coinType) === normalizeCoinType(balance.coinType)
            );
            if (!current) continue;
            queryClient.setQueryData(
                key,
                applyProposalBalanceChange(proposal, {
                    owner,
                    coinType: balance.coinType,
                    amount: (exact - current.raw).toString(),
                })
            );
        }
    }
}

function removeConfirmedEffects(queryClient: QueryClient, digest: string): void {
    queryClient.setQueryData<ConfirmedEffectState>(confirmedEffectsQueryKey, (previous = {}) => {
        const next = { ...previous };
        delete next[digest];
        return next;
    });
}

async function reconcileConfirmedEffectsOnce(input: {
    queryClient: QueryClient;
    client: GovexSuiClient;
    sdkClient?: GovexSuiClient;
    result: ConfirmedTransactionResult;
}): Promise<ReconciliationResult> {
    const { queryClient, client, sdkClient, result } = input;
    const options = {
        showEffects: true,
        showEvents: true,
        showBalanceChanges: true,
        showObjectChanges: true,
    };
    const waits: Promise<unknown>[] = [
        client.waitForTransactionBlock({ digest: result.digest, options, timeout: RECONCILIATION_WAIT_MS }),
    ];
    if (sdkClient && sdkClient !== client) {
        waits.push(
            sdkClient.waitForTransactionBlock({ digest: result.digest, options, timeout: RECONCILIATION_WAIT_MS })
        );
    }
    const waitResults = await Promise.allSettled(waits);
    const warnings = waitResults.flatMap((wait) =>
        wait.status === "rejected" ? [wait.reason instanceof Error ? wait.reason.message : String(wait.reason)] : []
    );
    const hasIndexedGrpcClient = waitResults.some((wait) => wait.status === "fulfilled");
    const objectReadWaitIndex = sdkClient && sdkClient !== client ? 1 : 0;
    let hasIndexedObjectClient = waitResults[objectReadWaitIndex]?.status === "fulfilled";

    clearChainReadCache(client);
    if (sdkClient) clearChainReadCache(sdkClient);

    const grouped = groupWalletBalanceChanges(result.balanceChanges ?? []);
    let usedGraphqlFallback = false;
    let snapshots: GovexTransactionSnapshot[];
    try {
        snapshots =
            grouped.size > 0
                ? await Promise.all(
                      [...grouped].map(([owner, coinTypes]) =>
                          client.waitForTransactionSnapshot({
                              digest: result.digest,
                              owner,
                              coinTypes,
                              timeout: RECONCILIATION_WAIT_MS,
                          })
                      )
                  )
                : [
                      await client.waitForTransactionSnapshot({
                          digest: result.digest,
                          timeout: RECONCILIATION_WAIT_MS,
                      }),
                  ];
    } catch (error) {
        usedGraphqlFallback = true;
        warnings.push(error instanceof Error ? error.message : String(error));
        console.warn("GraphQL reconciliation unavailable; using indexed gRPC balances", error);
        if (!hasIndexedGrpcClient) {
            return { snapshots: [], usedGraphqlFallback, status: "deferred", warnings };
        }
        try {
            snapshots = await readIndexedBalanceFallback(client, result.digest, grouped);
        } catch (fallbackError) {
            warnings.push(fallbackError instanceof Error ? fallbackError.message : String(fallbackError));
            return { snapshots: [], usedGraphqlFallback, status: "deferred", warnings };
        }
    }

    if ((result.objectChanges?.length ?? 0) > 0 && !hasIndexedObjectClient) {
        const objectClient = sdkClient ?? client;
        const retry = await retryObjectIndexBarrier(objectClient, result.digest, options, RECONCILIATION_WAIT_MS / 2);
        hasIndexedObjectClient = retry.indexed;
        if (retry.warning) warnings.push(retry.warning);
    }

    // A query started before the transaction can finish after the checkpoint
    // read. Cancel it again immediately before committing exact state.
    await cancelProjectionQueries(queryClient);
    for (const snapshot of snapshots) {
        const owner = snapshot.owner;
        if (owner) applyExactKnownBalanceCaches(queryClient, owner, snapshot.balances, result.digest);
    }
    if ((result.objectChanges?.length ?? 0) > 0 && !hasIndexedObjectClient) {
        // GraphQL proved the balance snapshot, but object/wrapper reads are not
        // safe yet. Retain the overlay and make callers keep actions disabled.
        return { snapshots, usedGraphqlFallback, status: "deferred", warnings };
    }
    removeConfirmedEffects(queryClient, result.digest);
    return {
        snapshots,
        usedGraphqlFallback,
        status: usedGraphqlFallback ? "fallback" : "reconciled",
        warnings,
    };
}

/**
 * Serialize checkpoint commits per QueryClient. Each later transaction reads
 * GraphQL after the prior commit, so an older response cannot overwrite a
 * newer confirmed balance when several transactions settle together.
 */
export function reconcileConfirmedEffects(input: {
    queryClient: QueryClient;
    client: GovexSuiClient;
    sdkClient?: GovexSuiClient;
    result: ConfirmedTransactionResult;
}): Promise<ReconciliationResult> {
    const previous = reconciliationQueues.get(input.queryClient) ?? Promise.resolve();
    const run = previous.catch(() => undefined).then(() => reconcileConfirmedEffectsOnce(input));
    const tail = run.then(
        () => undefined,
        () => undefined
    );
    reconciliationQueues.set(input.queryClient, tail);
    void tail.finally(() => {
        if (reconciliationQueues.get(input.queryClient) === tail) {
            reconciliationQueues.delete(input.queryClient);
        }
    });
    return run;
}
