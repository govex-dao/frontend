import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Shield } from "lucide-react";
import toast from "react-hot-toast";
import { Select } from "@/components/inputs/Select";
import { Modal } from "@/components/overlays/Modal";
import { useMultisigVaultNames, useVaultApprovedCoinTypes } from "@/hooks/useMultisig";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { CoinMigrationSection } from "./migrate/CoinMigrationSection";
import { MigrationFooter } from "./migrate/MigrationFooter";
import { ObjectMigrationSections } from "./migrate/ObjectMigrationSections";
import { submitMigration } from "./migrate/submitMigration";
import type { MigrationPlan } from "./migrate/types";
import { useMigrationCoins } from "./migrate/useMigrationCoins";
import { useMigrationObjects } from "./migrate/useMigrationObjects";
import { migrationPlanSizeError } from "./migrate/utils";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    accountId: string;
    canStageLockIntents: boolean;
    onSuccess?: () => void;
}

export function MigrateToMultisigModal({ isOpen, onClose, accountId, canStageLockIntents, onSuccess }: Props) {
    const account = useCurrentAccount();
    const client = useSuiClient();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);
    const queryEnabled = isOpen;

    const { data: vaultNames = [], isLoading: vaultNamesLoading } = useMultisigVaultNames(accountId);
    const [vaultName, setVaultName] = useState("");
    const resolvedVaultName = vaultName || vaultNames[0] || "";
    const { data: approvedCoinTypes = [] } = useVaultApprovedCoinTypes(accountId, resolvedVaultName || undefined);

    const coins = useMigrationCoins({
        owner: account?.address,
        queryEnabled,
        isOpen,
        resolvedVaultName,
        approvedCoinTypes,
    });
    const objects = useMigrationObjects({
        owner: account?.address,
        queryEnabled,
        isOpen,
        canStageLockIntents,
    });

    const hasSelectedAssets =
        coins.selectedCoinRows.length > 0 ||
        objects.selectedMoveObjects.length > 0 ||
        objects.selectedCapLockEntries.length > 0;
    const selectedPackageUpgradeLockCount = objects.selectedCapLockEntries.filter(
        (entry) => entry.kind === "upgrade"
    ).length;
    const selectedControlledCapLockCount = objects.selectedCapLockEntries.length - selectedPackageUpgradeLockCount;
    const plan = useMemo<MigrationPlan>(
        () => ({
            selectedCoinRows: coins.selectedCoinRows,
            coinAmounts: coins.coinAmounts,
            selectedMoveObjects: objects.selectedMoveObjects,
            selectedCapLockEntries: objects.selectedCapLockEntries,
            selectedCoinErrors: coins.selectedCoinErrors,
            capLockErrors: objects.capLockErrors,
            hasSelectedAssets,
            isReady: coins.selectedCoinErrors.length === 0 && objects.capLockErrors.length === 0,
        }),
        [
            coins.coinAmounts,
            coins.selectedCoinErrors,
            coins.selectedCoinRows,
            hasSelectedAssets,
            objects.capLockErrors,
            objects.selectedCapLockEntries,
            objects.selectedMoveObjects,
        ]
    );

    useEffect(() => {
        if (!isOpen || vaultNames.length === 0) return;
        setVaultName((current) => (current && vaultNames.includes(current) ? current : (vaultNames[0] ?? "")));
    }, [isOpen, vaultNames]);

    useEffect(() => {
        if (!isOpen) setVaultName("");
    }, [isOpen]);

    const vaultOptions = useMemo(() => vaultNames.map((name) => ({ value: name, label: name })), [vaultNames]);
    const sizeError = useMemo(() => migrationPlanSizeError(plan), [plan]);
    const migrationBlockingError =
        sizeError ?? (!plan.isReady ? (plan.selectedCoinErrors[0] ?? plan.capLockErrors[0] ?? null) : null);
    const submitDisabled =
        submittingRef.current ||
        isLoading ||
        !account ||
        !plan.hasSelectedAssets ||
        !plan.isReady ||
        !!sizeError ||
        (plan.selectedCoinRows.length > 0 && !resolvedVaultName);

    const handleMigrate = useCallback(async () => {
        if (submittingRef.current || !account || submitDisabled) return;

        submittingRef.current = true;
        try {
            await submitMigration({
                client,
                executeTransaction,
                queryClient,
                accountAddress: account.address,
                accountId,
                approvedCoinTypes,
                resolvedVaultName,
                plan,
                onClose,
                onSuccess,
            });
        } catch (error) {
            console.error("Failed to migrate to multisig:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Failed to migrate to multisig");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [
        account,
        accountId,
        approvedCoinTypes,
        client,
        executeTransaction,
        onClose,
        onSuccess,
        plan,
        queryClient,
        resolvedVaultName,
        submitDisabled,
    ]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title="Migrate existing address to this Govex multisig"
            className="w-full max-w-3xl!"
        >
            <div className="space-y-5">
                <div className="flex items-start gap-3 rounded-lg border border-primary/20 bg-primary/10 p-3 text-xs leading-5 text-text-secondary">
                    <Shield className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                    <div>
                        Assets selected here move from your connected address to this Govex multisig in one wallet
                        transaction. Coins deposit into the selected vault; objects move into multisig custody. Package
                        upgrade locks and controlled-cap locks are staged as intents for later multisig execution.
                    </div>
                </div>

                <section className="space-y-2">
                    <Select
                        label="Destination vault"
                        options={vaultOptions}
                        value={resolvedVaultName}
                        onChange={setVaultName}
                        placeholder={vaultNamesLoading ? "Loading vaults..." : "Select a vault..."}
                        allowSearch={false}
                        allowClear={false}
                        disabled={vaultNamesLoading || vaultOptions.length === 0}
                    />
                    {vaultOptions.length === 0 && !vaultNamesLoading && (
                        <p className="text-[11px] text-yellow-200">
                            This multisig has no discovered vaults yet. You can still move objects, but coin migration
                            needs a vault with approved coin types.
                        </p>
                    )}
                </section>

                <CoinMigrationSection
                    coinRows={coins.coinRows}
                    balancesLoading={coins.balancesLoading}
                    selectedCoinTypes={coins.selectedCoinTypes}
                    coinAmounts={coins.coinAmounts}
                    resolvedVaultName={resolvedVaultName}
                    allowedCoinTypes={coins.allowedCoinTypes}
                    selectedCoinRowsCount={coins.selectedCoinRows.length}
                    invalidCoinReason={coins.invalidCoinReason}
                    onClearCoins={coins.clearCoins}
                    onSelectAllApprovedCoins={coins.selectAllApprovedCoins}
                    onToggleCoin={coins.toggleCoin}
                    onCoinAmountChange={coins.setCoinAmount}
                />

                <ObjectMigrationSections
                    filteredCapObjects={objects.filteredCapObjects}
                    selectedRegularObjects={objects.selectedRegularObjects}
                    regularObjectOptions={objects.regularObjectOptions}
                    selectedObjectIds={objects.selectedObjectIds}
                    objectsLoading={objects.objectsLoading}
                    hasObjects={objects.hasObjects}
                    objectSearch={objects.objectSearch}
                    otherObjectPickerValue={objects.otherObjectPickerValue}
                    transferableCapCount={objects.transferableCapCount}
                    capLockErrors={objects.capLockErrors}
                    canStageLockIntents={canStageLockIntents}
                    capModes={objects.capModes}
                    capModeOptions={objects.capModeOptions}
                    upgradeCapPackageIds={objects.upgradeCapPackageIds}
                    upgradeCapNames={objects.upgradeCapNames}
                    upgradeCapDelayDays={objects.upgradeCapDelayDays}
                    objectTransferBlockReason={objects.objectTransferBlockReason}
                    onObjectSearchChange={objects.setObjectSearch}
                    onRegularObjectPick={objects.handleRegularObjectPick}
                    onSelectAllCaps={objects.selectAllCaps}
                    onToggleObject={objects.toggleObject}
                    onCapModeChange={objects.handleCapModeChange}
                    onUpgradeCapNameChange={objects.handleUpgradeCapNameChange}
                    onUpgradeDelayDaysChange={objects.handleUpgradeDelayDaysChange}
                />

                <MigrationFooter
                    accountConnected={!!account}
                    isLoading={isLoading}
                    submitDisabled={submitDisabled}
                    selectedCoinCount={coins.selectedCoinRows.length}
                    selectedMoveObjectCount={objects.selectedMoveObjects.length}
                    selectedPackageUpgradeLockCount={selectedPackageUpgradeLockCount}
                    selectedControlledCapLockCount={selectedControlledCapLockCount}
                    migrationBlockingError={migrationBlockingError}
                    onClose={onClose}
                    onMigrate={handleMigrate}
                />
            </div>
        </Modal>
    );
}
