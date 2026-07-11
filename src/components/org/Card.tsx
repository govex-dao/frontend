import { useState } from "react";
import { motion } from "motion/react";
import { Link } from "react-router";
import { StarIcon } from "lucide-react";
import type { DAODisplay } from "@/types";
import { VerifiedBadge } from "../badges/VerifiedBadge";
import { useOrgMarketCap } from "@/hooks/useOrgMarketCap";

interface Props {
    dao: DAODisplay;
    isFavorited: boolean;
    onToggleFavorite: (daoId: string) => void;
}

export function OrgCard(props: Props) {
    const { dao, isFavorited, onToggleFavorite } = props;
    const { id, name, description, iconUrl, verified, proposalCount, createdAt } = dao;
    const [imgError, setImgError] = useState(false);
    const { data: marketCap } = useOrgMarketCap(dao);

    const onFavoriteClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        onToggleFavorite(dao.id);
    };

    const GridElement = ({ title, value }: { title: string; value: string | number }) => (
        <div>
            <p className="text-[10px] text-text-muted mb-1">{title}</p>
            <p className="text-sm font-medium">{value}</p>
        </div>
    );

    const createdAtDate = createdAt
        ? createdAt.toLocaleDateString("en-US", { month: "short", year: "numeric" })
        : "N/A";

    return (
        <motion.div layout>
            <Link
                to={`/orgs/${id}`}
                className="group glass-flow-panel rounded-xl p-5 transition-all flex flex-col gap-2 items-start h-full"
            >
                {/* Header with logo, name, and actions */}
                <div className="flex justify-between items-start gap-3 w-full">
                    <div className="w-18 h-18 shrink-0">
                        {iconUrl && !imgError ? (
                            <img
                                src={iconUrl}
                                alt={`${name} logo`}
                                width={72}
                                height={72}
                                className="w-full h-full object-cover rounded-xl"
                                loading="lazy"
                                decoding="async"
                                onError={() => setImgError(true)}
                            />
                        ) : (
                            <div className="w-full h-full flex items-center justify-center text-2xl font-bold bg-linear-to-br from-primary/20 to-primary-light/10 text-primary rounded-xl">
                                {name[0]}
                            </div>
                        )}
                    </div>

                    <button
                        onClick={onFavoriteClick}
                        className="p-1.5 rounded-lg hover:bg-white/10 transition-colors shrink-0"
                        title={isFavorited ? "Remove from favorites" : "Add to favorites"}
                    >
                        <StarIcon
                            className={`size-5 ${isFavorited ? "text-yellow-400" : "text-white/40"}`}
                            fill={isFavorited ? "currentColor" : "none"}
                        />
                    </button>
                </div>

                <div className="min-w-0 flex items-center gap-2">
                    <h3 className="text-xl font-bold text-text-primary group-hover:text-primary transition-colors truncate">
                        {name}
                    </h3>
                    {verified && <VerifiedBadge variant="icon" />}
                </div>
                {/* Description */}
                <p className="text-text-light text-sm leading-relaxed line-clamp-2 flex-1">
                    {description || "No description"}
                </p>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-4 pt-4 border-t border-border-subtle w-full">
                    <GridElement title="Markets" value={proposalCount ?? "N/A"} />
                    <GridElement title="MC" value={marketCap?.formatted ? `$${marketCap.formatted}` : "—"} />
                </div>

                <div className="text-[10px] text-text-muted mt-1">Created {createdAtDate}</div>
            </Link>
        </motion.div>
    );
}
