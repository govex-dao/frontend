import { Helmet } from "react-helmet-async";
import { useState, useMemo } from "react";
import { motion } from "motion/react";
import { Star, Building, SlidersHorizontal, Loader2, type LucideIcon } from "lucide-react";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Select } from "@/components/inputs/Select";
import { OrgCard } from "@/components/org/Card";
import { useFavorites } from "@/hooks/useFavorites";
import { FilterDrawer } from "@/components/FilterDrawer";
import { Button } from "@/components/inputs/Button";
import { useDAOsDisplay } from "@/hooks/api";
import type { DAODisplay } from "@/types";

type FilterType = "all" | "favorites";
type SortType = "proposals" | "date";

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

export function Orgs() {
    const [filter, setFilter] = useState<FilterType>("all");
    const [sort, setSort] = useState<SortType>("proposals");
    const [isDrawerOpen, setIsDrawerOpen] = useState(false);
    const { favorites, isFavorited, toggleFavorite } = useFavorites();

    const { data: daos, isLoading, error } = useDAOsDisplay();

    const filteredAndSortedDaos = useMemo(() => {
        if (!daos) return [];
        let filtered = [...daos];

        // Apply filter
        if (filter === "favorites") {
            filtered = filtered.filter((dao: DAODisplay) => favorites.includes(dao.id));
        }

        // Apply sort
        filtered.sort((a: DAODisplay, b: DAODisplay) => {
            // Favorited DAOs appear first
            const aFav = favorites.includes(a.id);
            const bFav = favorites.includes(b.id);
            if (aFav && !bFav) return -1;
            if (!aFav && bFav) return 1;

            switch (sort) {
                case "proposals":
                    return (b.proposalCount ?? 0) - (a.proposalCount ?? 0);
                case "date":
                    return (b.createdAt?.getTime() ?? 0) - (a.createdAt?.getTime() ?? 0);
                default:
                    return 0;
            }
        });

        return filtered;
    }, [daos, filter, sort, favorites]);

    const filterContent = (
        <div className="space-y-6">
            <div className="space-y-3">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Filter</p>
                <div className="flex flex-col gap-2">
                    <FilterButton filterKey="all" label="All" activeKey={filter} onClick={setFilter} />
                    <FilterButton filterKey="favorites" label="Favorites" Icon={Star} activeKey={filter} onClick={setFilter} />
                </div>
            </div>

            <div className="space-y-3">
                <p className="text-xs font-semibold text-text-tertiary uppercase tracking-wider">Sort By</p>
                <Select
                    allowClear={false}
                    allowSearch={false}
                    value={sort}
                    onChange={(value) => setSort(value as SortType)}
                    options={[
                        { label: "Proposal Count", value: "proposals" },
                        { label: "Creation Date", value: "date" },
                    ]}
                />
            </div>
        </div>
    );

    if (error) {
        return (
            <div className="route-container h-full flex flex-col items-center justify-center gap-4">
                <p className="text-red-400">Failed to load orgs</p>
                <p className="text-text-muted text-sm">{error.message}</p>
            </div>
        );
    }

    return (
        <div className="route-container min-h-full flex flex-col gap-3 pb-6">
            <Helmet>
                <title>Orgs</title>
            </Helmet>
            <Breadcrumbs items={[{ label: "Home", href: "/" }, { label: "Orgs" }]} />

            <div className="flex flex-col sm:flex-row items-start justify-between gap-4">
                <h1>Orgs</h1>
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
                <div className="hidden lg:block w-72 shrink-0">{filterContent}</div>

                {/* Filter Drawer (Mobile) */}
                <FilterDrawer isOpen={isDrawerOpen} onClose={() => setIsDrawerOpen(false)}>
                    {filterContent}
                </FilterDrawer>

                {/* Main Content - DAOs Grid */}
                <div className="flex-1 overflow-x-hidden">
                    {isLoading ? (
                        <div className="flex items-center justify-center py-24">
                            <Loader2 className="w-8 h-8 animate-spin text-primary" />
                        </div>
                    ) : (
                        <motion.div layout className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-3">
                            {filteredAndSortedDaos.map((dao: DAODisplay) => (
                                <OrgCard
                                    key={dao.id}
                                    dao={dao}
                                    isFavorited={isFavorited(dao.id)}
                                    onToggleFavorite={toggleFavorite}
                                />
                            ))}
                        </motion.div>
                    )}

                    {/* Empty State */}
                    {!isLoading && filteredAndSortedDaos.length === 0 && (
                        <div className="flex flex-col items-center justify-center py-24">
                            <div className="w-20 h-20 rounded-full bg-white/5 flex items-center justify-center mb-6">
                                <Building className="w-10 h-10 text-text-disabled" />
                            </div>
                            <h3 className="mb-2">No Orgs Found</h3>
                            <p className="text-text-muted text-center max-w-md">
                                {filter === "favorites"
                                    ? "You haven't favorited any orgs yet. Add orgs to your favorites to see them here."
                                    : "No orgs match your current filters. Try adjusting your filter settings."}
                            </p>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
