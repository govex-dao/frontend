/* eslint-disable @typescript-eslint/no-explicit-any, max-lines */
/**
 * Direct RPC queries for MultisigConfig and Account intents.
 * Used for live onchain data on detail pages and paste-ID lookups.
 */

import { SuiClient } from "@mysten/sui/client";
import { parseStructTag } from "@mysten/sui/utils";
import { getSDK } from "@/lib/sdk";

// --- Types ---

export interface MultisigMember {
    address: string;
    weight: number;
    permissions: number; // bitmask: PROPOSE=1, VOTE=2, EXECUTE=4, CANCEL=8
}

export interface MultisigGroupMember {
    address: string;
    weight: number;
}

export interface MultisigTimeBand {
    afterMs: number;
    weight: number;
}

export interface MultisigGroup {
    name: string;
    members: MultisigGroupMember[];
    timeBands: MultisigTimeBand[];
}

export interface MultisigPolicyRequirement {
    groupIndex: number;
    threshold: number;
}

export interface MultisigPolicyPath {
    requirements: MultisigPolicyRequirement[];
}

export interface MultisigPolicy {
    paths: MultisigPolicyPath[];
}

export interface MultisigConfig {
    name: string;
    globalThreshold: number;
    executionTimelockMs: number;
    intentExpiryMs: number;
    configNonce: number;
    members: MultisigMember[];
    groups: MultisigGroup[];
    approvePolicy: MultisigPolicy;
    cancelPolicy: MultisigPolicy;
    proposeGroups: number[];
    executeGroups: number[];
    cancelGroups: number[];
    isExecutionPermissionless: boolean;
}

export interface VaultStreamInfo {
    id: string;
    vaultName: string;
    coinType: string;
    capId?: string;
    streamId?: string;
    accountId?: string;
    accountAddr?: string;
    capHolder?: string;
    amountPerIteration: bigint;
    claimedAmount: bigint;
    firstUnclaimedIteration?: bigint;
    partialClaimedInIteration?: bigint;
    startTimeMs: number;
    iterationsTotal: number;
    iterationPeriodMs: number;
    claimWindowMs: number | null;
    expiryMs: number | null;
    whitelistedRecipients: string[];
    isSpendingLimit: boolean;
}

export interface IntentApprovals {
    configNonce: number;
    status: number; // 0=ACTIVE, 1=APPROVED, 2=REJECTED, 4=EXECUTED
    totalWeight: number;
    cancelWeight: number;
    approvedAtMs: number;
    /** Approve-policy path index that satisfied the vote (set on APPROVED). */
    matchedVotePath: number | null;
    approved: string[];
    rejected: string[];
}

export interface IntentSummary {
    key: string;
    description: string;
    account: string;
    createdAtMs: number;
    expirationMs: number;
    intentType?: string;
    isConfigIntent?: boolean;
    actionCount: number;
    actionTypes: string[];
    expectedAmountByAction?: Record<number, string>;
    /** Package upgrade actions: expected UpgradeCap object ID from the action spec, keyed by action index. */
    expectedCapIdByAction?: Record<number, string>;
    /** PackageUpgrade: package name from the action spec, keyed by action index. */
    upgradePackageNameByAction?: Record<number, string>;
    /** PackageUpgrade: digest hex from the action spec, keyed by action index. */
    upgradeDigestByAction?: Record<number, string>;
    /** Execution object IDs encoded directly in the action spec, keyed by action index. */
    fixedObjectIdByAction?: Record<number, string>;
    /** Raw BCS action data hex, keyed by action index. Used for display-only decoding. */
    actionDataByAction?: Record<number, string>;
    approvals: IntentApprovals;
}

export const MULTISIG_INTENT_STATUS = {
    ACTIVE: 0,
    APPROVED: 1,
    REJECTED: 2,
    EXECUTED: 4,
} as const;

export type MultisigIntentStatus = (typeof MULTISIG_INTENT_STATUS)[keyof typeof MULTISIG_INTENT_STATUS];

export const MULTISIG_TERMINAL_INTENT_STATUSES = [
    MULTISIG_INTENT_STATUS.REJECTED,
    MULTISIG_INTENT_STATUS.EXECUTED,
] as const;

// --- Permission helpers ---

export const PERMISSION_PROPOSE = 1;
export const PERMISSION_VOTE = 2;
export const PERMISSION_EXECUTE = 4;
export const PERMISSION_CANCEL = 8;

export function hasPermission(permissions: number, flag: number): boolean {
    return (permissions & flag) !== 0;
}

export function permissionLabels(permissions: number): string[] {
    const labels: string[] = [];
    if (hasPermission(permissions, PERMISSION_PROPOSE)) labels.push("Propose");
    if (hasPermission(permissions, PERMISSION_VOTE)) labels.push("Vote");
    if (hasPermission(permissions, PERMISSION_EXECUTE)) labels.push("Execute");
    if (hasPermission(permissions, PERMISSION_CANCEL)) labels.push("Cancel");
    return labels;
}

export function normalizeSuiAddress(address: string | undefined | null): string {
    return (address ?? "").trim().toLowerCase();
}

export function isAccountMember(config: MultisigConfig, address: string | undefined | null): boolean {
    const normalized = normalizeSuiAddress(address);
    if (!normalized) return false;
    return config.groups.some((group) =>
        group.members.some((member) => normalizeSuiAddress(member.address) === normalized)
    );
}

function groupHasAddress(config: MultisigConfig, groupIndex: number, address: string): boolean {
    const group = config.groups[groupIndex];
    if (!group) return false;
    const normalized = normalizeSuiAddress(address);
    return group.members.some((member) => normalizeSuiAddress(member.address) === normalized);
}

function addressInGroups(config: MultisigConfig, groupIndices: number[], address: string | undefined | null): boolean {
    const normalized = normalizeSuiAddress(address);
    if (!normalized) return false;
    return groupIndices.some((groupIndex) => groupHasAddress(config, groupIndex, normalized));
}

export function canAddressPropose(config: MultisigConfig, address: string | undefined | null): boolean {
    return addressInGroups(config, config.proposeGroups, address);
}

export function canAddressExecute(config: MultisigConfig, address: string | undefined | null): boolean {
    if (!address) return false;
    if (config.executeGroups.length === 0) return true;
    return addressInGroups(config, config.executeGroups, address);
}

export function canAddressCancel(config: MultisigConfig, address: string | undefined | null): boolean {
    return addressInGroups(config, config.cancelGroups, address);
}

export function memberPermissionsForAddress(config: MultisigConfig, address: string | undefined | null): number {
    const normalized = normalizeSuiAddress(address);
    if (!normalized) return 0;
    return config.members.find((member) => normalizeSuiAddress(member.address) === normalized)?.permissions ?? 0;
}

export function primaryApprovalRequirement(config: MultisigConfig): MultisigPolicyRequirement | null {
    return config.approvePolicy.paths[0]?.requirements[0] ?? null;
}

export interface MultisigPolicyProgress {
    current: number;
    threshold: number;
    percent: number;
    label: string;
    satisfied: boolean;
}

export interface MaturingTimeBand {
    groupIndex: number;
    groupName: string;
    afterMs: number;
    weight: number;
    etaMs: number;
}

function memberWeightFor(group: MultisigGroup | undefined, voters: Set<string>): number {
    if (!group) return 0;
    return group.members.reduce((total, member) => {
        return voters.has(normalizeSuiAddress(member.address)) ? total + member.weight : total;
    }, 0);
}

function maturedTimeBandWeight(group: MultisigGroup | undefined, elapsedMs: number): number {
    if (!group) return 0;
    return group.timeBands.reduce((weight, band) => (elapsedMs >= band.afterMs ? band.weight : weight), 0);
}

