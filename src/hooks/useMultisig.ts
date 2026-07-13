/**
 * React Query hooks for live onchain multisig data (RPC)
 */

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import type {
    MultisigConfig,
    IntentSummary,
    VaultStreamInfo,
    AccountVestingInfo,
    VaultCoinBalance,
    LockedCurrency,
    LockedCapInfo,
    LockedPackageInfo,
    OwnedObjectInfo,
} from "@govex/futarchy-sdk/multisig/reads";
import { getSDK } from "@/lib/sdk";
import { REFRESH_INTERVALS } from "./api/refresh";

function getMultisigReads() {
    const reads = getSDK().multisig?.reads;
    if (!reads) throw new Error("Multisig reads are unavailable for this deployment");
    return reads;
}

export const multisigRpcKeys = {
    configs: (ids: readonly string[]) => ["multisig-rpc", "configs", ...ids] as const,
    config: (id: string) => ["multisig-rpc", "config", id] as const,
    intents: (id: string) => ["multisig-rpc", "intents", id] as const,
    vaultNames: (id: string) => ["multisig-rpc", "vault-names", id] as const,
    streams: (id: string) => ["multisig-rpc", "streams", id] as const,
    vestings: (id: string) => ["multisig-rpc", "vestings", id] as const,
    vaultBalances: (id: string) => ["multisig-rpc", "vault-balances", id] as const,
    vaultApprovedCoins: (id: string, vault: string) => ["multisig-rpc", "vault-approved-coins", id, vault] as const,
    packageNames: (id: string) => ["multisig-rpc", "package-names", id] as const,
    packageInfo: (id: string) => ["multisig-rpc", "package-info", id] as const,
    lockedCurrencies: (id: string) => ["multisig-rpc", "locked-currencies", id] as const,
    lockedCaps: (id: string) => ["multisig-rpc", "locked-caps", id] as const,
    ownedObjects: (id: string) => ["multisig-rpc", "owned-objects", id] as const,
};

/** Load configs for the visible list page as one bounded SDK operation. */
export function useMultisigConfigs(accountIds: readonly string[]) {
    const ids = useMemo(() => [...new Set(accountIds.filter(Boolean))].sort(), [accountIds]);
    return useQuery({
        queryKey: multisigRpcKeys.configs(ids),
        queryFn: () => getMultisigReads().getConfigs(ids),
        enabled: ids.length > 0,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch MultisigConfig directly from RPC (live data)
 */
export function useMultisigConfig(accountId: string | undefined) {
    return useQuery<MultisigConfig | null>({
        queryKey: multisigRpcKeys.config(accountId!),
        queryFn: () => getMultisigReads().getConfig(accountId!),
        enabled: !!accountId,
        staleTime: 30_000, // 30 seconds
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch intents directly from RPC (live data)
 */
export function useMultisigIntents(accountId: string | undefined) {
    return useQuery<IntentSummary[]>({
        queryKey: multisigRpcKeys.intents(accountId!),
        queryFn: () => getMultisigReads().getIntents(accountId!),
        enabled: !!accountId,
        staleTime: 15_000, // 15 seconds
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}

/**
 * Fetch vault names on an account (live RPC data)
 */
export function useMultisigVaultNames(accountId: string | undefined, options: { enabled?: boolean } = {}) {
    return useQuery<string[]>({
        queryKey: multisigRpcKeys.vaultNames(accountId!),
        queryFn: () => getMultisigReads().getVaultNames(accountId!),
        enabled: !!accountId && (options.enabled ?? true),
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch active streams across all vaults on an account (live RPC data)
 */
export function useMultisigStreams(accountId: string | undefined) {
    return useQuery<VaultStreamInfo[]>({
        queryKey: multisigRpcKeys.streams(accountId!),
        queryFn: () => getMultisigReads().getStreams(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch registered vestings for an account (live RPC data)
 */
export function useMultisigVestings(accountId: string | undefined) {
    return useQuery<AccountVestingInfo[]>({
        queryKey: multisigRpcKeys.vestings(accountId!),
        queryFn: () => getMultisigReads().getVestings(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch all coin balances across all vaults on an account (live RPC data)
 */
export function useMultisigVaultBalances(accountId: string | undefined, options: { enabled?: boolean } = {}) {
    return useQuery<VaultCoinBalance[]>({
        queryKey: multisigRpcKeys.vaultBalances(accountId!),
        queryFn: () => getMultisigReads().getVaultBalances(accountId!),
        enabled: !!accountId && (options.enabled ?? true),
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch approved coin types for a specific vault (live RPC data)
 */
export function useVaultApprovedCoinTypes(
    accountId: string | undefined,
    vaultName: string | undefined,
    options: { enabled?: boolean } = {}
) {
    return useQuery<string[]>({
        queryKey: multisigRpcKeys.vaultApprovedCoins(accountId!, vaultName!),
        queryFn: () => getMultisigReads().getVaultApprovedCoinTypes(accountId!, vaultName!),
        enabled: !!accountId && !!vaultName && (options.enabled ?? true),
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch package names with locked UpgradeCaps on the account (live RPC data)
 */
export function useMultisigPackageNames(accountId: string | undefined) {
    return useQuery<string[]>({
        queryKey: multisigRpcKeys.packageNames(accountId!),
        queryFn: () => getMultisigReads().getPackageNames(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch full info for locked UpgradeCaps: name, package address, delay, policy.
 */
export function useMultisigPackageInfo(accountId: string | undefined) {
    return useQuery<LockedPackageInfo[]>({
        queryKey: multisigRpcKeys.packageInfo(accountId!),
        queryFn: () => getMultisigReads().getPackageInfo(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch locked currencies (TreasuryCap/MetadataCap) on the account (live RPC data)
 */
export function useMultisigLockedCurrencies(accountId: string | undefined) {
    return useQuery<LockedCurrency[]>({
        queryKey: multisigRpcKeys.lockedCurrencies(accountId!),
        queryFn: () => getMultisigReads().getLockedCurrencies(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch non-package capability objects locked on the account (controlled caps and currency caps).
 */
export function useMultisigLockedCaps(accountId: string | undefined) {
    return useQuery<LockedCapInfo[]>({
        queryKey: multisigRpcKeys.lockedCaps(accountId!),
        queryFn: () => getMultisigReads().getLockedCaps(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch objects owned by the account (live RPC data)
 */
export function useMultisigOwnedObjects(accountId: string | undefined) {
    return useQuery<OwnedObjectInfo[]>({
        queryKey: multisigRpcKeys.ownedObjects(accountId!),
        queryFn: () => getMultisigReads().getOwnedObjects(accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}
