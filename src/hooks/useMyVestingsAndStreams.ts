/**
 * React Query hooks for fetching the connected user's VestingCap, StreamCap, and SpendingCap objects,
 * plus their associated onchain vesting/stream details.
 */

import { useQuery } from "@tanstack/react-query";
import { useSuiClient, useCurrentAccount } from "@mysten/dapp-kit";
import type { SuiClient, SuiObjectResponse } from "@mysten/sui/client";
import { getSDK } from "@/lib/sdk";
import type { VaultStreamInfo } from "@/lib/sui/multisig";
import { REFRESH_INTERVALS } from "./api/refresh";

// --- Types ---

export interface MyVestingInfo {
    capId: string;
    vestingId: string;
    accountId: string;
    daoAddress: string;
    coinType: string;
    balance: bigint;
    amountPerIteration: bigint;
    claimedAmount: bigint;
    firstUnclaimedIteration: bigint;
    partialClaimedInIteration: bigint;
    startTimeMs: number;
    iterationsTotal: number;
    iterationPeriodMs: number;
    isCancellable: boolean;
}

export interface MyStreamInfo extends VaultStreamInfo {
    capId: string;
    streamId: string;
    accountId: string;
    accountAddr: string;
}

export interface MySpendingLimitInfo extends VaultStreamInfo {
    capId: string;
    spendingLimitId: string;
    accountId: string;
    accountAddr: string;
}

// --- Helpers ---

interface OwnedVaultStreamCap {
    capId: string;
    streamId: string;
    accountId: string;
    accountAddr: string;
    vaultName: string;
    capHolder: string;
    isSpendingLimit: boolean;
}

type OwnedVaultStreamDetails = VaultStreamInfo & OwnedVaultStreamCap;

function parseOptionU64(value: unknown): number | null {
    if (value == null) return null;
    const obj = value as Record<string, unknown>;
    const fields = obj?.fields as Record<string, unknown> | undefined;
    const vec = (fields?.vec ?? (obj as Record<string, unknown>)?.vec) as unknown[] | undefined;
    if (Array.isArray(vec) && vec.length > 0) return Number(vec[0]);
    if (typeof value === "number") return value;
    if (typeof value === "string" && (value as string).length > 0) return Number(value);
    return null;
}

function parseTypeName(value: unknown): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string" && (value as string).trim().length > 0) return (value as string).trim();
    const obj = value as Record<string, unknown>;
    const fields = (obj?.fields || obj) as Record<string, unknown>;
    const name = fields?.name;
    if (typeof name === "string" && name.trim().length > 0) return name.trim();
    return undefined;
}

function parseAddressVector(value: unknown): string[] {
    if (!value) return [];
    if (Array.isArray(value)) return value.map((item) => String(item)).filter((item) => item.length > 0);
    const obj = value as Record<string, unknown>;
    const fields = (obj?.fields || obj) as Record<string, unknown>;
    const contents = fields?.contents ?? fields?.values ?? fields?.vec;
    if (!Array.isArray(contents)) return [];
    return contents.map((item) => String(item)).filter((item) => item.length > 0);
}

function parseVaultName(value: unknown): string {
    if (typeof value === "string") return value;
    const obj = value as Record<string, unknown> | undefined;
    const fields = obj?.fields as Record<string, unknown> | undefined;
    const fieldName = fields?.name;
    if (typeof fieldName === "string") return fieldName;
    const directName = obj?.name;
    if (typeof directName === "string") return directName;
    return "";
}

function normalizeIdValue(value: unknown): string {
    if (!value) return "";
    if (typeof value === "string") {
        const trimmed = value.trim();
        if (!trimmed) return "";
        return trimmed.startsWith("0x") ? trimmed : `0x${trimmed}`;
    }
    const obj = value as Record<string, unknown>;
    const fields = (obj?.fields || obj) as Record<string, unknown>;
    return normalizeIdValue(fields?.id ?? fields?.bytes ?? fields?.value);
}