export function approvalProgressFor(
    config: MultisigConfig,
    approvedAddresses: string[],
    elapsedMs = 0
): MultisigPolicyProgress {
    const voters = new Set(approvedAddresses.map(normalizeSuiAddress));
    let best: MultisigPolicyProgress = {
        current: 0,
        threshold: 0,
        percent: 0,
        label: "Approval policy unavailable",
        satisfied: false,
    };

    for (const path of config.approvePolicy.paths) {
        if (path.requirements.length === 0) continue;

        const requirementProgress = path.requirements.map((requirement) => {
            const group = config.groups[requirement.groupIndex];
            const memberWeight = memberWeightFor(group, voters);
            const current = memberWeight + maturedTimeBandWeight(group, elapsedMs);
            const threshold = requirement.threshold;
            const percent = threshold > 0 ? Math.min((current / threshold) * 100, 100) : 0;
            return {
                current,
                threshold,
                percent,
                satisfied: threshold > 0 && current >= threshold && memberWeight > 0,
            };
        });

        const pathSatisfied = requirementProgress.every((requirement) => requirement.satisfied);
        const bottleneck = requirementProgress.reduce((lowest, current) =>
            current.percent < lowest.percent ? current : lowest
        );
        const satisfiedCount = requirementProgress.filter((requirement) => requirement.satisfied).length;
        const label =
            path.requirements.length === 1
                ? `${bottleneck.current}/${bottleneck.threshold}`
                : `${satisfiedCount}/${path.requirements.length} requirements`;
        const pathProgress = {
            current: path.requirements.length === 1 ? bottleneck.current : satisfiedCount,
            threshold: path.requirements.length === 1 ? bottleneck.threshold : path.requirements.length,
            percent: pathSatisfied ? 100 : bottleneck.percent,
            label,
            satisfied: pathSatisfied,
        };

        if (pathProgress.satisfied || pathProgress.percent > best.percent) best = pathProgress;
        if (best.satisfied) break;
    }

    return best;
}

// Mirrors onchain find_satisfied_reject_path: cancel_policy is evaluated against
// the rejected voters with include_time_bands=false. Time bands never count toward
// cancellation; only real reject votes do.
export function rejectionProgressFor(
    config: MultisigConfig,
    rejectedAddresses: string[]
): MultisigPolicyProgress {
    const voters = new Set(rejectedAddresses.map(normalizeSuiAddress));
    let best: MultisigPolicyProgress = {
        current: 0,
        threshold: 0,
        percent: 0,
        label: "Cancel policy unavailable",
        satisfied: false,
    };

    for (const path of config.cancelPolicy.paths) {
        if (path.requirements.length === 0) continue;

        const requirementProgress = path.requirements.map((requirement) => {
            const group = config.groups[requirement.groupIndex];
            const current = memberWeightFor(group, voters);
            const threshold = requirement.threshold;
            const percent = threshold > 0 ? Math.min((current / threshold) * 100, 100) : 0;
            return {
                current,
                threshold,
                percent,
                satisfied: threshold > 0 && current >= threshold,
            };
        });

        const pathSatisfied = requirementProgress.every((requirement) => requirement.satisfied);
        const bottleneck = requirementProgress.reduce((lowest, current) =>
            current.percent < lowest.percent ? current : lowest
        );
        const satisfiedCount = requirementProgress.filter((requirement) => requirement.satisfied).length;
        const label =
            path.requirements.length === 1
                ? `${bottleneck.current}/${bottleneck.threshold}`
                : `${satisfiedCount}/${path.requirements.length} requirements`;
        const pathProgress = {
            current: path.requirements.length === 1 ? bottleneck.current : satisfiedCount,
            threshold: path.requirements.length === 1 ? bottleneck.threshold : path.requirements.length,
            percent: pathSatisfied ? 100 : bottleneck.percent,
            label,
            satisfied: pathSatisfied,
        };

        if (pathProgress.satisfied || pathProgress.percent > best.percent) best = pathProgress;
        if (best.satisfied) break;
    }

    return best;
}

// Deep equality on policy path structure. Order-sensitive: the onchain
// matched_vote_path index is derived from path order, so [path A, path B]
// is not the same as [path B, path A].
export function arePoliciesEqual(a: MultisigPolicy, b: MultisigPolicy): boolean {
    if (a.paths.length !== b.paths.length) return false;
    for (let i = 0; i < a.paths.length; i += 1) {
        const ap = a.paths[i];
        const bp = b.paths[i];
        if (ap.requirements.length !== bp.requirements.length) return false;
        for (let j = 0; j < ap.requirements.length; j += 1) {
            if (
                ap.requirements[j].groupIndex !== bp.requirements[j].groupIndex ||
                ap.requirements[j].threshold !== bp.requirements[j].threshold
            ) {
                return false;
            }
        }
    }
    return true;
}

// Deep equality on group index lists (order-insensitive).
export function areGroupListsEqual(a: number[], b: number[]): boolean {
    if (a.length !== b.length) return false;
    const sortedA = [...a].sort((x, y) => x - y);
    const sortedB = [...b].sort((x, y) => x - y);
    return sortedA.every((value, index) => value === sortedB[index]);
}

// Earliest-future time band across a set of groups. When approvedAddresses is
// provided, groups without any real approval weight are skipped to mirror Move:
// time bands can top up approvals, but cannot satisfy a requirement alone.
export function nextMaturingTimeBand(
    config: MultisigConfig,
    groupIndices: number[],
    elapsedMs: number,
    approvedAddresses?: string[]
): MaturingTimeBand | null {
    let best: MaturingTimeBand | null = null;
    const voters = approvedAddresses ? new Set(approvedAddresses.map(normalizeSuiAddress)) : null;

    for (const idx of groupIndices) {
        const group = config.groups[idx];
        if (!group) continue;
        if (voters && memberWeightFor(group, voters) === 0) continue;

        for (const band of group.timeBands) {
            if (band.afterMs <= elapsedMs) continue;
            const etaMs = band.afterMs - elapsedMs;
            if (best === null || etaMs < best.etaMs) {
                best = { groupIndex: idx, groupName: group.name, afterMs: band.afterMs, weight: band.weight, etaMs };
            }
        }
    }
    return best;
}

export function approvalPolicyLabel(config: MultisigConfig): string {
    const path = config.approvePolicy.paths[0];
    if (!path) return "No approval policy";
    if (config.approvePolicy.paths.length === 1 && path.requirements.length === 1) {
        const requirement = path.requirements[0];
        const groupName = config.groups[requirement.groupIndex]?.name ?? `Group ${requirement.groupIndex + 1}`;
        return `${requirement.threshold} ${groupName} weight`;
    }
    return `${config.approvePolicy.paths.length} approval path${config.approvePolicy.paths.length === 1 ? "" : "s"}`;
}

export const INTENT_STATUS_LABELS: Record<number, string> = {
    [MULTISIG_INTENT_STATUS.ACTIVE]: "Active",
    [MULTISIG_INTENT_STATUS.APPROVED]: "Approved",
    [MULTISIG_INTENT_STATUS.REJECTED]: "Rejected",
    [MULTISIG_INTENT_STATUS.EXECUTED]: "Executed",
};

export function intentStatusLabel(status: number): string {
    return INTENT_STATUS_LABELS[status] ?? `Unknown (${status})`;
}

export function isOpenIntentStatus(status: number): boolean {
    return status === MULTISIG_INTENT_STATUS.ACTIVE || status === MULTISIG_INTENT_STATUS.APPROVED;
}

export function isClosedIntentStatus(status: number): boolean {
    return status === MULTISIG_INTENT_STATUS.REJECTED || status === MULTISIG_INTENT_STATUS.EXECUTED;
}

// --- Expiration formatting ---

