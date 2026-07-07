import { Link } from "react-router";
import { Check, Clock3, Copy, Shield, Users, WalletCards, X } from "lucide-react";
import { useState, type MouseEvent } from "react";
import toast from "react-hot-toast";
import { MiddleEllipsizedAddress } from "./CopyableAddress";

interface Props {
    accountId: string;
    accountName: string;
    memberCount: number | null;
    pendingIntentCount?: number | null;
    balanceUsd?: string | null;
    metaLabel?: string;
    metaValue?: string;
    onRemove?: () => void;
    showAccountId?: boolean;
    to?: string | null;
}

export function AccountCard(props: Props) {
    const {
        accountId,
        accountName,
        memberCount,
        pendingIntentCount,
        balanceUsd,
        metaLabel,
        metaValue,
        onRemove,
        showAccountId = true,
        to,
    } = props;
    const [copied, setCopied] = useState(false);
    const displayName = accountName.trim() || "Multisig Account";
    const cardClassName =
        "group glass-flow-panel home-tier-panel rounded-xl p-5 transition-all flex flex-col gap-4 h-full relative";
    const memberCountValue = memberCount === null ? "..." : memberCount;
    const pendingIntentValue = pendingIntentCount === null ? "..." : pendingIntentCount;
    const balanceValue = balanceUsd === null ? "..." : balanceUsd;

    const copyAccountId = async (event: MouseEvent<HTMLButtonElement>) => {
        event.preventDefault();
        event.stopPropagation();

        try {
            await navigator.clipboard.writeText(accountId);
            setCopied(true);
            toast.success("Multisig address copied", { id: "clipboard-copy" });
            window.setTimeout(() => setCopied(false), 1600);
        } catch {
            toast.error("Could not copy address");
        }
    };

    const content = (
        <>
            {onRemove && (
                <button
                    onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onRemove();
                    }}
                    className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors text-text-muted hover:text-text-primary"
                    title="Remove saved account"
                >
                    <X className="w-4 h-4" />
                </button>
            )}

            <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-primary/15 border border-primary/15 backdrop-blur-sm flex items-center justify-center">
                    <Shield className="w-5 h-5 text-primary" />
                </div>
                <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-white group-hover:text-primary transition-colors truncate">
                        {displayName}
                    </h3>
                    {showAccountId && (
                        <div className="mt-1 flex min-w-0 items-center gap-1.5">
                            <MiddleEllipsizedAddress
                                address={accountId}
                                className="flex-1 font-mono text-xs text-text-muted"
                            />
                            <button
                                type="button"
                                onClick={copyAccountId}
                                className="shrink-0 rounded p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
                                title="Copy multisig address"
                                aria-label="Copy multisig address"
                            >
                                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                    )}
                </div>
            </div>

            <div className="grid grid-cols-2 gap-3 border-t border-border-subtle pt-3 sm:grid-cols-3">
                <div>
                    <p className="text-[10px] text-text-muted mb-0.5 uppercase tracking-wider">Members</p>
                    <p className="text-sm font-medium flex items-center gap-1">
                        <Users className="w-3 h-3" />
                        {memberCountValue}
                    </p>
                </div>
                {pendingIntentCount !== undefined && (
                    <div>
                        <p className="text-[10px] text-text-muted mb-0.5 uppercase tracking-wider">Pending</p>
                        <p className="text-sm font-medium flex items-center gap-1">
                            <Clock3 className="w-3 h-3" />
                            {pendingIntentValue}
                        </p>
                    </div>
                )}
                {balanceUsd !== undefined && (
                    <div>
                        <p className="text-[10px] text-text-muted mb-0.5 uppercase tracking-wider">Balance</p>
                        <p className="text-sm font-medium flex items-center gap-1">{balanceValue}</p>
                    </div>
                )}
                {metaValue && (
                    <div>
                        <p className="text-[10px] text-text-muted mb-0.5 uppercase tracking-wider">
                            {metaLabel ?? "Access"}
                        </p>
                        <p className="text-sm font-medium flex items-center gap-1">
                            <WalletCards className="w-3 h-3" />
                            {metaValue}
                        </p>
                    </div>
                )}
            </div>
        </>
    );

    if (to === null) {
        return <div className={cardClassName}>{content}</div>;
    }

    return (
        <Link to={to ?? `/multisig/${accountId}`} className={cardClassName}>
            {content}
        </Link>
    );
}
