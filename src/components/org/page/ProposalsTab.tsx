import { useState } from "react";
import { X } from "lucide-react";
import type { ProposalDisplay } from "@/types";
import { Select } from "@/components/inputs/Select";
import { ProposalCard } from "@/components/proposal/Card";

interface ProposalsTabProps {
    proposals: ProposalDisplay[];
}

type SortType = "date";

export function ProposalsTab(props: ProposalsTabProps) {
    const { proposals } = props;
    const [sort, setSort] = useState<SortType>("date");

    // Sort proposals based on selected sort type
    const sortedProposals = [...proposals].sort((a, b) => {
        switch (sort) {
            case "date":
                return b.timestamp.getTime() - a.timestamp.getTime();
            default:
                return 0;
        }
    });

    return (
        <div className="flex flex-col gap-2 sm:gap-6">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 min-h-8">
                <div className="flex flex-row items-baseline gap-3">
                    <h4>Decisions</h4>
                    <p className="text-text-light">{proposals.length}</p>
                </div>
                <div className="flex flex-row sm:items-center gap-3 sm:w-auto">
                    <Select
                        allowClear={false}
                        allowSearch={false}
                        value={sort}
                        onChange={(value) => setSort(value as SortType)}
                        className="flex-1 sm:w-56 shrink-0"
                        options={[{ label: "Most Recent", value: "date" }]}
                    />
                </div>
            </div>

            <div className="flex flex-col gap-2">
                {sortedProposals.length > 0 ? (
                    sortedProposals.map((proposal) => <ProposalCard key={proposal.id} proposal={proposal} />)
                ) : (
                    <div className="glass-flow-panel flex flex-col items-center justify-center rounded-lg px-4 py-16">
                        <div className="w-16 h-16 mb-4 rounded-full bg-white/5 flex items-center justify-center">
                            <X className="w-8 h-8 text-text-muted" />
                        </div>
                        <h3 className="text-lg font-semibold mb-2">No decisions yet</h3>
                        <p className="text-text-muted text-sm text-center max-w-md mb-6">
                            This org hasn't created any decisions yet. Be the first to propose something!
                        </p>
                    </div>
                )}
            </div>
        </div>
    );
}