export function formatExpiration(expirationMs: number): {
    label: string;
    isExpired: boolean;
    isSoon: boolean;
} {
    const now = Date.now();
    const diff = expirationMs - now;
    const absDiff = Math.abs(diff);
    const isExpired = diff <= 0;

    const minutes = Math.floor(absDiff / 60_000);
    const hours = Math.floor(absDiff / 3_600_000);
    const days = Math.floor(absDiff / 86_400_000);

    let relative: string;
    if (days > 0) relative = `${days}d ${hours % 24}h`;
    else if (hours > 0) relative = `${hours}h ${minutes % 60}m`;
    else relative = `${minutes}m`;

    const label = isExpired ? `Expired ${relative} ago` : `Expires in ${relative}`;
    const isSoon = !isExpired && diff < 86_400_000; // < 24h

    return { label, isExpired, isSoon };
}

// --- Helpers ---

function get(obj: any, path: string, defaultValue: any = null): any {
    const keys = path.split(".");
    let result = obj;
    for (const key of keys) {
        if (result == null) return defaultValue;
        result = result[key];
    }
    return result ?? defaultValue;
}

function fieldsOf(value: any): any {
    return value?.fields ?? value ?? {};
}

function parseNumberLike(value: any): number {
    if (typeof value === "number") return value;
    if (typeof value === "bigint") return Number(value);
    if (typeof value === "string") return Number(value);
    return Number(value ?? 0);
}

function parseVector(value: any): any[] {
    if (!value) return [];
    if (Array.isArray(value)) return value;
    const fields = fieldsOf(value);
    if (Array.isArray(fields.contents)) return fields.contents;
    if (Array.isArray(fields.values)) return fields.values;
    if (Array.isArray(fields.vec)) return fields.vec;
    return [];
}

function parseGroupIndices(value: any): number[] {
    return parseVector(value)
        .map((item) => parseNumberLike(item))
        .filter((item) => Number.isFinite(item) && item >= 0);
}

function parsePolicy(value: any): MultisigPolicy {
    const policyFields = fieldsOf(value);
    const rawPaths = parseVector(policyFields.paths ?? value);

    return {
        paths: rawPaths.map((path) => {
            const pathFields = fieldsOf(path);
            return {
                requirements: parseVector(pathFields.requirements).map((requirement) => {
                    const reqFields = fieldsOf(requirement);
                    return {
                        groupIndex: parseNumberLike(reqFields.group_idx ?? reqFields.groupIndex ?? 0),
                        threshold: parseNumberLike(reqFields.threshold ?? 0),
                    };
                }),
            };
        }),
    };
}

function parseGroups(value: any): MultisigGroup[] {
    return parseVector(value).map((group, index) => {
        const groupFields = fieldsOf(group);
        return {
            name: String(groupFields.name ?? `Group ${index + 1}`),
            members: parseVector(groupFields.members).map((member) => {
                const memberFields = fieldsOf(member);
                return {
                    address: String(memberFields.addr ?? memberFields.address ?? ""),
                    weight: parseNumberLike(memberFields.weight ?? 0),
                };
            }),
            timeBands: parseVector(groupFields.time_bands ?? groupFields.timeBands).map((timeBand) => {
                const timeBandFields = fieldsOf(timeBand);
                return {
                    afterMs: parseNumberLike(timeBandFields.after_ms ?? timeBandFields.afterMs ?? 0),
                    weight: parseNumberLike(timeBandFields.weight ?? 0),
                };
            }),
        };
    });
}

function deriveMembersFromConfigParts(
    groups: MultisigGroup[],
    proposeGroups: number[],
    executeGroups: number[],
    cancelGroups: number[]
): MultisigMember[] {
    const members = new Map<string, MultisigMember>();

    groups.forEach((group, groupIndex) => {
        for (const groupMember of group.members) {
            const address = normalizeSuiAddress(groupMember.address);
            if (!address) continue;
            const current = members.get(address) ?? { address: groupMember.address, weight: 0, permissions: 0 };
            current.weight = Math.max(current.weight, groupMember.weight);
            current.permissions |= PERMISSION_VOTE;
            if (proposeGroups.includes(groupIndex)) current.permissions |= PERMISSION_PROPOSE;
            if (executeGroups.includes(groupIndex)) current.permissions |= PERMISSION_EXECUTE;
            if (cancelGroups.includes(groupIndex)) current.permissions |= PERMISSION_CANCEL;
            members.set(address, current);
        }
    });

    return Array.from(members.values());
}

function parseVecSet(value: any): string[] {
    if (!value) return [];
    const contents = parseVector(value);
    if (contents.length > 0) return contents.map((item) => String(item));
    return [];
}

function parseAddressVector(value: any): string[] {
    return parseVector(value)
        .map((item) => String(item))
        .filter((address) => address.length > 0);
}

function parseVecMapEntries(value: any): Array<{ key: any; value: any }> {
    if (!value) return [];

    const contents = value?.fields?.contents || value?.contents;
    if (Array.isArray(contents)) {
        return contents
            .map((item) => {
                const fields = item?.fields || item;
                return { key: fields?.key, value: fields?.value };
            })
            .filter((entry) => entry.key != null);
    }

    const keys = value?.fields?.keys || value?.keys;
    const values = value?.fields?.values || value?.values;
    if (Array.isArray(keys) && Array.isArray(values)) {
        return keys.map((key, index) => ({ key, value: values[index] }));
    }

    return [];
}

function extractModuleType(fullType: string): string {
    try {
        const tag = parseStructTag(fullType);
        return `${tag.module}::${tag.name}`;
    } catch {
        const base = fullType.split("<")[0];
        const parts = base.split("::");
        return parts.length >= 3 ? `${parts[parts.length - 2]}::${parts[parts.length - 1]}` : base;
    }
}

function extractTypeAddress(fullType: string): string | undefined {
    try {
        return parseStructTag(fullType).address;
    } catch {
        const base = fullType.split("<")[0];
        const parts = base.split("::");
        return parts.length >= 3 ? parts[0] : undefined;
    }
}

function normalizeAddressForCompare(address: string | undefined): string | undefined {
    const trimmed = address?.trim().toLowerCase();
    if (!trimmed) return undefined;
    const noPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    const noLeadingZeroes = noPrefix.replace(/^0+/, "");
    return noLeadingZeroes || "0";
}

export function isMultisigConfigChangeIntentType(
    intentType: string | undefined,
    accountMultisigPackageId?: string
): boolean {
    if (!intentType || extractModuleType(intentType) !== "config::ConfigChangeIntent") return false;

    const expectedPackage = normalizeAddressForCompare(accountMultisigPackageId);
    if (!expectedPackage) return true;

    return normalizeAddressForCompare(extractTypeAddress(intentType)) === expectedPackage;
}

export function isMultisigConfigChangeActionType(actionType: string, accountMultisigPackageId?: string): boolean {
    if (extractModuleType(actionType) !== "config::ConfigChange") return false;

    const expectedPackage = normalizeAddressForCompare(accountMultisigPackageId);
    if (!expectedPackage) return true;

    return normalizeAddressForCompare(extractTypeAddress(actionType)) === expectedPackage;
}

export function isMultisigConfigIntentSummary(intent: IntentSummary, accountMultisigPackageId?: string): boolean {
    if (typeof intent.isConfigIntent === "boolean") return intent.isConfigIntent;
    return (
        isMultisigConfigChangeIntentType(intent.intentType, accountMultisigPackageId) ||
        intent.actionTypes.some((actionType) => isMultisigConfigChangeActionType(actionType, accountMultisigPackageId))
    );
}

function parseTypeName(value: any): string | undefined {
    if (!value) return undefined;
    if (typeof value === "string" && value.trim().length > 0) return value.trim();
    const fields = value?.fields || value;
    const name = fields?.name;
    if (typeof name === "string" && name.trim().length > 0) return name.trim();
    return undefined;
}

