/** Wallet-owned vesting, stream, and linked-account queries backed by SDK readers. */

import { useQuery } from "@tanstack/react-query";
import type { OwnedVaultStreamInfo, OwnedVestingInfo, LinkedMultisigAccount } from "@govex/futarchy-sdk/utils";
import { getLinkedMultisigAccounts, getOwnedVaultStreams, getOwnedVestings } from "@govex/futarchy-sdk/utils";
import type { VaultStreamInfo } from "@govex/futarchy-sdk/multisig/reads";
import { useCurrentAccount, useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { getSDK } from "@/lib/sdk";
import { REFRESH_INTERVALS } from "./api/refresh";

export type MyVestingInfo = OwnedVestingInfo;
export type MyLinkedMultisigAccount = LinkedMultisigAccount;

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

function actionsPackageId(): string {
    const packageId = getSDK().packages.accountActions;
    if (!packageId) throw new Error("accountActions package not configured");
    return packageId;
}

function toVaultStreamInfo(stream: OwnedVaultStreamInfo): VaultStreamInfo {
    return {
        id: stream.id,
        vaultName: stream.vaultName,
        coinType: stream.coinType,
        capId: stream.capId,
        streamId: stream.streamId,
        accountId: stream.accountId,
        accountAddr: stream.accountAddr,
        capHolder: stream.capHolder,
        amountPerIteration: stream.amountPerIteration,
        claimedAmount: stream.claimedAmount,
        firstUnclaimedIteration: stream.firstUnclaimedIteration,
        partialClaimedInIteration: stream.partialClaimedInIteration,
        startTimeMs: stream.startTimeMs,
        iterationsTotal: stream.iterationsTotal,
        iterationPeriodMs: stream.iterationPeriodMs,
        claimWindowMs: stream.claimWindowMs ?? null,
        expiryMs: stream.expiryMs ?? null,
        whitelistedRecipients: stream.whitelistedRecipients,
        isSpendingLimit: stream.isSpendingLimit,
    };
}

export const myVestingsAndStreamsKeys = {
    vestings: (owner: string) => ["my-vestings", owner] as const,
    vaultStreams: (owner: string) => ["my-vault-streams", owner] as const,
    linkedMultisigs: (owner: string) => ["my-linked-multisigs", owner] as const,
};

export function useMyVestings() {
    const client = useSuiClient();
    const owner = useCurrentAccount()?.address;
    return useQuery<MyVestingInfo[]>({
        queryKey: myVestingsAndStreamsKeys.vestings(owner!),
        queryFn: () => getOwnedVestings(client, actionsPackageId(), owner!),
        enabled: !!owner,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

function useOwnedVaultStreams() {
    const client = useSuiClient();
    const owner = useCurrentAccount()?.address;
    return useQuery<OwnedVaultStreamInfo[]>({
        queryKey: myVestingsAndStreamsKeys.vaultStreams(owner!),
        queryFn: () => getOwnedVaultStreams(client, actionsPackageId(), owner!),
        enabled: !!owner,
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

export function useMyStreams() {
    const query = useOwnedVaultStreams();
    return {
        ...query,
        data: query.data
            ?.filter((stream) => !stream.isSpendingLimit)
            .map((stream): MyStreamInfo => ({
                ...toVaultStreamInfo(stream),
                capId: stream.capId,
                streamId: stream.streamId,
                accountId: stream.accountId,
                accountAddr: stream.accountAddr,
            })),
    };
}

export function useMySpendingLimits() {
    const query = useOwnedVaultStreams();
    return {
        ...query,
        data: query.data
            ?.filter((stream) => stream.isSpendingLimit)
            .map((stream): MySpendingLimitInfo => ({
                ...toVaultStreamInfo(stream),
                capId: stream.capId,
                spendingLimitId: stream.streamId,
                accountId: stream.accountId,
                accountAddr: stream.accountAddr,
            })),
    };
}

export function useMyLinkedMultisigAccounts(options: { enabled?: boolean } = {}) {
    const client = useSuiClient();
    const owner = useCurrentAccount()?.address;
    return useQuery<MyLinkedMultisigAccount[]>({
        queryKey: myVestingsAndStreamsKeys.linkedMultisigs(owner!),
        queryFn: () => getLinkedMultisigAccounts(client, actionsPackageId(), owner!),
        enabled: !!owner && (options.enabled ?? true),
        staleTime: 30_000,
        refetchInterval: REFRESH_INTERVALS.DISCOVERY,
    });
}

export function useMyVestingsAndStreams() {
    const vestings = useMyVestings();
    const streams = useMyStreams();
    const spendingLimits = useMySpendingLimits();
    return {
        vestings: vestings.data ?? [],
        streams: streams.data ?? [],
        spendingLimits: spendingLimits.data ?? [],
        isLoading: vestings.isLoading || streams.isLoading || spendingLimits.isLoading,
        isError: vestings.isError || streams.isError || spendingLimits.isError,
    };
}
