import { ChevronDown } from "lucide-react";
import { useState } from "react";
import { motion, AnimatePresence } from "motion/react";
import type { ProposalAction } from "@/types";
import { getActionSummary, renderActionDetails } from "@/lib/actionRenderers";
import { ActionHeader } from "./ActionHeader";

interface Props {
    number: number;
    action: ProposalAction;
    onDetailsChange?: (isOpen: boolean) => void;
}

export function ActionCard(props: Props) {
    const { number, action, onDetailsChange } = props;
    const [showDetails, setShowDetails] = useState(false);

    const toggleDetails = (e: React.MouseEvent) => {
        e.stopPropagation();
        const newState = !showDetails;
        setShowDetails(newState);
        onDetailsChange?.(newState);
    };

    const summary = getActionSummary(action);
    const titleOverride = action.type === "onChain" ? action.data.displayName || action.data.actionType : undefined;

    return (
        <div
            className={`w-full ${showDetails ? "z-30" : "z-0"} rounded-lg group/card cursor-pointer relative flex flex-col transition-all duration-200`}
        >
            <div
                className="group-hover/card:border-border-light min-h-[132px] rounded-lg overflow-visible border border-border bg-card-more-elevated z-10 p-4 flex flex-col gap-3"
                onClick={action.type !== "memo" ? toggleDetails : undefined}
            >
                <div className="flex items-start justify-between gap-3">
                    <ActionHeader actionType={action.type} number={number} title={titleOverride} className="min-w-0" />
                    {action.type !== "memo" && (
                        <button
                            type="button"
                            onClick={toggleDetails}
                            className="shrink-0 inline-flex items-center gap-1 rounded-md border border-border/50 px-2 py-1 text-xs text-text-tertiary transition-colors hover:border-border-light hover:bg-card-elevated hover:text-text-secondary"
                        >
                            <span>Details</span>
                            <ChevronDown
                                className={`w-3 h-3 transition-transform ${showDetails ? "rotate-180" : ""}`}
                            />
                        </button>
                    )}
                </div>

                <div className="text-sm font-medium text-text-primary leading-snug flex-1">{summary}</div>
            </div>

            <AnimatePresence>
                {showDetails && (
                    <motion.div
                        initial={{ opacity: 0, y: -6 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
                        className="mt-2 max-h-[360px] overflow-y-auto rounded-lg border border-border bg-card p-4 group-hover/card:border-border-light"
                    >
                        {renderActionDetails(action)}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