function normalizeIdString(value: any): string | null {
    if (!value) return null;
    if (typeof value === "string" && value.length > 0) {
        return value.startsWith("0x") ? value : `0x${value}`;
    }
    const fields = value?.fields || value;
    return normalizeIdString(fields?.id ?? fields?.bytes ?? fields?.value ?? null);
}

function extractCoinTypeFromObjectType(objectType: string): string | undefined {
    const start = objectType.indexOf("<");
    const end = objectType.lastIndexOf(">");
    if (start === -1 || end === -1 || end <= start) return undefined;
    return objectType.slice(start + 1, end).trim();
}

function findNestedField(value: any, fieldName: string, depth = 0): any {
    if (value == null || depth > 8 || typeof value !== "object") return null;

    if (fieldName in value) return value[fieldName];
    if (value.fields && typeof value.fields === "object" && fieldName in value.fields) {
        return value.fields[fieldName];
    }

    for (const nested of Object.values(value)) {
        const found = findNestedField(nested, fieldName, depth + 1);
        if (found != null) return found;
    }

    return null;
}

function readUleb128(bytes: Uint8Array, start: number): { value: number; next: number } | null {
    let value = 0;
    let shift = 0;
    let i = start;
    while (i < bytes.length) {
        const byte = bytes[i];
        value |= (byte & 0x7f) << shift;
        i += 1;
        if ((byte & 0x80) === 0) {
            return { value, next: i };
        }
        shift += 7;
        if (shift > 28) return null;
    }
    return null;
}

function readU64LE(bytes: Uint8Array, start: number): bigint | null {
    if (start + 8 > bytes.length) return null;
    let out = 0n;
    for (let i = 0; i < 8; i += 1) {
        out |= BigInt(bytes[start + i]) << BigInt(i * 8);
    }
    return out;
}

function hexToBytes(hex: string): Uint8Array | null {
    const noPrefix = hex.startsWith("0x") ? hex.slice(2) : hex;
    if (noPrefix.length === 0 || noPrefix.length % 2 !== 0 || !/^[0-9a-fA-F]+$/.test(noPrefix)) {
        return null;
    }
    const out = new Uint8Array(noPrefix.length / 2);
    for (let i = 0; i < noPrefix.length; i += 2) {
        out[i / 2] = parseInt(noPrefix.slice(i, i + 2), 16);
    }
    return out;
}

function base64ToBytes(base64: string): Uint8Array | null {
    try {
        const binary = atob(base64);
        return Uint8Array.from(binary, (ch) => ch.charCodeAt(0));
    } catch {
        return null;
    }
}

function asBytes(value: any): Uint8Array | null {
    if (!value) return null;
    if (value instanceof Uint8Array) return value;
    if (ArrayBuffer.isView(value)) {
        return new Uint8Array(value.buffer, value.byteOffset, value.byteLength);
    }
    if (Array.isArray(value) && value.every((v) => typeof v === "number")) {
        return Uint8Array.from(value);
    }
    if (typeof value === "string") {
        const trimmed = value.trim();
        return hexToBytes(trimmed) || base64ToBytes(trimmed);
    }
    if (typeof value === "object") {
        return (
            asBytes(value.bytes) ||
            asBytes(value.contents) ||
            asBytes(value.data) ||
            asBytes(value.fields?.bytes) ||
            asBytes(value.fields?.contents) ||
            null
        );
    }
    return null;
}

function bytesToHex(bytes: Uint8Array | null): string | null {
    if (!bytes) return null;
    return `0x${Array.from(bytes)
        .map((byte) => byte.toString(16).padStart(2, "0"))
        .join("")}`;
}

function parseVaultDepositExternalExpectedAmount(actionData: any): string | null {
    const bytes = asBytes(actionData);
    if (!bytes) return null;

    const nameLen = readUleb128(bytes, 0);
    if (!nameLen) return null;
    const amountOffset = nameLen.next + nameLen.value;
    const expectedAmount = readU64LE(bytes, amountOffset);
    if (expectedAmount === null) return null;
    return expectedAmount.toString();
}

/** Parse action payloads that begin with a fixed object ID/address followed by other fields. */
function parseFixedExecutionObjectId(actionData: any): string | null {
    const bytes = asBytes(actionData);
    if (!bytes || bytes.length < 32) return null;
    return (
        "0x" +
        Array.from(bytes.slice(0, 32))
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
    );
}

/** Parse the package name (first BCS field) from any package upgrade action: name (String), ... */
function parseActionSpecPackageName(actionData: any): string | null {
    const bytes = asBytes(actionData);
    if (!bytes) return null;
    const nameLen = readUleb128(bytes, 0);
    if (!nameLen || nameLen.next + nameLen.value > bytes.length) return null;
    try {
        return new TextDecoder().decode(bytes.slice(nameLen.next, nameLen.next + nameLen.value));
    } catch {
        return null;
    }
}

function parsePackageUpgradeDigest(actionData: any): string | null {
    const bytes = asBytes(actionData);
    if (!bytes) return null;

    const nameLen = readUleb128(bytes, 0);
    if (!nameLen) return null;

    const digestLen = readUleb128(bytes, nameLen.next + nameLen.value);
    if (!digestLen || digestLen.next + digestLen.value > bytes.length) return null;

    return Array.from(bytes.slice(digestLen.next, digestLen.next + digestLen.value))
        .map((b) => b.toString(16).padStart(2, "0"))
        .join("");
}

/** Package upgrade action payloads now end with expected_cap_id: ID (32 bytes). */
function parsePackageUpgradeExpectedCapId(actionData: any): string | null {
    const bytes = asBytes(actionData);
    if (!bytes || bytes.length < 32) return null;
    const idBytes = bytes.slice(bytes.length - 32);
    return (
        "0x" +
        Array.from(idBytes)
            .map((b) => b.toString(16).padStart(2, "0"))
            .join("")
    );
}

async function getAllDynamicFields(client: SuiClient, parentId: string): Promise<Array<{ name: unknown }>> {
    const all: Array<{ name: unknown }> = [];
    let cursor: string | null | undefined = null;

    while (true) {
        const page = await client.getDynamicFields({
            parentId,
            ...(cursor ? { cursor } : {}),
        });
        all.push(...(page.data as Array<{ name: unknown }>));
        if (!page.hasNextPage || !page.nextCursor) break;
        cursor = page.nextCursor;
    }

    return all;
}

// --- RPC Fetchers ---

/**
 * Fetch MultisigConfig from an Account object's config Bag.
 * Works for any Account ID — including non-DAO accounts.
 */
