import { isValidSuiAddress } from "@mysten/sui/utils";
import { MAX_MULTISIG_MEMBERS, parseU64Input, type SimpleMultisigConfigInput } from "./multisigConfigValidation";

export const ADVANCED_MAX_GROUPS = 20;
export const ADVANCED_MAX_PATHS = 20;
export const ADVANCED_MAX_TIME_BANDS = 10;

const MAX_U64 = (1n << 64n) - 1n;
const MS_PER_DAY = 24n * 60n * 60n * 1000n;

export interface AdvancedMemberDraft {
    id: string;
    address: string;
    weight: string;
}

export interface AdvancedTimeBandDraft {
    id: string;
    afterDays: string;
    weight: string;
}

export interface AdvancedGroupDraft {
    id: string;
    name: string;
    members: AdvancedMemberDraft[];
    timeBands: AdvancedTimeBandDraft[];
}

export interface AdvancedRequirementDraft {
    id: string;
    groupId: string;
    threshold: string;
}

export interface AdvancedPolicyPathDraft {
    id: string;
    requirements: AdvancedRequirementDraft[];
}

export interface AdvancedMultisigDraft {
    intentExpiryDays: string;
    groups: AdvancedGroupDraft[];
    approvePaths: AdvancedPolicyPathDraft[];
    cancelPaths: AdvancedPolicyPathDraft[];
    proposeAddresses: string[];
    executeAddresses: string[];
    cancelAddresses: string[];
}

export interface AdvancedMultisigValidation {
    configInput: SimpleMultisigConfigInput | null;
    error: string | null;
}

interface ParsedGroup {
    input: SimpleMultisigConfigInput["groups"][number];
    memberWeight: bigint;
    approvalWeight: bigint;
}

let draftId = 0;

export function createDraftId(prefix: string): string {
    draftId += 1;
    return `${prefix}-${draftId}`;
}

/// Set of unique, valid, normalized Sui addresses across all user groups —
/// matches the eligibility set parseAdvancedMultisigDraft builds for role
/// addresses (valid address AND positive weight; mirrors parseGroups filtering).
function availableGroupMemberAddresses(draft: AdvancedMultisigDraft): Set<string> {
    return new Set(
        draft.groups.flatMap((group) =>
            group.members
                .filter((member) => {
                    const weight = parseU64Input(member.weight);
                    return weight !== null && weight > 0n;
                })
                .map((member) => member.address.trim().toLowerCase())
                .filter((address) => isValidSuiAddress(address))
        )
    );
}

/// Count of role addresses that would actually project to onchain entries:
/// unique, valid Sui addresses that exist in some user group.
function projectedRoleAddressCount(addresses: string[] | undefined, available: Set<string>): number {
    if (!addresses || addresses.length === 0) return 0;
    const unique = new Set<string>();
    for (const raw of addresses) {
        const normalized = raw.trim().toLowerCase();
        if (!normalized) continue;
        if (!isValidSuiAddress(normalized)) continue;
        if (!available.has(normalized)) continue;
        unique.add(normalized);
    }
    return unique.size;
}

/// Number of role groups that will be appended onchain (one per role list with ≥1 valid entry).
export function effectiveRoleGroupCount(draft: AdvancedMultisigDraft): number {
    const available = availableGroupMemberAddresses(draft);
    return (
        (projectedRoleAddressCount(draft.proposeAddresses, available) > 0 ? 1 : 0) +
        (projectedRoleAddressCount(draft.executeAddresses, available) > 0 ? 1 : 0) +
        (projectedRoleAddressCount(draft.cancelAddresses, available) > 0 ? 1 : 0)
    );
}

/// Total group count that will be sent onchain (user groups + projected role groups).
export function effectiveGroupCount(draft: AdvancedMultisigDraft): number {
    return draft.groups.length + effectiveRoleGroupCount(draft);
}

/// Total member entries that will be sent onchain (sum of user-group members + projected role-group entries).
/// Matches the onchain MAX_MEMBERS check, which counts entries not unique addresses.
export function effectiveMemberCount(draft: AdvancedMultisigDraft): number {
    const userMembers = draft.groups.reduce((sum, group) => sum + group.members.length, 0);
    const available = availableGroupMemberAddresses(draft);
    const roleMembers =
        projectedRoleAddressCount(draft.proposeAddresses, available) +
        projectedRoleAddressCount(draft.executeAddresses, available) +
        projectedRoleAddressCount(draft.cancelAddresses, available);
    return userMembers + roleMembers;
}

