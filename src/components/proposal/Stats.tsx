import { TrendingUp, ArrowLeftRight, Clock } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { formatNumber } from "@/lib/formatNumber";
import { Badge } from "@/components/Badge";
import { Card } from "../Card";
import { MetricItem } from "../MetricItem";

interface MetricBadgeProps {
    icon?: LucideIcon;
    value: string | number;
    label: string;
    className?: string;
}

export function MetricBadge({ icon: Icon, value, label, className = "" }: MetricBadgeProps) {
    const displayValue = typeof value === "number" ? formatNumber(value) : value;

    return (
        <Badge variant="elevated" className={` ${className}`}>
            {Icon && <Icon className="w-3 h-3" />}
            <span className="font-mono font-medium text-text-primary">{displayValue}</span>
            <span className="text-text-tertiary text-nowrap">{label}</span>
        </Badge>
    );
}

interface ProposalStatsProps {
    volume: number;
    traderCount: number;
    timeRemaining?: string;
    className?: string;
    ended?: string;
    statusText?: string;
    /** Label for the time column (e.g. "Trading Ends In", "Exec Ends In") */
    timeLabel?: string;
}

export function ProposalStats({
    volume,
    traderCount,
    timeRemaining,
    ended,
    statusText,
    className = "",
    timeLabel,
}: ProposalStatsProps) {
    return (
        <Card variant="glass" className={`grid grid-cols-3 gap-2 flex-wrap text-xs ${className}`}>
            <MetricItem label="Volume" value={formatNumber(volume)} size="lg" />
            <MetricItem label="Trades" value={traderCount} size="lg" />
            {ended ? (
                <MetricItem label="Ended" value={ended} size="lg" valueClassName="whitespace-pre-wrap" />
            ) : (
                <MetricItem label={timeLabel || "Ends In"} value={timeRemaining || 0} size="lg" />
            )}
            {statusText && (
                <div className="col-span-3 mt-1 border-t border-border/40 pt-3">
                    <p className="text-lg font-bold tracking-tight text-text-primary">{statusText}</p>
                </div>
            )}
        </Card>
    );
}

export function ProposalStatsCompact({ volume, traderCount, timeRemaining, className = "" }: ProposalStatsProps) {
    return (
        <div className={`flex flex-row gap-1 flex-wrap text-xs ${className}`}>
            {timeRemaining && (
                <Badge variant="elevated">
                    <Clock className="w-3 h-3 text-purple-400" />
                    <span className="text-[10px] sm:text-xs font-medium text-text-secondary whitespace-nowrap">
                        Ends in <span className="text-text-primary font-semibold">{timeRemaining}</span>
                    </span>
                </Badge>
            )}
            <MetricBadge icon={TrendingUp} value={`$${formatNumber(volume)}`} label="Volume" />
            <MetricBadge icon={ArrowLeftRight} value={traderCount} label="Trades" />
        </div>
    );
}
