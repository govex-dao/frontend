/**
 * React Query hooks for live onchain multisig data (RPC)
 */

import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@/lib/sui/dapp-kit-compat";
import {
    fetchMultisigConfig,
    fetchAccountIntents,
    fetchAccountVaultNames,
    fetchAccountStreams,
    fetchAccountVestings,
    fetchAccountVaultBalances,
    fetchVaultApprovedCoinTypes,
    fetchAccountPackageNames,
    fetchAccountPackageInfo,
    fetchAccountLockedCurrencies,
    fetchAccountLockedCaps,
    fetchAccountOwnedObjects,
} from "../lib/sui/multisig";
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
} from "../lib/sui/multisig";
import { REFRESH_INTERVALS } from "./api/refresh";

export const multisigRpcKeys = {
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

/**
 * Fetch MultisigConfig directly from RPC (live data)
 */
export function useMultisigConfig(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<MultisigConfig | null>({
        queryKey: multisigRpcKeys.config(accountId!),
        queryFn: () => fetchMultisigConfig(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000, // 30 seconds
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch intents directly from RPC (live data)
 */
export function useMultisigIntents(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<IntentSummary[]>({
        queryKey: multisigRpcKeys.intents(accountId!),
        queryFn: () => fetchAccountIntents(client, accountId!),
        enabled: !!accountId,
        staleTime: 15_000, // 15 seconds
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}

/**
 * Fetch vault names on an account (live RPC data)
 */
export function useMultisigVaultNames(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<string[]>({
        queryKey: multisigRpcKeys.vaultNames(accountId!),
        queryFn: () => fetchAccountVaultNames(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch active streams across all vaults on an account (live RPC data)
 */
export function useMultisigStreams(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<VaultStreamInfo[]>({
        queryKey: multisigRpcKeys.streams(accountId!),
        queryFn: () => fetchAccountStreams(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}

/**
 * Fetch registered vestings for an account (live RPC data)
 */
export function useMultisigVestings(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<AccountVestingInfo[]>({
        queryKey: multisigRpcKeys.vestings(accountId!),
        queryFn: () => fetchAccountVestings(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch all coin balances across all vaults on an account (live RPC data)
 */
export function useMultisigVaultBalances(accountId: string | undefined, options: { enabled?: boolean } = {}) {
    const client = useSuiClient();

    return useQuery<VaultCoinBalance[]>({
        queryKey: multisigRpcKeys.vaultBalances(accountId!),
        queryFn: () => fetchAccountVaultBalances(client, accountId!),
        enabled: !!accountId && (options.enabled ?? true),
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}

/**
 * Fetch approved coin types for a specific vault (live RPC data)
 */
export function useVaultApprovedCoinTypes(accountId: string | undefined, vaultName: string | undefined) {
    const client = useSuiClient();

    return useQuery<string[]>({
        queryKey: multisigRpcKeys.vaultApprovedCoins(accountId!, vaultName!),
        queryFn: () => fetchVaultApprovedCoinTypes(client, accountId!, vaultName!),
        enabled: !!accountId && !!vaultName,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch package names with locked UpgradeCaps on the account (live RPC data)
 */
export function useMultisigPackageNames(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<string[]>({
        queryKey: multisigRpcKeys.packageNames(accountId!),
        queryFn: () => fetchAccountPackageNames(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch full info for locked UpgradeCaps: name, package address, delay, policy.
 */
export function useMultisigPackageInfo(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<LockedPackageInfo[]>({
        queryKey: multisigRpcKeys.packageInfo(accountId!),
        queryFn: () => fetchAccountPackageInfo(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch locked currencies (TreasuryCap/MetadataCap) on the account (live RPC data)
 */
export function useMultisigLockedCurrencies(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<LockedCurrency[]>({
        queryKey: multisigRpcKeys.lockedCurrencies(accountId!),
        queryFn: () => fetchAccountLockedCurrencies(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch non-package capability objects locked on the account (controlled caps and currency caps).
 */
export function useMultisigLockedCaps(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<LockedCapInfo[]>({
        queryKey: multisigRpcKeys.lockedCaps(accountId!),
        queryFn: () => fetchAccountLockedCaps(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

/**
 * Fetch objects owned by the account (live RPC data)
 */
export function useMultisigOwnedObjects(accountId: string | undefined) {
    const client = useSuiClient();

    return useQuery<OwnedObjectInfo[]>({
        queryKey: multisigRpcKeys.ownedObjects(accountId!),
        queryFn: () => fetchAccountOwnedObjects(client, accountId!),
        enabled: !!accountId,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}
