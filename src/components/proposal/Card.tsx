import { useState, type CSSProperties } from "react";
import { useNavigate, useLocation } from "react-router";
import { ChevronRight } from "lucide-react";
import type { ProposalDisplay } from "@/types";
import { Card, CardContent } from "../Card";

interface Props {
    proposal: ProposalDisplay;
    className?: string;
    style?: CSSProperties;
    joined?: boolean;
}

export function ProposalCard(props: Props) {
    const { proposal, className = "", style, joined = false } = props;
    const { pathname } = useLocation();
    const navigate = useNavigate();
    const [daoIconError, setDaoIconError] = useState(false);

    const isOrgPage = pathname.includes("/orgs/");

    const handleCardClick = () => {
        navigate(`/orgs/${proposal.daoId}/proposals/${proposal.id}`);
    };

    const handleOrgClick = (e: React.MouseEvent) => {
        e.preventDefault();
        e.stopPropagation();
        navigate(`/orgs/${proposal.daoId}`);
    };

    // Determine status display
    const isActive = proposal.status === "active";
    const isPending = proposal.status === "pending";
    const isEnded = proposal.status === "passed" || proposal.status === "failed";
    const cardOuterClasses = joined
        ? "group/proposal w-full overflow-visible transition-colors duration-200"
        : "group/proposal w-full [&:has(button:hover)]:bg-transparent overflow-visible transition-all duration-200";
    const orgButtonHoverClass = joined ? "hover:text-primary" : "hover:text-text-primary";
    const orgTextHoverClass = joined ? "group-hover/proposal:text-primary" : "";
    const orgButtonClasses = joined
        ? "inline-flex max-w-full items-center gap-3 text-left text-lg font-semibold leading-tight"
        : "inline-flex max-w-full items-center gap-2 text-left";
    const orgIconClasses = joined ? "size-8 text-sm" : "size-6 text-[11px]";
    const orgNameClasses = joined ? "text-text-primary" : "text-text-muted";

    // Determine card styling based on status
    let cardClasses = "";
    let titleClasses = "text-lg font-semibold text-left leading-tight";
    let detailsClasses = "text-sm";

    if (joined) {
        cardClasses =
            "!bg-transparent hover:!bg-transparent active:!bg-transparent focus:!bg-transparent !shadow-none !border-border hover:!border-border-light";
        titleClasses += " text-text-primary";
        titleClasses +=
            " transition-colors group-hover/proposal:text-primary group-active/proposal:text-primary-light group-focus/proposal:text-primary";
        detailsClasses += " text-text-secondary";
    } else if (isEnded) {
        cardClasses = "hover:border-border-light";
        titleClasses += " text-text-secondary";
        detailsClasses += " text-text-muted";
    } else if (isPending) {
        cardClasses = "glass-flow-panel-accent";
        titleClasses += " text-text-primary";
        detailsClasses += " text-text-secondary";
    } else if (isActive) {
        cardClasses = "glass-flow-panel-accent";
        titleClasses += " text-text-primary";
        detailsClasses += " text-text-secondary";
    } else {
        cardClasses = "hover:border-border-light";
        titleClasses += " text-text-primary";
        detailsClasses += " text-text-secondary";
    }

    const orgButton = !isOrgPage ? (
        <button
            className={`${orgButtonClasses} ${orgButtonHoverClass} transition-colors ${joined ? "" : detailsClasses}`}
            onClick={handleOrgClick}
        >
            <span
                className={`flex ${orgIconClasses} shrink-0 items-center justify-center overflow-hidden rounded-full bg-primary/10 font-semibold text-primary ring-1 ring-white/10`}
            >
                {proposal.daoIconUrl && !daoIconError ? (
                    <img
                        src={proposal.daoIconUrl}
                        alt={`${proposal.daoName} logo`}
                        className="h-full w-full object-cover"
                        loading="lazy"
                        decoding="async"
                        onError={() => setDaoIconError(true)}
                    />
                ) : (
                    proposal.daoName.slice(0, 1).toUpperCase()
                )}
            </span>
            <span className={`truncate ${orgNameClasses} transition-colors ${orgTextHoverClass}`}>
                {proposal.daoName}
            </span>
            <ChevronRight className={`size-3 shrink-0 text-text-muted transition-colors ${orgTextHoverClass}`} />
        </button>
    ) : null;

    return (
        <Card
            key={proposal.id}
            variant={joined ? "default" : "glass"}
            interactive
            className={`${cardOuterClasses} ${cardClasses} ${className}`}
            onClick={handleCardClick}
            style={style}
        >
            <CardContent className="space-y-3 overflow-visible">
                <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 flex-1 space-y-2">
                        {joined && orgButton}
                        <h3 className={titleClasses}>{proposal.title}</h3>
                        {!joined && orgButton}
                    </div>
                    <StatusLabel status={proposal.status} joined={joined} />
                </div>
            </CardContent>
        </Card>
    );
}

function StatusLabel({ status, joined = false }: { status: ProposalDisplay["status"]; joined?: boolean }) {
    switch (status) {
        case "active":
            return (
                <div
                    className={`inline-flex shrink-0 items-center gap-2 font-semibold uppercase tracking-wide text-text-muted ${
                        joined ? "mt-1 text-sm" : "text-xs"
                    }`}
                >
                    <span className={`${joined ? "size-2.5" : "size-2"} rounded-full bg-green-400`} />
                    LIVE
                </div>
            );
        case "pending":
            return (
                <span className="shrink-0 text-xs font-semibold uppercase tracking-wide text-text-muted">PENDING</span>
            );
        case "passed":
            return (
                <span className="shrink-0 text-sm sm:text-xs font-semibold uppercase tracking-wide text-green-400">
                    PASSED
                </span>
            );
        case "failed":
            return (
                <span className="shrink-0 text-sm sm:text-xs font-semibold uppercase tracking-wide text-red-400">
                    REJECTED
                </span>
            );
        default:
            return null;
    }
}
