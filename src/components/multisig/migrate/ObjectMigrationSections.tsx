import { Box, Check, Loader2, Search } from "lucide-react";
import { formatAddress } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { Select, type SelectOption } from "@/components/inputs/Select";
import type { OwnedObjectInfo } from "@/lib/sui/multisig";
import { DEFAULT_UPGRADE_DELAY_DAYS } from "./constants";
import type { CapMigrationMode } from "./types";
import {
    capLabel,
    capModeForObject,
    defaultUpgradeCapName,
    extractCoinTypeFromCap,
    managedCapKind,
    shortType,
} from "./utils";

interface ObjectRowProps {
    object: OwnedObjectInfo;
    selected: boolean;
    canStageLockIntents: boolean;
    capModes: Record<string, CapMigrationMode>;
    capModeOptions: SelectOption[];
    upgradeCapPackageIds: Record<string, string>;
    upgradeCapNames: Record<string, string>;
    upgradeCapDelayDays: Record<string, string>;
    transferBlockReason: string | null;
    onToggle: (object: OwnedObjectInfo) => void;
    onCapModeChange: (objectId: string, mode: CapMigrationMode) => void;
    onUpgradeCapNameChange: (objectId: string, value: string) => void;
    onUpgradeDelayDaysChange: (objectId: string, value: string) => void;
}

function ObjectRow({
    object,
    selected,
    canStageLockIntents,
    capModes,
    capModeOptions,
    upgradeCapPackageIds,
    upgradeCapNames,
    upgradeCapDelayDays,
    transferBlockReason,
    onToggle,
    onCapModeChange,
    onUpgradeCapNameChange,
    onUpgradeDelayDaysChange,
}: ObjectRowProps) {
    const label = capLabel(object.objectType);
    const kind = managedCapKind(object.objectType);
    const mode = capModeForObject(object, capModes, canStageLockIntents);
    const coinType = extractCoinTypeFromCap(object.objectType);
    const packageId = upgradeCapPackageIds[object.objectId];
    const upgradeCapName = upgradeCapNames[object.objectId] ?? defaultUpgradeCapName(object.objectId, packageId);
    const upgradeDelayDays = upgradeCapDelayDays[object.objectId] ?? DEFAULT_UPGRADE_DELAY_DAYS;
    const objectDisabled = !!transferBlockReason;

    return (
        <div
            key={object.objectId}
            className={`rounded-lg border p-3 transition-colors ${
                selected
                    ? "border-primary/40 bg-primary/10"
                    : objectDisabled
                      ? "border-border-subtle bg-card-elevated/20 opacity-70"
                      : "border-border-subtle bg-card-elevated/50 hover:border-border-light"
            }`}
        >
            <button
                type="button"
                onClick={() => onToggle(object)}
                disabled={objectDisabled}
                className="flex w-full items-start gap-3 text-left disabled:cursor-not-allowed"
            >
                <span
                    className={`mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-black" : "border-border-light"}`}
                >
                    {selected && <Check className="h-3 w-3" />}
                </span>
                <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                        <span className="font-mono text-xs text-text-primary">{formatAddress(object.objectId)}</span>
                        {label && (
                            <span className="rounded-full border border-yellow-400/20 bg-yellow-400/10 px-2 py-0.5 text-[10px] font-semibold text-yellow-200">
                                {label}
                            </span>
                        )}
                    </span>
                    <span className="mt-1 block break-all text-[11px] text-text-muted">
                        {shortType(object.objectType)}
                    </span>
                    {transferBlockReason && (
                        <span className="mt-1 block text-[11px] text-yellow-200">{transferBlockReason}</span>
                    )}
                </span>
            </button>

            {selected && label && (
                <div className="mt-3 space-y-2 border-t border-border-subtle pt-3">
                    {kind ? (
                        <>
                            <Select
                                label="Add as"
                                options={capModeOptions}
                                value={mode}
                                onChange={(value) =>
                                    onCapModeChange(object.objectId, value === "move" ? "move" : "lock")
                                }
                                allowSearch={false}
                                allowClear={false}
                            />
                            {!canStageLockIntents && (
                                <p className="text-[11px] text-yellow-200">
                                    This signer cannot add controlled caps in this multisig config.
                                </p>
                            )}
                            {mode === "lock" && kind === "upgrade" && (
                                <div className="space-y-2">
                                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_8rem]">
                                        <Input
                                            label="Package name"
                                            value={upgradeCapName}
                                            onChange={(value) => onUpgradeCapNameChange(object.objectId, value)}
                                            size="sm"
                                            error={!upgradeCapName.trim()}
                                        />
                                        <Input
                                            label="Delay days"
                                            value={upgradeDelayDays}
                                            onChange={(value) => onUpgradeDelayDaysChange(object.objectId, value)}
                                            type="number"
                                            min="0"
                                            step="1"
                                            inputMode="decimal"
                                            size="sm"
                                            error={
                                                Number.isNaN(Number.parseFloat(upgradeDelayDays)) ||
                                                Number.parseFloat(upgradeDelayDays) < 0
                                            }
                                        />
                                    </div>
                                    <p className="text-[11px] text-text-muted">
                                        {packageId
                                            ? `Package ${formatAddress(packageId)} will be registered under this name when the staged lock intent executes.`
                                            : "Package ID will be verified from the UpgradeCap when the staged lock intent executes."}
                                    </p>
                                </div>
                            )}
                            {mode === "lock" && kind !== "upgrade" && (
                                <p className="break-all text-[11px] text-text-muted">
                                    Adds this as a controlled cap for finer grained control over{" "}
                                    {coinType ? shortType(coinType) : "this coin type"} usage.
                                </p>
                            )}
                            {mode === "move" && (
                                <p className="text-[11px] text-text-muted">
                                    Adds this as a raw object. The multisig owns it, but Govex will not register managed
                                    controls.
                                </p>
                            )}
                        </>
                    ) : (
                        <p className="text-[11px] text-text-muted">
                            This capability type is not a built-in Govex controlled cap, so it will be added as a raw
                            object.
                        </p>
                    )}
                </div>
            )}
        </div>
    );
}