/**
 * Normalize a coin type from onchain TypeName format to standard short-form.
 * "0000...0002::sui::SUI" -> "0x2::sui::SUI"
 */
function normalizeCoinType(coinType: string): string {
    if (typeof coinType !== "string") return "";
    let trimmed = coinType.trim();
    if (!trimmed.includes("::")) return trimmed;
    if (!trimmed.startsWith("0x")) trimmed = `0x${trimmed}`;
    const parts = trimmed.split("::");
    if (parts.length >= 3) {
        const addr = parts[0].replace(/^0x0+/, "0x") || "0x0";
        return `${addr}::${parts.slice(1).join("::")}`;
    }
    return trimmed;
}

/**
 * Extract the CoinType from a Vesting<CoinType> object type string.
 * e.g. "0x...::vesting::Vesting<0x2::sui::SUI>" -> "0x2::sui::SUI"
 */
function extractCoinTypeFromObjectType(objectType: string): string {
    const start = objectType.indexOf("<");
    const end = objectType.lastIndexOf(">");
    if (start === -1 || end === -1 || end <= start) return "unknown";
    return objectType.slice(start + 1, end).trim();
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function get(obj: any, path: string, defaultValue: any = null): any {
    const keys = path.split(".");
    let result = obj;
    for (const key of keys) {
        if (result == null) return defaultValue;
        result = result[key];
    }
    return result ?? defaultValue;
}

// --- Paginated owned object fetcher ---

async function getAllOwnedObjects(client: SuiClient, owner: string, structType?: string): Promise<SuiObjectResponse[]> {
    const all: SuiObjectResponse[] = [];
    let cursor: string | null | undefined = null;

    while (true) {
        const page = await client.getOwnedObjects({
            owner,
            options: { showContent: true, showType: true },
            ...(structType ? { filter: { StructType: structType } } : {}),
            ...(cursor ? { cursor } : {}),
        });
        all.push(...page.data);
        if (!page.hasNextPage || !page.nextCursor) break;
        cursor = page.nextCursor;
    }

    return all;
}

function objectTypeHasStructSuffix(objectType: string | null | undefined, suffix: string): boolean {
    if (!objectType) return false;
    const baseType = objectType.split("<")[0] ?? objectType;
    return baseType.endsWith(suffix);
}

async function getOwnedObjectsByStructOrSuffix(
    client: SuiClient,
    owner: string,
    structType: string,
    suffix: string
): Promise<SuiObjectResponse[]> {
    const exactMatches = await getAllOwnedObjects(client, owner, structType);
    if (exactMatches.length > 0) return exactMatches;

    const ownedObjects = await getAllOwnedObjects(client, owner);
    return ownedObjects.filter((obj) => objectTypeHasStructSuffix(obj.data?.type, suffix));
}

// --- Fetchers ---

async function fetchMyVestings(client: SuiClient, owner: string, actionsPackageId: string): Promise<MyVestingInfo[]> {
    // 1. Get all VestingCap objects owned by user
    const caps = await getOwnedObjectsByStructOrSuffix(
        client,
        owner,
        `${actionsPackageId}::vesting::VestingCap`,
        "::vesting::VestingCap"
    );

    if (caps.length === 0) return [];

    // 2. Parse cap fields and fetch associated Vesting objects in parallel
    const vestings = await Promise.all(
        caps.map(async (capObj) => {
            try {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const capFields = (capObj.data?.content as any)?.fields;
                if (!capFields) return null;

                const capId = capObj.data?.objectId ?? "";
                const vestingId = normalizeIdValue(capFields.vesting_id);
                const accountId = normalizeIdValue(capFields.account_id);
                const daoAddress = normalizeIdValue(capFields.dao_address);

                if (!vestingId) return null;

                // Fetch the Vesting shared object
                const vestingObj = await client.getObject({
                    id: vestingId,
                    options: { showContent: true, showType: true },
                });

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const fields = (vestingObj.data?.content as any)?.fields;
                if (!fields) return null;

                // Extract CoinType from the object type: "...::vesting::Vesting<CoinType>"
                const objectType = vestingObj.data?.type ?? "";
                const coinType = normalizeCoinType(
                    parseTypeName(fields.coin_type) ?? extractCoinTypeFromObjectType(objectType)
                );

                return {
                    capId,
                    vestingId,
                    accountId,
                    daoAddress,
                    coinType,
                    balance: BigInt(get(fields, "balance.fields.value", "0") || fields.balance?.value || "0"),
                    amountPerIteration: BigInt(fields.amount_per_iteration ?? 0),
                    claimedAmount: BigInt(fields.claimed_amount ?? 0),
                    firstUnclaimedIteration: BigInt(fields.first_unclaimed_iteration ?? 0),
                    partialClaimedInIteration: BigInt(fields.partial_claimed_in_iteration ?? 0),
                    startTimeMs: Number(fields.start_time ?? 0),
                    iterationsTotal: Number(fields.iterations_total ?? 0),
                    iterationPeriodMs: Number(fields.iteration_period_ms ?? 0),
                    isCancellable: Boolean(fields.is_cancellable),
                } satisfies MyVestingInfo;
            } catch {
                return null;
            }
        })
    );

    return vestings.filter((v): v is MyVestingInfo => v !== null);
}

async function fetchMyStreams(client: SuiClient, owner: string, actionsPackageId: string): Promise<MyStreamInfo[]> {
    const capInfos = await fetchOwnedVaultStreamCaps(client, owner, actionsPackageId, {
        structName: "StreamCap",
        streamIdField: "stream_id",
        isSpendingLimit: false,
    });
    const streams = await fetchOwnedVaultStreamDetails(client, capInfos);
    return streams.map(
        (stream) =>
            ({
                ...stream,
                streamId: stream.streamId,
            }) satisfies MyStreamInfo
    );
}

async function fetchMySpendingLimits(
    client: SuiClient,
    owner: string,
    actionsPackageId: string
): Promise<MySpendingLimitInfo[]> {
    const capInfos = await fetchOwnedVaultStreamCaps(client, owner, actionsPackageId, {
        structName: "SpendingCap",
        streamIdField: "spending_limit_id",
        isSpendingLimit: true,
    });
    const spendingLimits = await fetchOwnedVaultStreamDetails(client, capInfos);
    return spendingLimits.map(
        ({ streamId, ...spendingLimit }) =>
            ({
                ...spendingLimit,
                spendingLimitId: streamId,
            }) satisfies MySpendingLimitInfo
    );
}

async function fetchOwnedVaultStreamCaps(
    client: SuiClient,
    owner: string,
    actionsPackageId: string,
    config: {
        structName: "StreamCap" | "SpendingCap";
        streamIdField: "stream_id" | "spending_limit_id";
        isSpendingLimit: boolean;
    }
): Promise<OwnedVaultStreamCap[]> {
    const capObjects = await getOwnedObjectsByStructOrSuffix(
        client,
        owner,
        `${actionsPackageId}::vault::${config.structName}`,
        `::vault::${config.structName}`
    );

    if (capObjects.length === 0) return [];

    const capInfos: OwnedVaultStreamCap[] = [];
    for (const capObj of capObjects) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const capFields = (capObj.data?.content as any)?.fields;
        if (!capFields) continue;

        capInfos.push({
            capId: capObj.data?.objectId ?? "",
            streamId: normalizeIdValue(capFields[config.streamIdField]),
            accountId: normalizeIdValue(capFields.account_id),
            accountAddr: normalizeIdValue(capFields.account_addr),
            vaultName: parseVaultName(capFields.vault_name),
            capHolder: owner,
            isSpendingLimit: config.isSpendingLimit,
        });
    }

    return capInfos.filter((cap) => cap.streamId && cap.accountId && cap.vaultName);
}

