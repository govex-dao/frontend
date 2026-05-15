import { useRef, useState, useMemo, useCallback, useEffect } from "react";
import { Maximize2, Minimize2, Loader2 } from "lucide-react";
import { getOutcomeColors } from "@/lib/outcomes";
import { Switch } from "@/components/inputs/Switch";
import { useChartInstance } from "@/hooks/chart/useChartInstance";
import { useChartSeries } from "@/hooks/chart/useChartSeries";
import { useChartTooltip } from "@/hooks/chart/useChartTooltip";
import { useChartTimeRange, type TimeRange } from "@/hooks/chart/useChartTimeRange";
import { useChartResize } from "@/hooks/chart/useChartResize";
import { useFullscreen } from "@/hooks/useFullscreen";
import { useProposalPriceHistory, useProposalTwapHistory } from "@/hooks/api";
import type { ConditionalPricePoint, TwapSnapshot } from "@/lib/api";

const timeframes: TimeRange[] = ["1H", "4H", "1D", "MAX"];
const INPUT_KEY_SEPARATOR = "\u001f";

interface ChartDataPoint {
    time: number;
    [key: string]: number | null; // Allow dynamic market keys like market0, market1, etc.
}

interface OutcomeInfo {
    message: string;
    twap: number | null;
    price: number;
}

interface StableChartInputs {
    key: string;
    outcomeMessages: string[];
    twaps: Record<number, string>;
    prices: Record<number, string>;
}

interface Props {
    proposalId: string;
    outcomeCount: number;
    outcomeMessages: string[];
    twaps: Record<number, string>;
    prices: Record<number, string>;
    selectedOutcome?: number;
    enableTwap?: boolean;
    extendToNow?: boolean;
    endTimestampMs?: string | number | null;
    className?: string;
}

const INTERVAL_SEC = 5 * 60; // 5-minute intervals

function getListKey(values: string[], count: number): string {
    return Array.from({ length: count }, (_, index) => values[index] ?? "").join(INPUT_KEY_SEPARATOR);
}

function getRecordKey(values: Record<number, string>, count: number): string {
    return Array.from({ length: count }, (_, index) => values[index] ?? "").join(INPUT_KEY_SEPARATOR);
}

function getChartInputKey(
    outcomeCount: number,
    outcomeMessages: string[],
    twaps: Record<number, string>,
    prices: Record<number, string>
): string {
    return [
        outcomeCount,
        getListKey(outcomeMessages, outcomeCount),
        getRecordKey(twaps, outcomeCount),
        getRecordKey(prices, outcomeCount),
    ].join(INPUT_KEY_SEPARATOR);
}

function useStableChartInputs(
    outcomeCount: number,
    outcomeMessages: string[],
    twaps: Record<number, string>,
    prices: Record<number, string>
): StableChartInputs {
    const key = getChartInputKey(outcomeCount, outcomeMessages, twaps, prices);
    const stableInputsRef = useRef<StableChartInputs | null>(null);

    if (!stableInputsRef.current || stableInputsRef.current.key !== key) {
        stableInputsRef.current = { key, outcomeMessages, twaps, prices };
    }

    return stableInputsRef.current;
}

function getDataTimeKey(data: ChartDataPoint[]): string {
    if (data.length === 0) return "0";
    return `${data.length}:${data[0].time}:${data[data.length - 1].time}`;
}

function getNearestAlignedTime(sortedTimes: number[], targetTime: number): number | null {
    if (sortedTimes.length === 0 || !Number.isFinite(targetTime)) return null;

    let low = 0;
    let high = sortedTimes.length - 1;

    while (low < high) {
        const mid = Math.floor((low + high) / 2);
        if (sortedTimes[mid] < targetTime) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }

    const nextTime = sortedTimes[low];
    const prevTime = low > 0 ? sortedTimes[low - 1] : undefined;
    if (prevTime === undefined) return nextTime;

    return Math.abs(nextTime - targetTime) < Math.abs(targetTime - prevTime) ? nextTime : prevTime;
}

