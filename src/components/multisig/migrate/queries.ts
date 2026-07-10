import { useMemo } from "react";
import type { CoinStruct, SuiClient } from "@govex/futarchy-sdk";
import { parseStructTag } from "@mysten/sui/utils";
import { useQuery } from "@tanstack/react-query";
import { useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { COIN_OBJECT_PAGE_LIMIT, MAX_COIN_OBJECTS_PER_DEPOSIT } from "./constants";
import type { CoinObjectScan, ObjectTransferAbility, WalletBalance } from "./types";
import { extractUpgradeCapPackageId, normalizeAddressInput, objectTypeAbilityKey } from "./utils";

interface CoinObjectFetchResult {
    coinObjects: CoinStruct[];
    objectBalance: bigint;
    isComplete: boolean;
    hitObjectLimit: boolean;
}

export async function fetchCoinObjectsForAmount(
    client: SuiClient,
    owner: string,
    coinType: string,
    stopAtBalance?: bigint
): Promise<CoinObjectFetchResult> {
    const coinObjects: CoinStruct[] = [];
    let objectBalance = 0n;
    let cursor: string | null | undefined;

    for (;;) {
        const remaining = MAX_COIN_OBJECTS_PER_DEPOSIT - coinObjects.length;
        if (remaining <= 0) {
            return {
                coinObjects,
                objectBalance,
                isComplete: false,
                hitObjectLimit: stopAtBalance == null || objectBalance < stopAtBalance,
            };
        }

        const page = await client.getCoins({
            owner,
            coinType,
            cursor: cursor ?? undefined,
            limit: Math.min(COIN_OBJECT_PAGE_LIMIT, remaining),
        });
        const hasMore = !!page.hasNextPage && !!page.nextCursor;
        for (let i = 0; i < page.data.length; i += 1) {
            const coin = page.data[i];
            if (!coin) continue;
            coinObjects.push(coin);
            objectBalance += BigInt(coin.balance || "0");

            if (stopAtBalance != null && objectBalance >= stopAtBalance) {
                return {
                    coinObjects,
                    objectBalance,
                    isComplete: !hasMore && i === page.data.length - 1,
                    hitObjectLimit: false,
                };
            }
        }

        if (!hasMore) {
            return { coinObjects, objectBalance, isComplete: true, hitObjectLimit: false };
        }
        cursor = page.nextCursor;
    }
}

export function useWalletBalances(owner: string | undefined, enabled: boolean) {
    const client = useSuiClient();
    return useQuery<WalletBalance[]>({
        queryKey: ["wallet-balances", owner],
        queryFn: async () => {
            const balances = await client.getAllBalances({ owner: owner! });
            return balances.map((balance) => ({
                coinType: balance.coinType,
                totalBalance: balance.totalBalance,
            }));
        },
        enabled: enabled && !!owner,
        staleTime: 30_000,
    });
}

export function useSelectedCoinObjectScans(owner: string | undefined, coinTypes: string[], enabled: boolean) {
    const client = useSuiClient();
    return useQuery<CoinObjectScan[]>({
        queryKey: ["wallet-selected-coin-object-scans", owner, ...coinTypes],
        queryFn: async () =>
            Promise.all(
                coinTypes.map(async (coinType) => {
                    const result = await fetchCoinObjectsForAmount(client, owner!, coinType);
                    return {
                        coinType,
                        objectBalance: result.objectBalance.toString(),
                        coinObjectCount: result.coinObjects.length,
                        isComplete: result.isComplete,
                        hitObjectLimit: result.hitObjectLimit,
                    };
                })
            ),
        enabled: enabled && !!owner && coinTypes.length > 0,
        staleTime: 30_000,
    });
}

export function useUpgradeCapPackageIds(upgradeCapIds: string[], enabled: boolean) {
    const client = useSuiClient();
    return useQuery<Record<string, string>>({
        queryKey: ["wallet-upgrade-cap-packages", ...upgradeCapIds],
        queryFn: async () => {
            const responses = await client.multiGetObjects({
                ids: upgradeCapIds,
                options: { showContent: true },
            });
            const next: Record<string, string> = {};
            responses.forEach((response, index) => {
                const packageId = extractUpgradeCapPackageId(response.data?.content);
                const objectId = upgradeCapIds[index];
                if (objectId && packageId) next[objectId] = packageId;
            });
            return next;
        },
        enabled: enabled && upgradeCapIds.length > 0,
        staleTime: 30_000,
    });
}

export function useObjectTransferAbilities(objectTypes: string[], enabled: boolean) {
    const client = useSuiClient();
    const typeKey = useMemo(() => [...new Set(objectTypes)].sort((a, b) => a.localeCompare(b)), [objectTypes]);

    return useQuery<Record<string, ObjectTransferAbility>>({
        queryKey: ["wallet-object-transfer-abilities", ...typeKey],
        queryFn: async () => {
            const entries = await Promise.all(
                typeKey.map(async (objectType): Promise<[string, ObjectTransferAbility]> => {
                    const key = objectTypeAbilityKey(objectType);
                    try {
                        const tag = parseStructTag(objectType);
                        const legacyClient = client as unknown as {
                            getNormalizedMoveStruct?: (input: {
                                package: string;
                                module: string;
                                struct: string;
                            }) => Promise<{ abilities: { abilities: string[] } }>;
                            movePackageService?: {
                                getDatatype: (input: {
                                    packageId: string;
                                    moduleName: string;
                                    name: string;
                                }) => Promise<{ response: { datatype?: { abilities: number[] } } }>;
                            };
                        };

                        let canKeep = false;
                        if (legacyClient.getNormalizedMoveStruct) {
                            const normalized = await legacyClient.getNormalizedMoveStruct({
                                package: normalizeAddressInput(tag.address),
                                module: tag.module,
                                struct: tag.name,
                            });
                            const abilities = normalized.abilities.abilities.map((ability) => ability.toLowerCase());
                            canKeep = abilities.includes("key") && abilities.includes("store");
                        } else {
                            const result = await legacyClient.movePackageService?.getDatatype({
                                packageId: normalizeAddressInput(tag.address),
                                moduleName: tag.module,
                                name: tag.name,
                            });
                            const abilities = result?.response.datatype?.abilities ?? [];
                            canKeep = abilities.includes(4) && abilities.includes(3); // KEY + STORE
                        }
                        return [key, { canKeep, checked: true }];
                    } catch {
                        return [key, { canKeep: false, checked: true, error: true }];
                    }
                })
            );
            return Object.fromEntries(entries);
        },
        enabled: enabled && typeKey.length > 0,
        staleTime: 0,
        refetchOnWindowFocus: false,
    });
}
