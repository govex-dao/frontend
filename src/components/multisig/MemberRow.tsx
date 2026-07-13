import { permissionLabels } from "@govex/futarchy-sdk/multisig/reads";
import type { MultisigMember } from "@govex/futarchy-sdk/multisig/reads";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";

interface Props {
    member: MultisigMember;
    isCurrentUser?: boolean;
}

export function MemberRow({ member, isCurrentUser }: Props) {
    const permissions = permissionLabels(member.permissions);

    return (
        <tr className={`border-b border-border-subtle ${isCurrentUser ? "bg-primary/10" : ""}`}>
            <td className="min-w-0 py-3 px-4">
                <div className="flex min-w-0 items-center gap-2">
                    <CopyableAddress
                        address={member.address}
                        className="min-w-0 flex-1"
                        textClassName={`text-sm ${isCurrentUser ? "font-semibold text-primary" : "text-text-primary"}`}
                        copyLabel="Copy member address"
                        toastMessage="Member address copied"
                    />
                    {isCurrentUser && (
                        <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary">
                            You
                        </span>
                    )}
                </div>
            </td>
            <td className="py-3 px-4 text-sm text-text-primary">{member.weight}</td>
            <td className="py-3 px-4">
                <div className="flex gap-1 flex-wrap">
                    {permissions.map((p) => (
                        <span
                            key={p}
                            className="text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-card-more-elevated border border-border-subtle text-text-secondary"
                        >
                            {p}
                        </span>
                    ))}
                </div>
            </td>
        </tr>
    );
}
