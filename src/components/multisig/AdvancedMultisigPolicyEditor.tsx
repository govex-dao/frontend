import { ChevronDown, ChevronUp, Plus, Trash2 } from "lucide-react";
import { Input } from "@/components/inputs/Input";
import {
    ADVANCED_MAX_PATHS,
    createDraftId,
    movePath,
    type AdvancedMultisigDraft,
    type AdvancedPolicyPathDraft,
    type AdvancedRequirementDraft,
} from "@/lib/sui/advancedMultisigConfig";
import { parseU64Input } from "@/lib/sui/multisigConfigValidation";

type PolicyKind = "approval" | "rejection";

interface SelectOption {
    value: string;
    label: string;
}

interface Props {
    draft: AdvancedMultisigDraft;
    kind: PolicyKind;
    title: string;
    caption: string;
    onChange: (draft: AdvancedMultisigDraft) => void;
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

function getPolicyPaths(draft: AdvancedMultisigDraft, kind: PolicyKind): AdvancedPolicyPathDraft[] {
    return kind === "approval" ? draft.approvePaths : draft.cancelPaths;
}

function setPolicyPaths(
    draft: AdvancedMultisigDraft,
    kind: PolicyKind,
    paths: AdvancedPolicyPathDraft[]
): AdvancedMultisigDraft {
    return kind === "approval" ? { ...draft, approvePaths: paths } : { ...draft, cancelPaths: paths };
}

function groupTotalWeight(draft: AdvancedMultisigDraft, groupId: string, kind: PolicyKind): bigint {
    const group = draft.groups.find((item) => item.id === groupId);
    if (!group) return 0n;

    const memberWeight = group.members.reduce((total, member) => {
        const weight = parseU64Input(member.weight);
        return weight !== null && weight > 0n ? total + weight : total;
    }, 0n);

    if (kind !== "approval") return memberWeight;

    const delayedWeight = group.timeBands.reduce((max, band) => {
        const weight = parseU64Input(band.weight);
        return weight !== null && weight > max ? weight : max;
    }, 0n);

    return memberWeight + delayedWeight;
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

function DeleteButton({ onClick, disabled = false }: { onClick: () => void; disabled?: boolean }) {
    return (
        <button
            type="button"
            onClick={onClick}
            disabled={disabled}
            className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-red-500/20 hover:text-red-400 disabled:pointer-events-none disabled:opacity-30"
        >
            <Trash2 className="h-3.5 w-3.5" />
        </button>
    );
}

function SelectField({
    value,
    onChange,
    options,
}: {
    value: string;
    onChange: (value: string) => void;
    options: SelectOption[];
}) {
    return (
        <select
            value={value}
            onChange={(event) => onChange(event.target.value)}
            className="h-[30px] rounded-lg border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-border-light"
        >
            {options.map((option) => (
                <option key={option.value} value={option.value}>
                    {option.label}
                </option>
            ))}
        </select>
    );
}

function Section({
    title,
    caption,
    action,
    children,
}: {
    title: string;
    caption: string;
    action: React.ReactNode;
    children: React.ReactNode;
}) {
    return (
        <section className="rounded-lg border border-border-subtle bg-card-elevated/70 p-3">
            <div className="mb-3 flex items-start justify-between gap-3 lg:min-h-[4.75rem]">
                <div>
                    <h3 className="text-sm font-semibold text-text-primary">{title}</h3>
                    <p className="mt-0.5 text-[11px] leading-snug text-text-muted">{caption}</p>
                </div>
                {action}
            </div>
            {children}
        </section>
    );
}

export function AdvancedMultisigPolicyEditor({ draft, kind, title, caption, onChange }: Props) {
    const paths = getPolicyPaths(draft, kind);
    const groupOptions = draft.groups.map((group) => ({ value: group.id, label: group.name.trim() || "Untitled" }));
    const firstGroupId = draft.groups[0]?.id ?? "";
    const prefix = kind === "approval" ? "approve-path" : "reject-path";

    const updateRequirement = (pathId: string, requirementId: string, patch: Partial<AdvancedRequirementDraft>) => {
        const nextPaths = paths.map((path) => ({
            ...path,
            requirements:
                path.id === pathId
                    ? path.requirements.map((requirement) =>
                          requirement.id === requirementId ? { ...requirement, ...patch } : requirement
                      )
                    : path.requirements,
        }));
        onChange(setPolicyPaths(draft, kind, nextPaths));
    };

    return (
        <Section
            title={title}
            caption={caption}
            action={
                <SmallButton
                    onClick={() => onChange(setPolicyPaths(draft, kind, [...paths, createPath(prefix, firstGroupId)]))}
                    disabled={paths.length >= ADVANCED_MAX_PATHS}
                    title={
                        paths.length >= ADVANCED_MAX_PATHS ? `Max ${ADVANCED_MAX_PATHS} paths per policy` : undefined
                    }
                >
                    <Plus className="h-3 w-3" /> Path
                </SmallButton>
            }
        >
            <div className="space-y-2">
                {paths.length === 0 && (
                    <p className="rounded-md border border-border-subtle bg-card-more-elevated/30 px-2 py-1.5 text-[11px] text-text-muted">
                        No paths configured.
                    </p>
                )}
                {paths.map((path, pathIndex) => (
                    <div key={path.id} className="space-y-2">
                        {pathIndex > 0 && (
                            <div className="flex items-center gap-3 px-1 py-1">
                                <div className="h-px flex-1 bg-primary/30" />
                                <span className="text-base font-bold text-primary-light">OR</span>
                                <div className="h-px flex-1 bg-primary/30" />
                            </div>
                        )}
                        <div className="rounded-lg border border-border-subtle bg-card-more-elevated/35 p-2">
                            <div className="mb-2 flex items-center justify-between">
                                <div className="text-xs font-semibold text-text-primary">Path {pathIndex + 1}</div>
                                <div className="flex items-center gap-0.5">
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange(setPolicyPaths(draft, kind, movePath(paths, pathIndex, -1)))
                                        }
                                        disabled={pathIndex === 0}
                                        title="Move up"
                                        aria-label={`Move path ${pathIndex + 1} up`}
                                        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
                                    >
                                        <ChevronUp className="h-3.5 w-3.5" />
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() =>
                                            onChange(setPolicyPaths(draft, kind, movePath(paths, pathIndex, 1)))
                                        }
                                        disabled={pathIndex === paths.length - 1}
                                        title="Move down"
                                        aria-label={`Move path ${pathIndex + 1} down`}
                                        className="rounded-md p-1.5 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
                                    >
                                        <ChevronDown className="h-3.5 w-3.5" />
                                    </button>
                                    <DeleteButton
                                        onClick={() =>
                                            onChange(
                                                setPolicyPaths(
                                                    draft,
                                                    kind,
                                                    paths.filter((item) => item.id !== path.id)
                                                )
                                            )
                                        }
                                    />
                                </div>
                            </div>
                            <div className="space-y-2">
                                {path.requirements.map((requirement, requirementIndex) => (
                                    <div key={requirement.id} className="space-y-2">
                                        {requirementIndex > 0 && (
                                            <div className="flex items-center gap-2 pl-1 pr-8">
                                                <div className="h-px flex-1 bg-primary/20" />
                                                <span className="text-xs font-bold text-primary-light">AND</span>
                                                <div className="h-px flex-1 bg-primary/20" />
                                            </div>
                                        )}
                                        <div className="grid grid-cols-[minmax(0,1fr)_84px_auto_minmax(88px,auto)_28px] items-center gap-2">
                                            <SelectField
                                                value={requirement.groupId}
                                                onChange={(groupId) =>
                                                    updateRequirement(path.id, requirement.id, { groupId })
                                                }
                                                options={groupOptions}
                                            />
                                            <Input
                                                value={requirement.threshold}
                                                onChange={(threshold) =>
                                                    updateRequirement(path.id, requirement.id, { threshold })
                                                }
                                                placeholder="1"
                                                size="sm"
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                            />
                                            <span className="text-lg text-text-muted">/</span>
                                            <span className="text-xs text-text-muted">
                                                {groupTotalWeight(draft, requirement.groupId, kind).toString()} total
                                                weight
                                            </span>
                                            <DeleteButton
                                                onClick={() => {
                                                    const nextPaths = paths.map((item) =>
                                                        item.id === path.id
                                                            ? {
                                                                  ...item,
                                                                  requirements: item.requirements.filter(
                                                                      (req) => req.id !== requirement.id
                                                                  ),
                                                              }
                                                            : item
                                                    );
                                                    onChange(setPolicyPaths(draft, kind, nextPaths));
                                                }}
                                            />
                                        </div>
                                    </div>
                                ))}
                            </div>
                            <SmallButton
                                onClick={() => {
                                    const nextPaths = paths.map((item) =>
                                        item.id === path.id
                                            ? {
                                                  ...item,
                                                  requirements: [...item.requirements, createRequirement(firstGroupId)],
                                              }
                                            : item
                                    );
                                    onChange(setPolicyPaths(draft, kind, nextPaths));
                                }}
                                disabled={path.requirements.length >= draft.groups.length}
                                title={
                                    path.requirements.length >= draft.groups.length
                                        ? "Each path can reference each group at most once"
                                        : undefined
                                }
                            >
                                <Plus className="h-3 w-3" /> Requirement
                            </SmallButton>
                        </div>
                    </div>
                ))}
            </div>
            {paths.length >= ADVANCED_MAX_PATHS && (
                <p className="mt-2 text-[11px] text-text-muted">The onchain limit is {ADVANCED_MAX_PATHS} paths.</p>
            )}
        </Section>
    );
}
