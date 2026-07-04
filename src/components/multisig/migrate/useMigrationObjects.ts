import { useCallback, useEffect, useMemo, useState } from "react";
import { formatAddress } from "@mysten/sui/utils";
import { useMultisigOwnedObjects } from "@/hooks/useMultisig";
import type { OwnedObjectInfo } from "@/lib/sui/multisig";
import { CAP_MODE_OPTIONS, DEFAULT_UPGRADE_DELAY_DAYS } from "./constants";
import { useObjectTransferAbilities, useUpgradeCapPackageIds } from "./queries";
import type { CapMigrationMode, MigrationCapLockEntry } from "./types";
import {
    capLabel,
    capModeForObject,
    defaultUpgradeCapName,
    extractCoinTypeFromCap,
    isCoinObject,
    managedCapKind,
    normalizedType,
    objectTypeAbilityKey,
    shortType,
} from "./utils";

type CanKeepObject = (object: OwnedObjectInfo) => boolean;

interface Args {
    owner: string | undefined;
    queryEnabled: boolean;
    isOpen: boolean;
    canStageLockIntents: boolean;
}

interface InventoryArgs {
    owner: string | undefined;
    queryEnabled: boolean;
    objectSearch: string;
}

function useMigrationObjectInventory({ owner, queryEnabled, objectSearch }: InventoryArgs) {
    const { data: walletObjects = [], isLoading: objectsLoading } = useMultisigOwnedObjects(
        queryEnabled ? owner : undefined
    );
    const nonCoinObjects = useMemo(
        () => walletObjects.filter((object) => !isCoinObject(object.objectType)),
        [walletObjects]
    );
    const objectTypesForAbilityCheck = useMemo(
        () => [...new Set(nonCoinObjects.map((object) => object.objectType))],
        [nonCoinObjects]
    );
    const { data: objectTransferAbilities = {}, isLoading: objectTransferAbilitiesLoading } =
        useObjectTransferAbilities(objectTypesForAbilityCheck, queryEnabled);
    const canKeepObject = useCallback<CanKeepObject>(
        (object) => objectTransferAbilities[objectTypeAbilityKey(object.objectType)]?.canKeep === true,
        [objectTransferAbilities]
    );
    const objectTransferBlockReason = useCallback(
        (object: OwnedObjectInfo): string | null => {
            const ability = objectTransferAbilities[objectTypeAbilityKey(object.objectType)];
            if (objectTransferAbilitiesLoading || !ability?.checked) return "Checking object transfer ability...";
            if (ability.error)
                return "Cannot add: RPC could not verify key + store abilities. Try reopening this modal.";
            if (!ability.canKeep) return "Cannot add: this object type does not have key + store abilities.";
            return null;
        },
        [objectTransferAbilities, objectTransferAbilitiesLoading]
    );
    const capObjects = useMemo(
        () =>
            nonCoinObjects
                .filter((object) => capLabel(object.objectType))
                .sort((a, b) => {
                    const aLabel = capLabel(a.objectType) ?? "";
                    const bLabel = capLabel(b.objectType) ?? "";
                    if (aLabel !== bLabel) return aLabel.localeCompare(bLabel);
                    return shortType(a.objectType).localeCompare(shortType(b.objectType));
                }),
        [nonCoinObjects]
    );
    const filteredCapObjects = useMemo(() => {
        const query = objectSearch.trim().toLowerCase();
        return capObjects.filter((object) => {
            if (!query) return true;
            return (
                normalizedType(object.objectId).includes(query) ||
                normalizedType(object.objectType).includes(query) ||
                normalizedType(capLabel(object.objectType) ?? "").includes(query)
            );
        });
    }, [capObjects, objectSearch]);
    const transferableCapCount = useMemo(
        () => capObjects.filter((object) => canKeepObject(object)).length,
        [canKeepObject, capObjects]
    );
    const upgradeCapIds = useMemo(
        () =>
            capObjects
                .filter((object) => managedCapKind(object.objectType) === "upgrade")
                .map((object) => object.objectId),
        [capObjects]
    );
    const { data: upgradeCapPackageIds = {} } = useUpgradeCapPackageIds(upgradeCapIds, queryEnabled);
    const regularObjects = useMemo(
        () =>
            nonCoinObjects
                .filter((object) => !capLabel(object.objectType))
                .sort((a, b) => shortType(a.objectType).localeCompare(shortType(b.objectType))),
        [nonCoinObjects]
    );

    return {
        canKeepObject,
        capObjects,
        filteredCapObjects,
        hasObjects: nonCoinObjects.length > 0,
        nonCoinObjects,
        objectTransferAbilitiesLoading,
        objectTransferBlockReason,
        objectsLoading,
        regularObjects,
        transferableCapCount,
        upgradeCapPackageIds,
    };
}

