import { isValidSuiAddress } from "@mysten/sui/utils";
import { Copy, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Input } from "@/components/inputs/Input";
import {
    ADVANCED_MAX_GROUPS,
    ADVANCED_MAX_TIME_BANDS,
    createDraftId,
    effectiveGroupCount,
    effectiveMemberCount,
    groupBaseMemberWeight,
    groupMaxTimeBandWeight,
    type AdvancedGroupDraft,
    type AdvancedMemberDraft,
    type AdvancedMultisigDraft,
    type AdvancedPolicyPathDraft,
    type AdvancedRequirementDraft,
    type AdvancedTimeBandDraft,
} from "@/lib/sui/advancedMultisigConfig";
import { MAX_MULTISIG_MEMBERS, parseU64Input } from "@/lib/sui/multisigConfigValidation";
import { AdvancedMultisigOverview } from "./AdvancedMultisigOverview";
import { AdvancedMultisigPolicyEditor } from "./AdvancedMultisigPolicyEditor";
import { AdvancedMultisigRoles } from "./AdvancedMultisigRoles";

interface Props {
    draft: AdvancedMultisigDraft;
    onChange: (draft: AdvancedMultisigDraft) => void;
    error: string | null;
}

interface SectionProps {
    title: string;
    caption?: string;
    action?: React.ReactNode;
    children: React.ReactNode;
}

function normalizeAddress(value: string): string {
    return value.trim().toLowerCase();
}

function createMember(address = ""): AdvancedMemberDraft {
    return { id: createDraftId("member"), address, weight: "1" };
}

function createTimeBand(): AdvancedTimeBandDraft {
    return { id: createDraftId("time-band"), afterDays: "1", weight: "1" };
}

function nextGroupIndex(groups: AdvancedGroupDraft[]): number {
    const usedNames = new Set(groups.map((group) => group.name.trim().toLowerCase()));
    let index = groups.length + 1;
    while (usedNames.has(`group ${index}`)) index += 1;
    return index;
}

function createGroup(index: number): AdvancedGroupDraft {
    return {
        id: createDraftId("group"),
        name: `Group ${index}`,
        members: [createMember()],
        timeBands: [],
    };
}

function createRequirement(groupId: string): AdvancedRequirementDraft {
    return { id: createDraftId("requirement"), groupId, threshold: "1" };
}

function createPath(prefix: string, groupId: string): AdvancedPolicyPathDraft {
    return {
        id: createDraftId(prefix),
        requirements: groupId ? [createRequirement(groupId)] : [],
    };
}

function updateGroup(
    draft: AdvancedMultisigDraft,
    groupId: string,
    updater: (group: AdvancedGroupDraft) => AdvancedGroupDraft
): AdvancedMultisigDraft {
    return { ...draft, groups: draft.groups.map((group) => (group.id === groupId ? updater(group) : group)) };
}

function cleanPathsAfterGroupRemoval(
    paths: AdvancedPolicyPathDraft[],
    groupId: string,
    fallbackGroupId: string,
    prefix: string
): AdvancedPolicyPathDraft[] {
    const nextPaths = paths
        .map((path) => ({
            ...path,
            requirements: path.requirements.filter((requirement) => requirement.groupId !== groupId),
        }))
        .filter((path) => path.requirements.length > 0);

    return nextPaths.length > 0 || !fallbackGroupId ? nextPaths : [createPath(prefix, fallbackGroupId)];
}

function removeGroup(draft: AdvancedMultisigDraft, groupId: string): AdvancedMultisigDraft {
    const groups = draft.groups.filter((group) => group.id !== groupId);
    const fallbackGroupId = groups[0]?.id ?? "";
    const availableAddresses = new Set(
        groups.flatMap((group) => group.members.map((member) => normalizeAddress(member.address)))
    );
    const cleanRoleAddresses = (addresses: string[]) =>
        addresses.map(normalizeAddress).filter((address) => availableAddresses.has(address));

    return {
        ...draft,
        groups,
        approvePaths: cleanPathsAfterGroupRemoval(draft.approvePaths, groupId, fallbackGroupId, "approve-path"),
        cancelPaths: cleanPathsAfterGroupRemoval(draft.cancelPaths, groupId, fallbackGroupId, "cancel-path"),
        proposeAddresses: cleanRoleAddresses(draft.proposeAddresses ?? []),
        executeAddresses: cleanRoleAddresses(draft.executeAddresses ?? []),
        cancelAddresses: cleanRoleAddresses(draft.cancelAddresses ?? []),
    };
}