export async function fetchMultisigConfig(client: SuiClient, accountId: string): Promise<MultisigConfig | null> {
    try {
        // Get Account object
        const accountObj = await client.getObject({
            id: accountId,
            options: { showContent: true, showType: true },
        });

        const fields = (accountObj.data?.content as any)?.fields;
        if (!fields) return null;

        // Extract account name from metadata (VecMap<String, String>)
        let accountName = "";
        const metadataFields = fields.metadata?.fields;
        if (metadataFields) {
            const keys: string[] =
                metadataFields.keys ?? metadataFields.contents?.map((c: any) => c?.fields?.key) ?? [];
            const values: string[] =
                metadataFields.values ?? metadataFields.contents?.map((c: any) => c?.fields?.value) ?? [];
            const nameIdx = keys.indexOf("name");
            if (nameIdx >= 0 && values[nameIdx]) accountName = values[nameIdx];
        }

        // MultisigConfig is stored as a dynamic field directly on the Account object,
        // keyed by account::ConfigKey. List dynamic fields on the Account ID.
        const dynFields = await getAllDynamicFields(client, accountId);

        // Find the MultisigConfig entry (skip proposed config changes stored as managed data)
        const multisigField = dynFields.find((df: any) => {
            const objType = (df as any).objectType || "";
            const nameType = (df.name as any)?.type || "";
            // Proposed config changes use ProposedConfigKey / ManagedData — skip those
            if (nameType.includes("Proposed") || nameType.includes("ManagedData")) return false;
            return (
                objType.toLowerCase().includes("multisigconfig") ||
                (nameType.includes("ConfigKey") && objType.toLowerCase().includes("multisig"))
            );
        });

        if (!multisigField) return null;

        // Read the MultisigConfig dynamic field
        const dfObj = await client.getDynamicFieldObject({
            parentId: accountId,
            name: multisigField.name as any,
        });

        const configFields = (dfObj.data?.content as any)?.fields?.value?.fields;
        if (!configFields) return null;

        if (!configFields.groups) return null;

        const groups = parseGroups(configFields.groups);
        const approvePolicy = parsePolicy(configFields.approve_policy ?? configFields.approvePolicy);
        const cancelPolicy = parsePolicy(configFields.cancel_policy ?? configFields.cancelPolicy);
        const proposeGroups = parseGroupIndices(configFields.propose_groups ?? configFields.proposeGroups);
        const executeGroups = parseGroupIndices(configFields.execute_groups ?? configFields.executeGroups);
        const cancelGroups = parseGroupIndices(configFields.cancel_groups ?? configFields.cancelGroups);
        const members = deriveMembersFromConfigParts(groups, proposeGroups, executeGroups, cancelGroups);
        const primaryRequirement = approvePolicy.paths[0]?.requirements[0];

        return {
            name: accountName,
            globalThreshold: primaryRequirement?.threshold ?? 0,
            executionTimelockMs: 0,
            intentExpiryMs: Number(configFields.intent_expiry_ms || configFields.intentExpiryMs || 0),
            configNonce: Number(configFields.config_nonce || configFields.configNonce || 0),
            members,
            groups,
            approvePolicy,
            cancelPolicy,
            proposeGroups,
            executeGroups,
            cancelGroups,
            isExecutionPermissionless: executeGroups.length === 0,
        };
    } catch (error) {
        console.error(`[fetchMultisigConfig] Error for ${accountId}:`, error);
        return null;
    }
}

/**
 * Fetch active intents from an Account object's intents Bag.
 */
export async function fetchAccountIntents(client: SuiClient, accountId: string): Promise<IntentSummary[]> {
    try {
        const accountMultisigPackageId = getSDK().packages.accountMultisig;
        const accountObj = await client.getObject({
            id: accountId,
            options: { showContent: true },
        });

        const fields = (accountObj.data?.content as any)?.fields;
        if (!fields) return [];

        // Find intents bag ID
        const intentsBagId =
            get(fields, "intents.fields.inner.fields.id.id") ||
            get(fields, "intents.fields.id.id") ||
            get(fields, "intents.fields.id");
        if (!intentsBagId) return [];

        // List dynamic fields (each is an intent)
        const dynFields = await getAllDynamicFields(client, intentsBagId);

        const intents: IntentSummary[] = [];

        for (const df of dynFields) {
            try {
                const intentObj = await client.getDynamicFieldObject({
                    parentId: intentsBagId,
                    name: df.name as any,
                });

                const intentFields = (intentObj.data?.content as any)?.fields?.value?.fields;
                if (!intentFields) continue;

                const outcomeFields = get(intentFields, "outcome.fields") || intentFields.outcome;
                const intentType = parseTypeName(intentFields.type_ ?? intentFields.type);

                // Parse action types from action_specs vector
                const actionTypes: string[] = [];
                const rawSpecs = get(intentFields, "action_specs") || get(intentFields, "action_specs.fields") || [];
                const specsArray = Array.isArray(rawSpecs) ? rawSpecs : [];
                for (const spec of specsArray) {
                    const sf = spec?.fields || spec;
                    // TypeName is serialized as a string like "addr::module::Name"
                    // or as an object with fields { addr, module_name, name }
                    const actionType = sf?.action_type;
                    if (typeof actionType === "string") {
                        actionTypes.push(actionType);
                    } else if (actionType) {
                        const atFields = actionType?.fields || actionType;
                        const name = atFields?.name || "";
                        if (name) {
                            // TypeName.name contains the full "addr::module::Type" string
                            actionTypes.push(name);
                        }
                    }
                }

                const expectedAmountByAction: Record<number, string> = {};
                const expectedCapIdByAction: Record<number, string> = {};
                const upgradePackageNameByAction: Record<number, string> = {};
                const upgradeDigestByAction: Record<number, string> = {};
                const fixedObjectIdByAction: Record<number, string> = {};
                const actionDataByAction: Record<number, string> = {};
                for (let i = 0; i < specsArray.length; i += 1) {
                    const spec = specsArray[i];
                    const sf = spec?.fields || spec;
                    const actionType = actionTypes[i];
                    if (!actionType) continue;
                    const modType = extractModuleType(actionType);
                    const actionData = sf?.action_data ?? sf?.actionData ?? sf?.data;
                    const actionDataHex = bytesToHex(asBytes(actionData));
                    if (actionDataHex) actionDataByAction[i] = actionDataHex;

                    if (modType === "vault::VaultDepositExternal") {
                        const expectedAmount = parseVaultDepositExternalExpectedAmount(actionData);
                        if (expectedAmount) {
                            expectedAmountByAction[i] = expectedAmount;
                        }
                    } else if (modType.startsWith("package_upgrade::")) {
                        const expectedCapId = parsePackageUpgradeExpectedCapId(actionData);
                        if (expectedCapId) {
                            expectedCapIdByAction[i] = expectedCapId;
                        }
                        if (modType === "package_upgrade::PackageUpgrade") {
                            const pkgName = parseActionSpecPackageName(actionData);
                            if (pkgName) {
                                upgradePackageNameByAction[i] = pkgName;
                            }
                            const digest = parsePackageUpgradeDigest(actionData);
                            if (digest) {
                                upgradeDigestByAction[i] = digest;
                            }
                        }
                    } else if (
                        modType === "owned::OwnedWithdrawObject" ||
                        modType === "owned::ProvideObjectToResources" ||
                        modType === "vesting::CancelVesting"
                    ) {
                        const objId = parseFixedExecutionObjectId(actionData);
                        if (objId) {
                            fixedObjectIdByAction[i] = objId;
                        }
                    }
                }

                const isConfigIntent =
                    isMultisigConfigChangeIntentType(intentType, accountMultisigPackageId) ||
                    actionTypes.some((t) => isMultisigConfigChangeActionType(t, accountMultisigPackageId));

                intents.push({
                    key: (df.name as any)?.value || df.name?.toString() || "",
                    description: intentFields.description || "",
                    account: intentFields.account || accountId,
                    createdAtMs: Number(intentFields.creation_time || 0),
                    expirationMs: Number(intentFields.expiration_time || 0),
                    intentType,
                    isConfigIntent,
                    actionCount: Number(
                        get(intentFields, "actions.fields.size") ||
                            get(intentFields, "actions.fields.contents.length") ||
                            specsArray.length ||
                            0
                    ),
                    actionTypes,
                    expectedAmountByAction:
                        Object.keys(expectedAmountByAction).length > 0 ? expectedAmountByAction : undefined,
                    expectedCapIdByAction:
                        Object.keys(expectedCapIdByAction).length > 0 ? expectedCapIdByAction : undefined,
                    upgradePackageNameByAction:
                        Object.keys(upgradePackageNameByAction).length > 0 ? upgradePackageNameByAction : undefined,
                    upgradeDigestByAction:
                        Object.keys(upgradeDigestByAction).length > 0 ? upgradeDigestByAction : undefined,
                    fixedObjectIdByAction:
                        Object.keys(fixedObjectIdByAction).length > 0 ? fixedObjectIdByAction : undefined,
                    actionDataByAction:
                        Object.keys(actionDataByAction).length > 0 ? actionDataByAction : undefined,
                    approvals: {
                        configNonce: Number(get(outcomeFields, "config_nonce") || 0),
                        status: Number(get(outcomeFields, "status") || 0),
                        totalWeight: Number(get(outcomeFields, "total_weight") || 0),
                        cancelWeight: Number(get(outcomeFields, "cancel_weight") || 0),
                        approvedAtMs: Number(get(outcomeFields, "approved_at_ms") || 0),
                        matchedVotePath: parseOptionU64(get(outcomeFields, "matched_vote_path")),
                        approved: parseVecSet(get(outcomeFields, "approved")),
                        rejected: parseVecSet(get(outcomeFields, "rejected")),
                    },
                });
            } catch {
                // Skip unreadable intents
            }
        }

        // Sort most recently created/executed first
        intents.sort((a, b) => {
            const aTime = a.approvals.approvedAtMs || a.createdAtMs;
            const bTime = b.approvals.approvedAtMs || b.createdAtMs;
            return bTime - aTime;
        });

        return intents;
    } catch (error) {
        console.error(`[fetchAccountIntents] Error for ${accountId}:`, error);
        return [];
    }
}

