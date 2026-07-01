import type { SuiClient } from "@mysten/sui/client";
import { Transaction, type TransactionArgument } from "@mysten/sui/transactions";
import { formatAddress, SUI_TYPE_ARG } from "@mysten/sui/utils";
import type { OwnedObjectInfo } from "@/lib/sui/multisig";
import {
    addLockMetadataCapSpec,
    addLockTreasuryCapSpec,
    addLockUpgradeCapSpec,
    addWithdrawObjectSpec,
    stageActionsIntent,
} from "@/lib/sui/multisig-tx";
import { DEFAULT_UPGRADE_DELAY_DAYS, LOCKABLE_CAPS_PER_INTENT, MAX_COIN_OBJECTS_PER_DEPOSIT } from "./constants";
import { fetchCoinObjectsForAmount } from "./queries";
import type { MigrationCapLockEntry, MigrationPlan } from "./types";
import {
    daysToMs,
    defaultUpgradeCapName,
    migrationPlanSizeError,
    maxCoinObjectAmount,
    normalizedType,
    resourceSlug,
    tryParseAmount,
} from "./utils";

interface AppendMigrationArgs {
    tx: Transaction;
    plan: MigrationPlan;
    client: SuiClient;
    owner: string;
    accountId: string;
    accountProtocolPackage: string;
    actionsPackage: string;
    registryId: string;
    configType: string;
    approvedCoinTypes: string[];
    vaultName: string;
}

function keepObject(tx: Transaction, accountProtocolPackage: string, accountId: string, object: OwnedObjectInfo) {
    tx.moveCall({
        target: `${accountProtocolPackage}::account::keep`,
        typeArguments: [object.objectType],
        arguments: [tx.object(accountId), tx.object(object.objectId)],
    });
}

function stageUpgradeCapLockIntents(
    tx: Transaction,
    accountId: string,
    entries: MigrationCapLockEntry[],
    lockTimestamp: number
) {
    for (let start = 0; start < entries.length; start += LOCKABLE_CAPS_PER_INTENT) {
        const batch = entries.slice(start, start + LOCKABLE_CAPS_PER_INTENT);
        const batchIndex = Math.floor(start / LOCKABLE_CAPS_PER_INTENT);
        stageActionsIntent(
            tx,
            accountId,
            `migrate-lock-upgrade-caps-${lockTimestamp}-${batchIndex}`,
            `Lock migrated package upgrade caps (${batch.length})`,
            0n,
            (tx, builder) => {
                for (const entry of batch) {
                    const resourceName = `upgrade_cap_${resourceSlug(entry.object.objectId)}`;
                    addWithdrawObjectSpec(tx, builder, entry.object.objectType, entry.object.objectId, resourceName);
                    addLockUpgradeCapSpec(
                        tx,
                        builder,
                        entry.packageName?.trim() || defaultUpgradeCapName(entry.object.objectId, undefined),
                        daysToMs(entry.delayDays ?? DEFAULT_UPGRADE_DELAY_DAYS),
                        resourceName,
                        entry.object.objectId
                    );
                }
            }
        );
    }
}

function stageControlledCapLockIntents(
    tx: Transaction,
    accountId: string,
    entries: MigrationCapLockEntry[],
    lockTimestamp: number
) {
    for (let start = 0; start < entries.length; start += LOCKABLE_CAPS_PER_INTENT) {
        const batch = entries.slice(start, start + LOCKABLE_CAPS_PER_INTENT);
        const batchIndex = Math.floor(start / LOCKABLE_CAPS_PER_INTENT);
        stageActionsIntent(
            tx,
            accountId,
            `migrate-lock-controlled-caps-${lockTimestamp}-${batchIndex}`,
            `Lock migrated controlled caps (${batch.length})`,
            0n,
            (tx, builder) => {
                for (const entry of batch) {
                    if (!entry.coinType) {
                        throw new Error(`Missing coin type for ${formatAddress(entry.object.objectId)}`);
                    }

                    const slug = resourceSlug(entry.object.objectId);
                    if (entry.kind === "treasury") {
                        const resourceName = `treasury_cap_${slug}`;
                        addWithdrawObjectSpec(
                            tx,
                            builder,
                            entry.object.objectType,
                            entry.object.objectId,
                            resourceName
                        );
                        addLockTreasuryCapSpec(
                            tx,
                            builder,
                            entry.coinType,
                            null,
                            true,
                            true,
                            true,
                            true,
                            true,
                            resourceName
                        );
                    } else {
                        const resourceName = `metadata_cap_${slug}`;
                        addWithdrawObjectSpec(
                            tx,
                            builder,
                            entry.object.objectType,
                            entry.object.objectId,
                            resourceName
                        );
                        addLockMetadataCapSpec(tx, builder, entry.coinType, true, true, true, resourceName);
                    }
                }
            }
        );
    }
}

