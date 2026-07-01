import { formatAddress, normalizeSuiAddress, parseStructTag, SUI_TYPE_ARG } from "@mysten/sui/utils";
import { parseAmountToBigInt } from "@/lib/parseAmount";
import type { OwnedObjectInfo } from "@/lib/sui/multisig";
import {
    GAS_RESERVE_MIST,
    LOCKABLE_CAPS_PER_INTENT,
    MAX_MIGRATION_COIN_TYPES,
    MAX_MIGRATION_ESTIMATED_COMMANDS,
    MAX_MIGRATION_OBJECT_INPUTS,
    UPGRADE_CAP_TYPE,
} from "./constants";
import type { CapMigrationMode, ManagedCapKind, MigrationCoinRow, MigrationPlan } from "./types";

export function formatRawAmount(raw: string | bigint, decimals: number, precision = 6): string {
    const value = typeof raw === "bigint" ? raw : BigInt(raw || "0");
    const divisor = 10n ** BigInt(decimals);
    const whole = value / divisor;
    const remainder = value % divisor;
    const fraction = remainder.toString().padStart(decimals, "0").slice(0, precision).replace(/0+$/, "");
    return fraction ? `${whole.toString()}.${fraction}` : whole.toString();
}

export function formatRawAmountExact(raw: string | bigint, decimals: number): string {
    return formatRawAmount(raw, decimals, decimals);
}

export function defaultCoinAmount(coinType: string, objectBalance: string, decimals: number): string {
    const raw = BigInt(objectBalance || "0");
    if (coinType !== SUI_TYPE_ARG) return formatRawAmountExact(raw, decimals);
    const movable = raw > GAS_RESERVE_MIST ? raw - GAS_RESERVE_MIST : 0n;
    return formatRawAmountExact(movable, decimals);
}

export function tryParseAmount(amount: string, decimals: number): bigint | null {
    const trimmed = amount.trim();
    if (!/^\d+(\.\d*)?$|^\.\d+$/.test(trimmed)) return null;
    try {
        return parseAmountToBigInt(trimmed, decimals);
    } catch {
        return null;
    }
}

export function normalizedType(type: string): string {
    const trimmed = type.trim();
    if (!trimmed) return "";

    try {
        return formatStructTagForCompare(parseStructTag(addMoveTypeAddressPrefixes(trimmed)));
    } catch {
        return addMoveTypeAddressPrefixes(trimmed).toLowerCase();
    }
}

export function normalizeAddressInput(value: string | undefined): string {
    const trimmed = value?.trim();
    if (!trimmed) return "";
    try {
        return normalizeSuiAddress(trimmed);
    } catch {
        return trimmed;
    }
}

function addMoveTypeAddressPrefixes(type: string): string {
    return type.replace(/(^|[<,\s])([0-9a-fA-F]{1,64})(?=::)/g, (_match, prefix: string, address: string) => {
        if (address.startsWith("0x")) return `${prefix}${address}`;
        return `${prefix}0x${address}`;
    });
}

function normalizeMoveTypeAddress(address: string): string {
    const prefixed = address.startsWith("0x") ? address : `0x${address}`;
    try {
        return normalizeSuiAddress(prefixed);
    } catch {
        return prefixed.toLowerCase();
    }
}

function formatTypeParamForCompare(param: string | ReturnType<typeof parseStructTag>): string {
    return typeof param === "string" ? normalizedType(param) : formatStructTagForCompare(param);
}

function formatStructTagForCompare(tag: ReturnType<typeof parseStructTag>): string {
    const base = `${normalizeMoveTypeAddress(tag.address)}::${tag.module}::${tag.name}`;
    if (tag.typeParams.length === 0) return base;
    return `${base}<${tag.typeParams.map(formatTypeParamForCompare).join(",")}>`;
}

function isSystemType(objectType: string, module: string, name: string, typeParamCount?: number): boolean {
    try {
        const tag = parseStructTag(addMoveTypeAddressPrefixes(objectType));
        return (
            normalizeAddressInput(tag.address) === normalizeAddressInput("0x2") &&
            tag.module === module &&
            tag.name === name &&
            (typeParamCount == null || tag.typeParams.length === typeParamCount)
        );
    } catch {
        return false;
    }
}

export function isCoinObject(objectType: string): boolean {
    return isSystemType(objectType, "coin", "Coin", 1);
}

export function isUpgradeCapType(objectType: string): boolean {
    return objectType === UPGRADE_CAP_TYPE || isSystemType(objectType, "package", "UpgradeCap", 0);
}

export function managedCapKind(objectType: string): ManagedCapKind | null {
    if (isUpgradeCapType(objectType)) return "upgrade";
    if (isSystemType(objectType, "coin", "TreasuryCap", 1)) return "treasury";
    if (isSystemType(objectType, "coin_registry", "MetadataCap", 1)) return "metadata";
    return null;
}

export function capLabel(objectType: string): string | null {
    const kind = managedCapKind(objectType);
    if (kind === "upgrade") return "UpgradeCap";
    if (kind === "treasury") return "TreasuryCap";
    if (kind === "metadata") return "MetadataCap";
    try {
        const tag = parseStructTag(objectType);
        return tag.name.endsWith("Cap") ? tag.name : null;
    } catch {
        const base = objectType.split("<")[0] ?? objectType;
        const name = base.split("::").pop() ?? "";
        return name.endsWith("Cap") ? name : null;
    }
}

