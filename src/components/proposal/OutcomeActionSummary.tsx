import { ExplorerLink } from "@/components/ExplorerLink";
import type { ProposalAction } from "@/types";

interface OutcomeActionSummaryProps {
    actions: ProposalAction[];
    txDigest: string;
}

function getActionName(action: ProposalAction): string {
    return action.data?.displayName || action.data?.actionType || action.type || "Action";
}

export function OutcomeActionSummary({ actions, txDigest }: OutcomeActionSummaryProps) {
    if (actions.length === 0) return null;

    return (
        <div className="space-y-2">
            <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                    Actions ({actions.length})
                </div>
                <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                    <span>Creation tx</span>
                    <ExplorerLink id={txDigest} type="transaction" className="text-text-secondary" />
                </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
                {actions.map((action, index) => (
                    <span
                        key={action.id || `${index}-${getActionName(action)}`}
                        className="rounded-md border border-border/50 bg-card-more-elevated px-2 py-1 text-xs text-text-secondary"
                    >
                        {index + 1}. {getActionName(action)}
                    </span>
                ))}
            </div>
        </div>
    );
}