/**
 * Fetch vault names from an Account object's dynamic fields.
 */
export async function fetchAccountVaultNames(client: SuiClient, accountId: string): Promise<string[]> {
    try {
        const accountDynFields = await getAllDynamicFields(client, accountId);
        const names = accountDynFields
            .filter((df: any) => {
                const nameType = (df.name as any)?.type || "";
                if (nameType.includes("VaultNamesKey")) return false;
                return nameType.includes("VaultKey") || nameType.includes("vault::VaultKey");
            })
            .map((df: any) => {
                const value = (df.name as any)?.value;
                if (typeof value === "string") return value;
                if (typeof value?.pos0 === "string") return value.pos0;
                if (typeof value?.name === "string") return value.name;
                return "";
            })
            .filter((name): name is string => name.length > 0);

        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
        console.error(`[fetchAccountVaultNames] Error for ${accountId}:`, error);
        return [];
    }
}

/**
 * Fetch all active streams across all vaults on an Account.
 * Navigates: Account UID → VaultKey dynamic fields → Vault.streams Table → VaultStream entries.
 */
export async function fetchAccountStreams(client: SuiClient, accountId: string): Promise<VaultStreamInfo[]> {
    try {
        // 1. List all dynamic fields on the Account object to find VaultKey entries
        const accountDynFields = await getAllDynamicFields(client, accountId);

        const vaultFields = accountDynFields.filter((df: any) => {
            const nameType = (df.name as any)?.type || "";
            if (nameType.includes("VaultNamesKey")) return false;
            return nameType.includes("VaultKey") || nameType.includes("vault::VaultKey");
        });

        if (vaultFields.length === 0) return [];

        // 2. Fetch all vaults in parallel
        const vaultResults = await Promise.all(
            vaultFields.map(async (vf) => {
                try {
                    const vaultNameRaw = (vf.name as any)?.value ?? "";
                    const vaultName =
                        typeof vaultNameRaw === "string"
                            ? vaultNameRaw
                            : (vaultNameRaw?.pos0 ?? vaultNameRaw?.name ?? String(vaultNameRaw));
                    const vaultObj = await client.getDynamicFieldObject({
                        parentId: accountId,
                        name: vf.name as any,
                    });
                    const fields = (vaultObj.data?.content as any)?.fields?.value?.fields;
                    if (!fields) return null;
                    const streamsTableId = get(fields, "streams.fields.id.id") || get(fields, "streams.fields.id");
                    if (!streamsTableId) return null;
                    return { vaultName: typeof vaultName === "string" ? vaultName : String(vaultName), streamsTableId };
                } catch {
                    return null;
                }
            })
        );

        const vaults = vaultResults.filter((v): v is NonNullable<typeof v> => v !== null);
        if (vaults.length === 0) return [];

        // 3. List stream entries for each vault in parallel
        const streamListResults = await Promise.all(
            vaults.map(async ({ vaultName, streamsTableId }) => {
                const streamDynFields = await getAllDynamicFields(client, streamsTableId);
                return { vaultName, streamsTableId, streamDynFields };
            })
        );

        // 4. Fetch all individual streams in parallel
        const streamFetches: Promise<VaultStreamInfo | null>[] = [];
        for (const { vaultName, streamsTableId, streamDynFields } of streamListResults) {
            for (const sf of streamDynFields) {
                streamFetches.push(
                    client
                        .getDynamicFieldObject({ parentId: streamsTableId, name: sf.name as any })
                        .then((streamObj) => {
                            const streamFields = (streamObj.data?.content as any)?.fields?.value?.fields;
                            if (!streamFields) return null;
                            const whitelistedRecipients = parseAddressVector(streamFields.whitelisted_recipients);
                            return {
                                id: normalizeIdString(streamFields.id) ?? normalizeIdString((sf.name as any)?.value) ?? "",
                                vaultName,
                                coinType: normalizeCoinType(parseTypeName(streamFields.coin_type) || "unknown"),
                                amountPerIteration: BigInt(streamFields.amount_per_iteration ?? 0),
                                claimedAmount: BigInt(streamFields.claimed_amount ?? 0),
                                firstUnclaimedIteration: BigInt(streamFields.first_unclaimed_iteration ?? 0),
                                partialClaimedInIteration: BigInt(streamFields.partial_claimed_in_iteration ?? 0),
                                startTimeMs: Number(streamFields.start_time ?? 0),
                                iterationsTotal: Number(streamFields.iterations_total ?? 0),
                                iterationPeriodMs: Number(streamFields.iteration_period_ms ?? 0),
                                claimWindowMs: parseOptionU64(streamFields.claim_window_ms),
                                expiryMs: parseOptionU64(streamFields.expiry_ms),
                                whitelistedRecipients,
                                isSpendingLimit: whitelistedRecipients.length > 0,
                            };
                        })
                        .catch(() => null)
                );
            }
        }

        const results = await Promise.all(streamFetches);
        return results.filter((s): s is VaultStreamInfo => s !== null);
    } catch (error) {
        console.error(`[fetchAccountStreams] Error for ${accountId}:`, error);
        return [];
    }
}

// --- Vault Balance Types ---

export interface VaultCoinBalance {
    vaultName: string;
    coinType: string;
    amount: bigint;
}

export interface AccountVestingInfo {
    vestingId: string;
    accountId: string;
    daoAddress: string;
    coinType: string;
    balance: bigint;
    amountPerIteration: bigint;
    claimedAmount: bigint;
    firstUnclaimedIteration: bigint;
    partialClaimedInIteration: bigint;
    startTimeMs: number;
    iterationsTotal: number;
    iterationPeriodMs: number;
    isCancellable: boolean;
}

/**
 * Fetch all vault coin balances across all vaults on an Account.
 * Navigates: Account UID → VaultKey dynamic fields → Vault.balances Bag → each Balance.
 */
