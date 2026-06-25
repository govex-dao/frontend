import { Helmet } from "react-helmet-async";
import { useState, useMemo } from "react";
import { Coins, File, Star, SlidersHorizontal, Loader2, type LucideIcon } from "lucide-react";
import { ProposalCard } from "@/components/proposal/Card";
import { Select } from "@/components/inputs/Select";
import { Button } from "@/components/inputs/Button";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { useFavorites } from "@/hooks/useFavorites";
import { FilterDrawer } from "@/components/FilterDrawer";
import { useProposalsDisplay, useDAOsDisplay } from "@/hooks/api";
import type { ProposalDisplay, DAODisplay } from "@/types";

type FilterType = "all" | "favorites" | "active";

function FilterButton({
    filterKey,
    label,
    Icon,
    activeKey,
    onClick,
}: {
    filterKey: FilterType;
    label: string;
    Icon?: LucideIcon;
    activeKey: FilterType;
    onClick: (key: FilterType) => void;
}) {
    const isActive = activeKey === filterKey;
    return (
        <button
            onClick={() => onClick(filterKey)}
            className={`cursor-pointer p-3 py-2.5 rounded-md text-xs font-medium transition-all flex items-center gap-1.5 ${isActive ? "bg-primary/20 text-primary hover:bg-primary/30" : "bg-card-elevated hover:bg-card-more-elevated text-text-tertiary hover:text-text-primary"}`}
        >
            {Icon && (
                <Icon
                    className={`w-3 h-3 transition-colors ${isActive ? "text-primary fill-primary" : "text-text-tertiary"}`}
                />
            )}
            {label}
        </button>
    );
}

export function Proposals() {
    const [filter, setFilter] = useState<FilterType>("all");
    const [selectedDaoId, setSelectedDaoId] = useState<string | null>(null);
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { favorites } = useFavorites();

    const { data: proposals, isLoading: proposalsLoading, error: proposalsError } = useProposalsDisplay();
    const { data: daos } = useDAOsDisplay();

    const filteredAndSortedProposals = useMemo(() => {
        if (!proposals) return [];
        let filtered = [...proposals];

        // Apply filter
        if (filter === "favorites") {
            filtered = filtered.filter((p: ProposalDisplay) => favorites.includes(p.daoId));
        } else if (filter === "active") {
            filtered = filtered.filter((p: ProposalDisplay) => p.status === "active");
        }

        // Filter by DAO
        if (selectedDaoId) {
            filtered = filtered.filter((p: ProposalDisplay) => p.daoId === selectedDaoId);
        }

        // Sort by date (most recent first)
        filtered.sort((a: ProposalDisplay, b: ProposalDisplay) =>
            b.timestamp.getTime() - a.timestamp.getTime()
        );

        return filtered;
    }, [proposals, filter, favorites, selectedDaoId]);

    const filterContent = (
        <div className="space-y-6">
            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Filter</h3>
                <div className="flex flex-col gap-2">
                    <FilterButton filterKey="all" label="All" activeKey={filter} onClick={setFilter} />
                    <FilterButton filterKey="active" label="Active" Icon={Coins} activeKey={filter} onClick={setFilter} />
                    <FilterButton filterKey="favorites" label="Favorites" Icon={Star} activeKey={filter} onClick={setFilter} />
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Organization</h3>
                <Select
                    allowClear={true}
                    allowSearch={true}
                    value={selectedDaoId || undefined}
                    onChange={(value) => setSelectedDaoId(value || null)}
                    placeholder="All Orgs"
                    options={
                        daos?.map((dao: DAODisplay) => ({
                            label: dao.name,
                            value: dao.id,
                        })) || []
                    }
                />
            </div>

        </div>
    );

    if (proposalsError) {
        return (
            <div className="route-container h-full flex flex-col items-center justify-center gap-4">
                <p className="text-red-400">Failed to load proposals</p>
                <p className="text-text-muted text-sm">{proposalsError.message}</p>
            </div>
        );
    }

    return (
        <div className="route-container gap-2 min-h-full pb-6">
            <Helmet>
                <title>Decision Markets</title>
            </Helmet>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Decision Markets" }]} />

            {/* Header */}
            <div className="flex flex-col sm:flex-row items-start justify-between gap-4 mb-4">
                <h1>Decision Markets</h1>
                <div className="flex items-center gap-2 w-full sm:w-auto">
                    <Button
                        onClick={() => setIsDrawerOpen(true)}
                        variant="secondary"
                        className="lg:hidden flex-1 sm:flex-none"
                    >
                        <SlidersHorizontal className="w-4 h-4 mr-2" />
                        Filters
                    </Button>
                </div>
            </div>

            {/* Main Layout with Sidebar */}
            <div className="flex gap-6 flex-1">
                {/* Left Sidebar - Filters & Sort (Desktop) */}
                <div className="glass-flow-panel hidden w-72 shrink-0 self-start rounded-xl p-4 lg:block">
                    {filterContent}
                </div>

                {/* Filter Drawer (Mobile) */}
                <FilterDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
                    {filterContent}
                </FilterDrawer>

                {/* Main Content - Proposals List */}
                <div className="flex-1 overflow-x-hidden space-y-2">
                    {proposalsLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        filteredAndSortedProposals.map((proposal: ProposalDisplay) => (
                            <ProposalCard key={proposal.id} proposal={proposal} />
                        ))
                    )}

                    {/* Empty State */}
                    {!proposalsLoading && filteredAndSortedProposals.length === 0 && (
                        <div className="glass-flow-panel flex flex-col items-center justify-center gap-2 rounded-xl px-6 py-24">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                <File className="w-10 h-10 text-text-disabled" />
                            </div>
                            <h3>No Decision Markets Found</h3>
                            <p className="text-text-muted text-center max-w-md">
                                {filter === "favorites"
                                    ? "No markets from your favorite orgs."
                                    : filter === "active"
                                      ? "No active markets at the moment."
                                      : "No markets found. Check back soon!"}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
