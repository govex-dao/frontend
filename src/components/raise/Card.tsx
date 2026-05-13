import { useNavigate } from "react-router";

import { formatNumber } from "@/lib/formatNumber";
import { getTimeRemainingLabel } from "@/lib/getDaysRemaining";
import { getRaiseUiStatus } from "@/lib/raiseStatus";
import type { RaiseView } from "@/types/RaiseView";
import { Button } from "../inputs/Button";
import { LiveChip } from "../badges/LiveChip";
import { FeaturedCard } from "./FeaturedCard";
import { Card } from "../Card";
import { Badge } from "../Badge";

interface RaiseCardProps {
    raise: RaiseView;
    variant?: "featured" | "compact";
}

export function RaiseCard(props: RaiseCardProps) {
    const { raise, variant = "compact" } = props;
    const { id, name, raised, raising, raiseStart, raiseEnd, orgId, description, image, maxRaise } = raise;

    const navigate = useNavigate();
    const status = getRaiseUiStatus(raise._raw);
    const isActive = status === "active";
    const isFunded = status === "funded";
    const isFinalizing = status === "finalizing";
    const isUpcoming = status === "upcoming";
    const goalAmount = maxRaise ?? raising;
    const goalLabel = maxRaise ? "" : "min ";
    const progress = goalAmount > 0 ? (raised / goalAmount) * 100 : 0;

    const onInvestClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/raises/${id}`);
    };

    const onOrgClick = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/orgs/${orgId}`);
    };

    // Featured variant - delegate to FeaturedCard
    if (variant === "featured") {
        return <FeaturedCard raise={raise} />;
    }

    return (
        <Card
            className={`relative flex flex-col ${!isActive && "opacity-70"}`}
            onClick={isActive ? onInvestClick : undefined}
        >
            {/* Header with logo and status */}
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                    {/* Logo */}
                    <div
                        className={`w-8 h-8 rounded-lg flex items-center justify-center overflow-hidden ${isActive ? "bg-primary/20" : "bg-white/10"}`}
                    >
                        {image ? (
                            <img src={image} alt={name} className="w-full h-full object-cover" />
                        ) : (
                            <span className={`text-sm font-semibold ${isActive ? "text-primary" : "text-text-light"}`}>
                                {name[0]}
                            </span>
                        )}
                    </div>
                    <h3
                        onClick={onInvestClick}
                        className="text-lg font-semibold text-text-primary cursor-pointer hover:text-primary hover:underline transition-colors"
                    >
                        {name}
                    </h3>
                </div>

                {isActive ? (
                    <LiveChip color="green" animated />
                ) : isFunded ? (
                    <Badge variant="green">Funded</Badge>
                ) : isFinalizing ? (
                    <Badge variant="blue">Finalizing</Badge>
                ) : isUpcoming ? (
                    <Badge variant="blue">Upcoming</Badge>
                ) : (
                    <Badge variant="gray">Ended</Badge>
                )}
            </div>

            {/* Description */}
            <div className="flex-1">
                <p className="text-sm text-text-muted mb-4 line-clamp-2 text-left">{description}</p>
            </div>

            {/* Amount info */}
            <div className="mb-2">
                {isActive ? (
                    <>
                        <div className="flex justify-between items-baseline">
                            <p className="text-sm text-text-muted">
                                <span className="text-xl font-bold text-text-primary">
                                    ${formatNumber(raised) + " "}
                                </span>
                                of ${goalLabel}${formatNumber(goalAmount)}
                            </p>
                            <div className="text-xs text-text-muted">{Math.round(progress)}%</div>
                        </div>

                        {/* Progress bar */}
                        <div className="w-full bg-white/5 rounded-full h-2 overflow-hidden mb-1">
                            <div
                                className="bg-linear-to-r from-primary to-primary-light h-full transition-all duration-500"
                                style={{
                                    width: `${Math.min(progress, 100)}%`,
                                }}
                            />
                        </div>
                    </>
                ) : isFunded ? (
                    <p className="text-sm text-text-muted mb-3">
                        <span className="text-xl font-bold text-success">
                            ${formatNumber(raise.accepted ?? raised)}
                        </span>{" "}
                        of ${formatNumber(raised)} raised
                    </p>
                ) : isFinalizing ? (
                    <p className="text-sm text-text-muted mb-3">
                        <span className="text-xl font-bold text-primary">${formatNumber(raised)}</span> raised
                    </p>
                ) : isUpcoming ? (
                    <p className="text-sm text-text-muted mb-3">
                        Opens on{" "}
                        <span className="font-semibold text-text-primary">
                            {raiseStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                        </span>
                    </p>
                ) : (
                    <p className="text-sm text-text-muted mb-3">
                        <span className="text-xl font-bold text-white/60">{Math.round(progress)}%</span> of $
                        {formatNumber(goalAmount)} {goalLabel}goal
                    </p>
                )}
            </div>

            <div className="h-px bg-white/5 rounded-full mb-4" />

            {/* Footer */}
            <div className={`flex items-center justify-between ${!isActive && "justify-end"}`}>
                {isActive && <div className="text-sm text-text-muted font-medium">{getTimeRemainingLabel(raiseEnd)}</div>}
                {isActive ? (
                    <Button onClick={onInvestClick} innerLink size="sm">
                        Invest
                    </Button>
                ) : (
                    <div className="flex items-center gap-2">
                        {isFunded && orgId && (
                            <Button onClick={onOrgClick} variant="outline" size="sm" innerLink>
                                See Org
                            </Button>
                        )}
                        <Button onClick={onInvestClick} variant="outline" size="sm" innerLink>
                            See Raise
                        </Button>
                    </div>
                )}
            </div>
        </Card>
    );
}
