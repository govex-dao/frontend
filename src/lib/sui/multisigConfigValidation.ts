import { isValidSuiAddress } from "@mysten/sui/utils";

export const MAX_MULTISIG_MEMBERS = 200;
const MAX_U64 = (1n << 64n) - 1n;
export const PERMISSION_PROPOSE = 1;
export const PERMISSION_VOTE = 2;
export const PERMISSION_EXECUTE = 4;
export const PERMISSION_CANCEL = 8;

export interface MultisigConfigDraftMember {
    address: string;
    weight: string;
    permissions: number;
}

export interface ParsedMultisigConfigMember {
    address: string;
    weight: bigint;
    permissions: number;
}

export interface ParsedMultisigConfigDraft {
    members: ParsedMultisigConfigMember[];
    globalThreshold: bigint;
}

export interface SimpleMultisigConfigInput {
    groups: Array<{
        name: string;
        members: Array<{ address: string; weight: bigint }>;
        timeBands?: Array<{ afterMs: bigint; weight: bigint }>;
    }>;
    approvePolicy: {
        paths: Array<{ requirements: Array<{ groupIndex: number; threshold: bigint }> }>;
    };
    cancelPolicy: {
        paths: Array<{ requirements: Array<{ groupIndex: number; threshold: bigint }> }>;
    };
    proposeGroups: number[];
    executeGroups: number[];
    cancelGroups: number[];
    intentExpiryMs: bigint;
}

export interface FlattenedMultisigConfigInput {
    groupNames: string[];
    groupMemberCounts: bigint[];
    allMemberAddresses: string[];
    allMemberWeights: bigint[];
    timeBandCounts: bigint[];
    allTimeBandAfters: bigint[];
    allTimeBandWeights: bigint[];
    approvePathReqCounts: bigint[];
    allApproveGroupIndices: bigint[];
    allApproveThresholds: bigint[];
    cancelPathReqCounts: bigint[];
    allCancelGroupIndices: bigint[];
    allCancelThresholds: bigint[];
    proposeGroups: bigint[];
    executeGroups: bigint[];
    cancelGroups: bigint[];
    intentExpiryMs: bigint;
}

export function parseU64Input(value: string): bigint | null {
    const trimmed = value.trim();
    if (!/^\d+$/.test(trimmed)) return null;

    const parsed = BigInt(trimmed);
    if (parsed > MAX_U64) return null;
    return parsed;
}

export function validateAndParseMultisigConfigDraft(
    members: MultisigConfigDraftMember[],
    globalThreshold: string
): ParsedMultisigConfigDraft | null {
    if (members.length === 0 || members.length > MAX_MULTISIG_MEMBERS) return null;

    const parsedThreshold = parseU64Input(globalThreshold);
    if (parsedThreshold === null || parsedThreshold <= 0n) return null;

    const seen = new Set<string>();
    const parsedMembers: ParsedMultisigConfigMember[] = [];
    let totalVoterWeight = 0n;
    let hasProposer = false;
    let hasVoter = false;
    let hasExecutor = false;
    let hasCanceller = false;

    for (const member of members) {
        const address = member.address.trim().toLowerCase();
        const permissions = member.permissions;
        const weight = parseU64Input(member.weight);

        if (!isValidSuiAddress(address) || weight === null || weight <= 0n) return null;
        if (permissions <= 0 || permissions > 15) return null;
        if (seen.has(address)) return null;

        seen.add(address);

        if ((permissions & PERMISSION_PROPOSE) === PERMISSION_PROPOSE) hasProposer = true;
        if ((permissions & PERMISSION_EXECUTE) === PERMISSION_EXECUTE) hasExecutor = true;
        if ((permissions & PERMISSION_CANCEL) === PERMISSION_CANCEL) hasCanceller = true;
        if ((permissions & PERMISSION_VOTE) === PERMISSION_VOTE) {
            hasVoter = true;
            totalVoterWeight += weight;
        }

        parsedMembers.push({ address, weight, permissions });
    }

    if (!hasProposer || !hasVoter || !hasExecutor || !hasCanceller) return null;
    if (totalVoterWeight < parsedThreshold) return null;

    return {
        members: parsedMembers,
        globalThreshold: parsedThreshold,
    };
}

function sameGroupMembers(
    a: Array<{ address: string; weight: bigint }>,
    b: Array<{ address: string; weight: bigint }>
): boolean {
    return (
        a.length === b.length &&
        a.every((member, index) => {
            const other = b[index];
            return other !== undefined && member.address === other.address && member.weight === other.weight;
        })
    );
}