/// Total role member entries (projected). Exposed so the OverviewStrip can show
/// "incl. N role" sublabels that match the onchain projection.
export function effectiveRoleMemberCount(draft: AdvancedMultisigDraft): number {
    const available = availableGroupMemberAddresses(draft);
    return (
        projectedRoleAddressCount(draft.proposeAddresses, available) +
        projectedRoleAddressCount(draft.executeAddresses, available) +
        projectedRoleAddressCount(draft.cancelAddresses, available)
    );
}

/// Highest time-band weight in the group (the approval ceiling adds this to base member weight).
export function groupMaxTimeBandWeight(group: AdvancedGroupDraft): bigint {
    return group.timeBands.reduce((max, band) => {
        const weight = parseU64Input(band.weight);
        return weight !== null && weight > max ? weight : max;
    }, 0n);
}

/// Sum of all valid (positive) member weights in the group.
export function groupBaseMemberWeight(group: AdvancedGroupDraft): bigint {
    return group.members.reduce((total, member) => {
        const weight = parseU64Input(member.weight);
        return weight !== null && weight > 0n ? total + weight : total;
    }, 0n);
}

/// Swap path at `pathIndex` with its neighbor in `direction` (-1 up, +1 down).
/// Returns the same array reference if the move would go out of bounds.
export function movePath(
    paths: AdvancedPolicyPathDraft[],
    pathIndex: number,
    direction: -1 | 1
): AdvancedPolicyPathDraft[] {
    const target = pathIndex + direction;
    if (target < 0 || target >= paths.length) return paths;
    const next = [...paths];
    const tmp = next[pathIndex];
    next[pathIndex] = next[target];
    next[target] = tmp;
    return next;
}

export function createDefaultAdvancedDraft(creatorAddress = ""): AdvancedMultisigDraft {
    const groupId = createDraftId("group");
    const defaultRoleAddresses = creatorAddress.trim() ? [creatorAddress.trim().toLowerCase()] : [];

    return {
        intentExpiryDays: "365",
        groups: [
            {
                id: groupId,
                name: "Group 1",
                members: [{ id: createDraftId("member"), address: creatorAddress, weight: "1" }],
                timeBands: [],
            },
        ],
        approvePaths: [
            {
                id: createDraftId("approve-path"),
                requirements: [{ id: createDraftId("approve-req"), groupId, threshold: "1" }],
            },
        ],
        cancelPaths: [
            {
                id: createDraftId("cancel-path"),
                requirements: [{ id: createDraftId("cancel-req"), groupId, threshold: "1" }],
            },
        ],
        proposeAddresses: defaultRoleAddresses,
        executeAddresses: defaultRoleAddresses,
        cancelAddresses: defaultRoleAddresses,
    };
}

function normalizeAddress(value: string): string {
    return value.trim().toLowerCase();
}

function parsePositiveU64(value: string): bigint | null {
    const parsed = parseU64Input(value);
    return parsed !== null && parsed > 0n ? parsed : null;
}

function multiplyU64(value: bigint, multiplier: bigint): bigint | null {
    const result = value * multiplier;
    return result <= MAX_U64 ? result : null;
}

function parseTimeBands(
    group: AdvancedGroupDraft,
    intentExpiryMs: bigint,
    errors: string[]
): Array<{ afterMs: bigint; weight: bigint }> {
    if (group.timeBands.length > ADVANCED_MAX_TIME_BANDS) {
        errors.push(`Group ${group.name || "Untitled"} has more than ${ADVANCED_MAX_TIME_BANDS} time bands.`);
    }

    const parsed = group.timeBands
        .map((band, index) => {
            const afterDays = parsePositiveU64(band.afterDays);
            const weight = parsePositiveU64(band.weight);

            if (afterDays === null) {
                errors.push(`Time band ${index + 1} in ${group.name || "Untitled"} needs a positive delay.`);
                return null;
            }
            if (weight === null) {
                errors.push(`Time band ${index + 1} in ${group.name || "Untitled"} needs a positive weight.`);
                return null;
            }

            const afterMs = multiplyU64(afterDays, MS_PER_DAY);
            if (afterMs === null || afterMs >= intentExpiryMs) {
                errors.push(`Time band ${index + 1} in ${group.name || "Untitled"} must be before expiry.`);
                return null;
            }

            return { afterMs, weight };
        })
        .filter((band): band is { afterMs: bigint; weight: bigint } => band !== null)
        .sort((a, b) => (a.afterMs < b.afterMs ? -1 : a.afterMs > b.afterMs ? 1 : 0));

    for (let i = 1; i < parsed.length; i += 1) {
        const previous = parsed[i - 1];
        const current = parsed[i];
        if (current.afterMs === previous.afterMs) {
            errors.push(`Time bands in ${group.name || "Untitled"} need unique delays.`);
        }
        if (current.weight < previous.weight) {
            errors.push(`Time band weights in ${group.name || "Untitled"} must not decrease.`);
        }
    }

    return parsed;
}

