import { Button } from "@/components/inputs/Button";

interface Props {
    accountConnected: boolean;
    isLoading: boolean;
    submitDisabled: boolean;
    selectedCoinCount: number;
    selectedMoveObjectCount: number;
    selectedPackageUpgradeLockCount: number;
    selectedControlledCapLockCount: number;
    migrationBlockingError: string | null;
    onClose: () => void;
    onMigrate: () => void;
}

export function MigrationFooter({
    accountConnected,
    isLoading,
    submitDisabled,
    selectedCoinCount,
    selectedMoveObjectCount,
    selectedPackageUpgradeLockCount,
    selectedControlledCapLockCount,
    migrationBlockingError,
    onClose,
    onMigrate,
}: Props) {
    const selectedLockCount = selectedPackageUpgradeLockCount + selectedControlledCapLockCount;
    return (
        <div className="space-y-3 border-t border-border-subtle pt-3">
            <div className="text-xs text-text-muted">
                {selectedCoinCount} coin type{selectedCoinCount === 1 ? "" : "s"}, {selectedMoveObjectCount} custody
                move{selectedMoveObjectCount === 1 ? "" : "s"}, {selectedPackageUpgradeLockCount} package upgrade lock
                {selectedPackageUpgradeLockCount === 1 ? "" : "s"}, {selectedControlledCapLockCount} controlled-cap lock
                {selectedControlledCapLockCount === 1 ? "" : "s"} selected
            </div>
            {migrationBlockingError && (
                <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-2 text-xs text-red-300">
                    {migrationBlockingError}
                </div>
            )}
            {selectedLockCount > 0 && (
                <div className="rounded-lg border border-yellow-400/20 bg-yellow-400/10 p-2 text-xs text-yellow-100">
                    Selected caps move into multisig custody now. The generated lock intents still need normal multisig
                    approval and execution.
                </div>
            )}
            <div className="flex flex-col gap-2 sm:flex-row sm:justify-end">
                <Button variant="secondary" onClick={onClose} disabled={isLoading}>
                    Cancel
                </Button>
                <Button className="font-medium" disabled={submitDisabled} isLoading={isLoading} onClick={onMigrate}>
                    {accountConnected ? "Migrate to this Govex multisig" : "Connect wallet"}
                </Button>
            </div>
        </div>
    );
}
