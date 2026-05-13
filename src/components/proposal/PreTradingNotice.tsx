import { Clock } from "lucide-react";
import { Card } from "@/components/Card";
import { MetricItem } from "@/components/MetricItem";
import { formatTimeUntil, type TimeRemaining } from "@/lib/time";

interface PreTradingNoticeProps {
    timeUntilReviewEnd: TimeRemaining;
    reviewEndDate: Date;
}

export function PreTradingNotice({ timeUntilReviewEnd, reviewEndDate }: PreTradingNoticeProps) {
    const formattedDate = reviewEndDate.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
        year: "numeric",
    });
    const formattedTime = reviewEndDate.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
    });
    const reviewEnded = timeUntilReviewEnd.totalMs <= 0;

    return (
        <Card className="shrink-0 bg-linear-to-br from-purple-500/10 via-purple-500/5 to-purple-600/10 border border-border-light rounded-2xl overflow-hidden relative">
            <div className="relative z-10 p-6 sm:py-8 sm:px-4 flex flex-col items-center justify-center gap-6 text-center">
                <div className="relative">
                    <div className="relative flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full bg-purple-500/10 border border-purple-400/20">
                        <Clock className="w-8 h-8 sm:w-10 sm:h-10 text-purple-400/80" />
                    </div>
                </div>

                {/* Main countdown */}
                <div className="space-y-4 w-full">
                    <MetricItem
                        label={reviewEnded ? "Ready To Advance" : "Review Ends In"}
                        value={reviewEnded ? "Now" : formatTimeUntil(timeUntilReviewEnd)}
                        size="3xl"
                        className="flex flex-col items-center"
                        valueClassName="text-white"
                    />

                    {/* Date info */}
                    <div className="pt-2">
                        <p className="text-sm sm:text-base text-purple-300/60 font-medium">
                            {formattedDate} · {formattedTime}
                        </p>
                    </div>
                </div>
            </div>
        </Card>
    );
}
