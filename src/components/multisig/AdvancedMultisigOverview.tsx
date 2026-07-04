import {
    ADVANCED_MAX_GROUPS,
    ADVANCED_MAX_PATHS,
    effectiveGroupCount,
    effectiveMemberCount,
    effectiveRoleGroupCount,
    effectiveRoleMemberCount,
    type AdvancedMultisigDraft,
} from "@/lib/sui/advancedMultisigConfig";
import { MAX_MULTISIG_MEMBERS } from "@/lib/sui/multisigConfigValidation";

interface Props {
    draft: AdvancedMultisigDraft;
}

export function AdvancedMultisigOverview({ draft }: Props) {
    const totalGroups = effectiveGroupCount(draft);
    const totalMembers = effectiveMemberCount(draft);
    const roleGroups = effectiveRoleGroupCount(draft);
    const roleMembers = effectiveRoleMemberCount(draft);
    const stats: Array<{ label: string; value: string; sublabel?: string; overLimit: boolean }> = [
        {
            label: "Groups",
            value: `${totalGroups} / ${ADVANCED_MAX_GROUPS}`,
            sublabel: roleGroups > 0 ? `incl. ${roleGroups} role` : undefined,
            overLimit: totalGroups > ADVANCED_MAX_GROUPS,
        },
        {
            label: "Member entries",
            value: `${totalMembers} / ${MAX_MULTISIG_MEMBERS}`,
            sublabel: roleMembers > 0 ? `incl. ${roleMembers} role` : undefined,
            overLimit: totalMembers > MAX_MULTISIG_MEMBERS,
        },
        {
            label: "Approve paths",
            value: `${draft.approvePaths.length} / ${ADVANCED_MAX_PATHS}`,
            overLimit: draft.approvePaths.length > ADVANCED_MAX_PATHS,
        },
        {
            label: "Reject paths",
            value: `${draft.cancelPaths.length} / ${ADVANCED_MAX_PATHS}`,
            overLimit: draft.cancelPaths.length > ADVANCED_MAX_PATHS,
        },
    ];

    return (
        <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {stats.map((stat) => (
                <div
                    key={stat.label}
                    className={`rounded-lg border px-3 py-2 ${
                        stat.overLimit ? "border-error/40 bg-error/10" : "border-border-subtle bg-card-more-elevated/40"
                    }`}
                >
                    <div className="text-[10px] uppercase tracking-wide text-text-muted/70">{stat.label}</div>
                    <div
                        className={`mt-0.5 text-base font-semibold ${
                            stat.overLimit ? "text-error-light" : "text-text-primary"
                        }`}
                    >
                        {stat.value}
                    </div>
                    {stat.sublabel && <div className="mt-0.5 text-[10px] text-text-muted">{stat.sublabel}</div>}
                </div>
            ))}
        </div>
    );
}