interface ObjectSectionsProps {
    filteredCapObjects: OwnedObjectInfo[];
    selectedRegularObjects: OwnedObjectInfo[];
    regularObjectOptions: SelectOption[];
    selectedObjectIds: Set<string>;
    objectsLoading: boolean;
    hasObjects: boolean;
    objectSearch: string;
    otherObjectPickerValue: string;
    transferableCapCount: number;
    capLockErrors: string[];
    canStageLockIntents: boolean;
    capModes: Record<string, CapMigrationMode>;
    capModeOptions: SelectOption[];
    upgradeCapPackageIds: Record<string, string>;
    upgradeCapNames: Record<string, string>;
    upgradeCapDelayDays: Record<string, string>;
    objectTransferBlockReason: (object: OwnedObjectInfo) => string | null;
    onObjectSearchChange: (value: string) => void;
    onRegularObjectPick: (objectId: string) => void;
    onSelectAllCaps: () => void;
    onToggleObject: (object: OwnedObjectInfo) => void;
    onCapModeChange: (objectId: string, mode: CapMigrationMode) => void;
    onUpgradeCapNameChange: (objectId: string, value: string) => void;
    onUpgradeDelayDaysChange: (objectId: string, value: string) => void;
}

export function ObjectMigrationSections({
    filteredCapObjects,
    selectedRegularObjects,
    regularObjectOptions,
    selectedObjectIds,
    objectsLoading,
    hasObjects,
    objectSearch,
    otherObjectPickerValue,
    transferableCapCount,
    capLockErrors,
    canStageLockIntents,
    capModes,
    capModeOptions,
    upgradeCapPackageIds,
    upgradeCapNames,
    upgradeCapDelayDays,
    objectTransferBlockReason,
    onObjectSearchChange,
    onRegularObjectPick,
    onSelectAllCaps,
    onToggleObject,
    onCapModeChange,
    onUpgradeCapNameChange,
    onUpgradeDelayDaysChange,
}: ObjectSectionsProps) {
    const renderObjectRow = (object: OwnedObjectInfo) => (
        <ObjectRow
            key={object.objectId}
            object={object}
            selected={selectedObjectIds.has(object.objectId)}
            canStageLockIntents={canStageLockIntents}
            capModes={capModes}
            capModeOptions={capModeOptions}
            upgradeCapPackageIds={upgradeCapPackageIds}
            upgradeCapNames={upgradeCapNames}
            upgradeCapDelayDays={upgradeCapDelayDays}
            transferBlockReason={objectTransferBlockReason(object)}
            onToggle={onToggleObject}
            onCapModeChange={onCapModeChange}
            onUpgradeCapNameChange={onUpgradeCapNameChange}
            onUpgradeDelayDaysChange={onUpgradeDelayDaysChange}
        />
    );

    return (
        <>
            <section className="space-y-3">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <Box className="h-4 w-4 text-primary" />
                        Capability objects
                    </div>
                    <button
                        type="button"
                        onClick={onSelectAllCaps}
                        disabled={transferableCapCount === 0}
                        className="text-left text-xs font-medium text-primary transition-colors hover:text-primary-light disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                        Select all caps
                    </button>
                </div>
                <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
                    <Input
                        value={objectSearch}
                        onChange={onObjectSearchChange}
                        placeholder="Search caps or types"
                        className="pl-9"
                    />
                </div>
                <div className="max-h-72 space-y-2 overflow-y-auto pr-1">
                    {objectsLoading ? (
                        <div className="flex items-center justify-center py-6 text-text-muted">
                            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            Scanning address objects...
                        </div>
                    ) : filteredCapObjects.length === 0 ? (
                        <p className="py-3 text-sm text-text-muted">
                            {hasObjects ? "No matching caps found." : "No non-coin objects found for this address."}
                        </p>
                    ) : (
                        filteredCapObjects.map(renderObjectRow)
                    )}
                </div>
                {capLockErrors.length > 0 && (
                    <div className="rounded-lg border border-red-400/20 bg-red-400/10 p-2 text-[11px] text-red-300">
                        {capLockErrors[0]}
                    </div>
                )}
            </section>

            <section className="space-y-3">
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                        <Box className="h-4 w-4 text-primary" />
                        Other objects
                    </div>
                    {selectedRegularObjects.length > 0 && (
                        <span className="text-xs text-text-muted">{selectedRegularObjects.length} selected</span>
                    )}
                </div>

                <Select
                    label="Add object"
                    options={regularObjectOptions}
                    value={otherObjectPickerValue}
                    onChange={onRegularObjectPick}
                    placeholder={
                        objectsLoading
                            ? "Loading objects..."
                            : regularObjectOptions.length > 0
                              ? "Choose an object..."
                              : "No other objects available"
                    }
                    allowSearch
                    allowClear={false}
                    disabled={objectsLoading || regularObjectOptions.length === 0}
                />

                {selectedRegularObjects.length > 0 && (
                    <div className="max-h-56 space-y-2 overflow-y-auto pr-1">
                        {selectedRegularObjects.map(renderObjectRow)}
                    </div>
                )}
            </section>
        </>
    );
}
