import { Clock, Edit3, Play, Trash2 } from "lucide-react";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
import {
    type MultisigConfig,
    type MultisigGroup,
    normalizeSuiAddress,
} from "@/lib/sui/multisig";

interface Props {
    config: MultisigConfig;
    currentUserAddress?: string;
}

interface GroupRoleFlags {
    propose: boolean;
    execute: boolean;
    cancel: boolean;
}

function formatDelay(ms: number): string {
    if (ms <= 0) return "instant";
    const days = Math.max(1, Math.round(ms / 86_400_000));
    return `${days} ${days === 1 ? "day" : "days"}`;
}

function flagsFor(groupIndex: number, config: MultisigConfig): GroupRoleFlags {
    return {
        propose: config.proposeGroups.includes(groupIndex),
        execute: config.executeGroups.includes(groupIndex),
        cancel: config.cancelGroups.includes(groupIndex),
    };
}

function GroupRoleBadges({ flags }: { flags: GroupRoleFlags }) {
    const items: Array<{ label: string; icon: typeof Edit3; cls: string }> = [];
    if (flags.propose) items.push({ label: "Propose", icon: Edit3, cls: "bg-blue-500/15 text-blue-400" });
    if (flags.execute) items.push({ label: "Execute", icon: Play, cls: "bg-green-500/15 text-green-400" });
    if (flags.cancel) items.push({ label: "Cancel", icon: Trash2, cls: "bg-red-500/15 text-red-400" });
    if (items.length === 0) {
        return <span className="text-[10px] text-text-muted">No role</span>;
    }
    return (
        <div className="flex flex-wrap gap-1">
            {items.map(({ label, icon: Icon, cls }) => (
                <span
                    key={label}
                    className={`inline-flex items-center gap-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full ${cls}`}
                >
                    <Icon className="w-2.5 h-2.5" />
                    {label}
                </span>
            ))}
        </div>
    );
}

function GroupCard({
    group,
    groupIndex,
    flags,
    currentUserAddress,
}: {
    group: MultisigGroup;
    groupIndex: number;
    flags: GroupRoleFlags;
    currentUserAddress?: string;
}) {
    const normalizedUser = normalizeSuiAddress(currentUserAddress);
    const baseWeight = group.members.reduce((sum, m) => sum + m.weight, 0);
    const maxDelayed = group.timeBands.reduce((max, band) => (band.weight > max ? band.weight : max), 0);

    return (
        <div className="rounded-xl border border-border bg-card-elevated p-4 space-y-3">
            <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                    <div className="text-sm font-semibold text-text-primary truncate">
                        {group.name || `Group ${groupIndex + 1}`}
                    </div>
                    <div className="text-[10px] text-text-muted mt-0.5">
                        {baseWeight} base weight
                        {maxDelayed > 0 ? ` · ${baseWeight + maxDelayed} with delay` : ""}
                    </div>
                </div>
                <GroupRoleBadges flags={flags} />
            </div>

            <div className="space-y-1">
                {group.members.map((member) => {
                    const isUser = normalizedUser && normalizeSuiAddress(member.address) === normalizedUser;
                    return (
                        <div
                            key={member.address}
                            className={`flex items-center justify-between gap-2 rounded-md px-2 py-1 ${
                                isUser ? "bg-primary/10" : "bg-card-more-elevated/40"
                            }`}
                        >
                            <div className="flex min-w-0 flex-1 items-center gap-1.5">
                                <CopyableAddress
                                    address={member.address}
                                    className="min-w-0 flex-1"
                                    textClassName="text-[10px] text-text-primary"
                                    copyLabel="Copy group member address"
                                    toastMessage="Member address copied"
                                />
                                {isUser && (
                                    <span className="shrink-0 text-[9px] font-medium px-1 py-0.5 rounded bg-primary/20 text-primary">
                                        you
                                    </span>
                                )}
                            </div>
                            <span className="text-[10px] text-text-muted shrink-0">w {member.weight}</span>
                        </div>
                    );
                })}
            </div>

            {group.timeBands.length > 0 && (
                <div className="space-y-1 border-t border-border-subtle pt-2">
                    <div className="text-[10px] uppercase tracking-wide text-text-light/50 flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        Time bands
                    </div>
                    {group.timeBands.map((band, i) => (
                        <div key={i} className="flex items-center gap-2 text-[10px] text-text-muted">
                            <span>after {formatDelay(band.afterMs)}</span>
                            <span className="text-text-primary">+{band.weight} weight</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}

export function GroupsSection({ config, currentUserAddress }: Props) {
    if (config.groups.length === 0) return null;
    if (config.groups.length === 1 && config.groups[0]?.timeBands.length === 0) return null;

    return (
        <div>
            <h2 className="text-lg font-semibold mb-3">Groups ({config.groups.length})</h2>
            <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {config.groups.map((group, index) => (
                    <GroupCard
                        key={`${group.name}-${index}`}
                        group={group}
                        groupIndex={index}
                        flags={flagsFor(index, config)}
                        currentUserAddress={currentUserAddress}
                    />
                ))}
            </div>
        </div>
    );
}