export function buildSimpleMultisigConfigInput(
    draft: ParsedMultisigConfigDraft,
    intentExpiryMs: bigint | number
): SimpleMultisigConfigInput {
    const threshold = draft.globalThreshold;
    const expiry = BigInt(intentExpiryMs);
    const groups: SimpleMultisigConfigInput["groups"] = [];
    const membersForPermission = (permission: number) =>
        draft.members
            .filter((member) => (member.permissions & permission) === permission)
            .map((member) => ({ address: member.address, weight: member.weight }));
    const addGroup = (name: string, members: Array<{ address: string; weight: bigint }>): number => {
        const existingIndex = groups.findIndex((group) => sameGroupMembers(group.members, members));
        if (existingIndex >= 0) return existingIndex;
        groups.push({ name, members, timeBands: [] });
        return groups.length - 1;
    };
    const voteGroup = addGroup("Group 1", membersForPermission(PERMISSION_VOTE));
    const proposeGroup = addGroup("proposers", membersForPermission(PERMISSION_PROPOSE));
    const executeGroup = addGroup("executors", membersForPermission(PERMISSION_EXECUTE));
    const cancelGroup = addGroup("cancellers", membersForPermission(PERMISSION_CANCEL));

    return {
        groups,
        approvePolicy: {
            paths: [{ requirements: [{ groupIndex: voteGroup, threshold }] }],
        },
        cancelPolicy: {
            paths: [{ requirements: [{ groupIndex: voteGroup, threshold }] }],
        },
        proposeGroups: [proposeGroup],
        executeGroups: [executeGroup],
        cancelGroups: [cancelGroup],
        intentExpiryMs: expiry,
    };
}

function flattenPolicy(policy: SimpleMultisigConfigInput["approvePolicy"]): {
    pathReqCounts: bigint[];
    allGroupIndices: bigint[];
    allThresholds: bigint[];
} {
    const pathReqCounts: bigint[] = [];
    const allGroupIndices: bigint[] = [];
    const allThresholds: bigint[] = [];

    for (const path of policy.paths) {
        pathReqCounts.push(BigInt(path.requirements.length));
        for (const requirement of path.requirements) {
            allGroupIndices.push(BigInt(requirement.groupIndex));
            allThresholds.push(requirement.threshold);
        }
    }

    return { pathReqCounts, allGroupIndices, allThresholds };
}

export function flattenMultisigConfigInput(input: SimpleMultisigConfigInput): FlattenedMultisigConfigInput {
    const groupNames: string[] = [];
    const groupMemberCounts: bigint[] = [];
    const allMemberAddresses: string[] = [];
    const allMemberWeights: bigint[] = [];
    const timeBandCounts: bigint[] = [];
    const allTimeBandAfters: bigint[] = [];
    const allTimeBandWeights: bigint[] = [];

    for (const group of input.groups) {
        groupNames.push(group.name);
        groupMemberCounts.push(BigInt(group.members.length));
        for (const member of group.members) {
            allMemberAddresses.push(member.address);
            allMemberWeights.push(member.weight);
        }

        const timeBands = group.timeBands ?? [];
        timeBandCounts.push(BigInt(timeBands.length));
        for (const timeBand of timeBands) {
            allTimeBandAfters.push(timeBand.afterMs);
            allTimeBandWeights.push(timeBand.weight);
        }
    }

    const approvePolicy = flattenPolicy(input.approvePolicy);
    const cancelPolicy = flattenPolicy(input.cancelPolicy);

    return {
        groupNames,
        groupMemberCounts,
        allMemberAddresses,
        allMemberWeights,
        timeBandCounts,
        allTimeBandAfters,
        allTimeBandWeights,
        approvePathReqCounts: approvePolicy.pathReqCounts,
        allApproveGroupIndices: approvePolicy.allGroupIndices,
        allApproveThresholds: approvePolicy.allThresholds,
        cancelPathReqCounts: cancelPolicy.pathReqCounts,
        allCancelGroupIndices: cancelPolicy.allGroupIndices,
        allCancelThresholds: cancelPolicy.allThresholds,
        proposeGroups: input.proposeGroups.map(BigInt),
        executeGroups: input.executeGroups.map(BigInt),
        cancelGroups: input.cancelGroups.map(BigInt),
        intentExpiryMs: input.intentExpiryMs,
    };
}
