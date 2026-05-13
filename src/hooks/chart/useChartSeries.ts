import { useEffect, useRef } from "react";
import { LineSeries } from "lightweight-charts";
import type { ISeriesApi, Time, LineSeriesPartialOptions, IChartApi } from "lightweight-charts";
import { hexToRgba } from "@/lib/outcomes";

interface ChartDataPoint {
    time: number;
    [key: string]: number | null;
}

interface OutcomeInfo {
    message: string;
    twap: number | null;
    price: number;
}

interface UseChartSeriesProps {
    chart: IChartApi | null;
    chartData: ChartDataPoint[];
    outcomes: OutcomeInfo[];
    colors: string[];
    twaps: Array<number | null>;
    twapChartData?: ChartDataPoint[];
    selectedOutcome?: number;
    showTwap: boolean;
}

/**
 * Calculate opacity for series based on selection state
 */
function calculateSeriesOpacity(seriesIndex: number, selectedOutcome?: number): number {
    if (selectedOutcome === undefined) return 1;
    return seriesIndex === selectedOutcome ? 1 : 0.7;
}

function removeSeriesList(chart: IChartApi, seriesList: ISeriesApi<"Line">[]) {
    seriesList.forEach((series) => {
        try {
            chart.removeSeries(series);
        } catch {
            /* ignore */
        }
    });
}

function getSpotSeriesData(chartData: ChartDataPoint[], outcomeIndex: number) {
    return chartData.flatMap((point) => {
        const value = point[`market${outcomeIndex}`];
        if (value == null) return [];
        return [{ time: point.time as Time, value }];
    });
}

function getTwapSeriesData(
    chartData: ChartDataPoint[],
    twapChartData: ChartDataPoint[] | undefined,
    twap: number | null,
    outcomeIndex: number
) {
    const historyPoints = (twapChartData ?? []).flatMap((point) => {
        const value = point[`market${outcomeIndex}`];
        if (value == null) return [];
        return [{ time: point.time as Time, value }];
    });

    if (historyPoints.length >= 2) {
        return historyPoints;
    }

    const fallbackValue = twap ?? historyPoints[0]?.value ?? null;
    if (fallbackValue == null || fallbackValue <= 0 || chartData.length === 0) {
        return [];
    }

    return [
        { time: chartData[0].time as Time, value: fallbackValue },
        { time: chartData[chartData.length - 1].time as Time, value: fallbackValue },
    ];
}

/**
 * Hook to manage chart series (outcome price lines and TWAP lines)
 */
export function useChartSeries({
    chart,
    chartData,
    outcomes,
    colors,
    twaps,
    twapChartData,
    selectedOutcome,
    showTwap,
}: UseChartSeriesProps) {
    const seriesRefs = useRef<ISeriesApi<"Line">[]>([]);
    const twapSeriesRefs = useRef<ISeriesApi<"Line">[]>([]);
    const hasCreatedSeries = useRef(false);
    const outcomeCount = outcomes.length;

    // Create/remove series only when the chart structure changes.
    useEffect(() => {
        if (!chart || outcomeCount === 0) return;

        removeSeriesList(chart, seriesRefs.current);
        removeSeriesList(chart, twapSeriesRefs.current);
        seriesRefs.current = [];
        twapSeriesRefs.current = [];

        // Create series for each outcome (solid lines - spot price)
        seriesRefs.current = Array.from({ length: outcomeCount }, (_, i) => {
            const opacity = calculateSeriesOpacity(i, selectedOutcome);
            const color = hexToRgba(colors[i] ?? "#60a5fa", opacity);

            const seriesOptions: LineSeriesPartialOptions = {
                lineWidth: 2,
                priceLineVisible: false,
                priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
                color: color,
            };

            const lineSeries = chart.addSeries(LineSeries, seriesOptions);
            return lineSeries;
        });

        // Create TWAP lines (dashed). Data is applied in a separate effect.
        twapSeriesRefs.current = Array.from({ length: outcomeCount }, (_, i) => {
            const opacity = calculateSeriesOpacity(i, selectedOutcome);
            const color = hexToRgba(colors[i] ?? "#60a5fa", opacity);

            const twapSeriesOptions: LineSeriesPartialOptions = {
                lineWidth: 1,
                lineStyle: 3, // dashed
                priceLineVisible: false,
                priceFormat: { type: "price", precision: 6, minMove: 0.000001 },
                color: color,
                lastValueVisible: false,
                visible: showTwap,
            };

            return chart.addSeries(LineSeries, twapSeriesOptions);
        });

        hasCreatedSeries.current = true;

        return () => {
            removeSeriesList(chart, seriesRefs.current);
            removeSeriesList(chart, twapSeriesRefs.current);
            seriesRefs.current = [];
            twapSeriesRefs.current = [];
            hasCreatedSeries.current = false;
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps -- colors, selectedOutcome, and showTwap are handled by separate effects.
    }, [chart, outcomeCount]);

    // Update spot data without recreating the chart series.
    useEffect(() => {
        if (!chart || !hasCreatedSeries.current) return;

        seriesRefs.current.forEach((series, i) => {
            series.setData(getSpotSeriesData(chartData, i));
        });
    }, [chart, chartData]);

    // Update TWAP data without touching the spot series or time scale.
    useEffect(() => {
        if (!chart || !hasCreatedSeries.current) return;

        twapSeriesRefs.current.forEach((series, i) => {
            series.setData(getTwapSeriesData(chartData, twapChartData, twaps[i] ?? null, i));
        });
    }, [chart, chartData, twapChartData, twaps]);

    // Separate effect to update series colors when selectedOutcome changes
    useEffect(() => {
        if (!hasCreatedSeries.current) return;

        seriesRefs.current.forEach((series, i) => {
            const opacity = calculateSeriesOpacity(i, selectedOutcome);
            const color = hexToRgba(colors[i] ?? "#60a5fa", opacity);
            series.applyOptions({ color });
        });

        twapSeriesRefs.current.forEach((series, i) => {
            const opacity = calculateSeriesOpacity(i, selectedOutcome);
            const color = hexToRgba(colors[i] ?? "#60a5fa", opacity);
            series.applyOptions({ color });
        });
    }, [selectedOutcome, colors]);

    // Effect to toggle TWAP visibility
    useEffect(() => {
        if (!hasCreatedSeries.current) return;
        twapSeriesRefs.current.forEach((series) => {
            series.applyOptions({ visible: showTwap });
        });
    }, [showTwap]);

    return { seriesRefs, twapSeriesRefs };
}
