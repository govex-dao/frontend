import { isValidSuiAddress } from "@mysten/sui/utils";
import { Copy, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import {
    ADVANCED_MAX_GROUPS,
    effectiveGroupCount,
    effectiveMemberCount,
    type AdvancedMultisigDraft,
} from "@/lib/sui/advancedMultisigConfig";
import { MAX_MULTISIG_MEMBERS } from "@/lib/sui/multisigConfigValidation";
import { MiddleEllipsizedAddress } from "./CopyableAddress";

type RoleAddressKey = "proposeAddresses" | "executeAddresses" | "cancelAddresses";

interface Props {
    draft: AdvancedMultisigDraft;
    onChange: (draft: AdvancedMultisigDraft) => void;
}

function normalizeAddress(value: string): string {
    return value.trim().toLowerCase();
}

function compactAddress(address: string): string {
    const trimmed = address.trim();
    if (trimmed.length <= 13) return trimmed;
    return `${trimmed.slice(0, 6)}...${trimmed.slice(-4)}`;
}

function roleAddressOptions(draft: AdvancedMultisigDraft) {
    return Array.from(
        new Set(
            draft.groups
                .flatMap((group) => group.members.map((member) => normalizeAddress(member.address)))
                .filter((address) => isValidSuiAddress(address))
        )
    ).map((address) => ({ value: address, label: compactAddress(address) }));
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

export function AdvancedMultisigRoles({ draft, onChange }: Props) {
    const addressOptions = roleAddressOptions(draft);
    const roles: Array<{
        key: RoleAddressKey;
        title: string;
        caption: string;
        placeholder: string;
        accentClass: string;
        titleClass: string;
    }> = [
        {
            key: "proposeAddresses",
            title: "Propose",
            caption: "Can create intents.",
            placeholder: "Add proposer",
            accentClass: "border-l-primary/70",
            titleClass: "text-primary-light",
        },
        {
            key: "executeAddresses",
            title: "Execute",
            caption:
                "Can execute approved intents. Empty means permissionless execution, useful for third-party keeper bots or intent solvers.",
            placeholder: "Add executor",
            accentClass: "border-l-success/70",
            titleClass: "text-success-light",
        },
        {
            key: "cancelAddresses",
            title: "Cancel",
            caption: "Can delete intents after rejection policy allows it.",
            placeholder: "Add canceller",
            accentClass: "border-l-warning/70",
            titleClass: "text-warning-light",
        },
    ];

    const selectedAddresses = (key: RoleAddressKey) => draft[key] ?? [];
    // Each role becomes a synthetic onchain group when non-empty, costing
    // 1 group slot + N member-entry slots. Disable the picker when adding
    // would breach either onchain max.
    const totalGroups = effectiveGroupCount(draft);
    const totalMembers = effectiveMemberCount(draft);
    const atMemberLimit = totalMembers >= MAX_MULTISIG_MEMBERS;
    const isRoleAddDisabled = (key: RoleAddressKey) => {
        if (atMemberLimit) return true;
        const wouldCreateRoleGroup = selectedAddresses(key).length === 0;
        return wouldCreateRoleGroup && totalGroups >= ADVANCED_MAX_GROUPS;
    };
    const roleDisabledReason = (key: RoleAddressKey) => {
        if (atMemberLimit) return `Reached ${MAX_MULTISIG_MEMBERS} member entry limit`;
        const wouldCreateRoleGroup = selectedAddresses(key).length === 0;
        if (wouldCreateRoleGroup && totalGroups >= ADVANCED_MAX_GROUPS) {
            return `Reached ${ADVANCED_MAX_GROUPS} group limit (incl. role groups)`;
        }
        return undefined;
    };
    const addRoleAddress = (key: RoleAddressKey, address: string) => {
        if (!address) return;
        if (isRoleAddDisabled(key)) return;
        const nextAddress = normalizeAddress(address);
        const selected = selectedAddresses(key);
        if (selected.map(normalizeAddress).includes(nextAddress)) return;
        onChange({ ...draft, [key]: [...selected, nextAddress] });
    };

    const removeRoleAddress = (key: RoleAddressKey, address: string) => {
        const removed = normalizeAddress(address);
        onChange({ ...draft, [key]: selectedAddresses(key).filter((item) => normalizeAddress(item) !== removed) });
    };

    return (
        <section className="rounded-lg border border-border-subtle bg-card-elevated/70 p-3">
            <div className="mb-3">
                <h3 className="text-sm font-semibold text-text-primary">Roles</h3>
                <p className="mt-0.5 text-[11px] leading-snug text-text-muted">
                    Pick exact signer addresses for access. These selections are converted into role-only groups
                    onchain.
                </p>
            </div>
            <div className="grid items-stretch gap-3 md:grid-cols-3">
                {roles.map((role) => (
                    <div key={role.key} className={`flex min-w-0 flex-col gap-2 border-l-2 pl-3 ${role.accentClass}`}>
                        <div className="min-h-11 md:min-h-[5.25rem] lg:min-h-[4.5rem]">
                            <div className={`text-xs font-semibold ${role.titleClass}`}>{role.title}</div>
                            <p className="text-[11px] leading-snug text-text-muted">{role.caption}</p>
                        </div>
                        <div className="min-w-0 flex-1 space-y-2">
                            {selectedAddresses(role.key).length === 0 ? (
                                <div className="rounded-lg border border-border-subtle bg-card-more-elevated/30 px-2 py-1.5 text-[11px] text-text-muted">
                                    {role.key === "executeAddresses" ? "Permissionless" : "No signers selected"}
                                </div>
                            ) : (
                                selectedAddresses(role.key).map((address, index) => {
                                    const normalized = normalizeAddress(address);
                                    const addressExists = addressOptions.some((option) => option.value === normalized);
                                    return (
                                        <div
                                            key={normalized}
                                            className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-2 rounded-lg border border-border-subtle bg-card-more-elevated/20 p-1 sm:grid-cols-[5.25rem_minmax(0,1fr)_auto_auto]"
                                        >
                                            <span className="col-span-3 min-w-0 text-[11px] font-medium text-text-secondary sm:col-span-1">
                                                {role.title} {index + 1}
                                            </span>
                                            <div
                                                className={`min-w-0 max-w-full overflow-hidden rounded-lg border px-2 py-1 font-mono text-[10px] ${
                                                    addressExists
                                                        ? "border-border bg-card-more-elevated text-text-primary"
                                                        : "border-error/30 bg-error/10 text-error-light"
                                                }`}
                                                title={normalized}
                                            >
                                                {addressExists ? (
                                                    <MiddleEllipsizedAddress address={normalized} />
                                                ) : (
                                                    "Removed signer"
                                                )}
                                            </div>
                                            <button
                                                type="button"
                                                onClick={() => copyAddress(normalized)}
                                                disabled={!addressExists}
                                                className="rounded p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
                                                aria-label={`Copy ${role.title.toLowerCase()} address`}
                                            >
                                                <Copy className="h-3.5 w-3.5" />
                                            </button>
                                            <button
                                                type="button"
                                                onClick={() => removeRoleAddress(role.key, normalized)}
                                                className="rounded p-1 text-text-muted transition-colors hover:bg-red-500/20 hover:text-red-400"
                                                aria-label={`Remove ${role.title.toLowerCase()} signer`}
                                            >
                                                <Trash2 className="h-3.5 w-3.5" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                        <div className="mt-auto">
                            <select
                                value=""
                                onChange={(event) => addRoleAddress(role.key, event.target.value)}
                                disabled={isRoleAddDisabled(role.key)}
                                title={roleDisabledReason(role.key)}
                                className="h-8 w-full min-w-0 rounded-lg border border-border bg-card-elevated px-2 py-1 text-xs text-text-primary outline-none transition-colors focus:border-border-light disabled:pointer-events-none disabled:opacity-40"
                            >
                                <option value="">{role.placeholder}</option>
                                {addressOptions
                                    .filter(
                                        (option) =>
                                            !selectedAddresses(role.key).map(normalizeAddress).includes(option.value)
                                    )
                                    .map((option) => (
                                        <option key={option.value} value={option.value}>
                                            {option.label}
                                        </option>
                                    ))}
                            </select>
                        </div>
                        {addressOptions.length === 0 && (
                            <p className="text-[11px] text-text-muted">Add a valid signer address first.</p>
                        )}
                    </div>
                ))}
            </div>
        </section>
    );
}
