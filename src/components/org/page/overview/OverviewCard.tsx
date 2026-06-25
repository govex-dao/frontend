import type { ReactNode } from "react";
import type { LucideIcon } from "lucide-react";
import { ChevronRight } from "lucide-react";
import { MetricItem } from "../../../MetricItem";

interface OverviewCardProps {
    title: string;
    icon?: LucideIcon;
    mainMetricLabel: string;
    mainMetricValue: string | number;
    secondaryMetrics?: { label: string; value: string | number }[];
    headerAction?: ReactNode;
    onClick?: () => void;
    clickable?: boolean;
    badge?: ReactNode;
    backgroundItem?: ReactNode;
    className?: string;
}

export function OverviewCard({
    title,
    icon: Icon,
    mainMetricLabel,
    mainMetricValue,
    secondaryMetrics,
    headerAction,
    onClick,
    clickable = false,
    badge,
    backgroundItem,
    className,
}: OverviewCardProps) {
    const cardClasses = `
        flex flex-col h-full group min-w-[200px]
        glass-flow-panel rounded-2xl overflow-hidden
        relative shadow-sm transition-all duration-200
        ${clickable ? "cursor-pointer hover:border-border-light group" : ""}
    `.trim();

    const handleClick = () => {
        if (clickable && onClick) {
            onClick();
        }
    };

    return (
        <div className={cardClasses + " " + className} onClick={handleClick}>
            {/* Header */}
            <div className="z-20 bg-white/[0.035] px-4 py-3 flex items-center justify-between border-b border-border-light/30">
                <div className="flex items-center gap-2.5">
                    {Icon && (
                        <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                            <Icon className="w-3.5 h-3.5" />
                        </div>
                    )}
                    <div className="text-sm font-semibold text-text-light">{title}</div>
                    {badge}
                </div>
                <div className="flex items-center gap-2">
                    {headerAction && <div>{headerAction}</div>}
                    {clickable && (
                        <ChevronRight className="w-4 h-4 text-text-muted/40 group-hover:text-text-muted/60 transition-all group-hover:translate-x-1" />
                    )}
                </div>
            </div>

            {/* Content */}
            <div className="px-5 py-4 gap-3 flex flex-col justify-between relative h-full">
                {backgroundItem && <div className="absolute inset-0 z-0 opacity-40 blur-[0.5px]">{backgroundItem}</div>}
                <MetricItem
                    valueClassName="opacity-70 group-hover:opacity-100 transition-opacity"
                    size="xl"
                    label={mainMetricLabel}
                    value={mainMetricValue}
                />

                {/* Secondary Metrics - Quieter */}
                {secondaryMetrics && (
                    <div className="relative z-10 opacity-70 group-hover:opacity-100 flex-row gap-2 flex items-stretch">
                        {secondaryMetrics.map((metric) => (
                            <MetricItem
                                className="flex-1 border-r border-border-light/50 last:border-r-0"
                                key={metric.label}
                                label={metric.label}
                                value={metric.value}
                                size="sm"
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