export async function fetchAccountVaultBalances(client: SuiClient, accountId: string): Promise<VaultCoinBalance[]> {
    try {
        const accountDynFields = await getAllDynamicFields(client, accountId);

        const vaultFields = accountDynFields.filter((df: any) => {
            const nameType = (df.name as any)?.type || "";
            if (nameType.includes("VaultNamesKey")) return false;
            return nameType.includes("VaultKey") || nameType.includes("vault::VaultKey");
        });

        if (vaultFields.length === 0) return [];

        // Fetch all vaults in parallel to get balance bag IDs
        const vaultResults = await Promise.all(
            vaultFields.map(async (vf) => {
                try {
                    const vaultNameRaw = (vf.name as any)?.value ?? "";
                    const vaultName =
                        typeof vaultNameRaw === "string"
                            ? vaultNameRaw
                            : (vaultNameRaw?.pos0 ?? vaultNameRaw?.name ?? String(vaultNameRaw));

                    const vaultObj = await client.getDynamicFieldObject({
                        parentId: accountId,
                        name: vf.name as any,
                    });
                    const fields = (vaultObj.data?.content as any)?.fields?.value?.fields;
                    if (!fields) return null;

                    const balancesBagId =
                        get(fields, "bag.fields.id.id") ||
                        get(fields, "bag.fields.id") ||
                        get(fields, "balances.fields.id.id") ||
                        get(fields, "balances.fields.id");
                    if (!balancesBagId) return null;

                    return { vaultName, balancesBagId };
                } catch {
                    return null;
                }
            })
        );

        const vaults = vaultResults.filter((v): v is NonNullable<typeof v> => v !== null);
        if (vaults.length === 0) return [];

        // Fetch balance entries for each vault in parallel
        const balanceFetches: Promise<VaultCoinBalance | null>[] = [];

        for (const { vaultName, balancesBagId } of vaults) {
            const balanceDynFields = await getAllDynamicFields(client, balancesBagId);

            for (const bf of balanceDynFields) {
                balanceFetches.push(
                    client
                        .getDynamicFieldObject({ parentId: balancesBagId, name: bf.name as any })
                        .then((balanceObj) => {
                            const balanceFields = (balanceObj.data?.content as any)?.fields;
                            // The coin type is the key (TypeName value)
                            // TypeName dynamic field key: { value: { name: "addr::module::TYPE" } } or { value: "addr::module::TYPE" }
                            const rawValue = (bf.name as any)?.value;
                            const coinType = typeof rawValue === "string" ? rawValue : (rawValue?.name ?? "");
                            // The balance value is in fields.value (for Balance<T>) or fields.value
                            const amount = BigInt(balanceFields?.value ?? "0");
                            if (amount <= 0n) return null;
                            return { vaultName, coinType: normalizeCoinType(coinType), amount };
                        })
                        .catch(() => null)
                );
            }
        }

        const results = await Promise.all(balanceFetches);
        return results.filter((b): b is VaultCoinBalance => b !== null);
    } catch (error) {
        console.error(`[fetchAccountVaultBalances] Error for ${accountId}:`, error);
        return [];
    }
}

/**
 * Fetch vestings registered on an Account via VestingRegistry managed data.
 */
export async function fetchAccountVestings(client: SuiClient, accountId: string): Promise<AccountVestingInfo[]> {
    try {
        const accountDynFields = await getAllDynamicFields(client, accountId);
        const registryField = accountDynFields.find((df: any) => {
            const nameType = (df.name as any)?.type || "";
            const objType = (df as any).objectType || "";
            return nameType.includes("VestingRegistryKey") || objType.includes("VestingRegistry");
        });

        if (!registryField) return [];

        const registryObj = await client.getDynamicFieldObject({
            parentId: accountId,
            name: registryField.name as any,
        });

        const entries = parseVecMapEntries(findNestedField(registryObj.data?.content, "entries"));

        const registryEntries = entries
            .map((entry) => {
                const vestingId = normalizeIdString(entry.key);
                const fields = entry.value?.fields || entry.value;
                const coinType = parseTypeName(fields?.coin_type);
                if (!vestingId || !coinType) return null;

                return {
                    vestingId,
                    coinType: normalizeCoinType(coinType),
                    isCancellable: Boolean(fields?.is_cancellable),
                };
            })
            .filter((entry): entry is { vestingId: string; coinType: string; isCancellable: boolean } => entry !== null);

        const vestings = await Promise.all(
            registryEntries.map(async (entry) => {
                try {
                    const vestingObj = await client.getObject({
                        id: entry.vestingId,
                        options: { showContent: true, showType: true },
                    });
                    const fields = (vestingObj.data?.content as any)?.fields;
                    const objectType = vestingObj.data?.type ?? "";
                    if (!fields) return null;

                    return {
                        vestingId: entry.vestingId,
                        accountId,
                        daoAddress: normalizeIdString(fields.dao_address) ?? accountId,
                        coinType: normalizeCoinType(
                            parseTypeName(fields.coin_type) ?? extractCoinTypeFromObjectType(objectType) ?? entry.coinType
                        ),
                        balance: BigInt(get(fields, "balance.fields.value", "0") || fields.balance?.value || "0"),
                        amountPerIteration: BigInt(fields.amount_per_iteration ?? 0),
                        claimedAmount: BigInt(fields.claimed_amount ?? 0),
                        firstUnclaimedIteration: BigInt(fields.first_unclaimed_iteration ?? 0),
                        partialClaimedInIteration: BigInt(fields.partial_claimed_in_iteration ?? 0),
                        startTimeMs: Number(fields.start_time ?? 0),
                        iterationsTotal: Number(fields.iterations_total ?? 0),
                        iterationPeriodMs: Number(fields.iteration_period_ms ?? 0),
                        isCancellable: Boolean(fields.is_cancellable ?? entry.isCancellable),
                    } satisfies AccountVestingInfo;
                } catch {
                    return null;
                }
            })
        );

        return vestings
            .filter((entry): entry is AccountVestingInfo => entry !== null)
            .sort((a, b) => a.vestingId.localeCompare(b.vestingId));
    } catch (error) {
        console.error(`[fetchAccountVestings] Error for ${accountId}:`, error);
        return [];
    }
}

/**
 * Normalize a coin type from onchain TypeName format to standard short-form.
 * Onchain TypeName stores "0000...0002::sui::SUI" (full 64-char, no 0x prefix).
 * Wallet/SDK uses short form "0x2::sui::SUI". This converts to short form.
 */
function normalizeCoinType(coinType: string): string {
    if (typeof coinType !== "string") return "";
    let trimmed = coinType.trim();
    if (!trimmed.includes("::")) return trimmed;
    // Ensure 0x prefix
    if (!trimmed.startsWith("0x")) trimmed = `0x${trimmed}`;
    // Shorten the address: remove leading zeros after 0x
    const parts = trimmed.split("::");
    if (parts.length >= 3) {
        const addr = parts[0].replace(/^0x0+/, "0x") || "0x0";
        return `${addr}::${parts.slice(1).join("::")}`;
    }
    return trimmed;
}

/**
 * Fetch approved coin types for a specific vault on an Account.
 */
export async function fetchVaultApprovedCoinTypes(
    client: SuiClient,
    accountId: string,
    vaultName: string
): Promise<string[]> {
    try {
        const accountDynFields = await getAllDynamicFields(client, accountId);

        const vaultField = accountDynFields.find((df: any) => {
            const nameType = (df.name as any)?.type || "";
            if (nameType.includes("VaultNamesKey")) return false;
            if (!nameType.includes("VaultKey") && !nameType.includes("vault::VaultKey")) return false;
            const value = (df.name as any)?.value;
            const name = typeof value === "string" ? value : (value?.pos0 ?? value?.name ?? "");
            return name === vaultName;
        });

        if (!vaultField) return [];

        const vaultObj = await client.getDynamicFieldObject({
            parentId: accountId,
            name: vaultField.name as any,
        });

        const fields = (vaultObj.data?.content as any)?.fields?.value?.fields;
        if (!fields) return [];

        // approved_types is a VecSet<TypeName>
        const approvedRaw = fields.approved_types || fields.approved_coin_types;
        const contents = approvedRaw?.fields?.contents || approvedRaw?.contents || approvedRaw;
        if (!Array.isArray(contents)) return [];

        return contents
            .map((item: any) => {
                const name = parseTypeName(item);
                return name ? normalizeCoinType(name) : "";
            })
            .filter((t: string) => t.length > 0);
    } catch (error) {
        console.error(`[fetchVaultApprovedCoinTypes] Error for ${accountId}/${vaultName}:`, error);
        return [];
    }
}

