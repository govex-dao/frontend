import { useNavigate } from "react-router";

import { Columns3 } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import { getTimeRemainingLabel } from "@/lib/getDaysRemaining";
import type { RaiseView } from "@/types/RaiseView";
import { getRaiseUiStatus } from "@/lib/raiseStatus";
import { Button } from "../inputs/Button";
import { LiveChip } from "../badges/LiveChip";
import { Card } from "../Card";
import { Badge } from "../Badge";

interface Props {
    raise: RaiseView;
}

export function FeaturedCard(props: Props) {
    const { raise } = props;
    const { id, name, raised, raising, raiseStart, raiseEnd, orgId, headerImage, description, maxRaise } = raise;

    const navigate = useNavigate();
    const status = getRaiseUiStatus(raise._raw);
    const isActive = status === "active";
    const goalAmount = maxRaise ?? raising;
    const goalLabel = maxRaise ? "" : "min ";
    const progress = goalAmount > 0 ? (raised / goalAmount) * 100 : 0;

    const onInvest = (e: React.MouseEvent) => {
        e.stopPropagation();
        navigate(`/raises/${id}`);
    };

    const onOrg = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (!orgId) return;
        navigate(`/orgs/${orgId}`);
    };

    return (
        <Card className="p-0! flex flex-col sm:flex-row overflow-hidden" onClick={isActive ? onInvest : undefined}>
            <div className="relative w-full h-48 sm:h-auto sm:w-80 lg:w-96 shrink-0">
                {headerImage ? (
                    <>
                        <img src={headerImage} alt={name} className="absolute inset-0 w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-linear-to-br from-black/30 via-black/20 to-transparent" />
                    </>
                ) : (
                    <>
                        <div className="absolute inset-0 bg-linear-to-br from-primary/15 via-primary/5 to-transparent" />
                        <div className="absolute inset-0 engineering-grid engineering-grid-fade pointer-events-none" />
                        <div className="absolute inset-0 flex items-center justify-center">
                            <div className="w-16 h-16 rounded-xl bg-primary/15 border border-primary/30 backdrop-blur-sm flex items-center justify-center">
                                <Columns3 className="w-5 h-5 text-primary" />
                            </div>
                        </div>
                    </>
                )}
            </div>

            {/* Right: Content */}
            <div className="flex-1 p-4 sm:p-6 flex flex-col gap-3 sm:gap-4">
                {/* Header */}
                <div className="flex-1 space-y-2">
                    <div className="flex items-start justify-between gap-2">
                        <h3>{name}</h3>
                        {status === "active" ? (
                            <LiveChip color="green" size="large" animated />
                        ) : status === "funded" ? (
                            <Badge variant="green">Funded</Badge>
                        ) : status === "finalizing" ? (
                            <Badge variant="blue">Finalizing</Badge>
                        ) : status === "upcoming" ? (
                            <Badge variant="blue">Upcoming</Badge>
                        ) : (
                            <Badge variant="gray">Ended</Badge>
                        )}
                    </div>
                    <p className="text-sm sm:text-base text-text-muted text-left line-clamp-2 sm:line-clamp-none">
                        {description}
                    </p>
                </div>

                <div className="space-y-1">
                    {/* Amount info */}
                    <div className="flex flex-row items-baseline justify-between gap-2">
                        <div className="flex items-baseline gap-2 sm:gap-3">
                            <p className="text-2xl sm:text-3xl font-bold">${formatNumber(raised)}</p>
                            <p className="text-sm sm:text-base text-text-muted">of {goalLabel}${formatNumber(goalAmount)}</p>
                        </div>
                        <p className="text-sm sm:text-base">{Math.round(progress)}%</p>
                    </div>

                    {/* Progress bar */}
                    <div className="w-full bg-white/5 rounded-full h-2 sm:h-3 overflow-hidden">
                        <div
                            className="bg-linear-to-r from-primary to-primary-light h-full transition-all duration-500"
                            style={{ width: `${Math.min(progress, 100)}%` }}
                        />
                    </div>
                </div>

                {/* Footer */}
                <div className="flex items-center justify-between">
                    <p className="text-sm sm:text-base text-text-muted font-medium">
                        {status === "active"
                            ? getTimeRemainingLabel(raiseEnd)
                            : status === "upcoming"
                              ? `Starts ${raiseStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })}`
                              : status === "finalizing"
                                ? "Finalizing onchain"
                                : status === "funded"
                                  ? "Funding complete"
                                  : "Funding ended"}
                    </p>
                    {status === "active" ? (
                        <Button onClick={onInvest} innerLink>
                            Invest
                        </Button>
                    ) : status === "funded" && orgId ? (
                        <Button onClick={onOrg} variant="outline" innerLink>
                            See Org
                        </Button>
                    ) : (
                        <Button onClick={onInvest} variant="outline" innerLink>
                            See Raise
                        </Button>
                    )}
                </div>
            </div>
        </Card>
    );
}