function parseGroups(draft: AdvancedMultisigDraft, intentExpiryMs: bigint, errors: string[]): ParsedGroup[] {
    const parsedGroups: ParsedGroup[] = [];
    const seenNames = new Set<string>();
    let totalMembers = 0;

    if (draft.groups.length === 0 || draft.groups.length > ADVANCED_MAX_GROUPS) {
        errors.push(`Use 1 to ${ADVANCED_MAX_GROUPS} groups.`);
    }

    for (const group of draft.groups) {
        const name = group.name.trim();
        const normalizedName = name.toLowerCase();
        const seenAddresses = new Set<string>();
        const members: Array<{ address: string; weight: bigint }> = [];

        if (!name) errors.push("Every group needs a name.");
        if (seenNames.has(normalizedName)) errors.push(`Group name "${name}" is already used.`);
        seenNames.add(normalizedName);

        if (group.members.length === 0) errors.push(`Group ${name || "Untitled"} needs at least one signer.`);
        totalMembers += group.members.length;

        for (const member of group.members) {
            const address = normalizeAddress(member.address);
            const weight = parsePositiveU64(member.weight);

            if (!isValidSuiAddress(address)) {
                errors.push(`Group ${name || "Untitled"} has an invalid signer address.`);
                continue;
            }
            if (seenAddresses.has(address)) {
                errors.push(`Group ${name || "Untitled"} has a duplicate signer address.`);
                continue;
            }
            if (weight === null) {
                errors.push(`Group ${name || "Untitled"} has a signer with invalid weight.`);
                continue;
            }

            seenAddresses.add(address);
            members.push({ address, weight });
        }

        const timeBands = parseTimeBands(group, intentExpiryMs, errors);
        const memberWeight = members.reduce((total, member) => total + member.weight, 0n);
        const approvalWeight = memberWeight + (timeBands[timeBands.length - 1]?.weight ?? 0n);

        parsedGroups.push({
            input: { name, members, timeBands },
            memberWeight,
            approvalWeight,
        });
    }

    if (totalMembers > MAX_MULTISIG_MEMBERS) {
        errors.push(`A multisig can have at most ${MAX_MULTISIG_MEMBERS} group signer entries.`);
    }

    return parsedGroups;
}

function parseRoleAddresses(
    addresses: string[],
    availableAddresses: Set<string>,
    label: string,
    allowEmpty: boolean,
    errors: string[]
): string[] {
    const uniqueAddresses = [...new Set(addresses.map(normalizeAddress).filter(Boolean))];

    if (!allowEmpty && uniqueAddresses.length === 0) errors.push(`${label} needs at least one signer.`);
    if (uniqueAddresses.length > MAX_MULTISIG_MEMBERS) errors.push(`${label} has too many signers.`);

    return uniqueAddresses.flatMap((address) => {
        if (!isValidSuiAddress(address)) {
            errors.push(`${label} has an invalid signer address.`);
            return [];
        }
        if (!availableAddresses.has(address)) {
            errors.push(`${label} references a signer that is no longer in a group.`);
            return [];
        }
        return [address];
    });
}

function uniqueRoleGroupName(baseName: string, usedNames: Set<string>): string {
    let name = baseName;
    let suffix = 2;

    while (usedNames.has(name.toLowerCase())) {
        name = `${baseName} ${suffix}`;
        suffix += 1;
    }

    usedNames.add(name.toLowerCase());
    return name;
}

function appendRoleAddressGroup(
    groups: ParsedGroup[],
    usedNames: Set<string>,
    name: string,
    addresses: string[]
): number[] {
    if (addresses.length === 0) return [];

    const groupIndex = groups.length;
    const members = addresses.map((address) => ({ address, weight: 1n }));
    const memberWeight = BigInt(members.length);

    groups.push({
        input: {
            name: uniqueRoleGroupName(name, usedNames),
            members,
            timeBands: [],
        },
        memberWeight,
        approvalWeight: memberWeight,
    });

    return [groupIndex];
}

