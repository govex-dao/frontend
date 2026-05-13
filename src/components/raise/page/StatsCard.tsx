import { ChevronRight } from "lucide-react";
import { Card, CardContent } from "@/components/Card";
import { formatNumber } from "@/lib/formatNumber";
import { getTimeRemainingLabel } from "@/lib/getDaysRemaining";
import { MetricItem } from "@/components/MetricItem";
import type { RaiseUiStatus } from "@/lib/raiseStatus";
import type { RaiseView } from "@/types/RaiseView";

interface Props {
    raise: RaiseView;
    isEnded: boolean;
    status: RaiseUiStatus;
    contributorCount?: number;
    setIsInvestorsModalOpen: (isOpen: boolean) => void;
}

export function StatsCards(props: Props) {
    const { raise, isEnded, status, contributorCount = 0, setIsInvestorsModalOpen } = props;
    const upcomingCountdown = getTimeRemainingLabel(raise.raiseStart);
    const startsIn = upcomingCountdown === "Ended" ? "Starting soon" : upcomingCountdown.replace(/ left$/, "");
    const startAtLabel = raise.raiseStart.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
    });

    return (
        <div className="flex flex-row gap-1">
            <Card
                className="flex-1 cursor-pointer hover:border-primary/30 transition-colors"
                onClick={() => setIsInvestorsModalOpen(true)}
            >
                <CardContent className="flex items-center justify-between">
                    <MetricItem label="Investors" value={formatNumber(contributorCount)} size="lg" />
                    <ChevronRight className="w-5 h-5 text-white/40" />
                </CardContent>
            </Card>

            <Card className="flex-1">
                <CardContent className="h-full">
                    {status === "upcoming" ? (
                        <div className="space-y-1">
                            <MetricItem label="Starts in" value={startsIn} size="lg" />
                            <p className="text-xs text-white/40">{startAtLabel}</p>
                        </div>
                    ) : isEnded ? (
                        <MetricItem
                            label="Date Ended"
                            value={raise.raiseEnd.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                                year: "numeric",
                            })}
                            size="lg"
                            valueClassName="text-sm"
                        />
                    ) : (
                        <MetricItem label="Time left" value={getTimeRemainingLabel(raise.raiseEnd)} size="lg" />
                    )}
                </CardContent>
            </Card>
        </div>
    );
}