function parseTimestampMs(raw: string | number | null | undefined): number | null {
    if (raw == null) return null;
    const parsed = typeof raw === "number" ? raw : Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

/**
 * Convert price history data to chart data points at regular 5-minute intervals.
 * Prices are raw AMM prices (stable/asset) and include real pool init, liquidity, swap,
 * and repricing updates. Zero-reserve oracle seed events are filtered server-side.
 */
function priceHistoryToChartData(
    pricePoints: ConditionalPricePoint[],
    outcomeCount: number,
    extendToNow: boolean,
    endTimestampMs?: string | number | null
): ChartDataPoint[] {
    if (pricePoints.length === 0 || outcomeCount === 0) return [];

    const orderedPoints = [...pricePoints].sort((a, b) => {
        const timeDiff = parseInt(a.timestamp) - parseInt(b.timestamp);
        if (timeDiff !== 0) return timeDiff;
        return a.outcome - b.outcome;
    });

    const lastPrices: Array<number | null> = Array(outcomeCount).fill(null);
    let pointIdx = 0;

    const makeChartPoint = (time: number): ChartDataPoint | null => {
        const point: ChartDataPoint = { time };
        for (let i = 0; i < outcomeCount; i++) {
            const price = lastPrices[i];
            if (price == null) return null;
            point[`market${i}`] = price;
        }
        return point;
    };

    // Seed from the first moment where every outcome has a real price.
    while (pointIdx < orderedPoints.length && lastPrices.some((price) => price == null)) {
        const point = orderedPoints[pointIdx];
        lastPrices[point.outcome] = parseFloat(point.price);
        pointIdx++;
    }

    const startSourcePoint = orderedPoints[pointIdx - 1];
    if (!startSourcePoint) return [];
    const startTimestampMs = parseInt(startSourcePoint.timestamp);
    while (pointIdx < orderedPoints.length && parseInt(orderedPoints[pointIdx].timestamp) <= startTimestampMs) {
        const point = orderedPoints[pointIdx];
        lastPrices[point.outcome] = parseFloat(point.price);
        pointIdx++;
    }

    const startPoint = makeChartPoint(Math.floor(startTimestampMs / 1000));
    if (!startPoint) return [];

    // Determine time range (seconds for lightweight-charts)
    const startTimeSec = startPoint.time;
    const lastPointSec = Math.floor(parseInt(orderedPoints[orderedPoints.length - 1].timestamp) / 1000);
    const requestedEndTimeMs = parseTimestampMs(endTimestampMs);
    const requestedEndTimeSec = requestedEndTimeMs == null ? null : Math.floor(requestedEndTimeMs / 1000);
    const liveEndTimeSec = extendToNow ? Math.floor(Date.now() / 1000) : null;
    const endTimeSec = Math.max(lastPointSec, requestedEndTimeSec ?? lastPointSec, liveEndTimeSec ?? lastPointSec);

    // Generate points at regular intervals
    const points: ChartDataPoint[] = [startPoint];

    // Start intervals from the next 5-min boundary after start
    const firstInterval = startTimeSec + INTERVAL_SEC;
    for (let t = firstInterval; t <= endTimeSec; t += INTERVAL_SEC) {
        while (pointIdx < orderedPoints.length) {
            const pointTimeSec = Math.floor(parseInt(orderedPoints[pointIdx].timestamp) / 1000);
            if (pointTimeSec > t) break;
            lastPrices[orderedPoints[pointIdx].outcome] = parseFloat(orderedPoints[pointIdx].price);
            pointIdx++;
        }

        const point = makeChartPoint(t);
        if (point) points.push(point);
    }

    // Ensure the very last price update is represented even if between intervals
    if (pointIdx < orderedPoints.length) {
        while (pointIdx < orderedPoints.length) {
            lastPrices[orderedPoints[pointIdx].outcome] = parseFloat(orderedPoints[pointIdx].price);
            pointIdx++;
        }
        const point = makeChartPoint(endTimeSec);
        if (point) points.push(point);
    }

    const lastGeneratedPoint = points[points.length - 1];
    if (lastGeneratedPoint && lastGeneratedPoint.time < endTimeSec) {
        const point = makeChartPoint(endTimeSec);
        if (point) points.push(point);
    }

    return points;
}

/**
 * Convert TWAP snapshots to chart data points.
 * Each snapshot has a timestamp and TWAP values per outcome (already human-readable from API).
 */
function twapSnapshotsToChartData(
    snapshots: TwapSnapshot[],
    outcomeCount: number,
    alignToTimes: number[] = []
): ChartDataPoint[] {
    if (snapshots.length === 0) return [];

    const sortedSnapshots = [...snapshots].sort((a, b) => parseInt(a.timestamp) - parseInt(b.timestamp));

    if (alignToTimes.length > 0) {
        const pointsByTime = new Map<number, ChartDataPoint>();

        sortedSnapshots.forEach((snapshot) => {
            const snapshotTimeSec = Math.floor(parseInt(snapshot.timestamp) / 1000);
            const timeSec = getNearestAlignedTime(alignToTimes, snapshotTimeSec);
            if (timeSec == null) return;

            const point = pointsByTime.get(timeSec) ?? { time: timeSec };
            for (let i = 0; i < outcomeCount; i++) {
                point[`market${i}`] = snapshot.twaps[i] ? parseFloat(snapshot.twaps[i]) : null;
            }
            pointsByTime.set(timeSec, point);
        });

        return Array.from(pointsByTime.values()).sort((a, b) => a.time - b.time);
    }

    return sortedSnapshots.map((snapshot) => {
        const timeSec = Math.floor(parseInt(snapshot.timestamp) / 1000);
        const point: ChartDataPoint = { time: timeSec };
        for (let i = 0; i < outcomeCount; i++) {
            point[`market${i}`] = snapshot.twaps[i] ? parseFloat(snapshot.twaps[i]) : null;
        }
        return point;
    });
}

export function Chart({
    proposalId,
    outcomeCount,
    outcomeMessages,
    twaps,
    prices,
    selectedOutcome,
    enableTwap = true,
    extendToNow = false,
    endTimestampMs,
    className = "",
}: Props) {
    const chartContainerRef = useRef<HTMLDivElement | null>(null);
    const fullscreenContainerRef = useRef<HTMLDivElement | null>(null);
    const [showTwap, setShowTwap] = useState(enableTwap);

    const { data: priceHistoryData, isLoading } = useProposalPriceHistory(proposalId);
    const { data: twapHistoryData } = useProposalTwapHistory(enableTwap ? proposalId : undefined);
    const stableInputs = useStableChartInputs(outcomeCount, outcomeMessages, twaps, prices);

    useEffect(() => {
        setShowTwap(enableTwap);
    }, [enableTwap, proposalId]);

    // Build outcomes array for chart series
    const outcomes: OutcomeInfo[] = useMemo(() => {
        const result: OutcomeInfo[] = [];
        for (let i = 0; i < outcomeCount; i++) {
            result.push({
                message: stableInputs.outcomeMessages[i] || `Outcome ${i}`,
                twap: stableInputs.twaps[i] ? parseFloat(stableInputs.twaps[i]) : null,
                price: stableInputs.prices[i] ? parseFloat(stableInputs.prices[i]) : 0,
            });
        }
        return result;
    }, [outcomeCount, stableInputs]);

    const outcomeMessagesList = useMemo(() => outcomes.map((o) => o.message), [outcomes]);
    const colors = useMemo(() => getOutcomeColors(outcomes.length), [outcomes.length]);
    const twapValues = useMemo(() => outcomes.map((o) => o.twap), [outcomes]);

    // Convert price history to chart data
    const chartData = useMemo((): ChartDataPoint[] => {
        if (!priceHistoryData?.price_points?.length) return [];
        return priceHistoryToChartData(priceHistoryData.price_points, outcomeCount, extendToNow, endTimestampMs);
    }, [priceHistoryData, outcomeCount, extendToNow, endTimestampMs]);

    const chartDataRange = useMemo(() => {
        if (chartData.length === 0) return undefined;
        return {
            start: chartData[0].time,
            end: chartData[chartData.length - 1].time,
        };
    }, [chartData]);

    // Convert TWAP history to chart data
    const chartDataTimes = useMemo(() => chartData.map((point) => point.time), [chartData]);

    const twapChartData = useMemo((): ChartDataPoint[] => {
        if (!enableTwap) return [];
        if (!twapHistoryData?.snapshots?.length) return [];
        return twapSnapshotsToChartData(twapHistoryData.snapshots, outcomeCount, chartDataTimes);
    }, [enableTwap, twapHistoryData, outcomeCount, chartDataTimes]);

    const timeScaleDataKey = useMemo(
        () => `${getDataTimeKey(chartData)}|${getDataTimeKey(twapChartData)}`,
        [chartData, twapChartData]
    );

    const hasTwapHistory = useMemo(
        () =>
            twapChartData.some((point) =>
                Array.from({ length: outcomeCount }).some((_, index) => point[`market${index}`] != null)
            ),
        [twapChartData, outcomeCount]
    );
    const hasCurrentTwap = useMemo(() => twapValues.some((value) => value != null && value > 0), [twapValues]);
    const hasAnyTwapData = enableTwap && (hasTwapHistory || hasCurrentTwap);
    const effectiveShowTwap = showTwap && hasAnyTwapData;

    const chart = useChartInstance(chartContainerRef);

    const { seriesRefs, twapSeriesRefs } = useChartSeries({
        chart,
        chartData,
        outcomes,
        colors,
        twaps: twapValues,
        twapChartData,
        selectedOutcome,
        showTwap: effectiveShowTwap,
    });

    useChartTooltip({
        chart,
        containerRef: chartContainerRef,
        seriesRefs,
        twapSeriesRefs,
        colors,
        outcomeMessages: outcomeMessagesList,
        twaps: twapValues,
        showTwap: effectiveShowTwap,
    });

    const { selectedRange, handleRangeSelect } = useChartTimeRange({
        chart,
        containerRef: chartContainerRef,
        dataRange: chartDataRange,
        dataVersion: timeScaleDataKey,
        initialRange: "MAX",
    });

    useChartResize({ chart, containerRef: chartContainerRef });

    // Handle fullscreen with chart resize callback
    const handleChartResize = useCallback(() => {
        if (chart && chartContainerRef.current) {
            const { clientWidth, clientHeight } = chartContainerRef.current;
            chart.applyOptions({
                width: clientWidth,
                height: clientHeight,
            });
        }
    }, [chart]);

    const { isFullscreen, toggleFullscreen } = useFullscreen({
        elementRef: fullscreenContainerRef,
        onResize: handleChartResize,
    });

    // Always render the container, show overlay for loading/empty states
    const showLoading = isLoading;
    const showEmpty = !isLoading && !chartData.length;
    const showChart = !isLoading && chartData.length > 0;

    return (
        <div
            ref={fullscreenContainerRef}
            className={`relative w-full h-full overflow-hidden flex flex-col ${isFullscreen ? "bg-card h-screen! w-screen!" : ""} ${className}`}
        >
            {/* Loading overlay */}
            {showLoading && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-inherit">
                    <Loader2 className="w-6 h-6 animate-spin text-text-muted" />
                </div>
            )}

            {/* Empty state overlay */}
            {showEmpty && (
                <div className="absolute inset-0 z-10 flex items-center justify-center bg-inherit">
                    <p className="text-sm text-text-muted">No trading data yet</p>
                </div>
            )}

            {/* Time range selector - only show when chart has data */}
            {showChart && (
                <div className="flex justify-between items-center px-4 py-1 border-b border-border/30 shrink-0">
                    <div className="flex items-center gap-3">
                        {enableTwap && hasAnyTwapData && (
                            <label className="flex items-center gap-2 cursor-pointer">
                                <Switch value={showTwap} onChange={setShowTwap} size="sm" />
                                <span className="text-xs font-medium text-text-secondary">TWAP</span>
                            </label>
                        )}
                    </div>
                    <div className="flex items-center gap-2">
                        <div className="flex items-center gap-1 bg-card-elevated rounded-lg p-1">
                            {timeframes.map((tf) => (
                                <button
                                    key={tf}
                                    onClick={() => handleRangeSelect(tf)}
                                    className={`px-3 py-1 rounded-md text-xs font-medium transition-all ${
                                        selectedRange === tf
                                            ? "bg-card-more-elevated text-text-primary shadow-sm"
                                            : "text-text-tertiary hover:text-text-secondary"
                                    }`}
                                >
                                    {tf}
                                </button>
                            ))}
                        </div>
                        <button
                            onClick={toggleFullscreen}
                            className="p-2 rounded-lg text-text-tertiary hover:text-text-secondary hover:bg-card-elevated transition-all"
                            title={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
                        >
                            {isFullscreen ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
                        </button>
                    </div>
                </div>
            )}

            {/* Chart container - always rendered so useChartInstance can attach */}
            <div ref={chartContainerRef} className="flex-1 min-h-0 w-full" />
        </div>
    );
}