async function copyAddress(address: string) {
    const trimmed = address.trim();
    if (!trimmed) return;

    try {
        await navigator.clipboard.writeText(trimmed);
        toast.success("Address copied");
    } catch {
        toast.error("Could not copy address");
    }
}

function Section({ title, caption, action, children }: SectionProps) {
    return (
        <section className="rounded-lg border border-border-subtle bg-card-elevated/70 p-3">
            <div className="mb-3 flex items-start justify-between gap-3">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                    {caption && <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{caption}</p>}
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

function SmallButton({
    children,
    onClick,
    disabled = false,
    title,
}: {
    children: React.ReactNode;
    onClick: () => void;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 hover:text-primary-light transition-colors disabled:pointer-events-none disabled:opacity-40"
        >
            {children}
        </button>
    );
}

function DeleteButton({
    onClick,
    disabled = false,
    title = "Remove",
}: {
    onClick: () => void;
    disabled?: boolean;
    title?: string;
}) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            title={title}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:pointer-events-none disabled:opacity-30"
        >
            <Trash2 className="h-3.5 w-3.5" />
        </button>
    );
}

function GroupMembers({
    group,
    draft,
    onChange,
}: {
    group: AdvancedGroupDraft;
    draft: AdvancedMultisigDraft;
    onChange: (draft: AdvancedMultisigDraft) => void;
}) {
    const updateMember = (memberId: string, patch: Partial<AdvancedMemberDraft>) =>
        onChange(
            updateGroup(draft, group.id, (current) => ({
                ...current,
                members: current.members.map((member) => (member.id === memberId ? { ...member, ...patch } : member)),
            }))
        );
    const atMemberLimit = effectiveMemberCount(draft) >= MAX_MULTISIG_MEMBERS;

    return (
        <div className="space-y-2">
            <div className="flex items-center justify-between">
                <div className="text-[10px] uppercase tracking-wide text-text-light/50">Signers</div>
                <SmallButton
                    onClick={() =>
                        onChange(
                            updateGroup(draft, group.id, (current) => ({
                                ...current,
                                members: [...current.members, createMember()],
                            }))
                        )
                    }
                    disabled={atMemberLimit}
                    title={atMemberLimit ? `Reached ${MAX_MULTISIG_MEMBERS} member entry limit` : undefined}
                >
                    <Plus className="h-3 w-3" /> Add signer
                </SmallButton>
            </div>
            {group.members.map((member) => (
                <div key={member.id} className="grid grid-cols-[minmax(0,1fr)_28px_72px_28px] gap-2">
                    <div className="min-w-0">
                        <Input
                            value={member.address}
                            onChange={(address) => updateMember(member.id, { address })}
                            placeholder="0x... address"
                            className="min-w-0 w-full"
                            size="sm"
                            error={member.address.length > 0 && !isValidSuiAddress(member.address)}
                        />
                    </div>
                    <button
                        type="button"
                        onClick={() => copyAddress(member.address)}
                        disabled={member.address.trim().length === 0}
                        title="Copy address"
                        aria-label="Copy signer address"
                        className="self-center rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
                    >
                        <Copy className="h-3.5 w-3.5" />
                    </button>
                    <div className="w-[72px]">
                        <Input
                            value={member.weight}
                            onChange={(weight) => updateMember(member.id, { weight })}
                            placeholder="1"
                            className="w-full"
                            size="sm"
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                    </div>
                    <DeleteButton
                        onClick={() =>
                            onChange(
                                updateGroup(draft, group.id, (current) => ({
                                    ...current,
                                    members: current.members.filter((item) => item.id !== member.id),
                                }))
                            )
                        }
                        disabled={group.members.length === 1}
                    />
                </div>
            ))}
        </div>
    );
}