interface SelectionArgs {
    canKeepObject: CanKeepObject;
    canStageLockIntents: boolean;
    capObjects: OwnedObjectInfo[];
    isOpen: boolean;
    nonCoinObjects: OwnedObjectInfo[];
    objectTransferAbilitiesLoading: boolean;
    owner: string | undefined;
    regularObjects: OwnedObjectInfo[];
    upgradeCapPackageIds: Record<string, string>;
}

function useMigrationObjectSelection({
    canKeepObject,
    canStageLockIntents,
    capObjects,
    isOpen,
    nonCoinObjects,
    objectTransferAbilitiesLoading,
    owner,
    regularObjects,
    upgradeCapPackageIds,
}: SelectionArgs) {
    const [selectedObjectIds, setSelectedObjectIds] = useState<Set<string>>(() => new Set());
    const [capModes, setCapModes] = useState<Record<string, CapMigrationMode>>({});
    const [upgradeCapNames, setUpgradeCapNames] = useState<Record<string, string>>({});
    const [upgradeCapDelayDays, setUpgradeCapDelayDays] = useState<Record<string, string>>({});
    const [otherObjectPickerValue, setOtherObjectPickerValue] = useState("");

    const selectedObjects = useMemo(
        () => nonCoinObjects.filter((object) => selectedObjectIds.has(object.objectId) && canKeepObject(object)),
        [canKeepObject, nonCoinObjects, selectedObjectIds]
    );
    const selectedRegularObjects = useMemo(
        () => regularObjects.filter((object) => selectedObjectIds.has(object.objectId) && canKeepObject(object)),
        [canKeepObject, regularObjects, selectedObjectIds]
    );
    const regularObjectOptions = useMemo(
        () =>
            regularObjects
                .filter((object) => !selectedObjectIds.has(object.objectId))
                .map((object) => ({
                    value: object.objectId,
                    label: `${formatAddress(object.objectId)} · ${shortType(object.objectType)}${
                        canKeepObject(object) ? "" : " · cannot add"
                    }`,
                    disabled: !canKeepObject(object),
                })),
        [canKeepObject, regularObjects, selectedObjectIds]
    );
    const selectedCapLockEntries = useMemo<MigrationCapLockEntry[]>(() => {
        if (!canStageLockIntents) return [];
        return selectedObjects.flatMap((object): MigrationCapLockEntry[] => {
            const kind = managedCapKind(object.objectType);
            if (!kind || capModeForObject(object, capModes, canStageLockIntents) !== "lock") return [];

            if (kind === "upgrade") {
                return [
                    {
                        object,
                        kind,
                        packageName:
                            upgradeCapNames[object.objectId] ??
                            defaultUpgradeCapName(object.objectId, upgradeCapPackageIds[object.objectId]),
                        delayDays: upgradeCapDelayDays[object.objectId] ?? DEFAULT_UPGRADE_DELAY_DAYS,
                    },
                ];
            }

            return [{ object, kind, coinType: extractCoinTypeFromCap(object.objectType) ?? undefined }];
        });
    }, [canStageLockIntents, capModes, selectedObjects, upgradeCapDelayDays, upgradeCapNames, upgradeCapPackageIds]);
    const selectedMoveObjects = useMemo(
        () =>
            selectedObjects.filter((object) => {
                const kind = managedCapKind(object.objectType);
                return !kind || capModeForObject(object, capModes, canStageLockIntents) === "move";
            }),
        [canStageLockIntents, capModes, selectedObjects]
    );
    const capLockErrors = useMemo(
        () =>
            selectedCapLockEntries
                .map((entry) => {
                    if (entry.kind === "upgrade") {
                        if (!entry.packageName?.trim())
                            return `${formatAddress(entry.object.objectId)} needs a package name`;
                        const delay = Number.parseFloat(entry.delayDays ?? "");
                        if (!Number.isFinite(delay) || delay < 0) {
                            return `${formatAddress(entry.object.objectId)} has an invalid delay`;
                        }
                    } else if (!entry.coinType) {
                        return `${formatAddress(entry.object.objectId)} is missing a coin type`;
                    }
                    return null;
                })
                .filter((reason): reason is string => !!reason),
        [selectedCapLockEntries]
    );

    useEffect(() => {
        if (!isOpen) {
            setSelectedObjectIds(new Set());
            setCapModes({});
            setUpgradeCapNames({});
            setUpgradeCapDelayDays({});
            setOtherObjectPickerValue("");
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedObjectIds(new Set());
        setCapModes({});
        setUpgradeCapNames({});
        setUpgradeCapDelayDays({});
        setOtherObjectPickerValue("");
    }, [isOpen, owner]);

    useEffect(() => {
        if (!isOpen || objectTransferAbilitiesLoading) return;
        setSelectedObjectIds((prev) => {
            let changed = false;
            const next = new Set<string>();
            for (const objectId of prev) {
                const object = nonCoinObjects.find((candidate) => candidate.objectId === objectId);
                if (object && canKeepObject(object)) next.add(objectId);
                else changed = true;
            }
            return changed ? next : prev;
        });
    }, [canKeepObject, isOpen, nonCoinObjects, objectTransferAbilitiesLoading]);

    const toggleObject = useCallback(
        (object: OwnedObjectInfo) => {
            if (!canKeepObject(object)) return;
            setSelectedObjectIds((prev) => {
                const next = new Set(prev);
                if (next.has(object.objectId)) next.delete(object.objectId);
                else next.add(object.objectId);
                return next;
            });
        },
        [canKeepObject]
    );
    const handleRegularObjectPick = useCallback(
        (objectId: string) => {
            if (!objectId) return;
            const object = regularObjects.find((candidate) => candidate.objectId === objectId);
            if (!object || !canKeepObject(object)) return;
            setSelectedObjectIds((prev) => new Set(prev).add(objectId));
            setOtherObjectPickerValue("");
        },
        [canKeepObject, regularObjects]
    );
    const selectAllCaps = useCallback(() => {
        setSelectedObjectIds((prev) => {
            const next = new Set(prev);
            for (const object of capObjects) {
                if (canKeepObject(object)) next.add(object.objectId);
            }
            return next;
        });
    }, [canKeepObject, capObjects]);

    return {
        capLockErrors,
        capModes,
        handleCapModeChange: (objectId: string, mode: CapMigrationMode) =>
            setCapModes((prev) => ({ ...prev, [objectId]: mode })),
        handleRegularObjectPick,
        handleUpgradeCapNameChange: (objectId: string, value: string) =>
            setUpgradeCapNames((prev) => ({ ...prev, [objectId]: value })),
        handleUpgradeDelayDaysChange: (objectId: string, value: string) =>
            setUpgradeCapDelayDays((prev) => ({ ...prev, [objectId]: value })),
        otherObjectPickerValue,
        regularObjectOptions,
        selectAllCaps,
        selectedCapLockEntries,
        selectedMoveObjects,
        selectedObjectIds,
        selectedRegularObjects,
        toggleObject,
        upgradeCapDelayDays,
        upgradeCapNames,
    };
}

export function useMigrationObjects({ owner, queryEnabled, isOpen, canStageLockIntents }: Args) {
    const [objectSearch, setObjectSearch] = useState("");
    const inventory = useMigrationObjectInventory({ owner, queryEnabled, objectSearch });
    const selection = useMigrationObjectSelection({
        canKeepObject: inventory.canKeepObject,
        canStageLockIntents,
        capObjects: inventory.capObjects,
        isOpen,
        nonCoinObjects: inventory.nonCoinObjects,
        objectTransferAbilitiesLoading: inventory.objectTransferAbilitiesLoading,
        owner,
        regularObjects: inventory.regularObjects,
        upgradeCapPackageIds: inventory.upgradeCapPackageIds,
    });
    const capModeOptions = useMemo<Array<{ value: CapMigrationMode; label: string }>>(
        () => (canStageLockIntents ? CAP_MODE_OPTIONS : [{ value: "move", label: "Add as raw object" }]),
        [canStageLockIntents]
    );

    useEffect(() => {
        setObjectSearch("");
    }, [isOpen, owner]);

    return {
        ...selection,
        capModeOptions,
        filteredCapObjects: inventory.filteredCapObjects,
        hasObjects: inventory.hasObjects,
        objectSearch,
        objectTransferBlockReason: inventory.objectTransferBlockReason,
        objectsLoading: inventory.objectsLoading,
        setObjectSearch,
        transferableCapCount: inventory.transferableCapCount,
        upgradeCapPackageIds: inventory.upgradeCapPackageIds,
    };
}