function createStreamsTableResolver(client: SuiClient) {
    type VaultKey = string;
    const vaultKeyFn = (accountId: string, vaultName: string): VaultKey => `${accountId}::${vaultName}`;

    const vaultStreamTableCache = new Map<VaultKey, string | null>();

    async function getStreamsTableId(accountId: string, vaultName: string): Promise<string | null> {
        const key = vaultKeyFn(accountId, vaultName);
        if (vaultStreamTableCache.has(key)) return vaultStreamTableCache.get(key) ?? null;

        try {
            // List dynamic fields on account to find VaultKey
            const dynFields: Array<{ name: unknown }> = [];
            let cursor: string | null | undefined = null;
            while (true) {
                const page = await client.getDynamicFields({
                    parentId: accountId,
                    ...(cursor ? { cursor } : {}),
                });
                dynFields.push(...(page.data as Array<{ name: unknown }>));
                if (!page.hasNextPage || !page.nextCursor) break;
                cursor = page.nextCursor;
            }

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const vaultField = dynFields.find((df: any) => {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const nameType = (df.name as any)?.type || "";
                if (nameType.includes("VaultNamesKey")) return false;
                if (!nameType.includes("VaultKey") && !nameType.includes("vault::VaultKey")) return false;
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const value = (df.name as any)?.value;
                const name = typeof value === "string" ? value : (value?.pos0 ?? value?.name ?? "");
                return name === vaultName;
            });

            if (!vaultField) {
                vaultStreamTableCache.set(key, null);
                return null;
            }

            const vaultObj = await client.getDynamicFieldObject({
                parentId: accountId,
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                name: vaultField.name as any,
            });

            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            const fields = (vaultObj.data?.content as any)?.fields?.value?.fields;
            if (!fields) {
                vaultStreamTableCache.set(key, null);
                return null;
            }

            const streamsTableId = get(fields, "streams.fields.id.id") || get(fields, "streams.fields.id");

            vaultStreamTableCache.set(key, streamsTableId ?? null);
            return streamsTableId ?? null;
        } catch {
            vaultStreamTableCache.set(key, null);
            return null;
        }
    }

    return getStreamsTableId;
}