function GroupTimeBands({
    group,
    draft,
    onChange,
}: {
    group: AdvancedGroupDraft;
    draft: AdvancedMultisigDraft;
    onChange: (draft: AdvancedMultisigDraft) => void;
}) {
    const updateBand = (bandId: string, patch: Partial<AdvancedTimeBandDraft>) =>
        onChange(
            updateGroup(draft, group.id, (current) => ({
                ...current,
                timeBands: current.timeBands.map((band) => (band.id === bandId ? { ...band, ...patch } : band)),
            }))
        );
    const atBandLimit = group.timeBands.length >= ADVANCED_MAX_TIME_BANDS;

    return (
        <div className="space-y-2 border-t border-border-subtle pt-3">
            <div className="flex items-center justify-between gap-2">
                <div>
                    <div className="text-[10px] uppercase tracking-wide text-text-light/50">Time bands</div>
                    <p className="text-[11px] text-text-muted">
                        Extra approval weight after delay. Cancel ignores these. Rows save in delay order; weight must
                        not decrease as delay grows.
                    </p>
                </div>
                <SmallButton
                    onClick={() =>
                        onChange(
                            updateGroup(draft, group.id, (current) => ({
                                ...current,
                                timeBands: [...current.timeBands, createTimeBand()],
                            }))
                        )
                    }
                    disabled={atBandLimit}
                    title={atBandLimit ? `Max ${ADVANCED_MAX_TIME_BANDS} time bands per group` : undefined}
                >
                    <Plus className="h-3 w-3" /> Add
                </SmallButton>
            </div>
            {group.timeBands.length === 0 ? (
                <p className="rounded-md border border-border-subtle bg-card-more-elevated/30 px-2 py-1.5 text-[11px] text-text-muted">
                    No delayed approval weight.
                </p>
            ) : (
                group.timeBands.map((band) => (
                    <div key={band.id} className="grid grid-cols-[1fr_1fr_28px] gap-2">
                        <Input
                            label="After days"
                            value={band.afterDays}
                            onChange={(afterDays) => updateBand(band.id, { afterDays })}
                            placeholder="1"
                            size="sm"
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                        <Input
                            label="Extra weight"
                            value={band.weight}
                            onChange={(weight) => updateBand(band.id, { weight })}
                            placeholder="1"
                            size="sm"
                            inputMode="numeric"
                            pattern="[0-9]*"
                        />
                        <div className="pt-4">
                            <DeleteButton
                                onClick={() =>
                                    onChange(
                                        updateGroup(draft, group.id, (current) => ({
                                            ...current,
                                            timeBands: current.timeBands.filter((item) => item.id !== band.id),
                                        }))
                                    )
                                }
                            />
                        </div>
                    </div>
                ))
            )}
        </div>
    );
}

function GroupEditor({
    group,
    index,
    draft,
    onChange,
}: {
    group: AdvancedGroupDraft;
    index: number;
    draft: AdvancedMultisigDraft;
    onChange: (draft: AdvancedMultisigDraft) => void;
}) {
    const baseWeight = groupBaseMemberWeight(group);
    const maxDelayed = groupMaxTimeBandWeight(group);
    const hasDelay = maxDelayed > 0n;
    const weightLabel = hasDelay
        ? `${baseWeight.toString()} base · ${(baseWeight + maxDelayed).toString()} max approval`
        : `${baseWeight.toString()} total weight`;

    return (
        <div className="rounded-lg border border-border-subtle bg-card-more-elevated/35 p-3">
            <div className="grid grid-cols-[minmax(0,1fr)_auto_28px] items-end gap-2">
                <Input
                    label={`Group ${index + 1}`}
                    value={group.name}
                    onChange={(name) => onChange(updateGroup(draft, group.id, (current) => ({ ...current, name })))}
                    placeholder="Enter group name"
                    size="sm"
                />
                <div
                    className="pb-1 text-xs text-text-muted"
                    title={
                        hasDelay
                            ? "Approval ceiling = base member weight + highest time-band weight. Cancel ignores time bands."
                            : "Sum of member weights for approval and cancel."
                    }
                >
                    {weightLabel}
                </div>
                <div className="pb-0.5">
                    <DeleteButton
                        onClick={() => onChange(removeGroup(draft, group.id))}
                        disabled={draft.groups.length === 1}
                    />
                </div>
            </div>
            <div className="mt-3 space-y-3">
                <GroupMembers group={group} draft={draft} onChange={onChange} />
                <GroupTimeBands group={group} draft={draft} onChange={onChange} />
            </div>
        </div>
    );
}