function parseOptionU64(value: any): number | null {
    if (value == null) return null;
    // Move Option serialized as { fields: { vec: [value] } } or { vec: [value] }
    const vec = value?.fields?.vec ?? value?.vec;
    if (Array.isArray(vec) && vec.length > 0) return Number(vec[0]);
    // Some RPC formats: just the number or null
    if (typeof value === "number") return value;
    if (typeof value === "string" && value.length > 0) return Number(value);
    return null;
}

// --- Package & Cap Discovery ---

/**
 * Fetch package names that have a locked UpgradeCap on the Account.
 * Scans dynamic fields for UpgradeCapKey entries.
 */
export async function fetchAccountPackageNames(client: SuiClient, accountId: string): Promise<string[]> {
    try {
        const dynFields = await getAllDynamicFields(client, accountId);
        const names = dynFields
            .filter((df: any) => {
                const nameType = (df.name as any)?.type || "";
                return nameType.includes("UpgradeCapKey");
            })
            .map((df: any) => {
                const value = (df.name as any)?.value;
                if (typeof value === "string") return value;
                if (typeof value?.pos0 === "string") return value.pos0;
                if (typeof value?.name === "string") return value.name;
                return "";
            })
            .filter((name): name is string => name.length > 0);

        return Array.from(new Set(names)).sort((a, b) => a.localeCompare(b));
    } catch (error) {
        console.error(`[fetchAccountPackageNames] Error for ${accountId}:`, error);
        return [];
    }
}

export interface LockedPackageInfo {
    name: string;
    packageAddress: string;
    capObjectId: string;
    delayMs: number;
    policy: number;
}

const POLICY_LABELS: Record<number, string> = {
    0: "Compatible",
    128: "Additive",
    192: "Dep-only",
    255: "Immutable",
};

export function policyLabel(policy: number): string {
    return POLICY_LABELS[policy] ?? `Unknown (${policy})`;
}

/**
 * Fetch full info for locked UpgradeCaps: name, package address, delay, policy.
 * Reads UpgradeCapKey (dynamic object field) and UpgradeRulesKey (dynamic field).
 */
export async function fetchAccountPackageInfo(client: SuiClient, accountId: string): Promise<LockedPackageInfo[]> {
    try {
        const dynFields = await getAllDynamicFields(client, accountId);
        const capFields = dynFields.filter((df: any) => {
            const nameType = (df.name as any)?.type || "";
            return nameType.includes("UpgradeCapKey");
        });

        const results: LockedPackageInfo[] = [];

        for (const capField of capFields) {
            const value = (capField.name as any)?.value;
            const name = typeof value === "string" ? value : (value?.pos0 ?? value?.name ?? "");
            if (!name) continue;

            // Read the UpgradeCap dynamic object field for policy + package address
            let packageAddress = "";
            let capObjectId = "";
            let policy = 0;
            try {
                const capObj = await client.getDynamicFieldObject({
                    parentId: accountId,
                    name: capField.name as any,
                });
                const fields = (capObj.data?.content as any)?.fields?.value?.fields;
                if (fields) {
                    packageAddress = fields.package ?? "";
                    capObjectId = fields.id?.id ?? fields.id ?? "";
                    policy = Number(fields.policy ?? 0);
                }
            } catch {
                /* cap may have been removed (immutable) */
            }

            // Read the UpgradeRules dynamic field for delay_ms
            let delayMs = 0;
            const rulesField = dynFields.find((df: any) => {
                const nameType = (df.name as any)?.type || "";
                if (!nameType.includes("UpgradeRulesKey")) return false;
                const v = (df.name as any)?.value;
                const n = typeof v === "string" ? v : (v?.pos0 ?? v?.name ?? "");
                return n === name;
            });
            if (rulesField) {
                try {
                    const rulesObj = await client.getDynamicFieldObject({
                        parentId: accountId,
                        name: rulesField.name as any,
                    });
                    const fields = (rulesObj.data?.content as any)?.fields?.value?.fields;
                    if (fields) {
                        delayMs = Number(fields.delay_ms ?? 0);
                    }
                } catch {
                    /* rules may not exist */
                }
            }

            results.push({ name, packageAddress, capObjectId, delayMs, policy });
        }

        return results.sort((a, b) => a.name.localeCompare(b.name));
    } catch (error) {
        console.error(`[fetchAccountPackageInfo] Error for ${accountId}:`, error);
        return [];
    }
}

export interface LockedCurrency {
    coinType: string;
    hasTreasuryCap: boolean;
    hasMetadataCap: boolean;
}

/**
 * Fetch coin types that have locked TreasuryCap or MetadataCap on the Account.
 * Scans dynamic fields for TreasuryCapKey<T> and MetadataCapKey<T> entries.
 */
export async function fetchAccountLockedCurrencies(client: SuiClient, accountId: string): Promise<LockedCurrency[]> {
    try {
        const dynFields = await getAllDynamicFields(client, accountId);
        const currencies = new Map<string, { treasury: boolean; metadata: boolean }>();

        for (const df of dynFields) {
            const nameType = (df.name as any)?.type || "";

            if (nameType.includes("TreasuryCapKey")) {
                const coinType = extractTypeParam(nameType);
                if (coinType) {
                    const existing = currencies.get(coinType) || { treasury: false, metadata: false };
                    existing.treasury = true;
                    currencies.set(coinType, existing);
                }
            } else if (nameType.includes("MetadataCapKey")) {
                const coinType = extractTypeParam(nameType);
                if (coinType) {
                    const existing = currencies.get(coinType) || { treasury: false, metadata: false };
                    existing.metadata = true;
                    currencies.set(coinType, existing);
                }
            }
        }

        return Array.from(currencies.entries()).map(([coinType, caps]) => ({
            coinType: normalizeCoinType(coinType),
            hasTreasuryCap: caps.treasury,
            hasMetadataCap: caps.metadata,
        }));
    } catch (error) {
        console.error(`[fetchAccountLockedCurrencies] Error for ${accountId}:`, error);
        return [];
    }
}

/** Extract the first type parameter from a Move type string, e.g. "0x...::currency::TreasuryCapKey<0x...::coin::COIN>" → "0x...::coin::COIN" */
function extractTypeParam(typeStr: string): string | null {
    const start = typeStr.indexOf("<");
    const end = typeStr.lastIndexOf(">");
    if (start === -1 || end === -1 || end <= start) return null;
    return typeStr.slice(start + 1, end).trim();
}

// --- Owned Object Discovery ---

export interface OwnedObjectInfo {
    objectId: string;
    objectType: string;
    digest: string;
}

/**
 * Fetch all objects owned by an Account (excluding gas coins and system objects).
 * Returns objectId, full type string, and digest.
 */
export async function fetchAccountOwnedObjects(client: SuiClient, accountId: string): Promise<OwnedObjectInfo[]> {
    try {
        const all: OwnedObjectInfo[] = [];
        let cursor: string | null | undefined = null;

        while (true) {
            const page = await client.getOwnedObjects({
                owner: accountId,
                options: { showType: true },
                ...(cursor ? { cursor } : {}),
            });

            for (const item of page.data) {
                const data = item.data;
                if (!data?.type) continue;
                all.push({
                    objectId: data.objectId,
                    objectType: data.type,
                    digest: data.digest,
                });
            }

            if (!page.hasNextPage || !page.nextCursor) break;
            cursor = page.nextCursor;
        }

        return all;
    } catch (error) {
        console.error(`[fetchAccountOwnedObjects] Error for ${accountId}:`, error);
        return [];
    }
}