async function getVaultStreamDynamicField(
    client: SuiClient,
    streamsTableId: string,
    streamId: string
): Promise<SuiObjectResponse | null> {
    const names = [
        { type: "0x2::object::ID", value: streamId },
        { type: "address", value: streamId },
    ];

    for (const name of names) {
        try {
            const streamObj = await client.getDynamicFieldObject({ parentId: streamsTableId, name });
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            if ((streamObj.data?.content as any)?.fields?.value?.fields) return streamObj;
        } catch {
            // Try the legacy address key shape next.
        }
    }

    return null;
}

async function fetchOwnedVaultStreamDetails(
    client: SuiClient,
    capInfos: OwnedVaultStreamCap[]
): Promise<OwnedVaultStreamDetails[]> {
    if (capInfos.length === 0) return [];
    const getStreamsTableId = createStreamsTableResolver(client);

    const streams: Array<OwnedVaultStreamDetails | null> = await Promise.all(
        capInfos.map(async (cap) => {
            try {
                const streamsTableId = await getStreamsTableId(cap.accountId, cap.vaultName);
                if (!streamsTableId) return null;

                const streamObj = await getVaultStreamDynamicField(client, streamsTableId, cap.streamId);
                if (!streamObj) return null;

                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                const streamFields = (streamObj.data?.content as any)?.fields?.value?.fields;
                if (!streamFields) return null;

                const coinType = normalizeCoinType(parseTypeName(streamFields.coin_type) ?? "unknown");

                return {
                    id: normalizeIdValue(streamFields.id) || cap.streamId,
                    vaultName: cap.vaultName,
                    coinType,
                    capHolder: cap.capHolder,
                    amountPerIteration: BigInt(streamFields.amount_per_iteration ?? 0),
                    claimedAmount: BigInt(streamFields.claimed_amount ?? 0),
                    firstUnclaimedIteration: BigInt(streamFields.first_unclaimed_iteration ?? 0),
                    partialClaimedInIteration: BigInt(streamFields.partial_claimed_in_iteration ?? 0),
                    startTimeMs: Number(streamFields.start_time ?? 0),
                    iterationsTotal: Number(streamFields.iterations_total ?? 0),
                    iterationPeriodMs: Number(streamFields.iteration_period_ms ?? 0),
                    claimWindowMs: parseOptionU64(streamFields.claim_window_ms),
                    expiryMs: parseOptionU64(streamFields.expiry_ms),
                    whitelistedRecipients: parseAddressVector(streamFields.whitelisted_recipients),
                    isSpendingLimit: cap.isSpendingLimit,
                    capId: cap.capId,
                    streamId: cap.streamId,
                    accountId: cap.accountId,
                    accountAddr: cap.accountAddr,
                } satisfies OwnedVaultStreamDetails;
            } catch {
                return null;
            }
        })
    );

    return streams.filter((s): s is OwnedVaultStreamDetails => s !== null);
}