const RECOMMENDED_EXPIRY_DAYS_MIN = 1n;
const RECOMMENDED_EXPIRY_DAYS_MAX = 365n;

export function AdvancedMultisigConfig({ draft, onChange, error }: Props) {
    const expiryDays = parseU64Input(draft.intentExpiryDays);
    const expiryInvalid =
        draft.intentExpiryDays.trim().length > 0 &&
        (expiryDays === null || expiryDays < RECOMMENDED_EXPIRY_DAYS_MIN);
    const expiryTooHigh = expiryDays !== null && expiryDays > RECOMMENDED_EXPIRY_DAYS_MAX;
    return (
        <div className="space-y-4">
            <div className="grid gap-3 md:grid-cols-[minmax(0,1fr)_160px]">
                <AdvancedMultisigOverview draft={draft} />
                <div className="flex flex-col gap-1">
                    <Input
                        label="Intent expiry days"
                        value={draft.intentExpiryDays}
                        onChange={(intentExpiryDays) => onChange({ ...draft, intentExpiryDays })}
                        placeholder="365"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        error={expiryInvalid || expiryTooHigh}
                    />
                    {expiryInvalid && (
                        <p className="text-[10px] text-error-light">Intent expiry must be at least 1 day.</p>
                    )}
                    {expiryTooHigh && (
                        <p className="text-[10px] text-error-light">
                            365 days is the recommended maximum. Longer expiry keeps pending intents live for longer.
                        </p>
                    )}
                </div>
            </div>

            <Section
                title="Groups"
                caption={`Signers can appear in multiple groups. Max ${ADVANCED_MAX_GROUPS} groups per multisig (incl. role groups), max ${MAX_MULTISIG_MEMBERS} member entries per multisig, max ${ADVANCED_MAX_TIME_BANDS} time bands per group.`}
                action={
                    <SmallButton
                        onClick={() =>
                            onChange({ ...draft, groups: [...draft.groups, createGroup(nextGroupIndex(draft.groups))] })
                        }
                        disabled={effectiveGroupCount(draft) >= ADVANCED_MAX_GROUPS}
                        title={
                            effectiveGroupCount(draft) >= ADVANCED_MAX_GROUPS
                                ? `Reached ${ADVANCED_MAX_GROUPS} group limit (incl. role groups)`
                                : undefined
                        }
                    >
                        <Plus className="h-3 w-3" /> Group
                    </SmallButton>
                }
            >
                <div className="space-y-3">
                    {draft.groups.map((group, index) => (
                        <GroupEditor key={group.id} group={group} index={index} draft={draft} onChange={onChange} />
                    ))}
                </div>
            </Section>

            <AdvancedMultisigRoles draft={draft} onChange={onChange} />

            <div className="grid gap-3 lg:grid-cols-2">
                <AdvancedMultisigPolicyEditor
                    draft={draft}
                    kind="approval"
                    title="Approval policy"
                    caption="Any path can approve. Each path requires every row."
                    onChange={onChange}
                />
                <AdvancedMultisigPolicyEditor
                    draft={draft}
                    kind="rejection"
                    title="Rejection policy"
                    caption="Reject votes can unlock cancellation. Time bands are considered only for approvals, never for rejections."
                    onChange={onChange}
                />
            </div>

            {error && (
                <div className="rounded-lg border border-error/30 bg-error/10 px-3 py-2 text-xs text-error-light">
                    {error}
                </div>
            )}
        </div>
    );
}
