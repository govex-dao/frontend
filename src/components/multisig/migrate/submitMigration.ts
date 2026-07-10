import type { SuiClient } from "@govex/futarchy-sdk";
import { Transaction } from "@mysten/sui/transactions";
import type { QueryClient } from "@tanstack/react-query";
import { multisigRpcKeys } from "@/hooks/useMultisig";
import type { useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import { appendMigrationToTx } from "./appendMigrationToTx";
import type { MigrationPlan } from "./types";

type ExecuteTransaction = ReturnType<typeof useSuiTransaction>["executeTransaction"];

interface SubmitMigrationArgs {
    client: SuiClient;
    executeTransaction: ExecuteTransaction;
    queryClient: QueryClient;
    accountAddress: string;
    accountId: string;
    approvedCoinTypes: string[];
    resolvedVaultName: string;
    plan: MigrationPlan;
    onClose: () => void;
    onSuccess?: () => void;
}

export async function submitMigration({
    client,
    executeTransaction,
    queryClient,
    accountAddress,
    accountId,
    approvedCoinTypes,
    resolvedVaultName,
    plan,
    onClose,
    onSuccess,
}: SubmitMigrationArgs): Promise<void> {
    const sdk = getSDK();
    const actionsPackage = sdk.packages.accountActions;
    const accountProtocolPackage = sdk.packages.accountProtocol;
    const multisigPackage = sdk.packages.accountMultisig;
    const registryId = sdk.sharedObjects.packageRegistry.id;

    if (!actionsPackage) throw new Error("accountActions package not configured");
    if (!accountProtocolPackage) throw new Error("accountProtocol package not configured");
    if (!multisigPackage) throw new Error("accountMultisig package not configured");

    const tx = new Transaction();
    await appendMigrationToTx({
        tx,
        plan,
        client,
        owner: accountAddress,
        accountId,
        accountProtocolPackage,
        actionsPackage,
        registryId,
        configType: `${multisigPackage}::multisig::MultisigConfig`,
        approvedCoinTypes,
        vaultName: resolvedVaultName,
    });

    await executeTransaction(
        tx,
        {
            onSuccess: () => {
                queryClient.invalidateQueries({ queryKey: ["wallet-balances", accountAddress] });
                queryClient.invalidateQueries({ queryKey: ["wallet-selected-coin-object-scans", accountAddress] });
                queryClient.invalidateQueries({ queryKey: ["wallet-upgrade-cap-packages"] });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.ownedObjects(accountAddress) });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.ownedObjects(accountId) });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.intents(accountId) });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.vaultBalances(accountId) });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.packageInfo(accountId) });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.packageNames(accountId) });
                queryClient.invalidateQueries({ queryKey: multisigRpcKeys.lockedCurrencies(accountId) });
                onSuccess?.();
                onClose();
            },
        },
        {
            loadingMessage: "Migrating to Govex multisig...",
            successMessage: migrationSuccessMessage(plan),
        }
    );
}

function migrationSuccessMessage(plan: MigrationPlan): string {
    const hasUpgradeLocks = plan.selectedCapLockEntries.some((entry) => entry.kind === "upgrade");
    const hasControlledCapLocks = plan.selectedCapLockEntries.some((entry) => entry.kind !== "upgrade");
    if (hasUpgradeLocks && hasControlledCapLocks) {
        return "Migration submitted. Package upgrade lock and controlled-cap lock intents are staged.";
    }
    if (hasUpgradeLocks) return "Migration submitted. Package upgrade lock intents are staged.";
    if (hasControlledCapLocks) return "Migration submitted. Controlled-cap lock intents are staged.";
    return "Migration submitted.";
}
