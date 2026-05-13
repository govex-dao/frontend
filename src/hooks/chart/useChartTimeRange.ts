import { useState, useRef, useEffect, useCallback } from "react";
import type { RefObject } from "react";
import type { IChartApi, Time } from "lightweight-charts";

export type TimeRange = "1H" | "4H" | "1D" | "MAX";

interface DataTimeRange {
    start: number;
    end: number;
}

const RANGE_DURATIONS: Record<Exclude<TimeRange, "MAX">, number> = {
    "1H": 3600,
    "4H": 4 * 3600,
    "1D": 24 * 3600,
};

const FALLBACK_MAX_DURATION_SEC = 7 * 24 * 60 * 60;

/**
 * Add a small amount of whitespace before the first point so the first tick/line
 * is not pinned to the chart edge after programmatic range changes.
 */
function getLeftPaddingSec(dataRange: DataTimeRange): number {
    const span = Math.max(dataRange.end - dataRange.start, 1);
    return Math.min(Math.max(Math.floor(span * 0.02), 60), 30 * 60);
}

function getMinVisibleStart(dataRange?: DataTimeRange): number {
    if (!dataRange) {
        return Math.floor(Date.now() / 1000) - FALLBACK_MAX_DURATION_SEC;
    }
    return dataRange.start - getLeftPaddingSec(dataRange);
}

function getMaxVisibleEnd(dataRange?: DataTimeRange): number {
    return dataRange?.end ?? Math.floor(Date.now() / 1000);
}

function getVisibleRangeForSelection(range: TimeRange, dataRange?: DataTimeRange): { from: number; to: number } {
    const endTime = getMaxVisibleEnd(dataRange);
    const minStart = getMinVisibleStart(dataRange);

    if (range === "MAX") {
        return { from: minStart, to: endTime };
    }

    return {
        from: Math.max(endTime - RANGE_DURATIONS[range], minStart),
        to: endTime,
    };
}

interface UseChartTimeRangeProps {
    chart: IChartApi | null;
    dataRange?: DataTimeRange;
    dataVersion?: string | number;
    initialRange?: TimeRange;
    containerRef?: RefObject<HTMLDivElement | null>;
}

/**
 * Hook to manage chart time range selection and visibility
 */
export function useChartTimeRange({
    chart,
    dataRange,
    dataVersion,
    initialRange = "MAX",
    containerRef,
}: UseChartTimeRangeProps) {
    const [selectedRange, setSelectedRange] = useState<TimeRange | null>(initialRange);
    const isProgrammaticChangeRef = useRef(false);
    const programmaticUntilRef = useRef(0);
    const userInteractionUntilRef = useRef(0);

    const markProgrammaticChange = useCallback(() => {
        isProgrammaticChangeRef.current = true;
        programmaticUntilRef.current = Date.now() + 250;
    }, []);

    const handleRangeSelect = (range: TimeRange) => {
        setSelectedRange(range);
        if (!chart) return;

        markProgrammaticChange();
        const { from, to } = getVisibleRangeForSelection(range, dataRange);

        chart.timeScale().setVisibleRange({
            from: from as Time,
            to: to as Time,
        });
    };

    useEffect(() => {
        const container = containerRef?.current;
        if (!container) return;

        const markUserInteraction = () => {
            userInteractionUntilRef.current = Date.now() + 750;
        };
        const options: AddEventListenerOptions = { passive: true };

        container.addEventListener("pointerdown", markUserInteraction, options);
        container.addEventListener("touchstart", markUserInteraction, options);
        container.addEventListener("wheel", markUserInteraction, options);

        return () => {
            container.removeEventListener("pointerdown", markUserInteraction);
            container.removeEventListener("touchstart", markUserInteraction);
            container.removeEventListener("wheel", markUserInteraction);
        };
    }, [containerRef]);

    // Subscribe to visible logical range changes to detect user interaction
    useEffect(() => {
        if (!chart) return;

        const visibleLogicalRangeChangeHandler = () => {
            if (isProgrammaticChangeRef.current || Date.now() < programmaticUntilRef.current) {
                isProgrammaticChangeRef.current = false;
                return;
            }

            // Get the current visible time range
            const timeScale = chart.timeScale();
            const visibleRange = timeScale.getVisibleRange();

            if (visibleRange) {
                const maxEnd = getMaxVisibleEnd(dataRange);
                const minStart = getMinVisibleStart(dataRange);
                const fromTime = visibleRange.from as number;
                const toTime = visibleRange.to as number;
                const rangeDuration = toTime - fromTime;
                const maxRangeDuration = maxEnd - minStart;

                let needsCorrection = false;
                let newFrom = fromTime;
                let newTo = toTime;

                if (rangeDuration >= maxRangeDuration) {
                    newFrom = minStart;
                    newTo = maxEnd;
                    needsCorrection = true;
                } else {
                    // If user scrolled past the latest chart point/current time.
                    if (toTime > maxEnd) {
                        newTo = maxEnd;
                        newFrom = maxEnd - rangeDuration;
                        needsCorrection = true;
                    }

                    // If user scrolled before the first chart point.
                    if (fromTime < minStart) {
                        newFrom = minStart;
                        newTo = minStart + rangeDuration;
                        needsCorrection = true;
                    }
                }

                // Apply correction if needed
                if (needsCorrection) {
                    markProgrammaticChange();
                    timeScale.setVisibleRange({
                        from: newFrom as Time,
                        to: newTo as Time,
                    });
                }
            }

            if (Date.now() < userInteractionUntilRef.current) {
                setSelectedRange(null);
            }
        };

        chart.timeScale().subscribeVisibleLogicalRangeChange(visibleLogicalRangeChangeHandler);

        return () => {
            chart.timeScale().unsubscribeVisibleLogicalRangeChange(visibleLogicalRangeChangeHandler);
        };
    }, [chart, dataRange, markProgrammaticChange]);

    // Apply initial range when chart is ready
    useEffect(() => {
        if (!chart || !selectedRange) return;

        markProgrammaticChange();
        const { from, to } = getVisibleRangeForSelection(selectedRange, dataRange);

        try {
            chart.timeScale().setVisibleRange({
                from: from as Time,
                to: to as Time,
            });
        } catch {
            // Chart may not have data yet, ignore
            isProgrammaticChangeRef.current = false;
        }
    }, [chart, dataRange, dataVersion, selectedRange, markProgrammaticChange]);

    return {
        selectedRange,
        handleRangeSelect,
    };
}
