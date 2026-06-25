import { Link } from "react-router";
import { Check, Copy, Shield, Users, WalletCards, X } from "lucide-react";
import { useState, type MouseEvent } from "react";
import toast from "react-hot-toast";

interface Props {
  accountId: string;
  accountName: string;
  memberCount: number;
  metaLabel?: string;
  metaValue?: string;
  onRemove?: () => void;
  to?: string | null;
}

export function AccountCard(props: Props) {
  const { accountId, accountName, memberCount, metaLabel, metaValue, onRemove, to } = props;
  const [copied, setCopied] = useState(false);
  const displayName = accountName.trim() || "Multisig Account";
  const cardClassName =
    "group glass-flow-panel rounded-xl p-5 transition-all flex flex-col gap-4 h-full relative";

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
          <div className="mt-1 flex min-w-0 items-start gap-1.5">
            <p className="min-w-0 flex-1 break-all font-mono text-[11px] leading-relaxed text-text-muted">
              {accountId}
            </p>
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
        </div>
      </div>

      {(memberCount > 0 || metaValue) && (
        <div className="grid gap-3 border-t border-border-subtle pt-3 sm:grid-cols-2">
          {memberCount > 0 && (
            <div>
              <p className="text-[10px] text-text-muted mb-0.5 uppercase tracking-wider">Members</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <Users className="w-3 h-3" />
                {memberCount}
              </p>
            </div>
          )}
          {metaValue && (
            <div>
              <p className="text-[10px] text-text-muted mb-0.5 uppercase tracking-wider">{metaLabel ?? "Access"}</p>
              <p className="text-sm font-medium flex items-center gap-1">
                <WalletCards className="w-3 h-3" />
                {metaValue}
              </p>
            </div>
          )}
        </div>
      )}
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