export async function appendMigrationToTx({
    tx,
    plan,
    client,
    owner,
    accountId,
    accountProtocolPackage,
    actionsPackage,
    registryId,
    configType,
    approvedCoinTypes,
    vaultName,
}: AppendMigrationArgs): Promise<void> {
    if (!plan.hasSelectedAssets) return;
    if (!plan.isReady)
        throw new Error(plan.selectedCoinErrors[0] ?? plan.capLockErrors[0] ?? "Migration is incomplete");
    const sizeError = migrationPlanSizeError(plan);
    if (sizeError) throw new Error(sizeError);

    const allowedCoinTypes = new Set(approvedCoinTypes.map(normalizedType));
    for (const row of plan.selectedCoinRows) {
        if (!allowedCoinTypes.has(normalizedType(row.coinType))) {
            throw new Error(`${row.symbol} is not approved for ${vaultName}`);
        }

        const amountRaw = tryParseAmount(plan.coinAmounts[row.coinType] ?? "", row.decimals);
        if (amountRaw === null || amountRaw <= 0n) throw new Error(`Invalid amount for ${row.symbol}`);
        if (amountRaw > maxCoinObjectAmount(row)) {
            if (row.objectScanTruncated) {
                throw new Error(`${row.symbol} amount exceeds the first ${MAX_COIN_OBJECTS_PER_DEPOSIT} coin objects`);
            }
            throw new Error(`${row.symbol} amount exceeds migratable coin-object balance`);
        }

        let depositCoin: TransactionArgument;
        if (row.coinType === SUI_TYPE_ARG) {
            [depositCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(amountRaw)]);
        } else {
            const {
                coinObjects,
                objectBalance: coinObjectTotal,
                hitObjectLimit,
            } = await fetchCoinObjectsForAmount(client, owner, row.coinType, amountRaw);
            if (coinObjects.length === 0) throw new Error(`No ${row.symbol} coin objects found`);
            if (amountRaw > coinObjectTotal) {
                if (hitObjectLimit) {
                    throw new Error(
                        `${row.symbol} deposit needs more than ${MAX_COIN_OBJECTS_PER_DEPOSIT} coin objects; consolidate first or enter a smaller amount`
                    );
                }
                throw new Error(`${row.symbol} amount exceeds migratable coin-object balance`);
            }

            const primaryCoin = tx.object(coinObjects[0].coinObjectId);
            if (coinObjects.length > 1) {
                tx.mergeCoins(
                    primaryCoin,
                    coinObjects.slice(1).map((coin) => tx.object(coin.coinObjectId))
                );
            }
            if (amountRaw === coinObjectTotal) {
                depositCoin = primaryCoin;
            } else {
                [depositCoin] = tx.splitCoins(primaryCoin, [tx.pure.u64(amountRaw)]);
            }
        }

        tx.moveCall({
            target: `${actionsPackage}::vault::deposit_approved`,
            typeArguments: [configType, row.coinType],
            arguments: [tx.object(accountId), tx.object(registryId), tx.pure.string(vaultName), depositCoin],
        });
    }

    for (const object of plan.selectedMoveObjects) {
        keepObject(tx, accountProtocolPackage, accountId, object);
    }

    for (const entry of plan.selectedCapLockEntries) {
        keepObject(tx, accountProtocolPackage, accountId, entry.object);
    }

    const lockTimestamp = Date.now();
    const upgradeCapLockEntries = plan.selectedCapLockEntries.filter((entry) => entry.kind === "upgrade");
    const controlledCapLockEntries = plan.selectedCapLockEntries.filter((entry) => entry.kind !== "upgrade");
    stageUpgradeCapLockIntents(tx, accountId, upgradeCapLockEntries, lockTimestamp);
    stageControlledCapLockIntents(tx, accountId, controlledCapLockEntries, lockTimestamp);
}
