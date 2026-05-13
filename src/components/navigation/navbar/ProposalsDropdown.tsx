import { useNavigate } from "react-router";
import { File } from "lucide-react";
import { useProposalsDisplay } from "@/hooks/api";
import type { ProposalDisplay } from "@/types";
import { DropdownWrapper } from "./DropdownWrapper";

interface ProposalsDropdownContentProps {
    onItemClick: () => void;
    onMouseLeave?: () => void;
}

/**
 * Hook to get active proposals from the API
 */
export function useActiveProposals() {
    const { data: proposals, ...rest } = useProposalsDisplay();
    const activeProposals = proposals?.filter((p) => p.status === "active") || [];
    return { data: activeProposals, ...rest };
}

export function ProposalsDropdownContent({ onItemClick, onMouseLeave }: ProposalsDropdownContentProps) {
    const navigate = useNavigate();
    const { data: activeProposals } = useActiveProposals();

    return (
        <DropdownWrapper
            title="Recent Markets"
            subtitle="Community governance decisions"
            onViewAll={() => navigate("/proposals")}
            onMouseLeave={onMouseLeave}
        >
            {activeProposals.map((proposal: ProposalDisplay) => (
                <button
                    key={proposal.id}
                    onClick={() => {
                        navigate(`/proposals/${proposal.id}`);
                        onItemClick();
                    }}
                    className="group text-left p-4 rounded-xl bg-card-elevated/50 hover:bg-card-elevated border border-white/5 hover:border-primary/10 transition-all duration-200"
                >
                    <div className="flex items-start gap-3 mb-3">
                        <div className="w-8 h-8 rounded-lg bg-linear-to-br from-primary/20 to-primary-light/10 flex items-center justify-center shrink-0">
                            <File className="w-4 h-4 text-primary" />
                        </div>
                        <div className="flex-1 min-w-0">
                            <h4 className="text-sm font-semibold text-text-primary group-hover:text-primary transition-colors line-clamp-1 mb-1">
                                {proposal.title}
                            </h4>
                            <div className="flex items-center gap-2">
                                <span
                                    className={`text-xs px-2 py-0.5 rounded-md font-medium ${
                                        proposal.status === "passed"
                                            ? "bg-green-500/10 text-green-400"
                                            : proposal.status === "failed"
                                              ? "bg-red-500/10 text-red-400"
                                              : "bg-blue-500/10 text-blue-400"
                                    }`}
                                >
                                    {proposal.status === "active" ? "Live" : proposal.status}
                                </span>
                                <span className="text-xs text-text-muted">{proposal.daoName}</span>
                            </div>
                        </div>
                    </div>
                    <p className="text-xs text-text-muted line-clamp-2 leading-relaxed">{proposal.description}</p>
                </button>
            ))}
        </DropdownWrapper>
    );
}