// --- Query keys ---

export const myVestingsAndStreamsKeys = {
    vestings: (owner: string) => ["my-vestings", owner] as const,
    streams: (owner: string) => ["my-streams", owner] as const,
    spendingLimits: (owner: string) => ["my-spending-limits", owner] as const,
};

// --- Hooks ---

export function useMyVestings() {
    const client = useSuiClient();
    const account = useCurrentAccount();
    const owner = account?.address;

    return useQuery<MyVestingInfo[]>({
        queryKey: myVestingsAndStreamsKeys.vestings(owner!),
        queryFn: () => {
            const sdk = getSDK();
            const actionsPackageId = sdk.packages.accountActions;
            if (!actionsPackageId) throw new Error("accountActions package not configured");
            return fetchMyVestings(client, owner!, actionsPackageId);
        },
        enabled: !!owner,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

export function useMyStreams() {
    const client = useSuiClient();
    const account = useCurrentAccount();
    const owner = account?.address;

    return useQuery<MyStreamInfo[]>({
        queryKey: myVestingsAndStreamsKeys.streams(owner!),
        queryFn: () => {
            const sdk = getSDK();
            const actionsPackageId = sdk.packages.accountActions;
            if (!actionsPackageId) throw new Error("accountActions package not configured");
            return fetchMyStreams(client, owner!, actionsPackageId);
        },
        enabled: !!owner,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}

export function useMySpendingLimits() {
    const client = useSuiClient();
    const account = useCurrentAccount();
    const owner = account?.address;

    return useQuery<MySpendingLimitInfo[]>({
        queryKey: myVestingsAndStreamsKeys.spendingLimits(owner!),
        queryFn: () => {
            const sdk = getSDK();
            const actionsPackageId = sdk.packages.accountActions;
            if (!actionsPackageId) throw new Error("accountActions package not configured");
            return fetchMySpendingLimits(client, owner!, actionsPackageId);
        },
        enabled: !!owner,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}

/**
 * Combined hook for convenience — returns vestings, streams, spending limits, and loading state.
 */
export function useMyVestingsAndStreams() {
    const vestingsQuery = useMyVestings();
    const streamsQuery = useMyStreams();
    const spendingLimitsQuery = useMySpendingLimits();

    return {
        vestings: vestingsQuery.data ?? [],
        streams: streamsQuery.data ?? [],
        spendingLimits: spendingLimitsQuery.data ?? [],
        isLoading: vestingsQuery.isLoading || streamsQuery.isLoading || spendingLimitsQuery.isLoading,
        isError: vestingsQuery.isError || streamsQuery.isError || spendingLimitsQuery.isError,
    };
}
