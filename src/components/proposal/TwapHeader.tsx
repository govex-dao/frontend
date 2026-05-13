import { Info } from "lucide-react";
import type { PageOutcome } from "@/lib/proposalAdapter";
import { Tooltip } from "@/components/overlays/Tooltip";
import { TwapBadge } from "@/components/proposal/trade/TwapBadge";

export interface OutcomeWithIndex extends PageOutcome {
    originalIndex: number;
}

interface TwapHeaderProps {
    sortedOutcomes: OutcomeWithIndex[];
    totalOutcomes: number;
    isEnded: boolean;
    isExecuted: boolean;
    winningOutcomeIndex: number | null;
    twapThresholdLabel: string;
    twapDelayLabel: string;
    twapDelayCaption: string;
    twapDelayLive: boolean;
    sponsorshipTypes: number[];
    sponsoredThresholdLabel: string;
    phaseCountdown?: string;
    phaseCountdownCaption?: string;
    phaseCountdownDone?: boolean;
    onOutcomeClick: (index: number) => void;
}

function signedPositivePercent(label: string): string {
    if (label.startsWith("+") || label.startsWith("-") || label === "0%") return label;
    return `+${label}`;
}

export function TwapHeader({
    sortedOutcomes,
    totalOutcomes,
    isEnded,
    isExecuted,
    winningOutcomeIndex,
    twapThresholdLabel,
    twapDelayLabel,
    twapDelayCaption,
    twapDelayLive,
    sponsorshipTypes,
    sponsoredThresholdLabel,
    phaseCountdown,
    phaseCountdownCaption,
    phaseCountdownDone,
    onOutcomeClick,
}: TwapHeaderProps) {
    return (
        <div className="-mb-2 gap-2 sticky top-10 z-20 flex flex-col px-2 sm:px-3 md:px-4 py-2 border border-border/50 rounded bg-card-elevated shrink-0">
            <div className="flex flex-col sm:flex-row items-start sm:items-center flex-wrap justify-between gap-2 sm:gap-3">
                <div className="flex items-center gap-2 text-xs sm:text-[11px] flex-wrap">
                    <div className="flex items-center gap-1.5">
                        <span className="text-text-tertiary/70 font-medium uppercase text-[10px] sm:text-xs">
                            Base TWAP Threshold
                        </span>
                        <Tooltip
                            content={
                                <div className="flex flex-col gap-1.5">
                                    <div className="font-semibold text-sm">TWAP Threshold</div>
                                    <div className="text-xs text-text-secondary whitespace-normal">
                                        Unsponsored accept outcomes must beat reject TWAP by this threshold.
                                    </div>
                                </div>
                            }
                            position="bottom"
                            className="w-64"
                        >
                            <Info className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-text-tertiary/50 hover:text-text-tertiary transition-colors" />
                        </Tooltip>
                    </div>
                    <span className="text-text-primary font-bold text-xs sm:text-sm">
                        {signedPositivePercent(twapThresholdLabel)}
                    </span>
                    <div className="ml-2 rounded-md border border-border/40 bg-card px-2 py-1">
                        <div className="text-[10px] uppercase tracking-wide text-text-tertiary">{twapDelayCaption}</div>
                        <div
                            className={`font-mono tabular-nums text-sm tracking-[0.08em] ${
                                twapDelayLive ? "text-success-light" : "text-text-primary"
                            }`}
                        >
                            {twapDelayLabel}
                        </div>
                    </div>
                    {phaseCountdown && (
                        <div className="ml-1 rounded-md border border-border/40 bg-card px-2 py-1">
                            <div className="text-[10px] uppercase tracking-wide text-text-tertiary">
                                {phaseCountdownCaption}
                            </div>
                            <div
                                className={`font-mono tabular-nums text-sm tracking-[0.08em] ${
                                    phaseCountdownDone ? "text-amber-400" : "text-text-primary"
                                }`}
                            >
                                {phaseCountdown}
                            </div>
                        </div>
                    )}
                </div>

                <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap w-full sm:w-auto">
                    {sortedOutcomes.map((outcome, index) => (
                        <TwapBadge
                            key={index}
                            outcome={outcome.message}
                            twap={outcome.twap}
                            volume={outcome.volume || 0}
                            outcomeIndex={outcome.originalIndex}
                            totalOutcomes={totalOutcomes}
                            isWinning={winningOutcomeIndex === outcome.originalIndex}
                            sponsorshipType={sponsorshipTypes[outcome.originalIndex] ?? 0}
                            sponsoredThresholdLabel={sponsoredThresholdLabel}
                            onClick={() => onOutcomeClick(outcome.originalIndex)}
                            nextTwap={index < sortedOutcomes.length - 1 ? sortedOutcomes[index + 1].twap : undefined}
                            isEnded={isEnded}
                            likelihood={outcome.likelihood}
                            isExecuted={isExecuted}
                        />
                    ))}
                </div>
            </div>
        </div>
    );
}
