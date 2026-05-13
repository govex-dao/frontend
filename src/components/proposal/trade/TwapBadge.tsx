import { Tooltip } from "@/components/overlays/Tooltip";
import { getOutcomeColor, getOutcomeClass, hexToRgba } from "@/lib/outcomes";
import { formatNumber } from "@/lib/formatNumber";
import { Check } from "@/components/badges/Check";

interface TwapBadgeProps {
    outcome: string;
    twap: number | null;
    volume: number;
    outcomeIndex: number;
    totalOutcomes: number;
    isWinning?: boolean;
    onClick?: () => void;
    nextTwap?: number | null; // TWAP of the next outcome to show difference
    isEnded?: boolean; // Whether the proposal has ended
    likelihood?: number | null; // Likelihood percentage (0-100) for this outcome winning
    isExecuted?: boolean;
    sponsorshipType?: number;
    sponsoredThresholdLabel?: string;
}

export function TwapBadge(props: TwapBadgeProps) {
    const {
        outcome,
        twap,
        volume,
        outcomeIndex,
        totalOutcomes,
        isWinning = false,
        onClick,
        nextTwap,
        isEnded = false,
        isExecuted = false,
        sponsorshipType = 0,
        sponsoredThresholdLabel = "0%",
    } = props;
    const color = getOutcomeColor(outcomeIndex, totalOutcomes, "normal");
    const lightColor = getOutcomeColor(outcomeIndex, totalOutcomes, "light");
    const bgClass = getOutcomeClass(outcomeIndex, totalOutcomes, "normal");

    // Calculate percentage difference for display (lead over next outcome)
    const hasTwap = twap !== null;
    const percentageDifference =
        hasTwap && nextTwap != null && nextTwap > 0 ? ((twap - nextTwap) / nextTwap) * 100 : null;
    const isSponsored = sponsorshipType > 0;
    const sponsorshipLabel = isSponsored ? `Sponsored ${sponsoredThresholdLabel}` : null;
    const sponsorshipDescription = isSponsored
        ? `Sponsorship reduces this outcome's TWAP threshold by ${sponsoredThresholdLabel}.`
        : null;

    const tooltipMetrics = [
        {
            label: "TWAP",
            value: hasTwap ? `$${formatNumber(twap)}` : "N/A",
            className: "font-mono font-semibold text-text-primary",
        },
        ...(percentageDifference !== null
            ? [
                  {
                      label: "Lead",
                      value: `+${formatNumber(percentageDifference)}%`,
                      className: "font-mono font-bold text-sm",
                      color: "#10b981",
                      highlight: true,
                  },
              ]
            : []),
        ...(sponsorshipLabel
            ? [
                  {
                      label: "Sponsorship",
                      value: sponsorshipLabel,
                      className: "font-mono font-semibold text-warning-light",
                  },
              ]
            : []),
        {
            label: "Volume",
            value: `$${formatNumber(volume)}`,
            className: "font-mono font-semibold text-text-primary",
        },
    ];

    const tooltipContent = (
        <div className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
                <div className={`w-2 h-2 rounded-full ${bgClass}`} />
                <span className="font-semibold text-sm uppercase tracking-wide" style={{ color }}>
                    {outcome}
                </span>
            </div>
            <div className="flex flex-col gap-1.5 text-xs border-t border-border/30 pt-2">
                {tooltipMetrics.map((metric) => (
                    <div key={metric.label} className={`flex items-center justify-between gap-10`}>
                        <p className={`text-xs text-text-tertiary`}>{metric.label}</p>
                        <span className={metric.className} style={metric.color ? { color: metric.color } : undefined}>
                            {metric.value}
                        </span>
                    </div>
                ))}
            </div>
            {isWinning && !isEnded && (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-success/15 text-success">
                    <Check className="w-3 h-3 text-success shrink-0" />
                    <span>Winning outcome</span>
                </div>
            )}
            {isWinning && isEnded && (
                <div className="flex items-center gap-1.5 text-xs font-medium px-2 py-1 rounded bg-success/15 text-success">
                    <Check className="w-3 h-3 text-success shrink-0" />
                    <span>{isExecuted ? "Executed outcome" : "Winning outcome"}</span>
                </div>
            )}
            {sponsorshipDescription && (
                <div className="text-xs px-2 py-1 rounded bg-warning/10 text-warning-light">
                    {sponsorshipDescription}
                </div>
            )}
        </div>
    );

    return (
        <Tooltip content={tooltipContent} position="bottom">
            <div
                onClick={onClick}
                className={`flex items-center gap-1.5 px-2 py-0.5 border rounded text-[11px] transition-colors ${
                    !isWinning ? "border-border/50 bg-card-elevated hover:bg-card-more-elevated" : ""
                } ${onClick ? "cursor-pointer" : ""}`}
                style={
                    isWinning
                        ? {
                              borderColor: hexToRgba(color, 0.2),
                              backgroundColor: hexToRgba(color, 0.1),
                          }
                        : undefined
                }
            >
                <div className={`w-1.5 h-1.5 rounded-full ${bgClass}`} />
                <span className="uppercase tracking-wide" style={{ color: isWinning ? color : "#FFFFFF90" }}>
                    {outcome}
                </span>
                {sponsorshipLabel && (
                    <span className="text-[10px] font-semibold text-warning-light bg-warning/10 border border-warning/20 rounded px-1 py-0.5">
                        {sponsorshipLabel}
                    </span>
                )}
                <span
                    className="font-mono font-medium text-text-secondary"
                    style={{ color: isWinning ? lightColor : undefined }}
                >
                    {hasTwap ? `$${formatNumber(twap)}` : "--"}
                </span>
                {percentageDifference !== null && percentageDifference > 0 && (
                    <span
                        className={`font-mono text-xs font-bold px-1 py-0.5 rounded -mr-1.5`}
                        style={{ backgroundColor: lightColor + "40", color: lightColor }}
                    >
                        +{formatNumber(percentageDifference)}%
                    </span>
                )}
            </div>
        </Tooltip>
    );
}