export function shortType(fullType: string): string {
    try {
        const tag = parseStructTag(fullType);
        let label = `${formatAddress(tag.address)}::${tag.module}::${tag.name}`;
        if (tag.typeParams.length > 0) {
            label += `<${tag.typeParams
                .map((param) => {
                    if (typeof param === "string") return param;
                    return `${formatAddress(param.address)}::${param.module}::${param.name}`;
                })
                .join(", ")}>`;
        }
        return label;
    } catch {
        return fullType.length > 76 ? `${fullType.slice(0, 73)}...` : fullType;
    }
}

function parseTopLevelTypeArgs(fullType: string): string[] {
    const trimmed = fullType.trim();
    const start = trimmed.indexOf("<");
    const end = trimmed.lastIndexOf(">");
    if (start < 0 || end <= start) return [];

    const inner = trimmed.slice(start + 1, end);
    const args: string[] = [];
    let depth = 0;
    let chunkStart = 0;
    for (let i = 0; i < inner.length; i += 1) {
        const char = inner[i];
        if (char === "<") depth += 1;
        if (char === ">") depth -= 1;
        if (char === "," && depth === 0) {
            const chunk = inner.slice(chunkStart, i).trim();
            if (chunk) args.push(chunk);
            chunkStart = i + 1;
        }
    }
    const tail = inner.slice(chunkStart).trim();
    if (tail) args.push(tail);
    return args;
}

export function extractCoinTypeFromCap(objectType: string): string | null {
    return parseTopLevelTypeArgs(objectType)[0] ?? null;
}

export function objectTypeAbilityKey(objectType: string): string {
    return normalizedType(objectType);
}

export function resourceSlug(value: string): string {
    const compact = value
        .replace(/^0x/i, "")
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .slice(0, 64);
    return compact || "object";
}

export function daysToMs(days: string): bigint {
    const value = Number.parseFloat(days || "0");
    if (!Number.isFinite(value) || value < 0) return 0n;
    return BigInt(Math.round(value * 86_400_000));
}

function getObjectRecord(value: unknown): Record<string, unknown> | null {
    return value != null && typeof value === "object" ? (value as Record<string, unknown>) : null;
}

function readObjectIdField(value: unknown): string | null {
    if (typeof value === "string" && value.length > 0) return normalizeAddressInput(value);
    const record = getObjectRecord(value);
    if (!record) return null;
    const fields = getObjectRecord(record.fields) ?? record;
    return (
        readObjectIdField(fields.id) ??
        readObjectIdField(fields.bytes) ??
        readObjectIdField(fields.value) ??
        readObjectIdField(fields.package)
    );
}

export function extractUpgradeCapPackageId(content: unknown): string | null {
    const record = getObjectRecord(content);
    if (!record) return null;
    if (record.dataType && record.dataType !== "moveObject") return null;
    const fields = getObjectRecord(record.fields);
    return fields ? readObjectIdField(fields.package) : null;
}

export function defaultUpgradeCapName(objectId: string, packageId: string | undefined): string {
    const basis = packageId || objectId;
    return `package_${resourceSlug(basis)}`;
}

export function capModeForObject(
    object: OwnedObjectInfo,
    modes: Record<string, CapMigrationMode>,
    canStageLockIntents: boolean
): CapMigrationMode {
    if (!managedCapKind(object.objectType) || !canStageLockIntents) return "move";
    return modes[object.objectId] ?? "lock";
}

export function maxCoinObjectAmount(row: MigrationCoinRow): bigint {
    if (!row.objectBalanceKnown) return 0n;
    const raw = BigInt(row.objectBalance || "0");
    if (row.coinType !== SUI_TYPE_ARG) return raw;
    return raw > GAS_RESERVE_MIST ? raw - GAS_RESERVE_MIST : 0n;
}

export function migrationPlanSizeError(plan: MigrationPlan): string | null {
    if (plan.selectedCoinRows.length > MAX_MIGRATION_COIN_TYPES) {
        return `Select ${MAX_MIGRATION_COIN_TYPES} or fewer coin types per migration. Split the rest into another transaction.`;
    }

    const nonSuiCoinObjectInputs = plan.selectedCoinRows.reduce((total, row) => {
        if (row.coinType === SUI_TYPE_ARG) return total;
        return total + row.coinObjectCount;
    }, 0);
    const custodyObjectInputs = plan.selectedMoveObjects.length + plan.selectedCapLockEntries.length;
    const objectInputs = nonSuiCoinObjectInputs + custodyObjectInputs;
    if (objectInputs > MAX_MIGRATION_OBJECT_INPUTS) {
        return `This migration selects ${objectInputs} object inputs. Split it into batches of ${MAX_MIGRATION_OBJECT_INPUTS} or fewer.`;
    }

    const capLockBatches = Math.ceil(plan.selectedCapLockEntries.length / LOCKABLE_CAPS_PER_INTENT);
    const estimatedCoinCommands = plan.selectedCoinRows.reduce((total, row) => {
        if (row.coinType === SUI_TYPE_ARG) return total + 2;
        const mergeCommand = row.coinObjectCount > 1 ? 1 : 0;
        return total + mergeCommand + 2;
    }, 0);
    const estimatedCommands =
        estimatedCoinCommands +
        plan.selectedMoveObjects.length +
        plan.selectedCapLockEntries.length +
        capLockBatches * 5 +
        plan.selectedCapLockEntries.length * 2;

    if (estimatedCommands > MAX_MIGRATION_ESTIMATED_COMMANDS) {
        return `This migration is too large for one wallet transaction. Split it into smaller batches.`;
    }

    return null;
}