function parsePolicy(
    paths: AdvancedPolicyPathDraft[],
    groups: ParsedGroup[],
    groupIdToIndex: Map<string, number>,
    label: string,
    includeTimeBands: boolean,
    errors: string[]
): SimpleMultisigConfigInput["approvePolicy"] {
    if (paths.length === 0 || paths.length > ADVANCED_MAX_PATHS) {
        errors.push(`${label} needs 1 to ${ADVANCED_MAX_PATHS} paths.`);
    }

    return {
        paths: paths.map((path, pathIndex) => {
            const seenGroups = new Set<number>();

            if (path.requirements.length === 0 || path.requirements.length > ADVANCED_MAX_GROUPS) {
                errors.push(`${label} path ${pathIndex + 1} needs 1 to ${ADVANCED_MAX_GROUPS} requirements.`);
            }

            return {
                requirements: path.requirements.flatMap((requirement) => {
                    const groupIndex = groupIdToIndex.get(requirement.groupId);
                    const threshold = parsePositiveU64(requirement.threshold);

                    if (groupIndex === undefined) {
                        errors.push(`${label} path ${pathIndex + 1} references a removed group.`);
                        return [];
                    }
                    if (seenGroups.has(groupIndex)) {
                        errors.push(`${label} path ${pathIndex + 1} uses the same group twice.`);
                        return [];
                    }
                    if (threshold === null) {
                        errors.push(`${label} path ${pathIndex + 1} has an invalid threshold.`);
                        return [];
                    }

                    seenGroups.add(groupIndex);
                    const maxWeight = includeTimeBands
                        ? groups[groupIndex].approvalWeight
                        : groups[groupIndex].memberWeight;
                    if (threshold > maxWeight) {
                        errors.push(`${label} path ${pathIndex + 1} threshold exceeds available weight.`);
                    }
                    // Mirrors onchain rule (multisig.move:472-475): a time band can top up
                    // real votes but cannot satisfy a requirement on its own. If the group
                    // has no member weight, the path is unsatisfiable regardless of bands.
                    if (includeTimeBands && groups[groupIndex].memberWeight === 0n) {
                        const groupName = groups[groupIndex].input.name || "Untitled";
                        errors.push(
                            `${label} path ${pathIndex + 1} requires "${groupName}" to have signers (time bands cannot satisfy alone).`
                        );
                    }

                    return [{ groupIndex, threshold }];
                }),
            };
        }),
    };
}

export function parseAdvancedMultisigDraft(draft: AdvancedMultisigDraft): AdvancedMultisigValidation {
    const errors: string[] = [];
    const expiryDays = parsePositiveU64(draft.intentExpiryDays);
    const intentExpiryMs = expiryDays === null ? null : multiplyU64(expiryDays, MS_PER_DAY);

    if (intentExpiryMs === null) errors.push("Intent expiry must be a positive number of days.");

    const parsedGroups = parseGroups(draft, intentExpiryMs ?? 1n, errors);
    const groupIdToIndex = new Map(draft.groups.map((group, index) => [group.id, index]));
    const availableAddresses = new Set(
        parsedGroups.flatMap((group) => group.input.members.map((member) => member.address))
    );
    const approvePolicy = parsePolicy(
        draft.approvePaths,
        parsedGroups,
        groupIdToIndex,
        "Approval policy",
        true,
        errors
    );
    const cancelPolicy = parsePolicy(
        draft.cancelPaths,
        parsedGroups,
        groupIdToIndex,
        "Rejection policy",
        false,
        errors
    );
    const proposeAddresses = parseRoleAddresses(
        draft.proposeAddresses ?? [],
        availableAddresses,
        "Propose access",
        false,
        errors
    );
    const executeAddresses = parseRoleAddresses(
        draft.executeAddresses ?? [],
        availableAddresses,
        "Execute access",
        true,
        errors
    );
    const cancelAddresses = parseRoleAddresses(
        draft.cancelAddresses ?? [],
        availableAddresses,
        "Cancel access",
        false,
        errors
    );

    const configGroups = [...parsedGroups];
    const usedNames = new Set(configGroups.map((group) => group.input.name.toLowerCase()));
    const proposeGroups = appendRoleAddressGroup(configGroups, usedNames, "Propose role", proposeAddresses);
    const executeGroups = appendRoleAddressGroup(configGroups, usedNames, "Execute role", executeAddresses);
    const cancelGroups = appendRoleAddressGroup(configGroups, usedNames, "Cancel role", cancelAddresses);
    const totalGroupEntries = configGroups.length;
    const totalMemberEntries = configGroups.reduce((total, group) => total + group.input.members.length, 0);

    if (totalGroupEntries > ADVANCED_MAX_GROUPS) {
        errors.push(
            `Advanced config uses ${totalGroupEntries} groups including role groups. Max is ${ADVANCED_MAX_GROUPS}.`
        );
    }
    if (totalMemberEntries > MAX_MULTISIG_MEMBERS) {
        errors.push(`A multisig can have at most ${MAX_MULTISIG_MEMBERS} group signer entries including role groups.`);
    }

    if (errors.length > 0 || intentExpiryMs === null) {
        return { configInput: null, error: errors[0] ?? "Invalid advanced multisig config." };
    }

    return {
        configInput: {
            groups: configGroups.map((group) => group.input),
            approvePolicy,
            cancelPolicy,
            proposeGroups,
            executeGroups,
            cancelGroups,
            intentExpiryMs,
        },
        error: null,
    };
}
