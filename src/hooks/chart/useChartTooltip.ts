import { useEffect } from "react";
import type { ISeriesApi, IChartApi, MouseEventParams } from "lightweight-charts";
import { TOOLTIP_STYLES } from "@/lib/chartConfig";

interface PriceFormatter {
    format: (value: number) => string;
}

interface TooltipEntry {
    value: number;
    color: string;
    title: string;
    formatter: PriceFormatter;
    isDashed?: boolean;
}

interface UseChartTooltipProps {
    chart: IChartApi | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
    seriesRefs: React.RefObject<ISeriesApi<"Line">[]>;
    twapSeriesRefs?: React.RefObject<ISeriesApi<"Line">[]>;
    colors: string[];
    outcomeMessages: string[];
    twaps: Array<number | null>;
    showTwap: boolean;
}

/**
 * Build tooltip content using DOM APIs (avoids innerHTML XSS from on-chain data)
 */
function buildTooltipDOM(container: HTMLElement, tooltipEntries: TooltipEntry[]): void {
    container.textContent = "";
    for (const entry of tooltipEntries) {
        const row = document.createElement("div");
        Object.assign(row.style, { display: "flex", alignItems: "center", marginBottom: "4px", fontSize: "12px" });

        const indicator = document.createElement("span");
        if (entry.isDashed) {
            Object.assign(indicator.style, {
                display: "inline-flex",
                alignItems: "center",
                width: "10px",
                height: "10px",
                marginRight: "8px",
                gap: "1px",
            });
            for (let i = 0; i < 3; i++) {
                const dot = document.createElement("span");
                Object.assign(dot.style, {
                    width: "2px",
                    height: "2px",
                    backgroundColor: entry.color,
                    borderRadius: "1px",
                });
                indicator.appendChild(dot);
            }
        } else {
            Object.assign(indicator.style, {
                display: "inline-block",
                width: "10px",
                height: "10px",
                borderRadius: "2px",
                backgroundColor: entry.color,
                marginRight: "8px",
            });
        }
        row.appendChild(indicator);

        const price = document.createElement("span");
        Object.assign(price.style, { color: "white", fontWeight: "500", marginRight: "8px" });
        price.textContent = `$${entry.formatter.format(entry.value)}`;
        row.appendChild(price);

        const title = document.createElement("span");
        Object.assign(title.style, { color: "#D1D5DB", fontWeight: "500" });
        title.textContent = entry.title;
        row.appendChild(title);

        container.appendChild(row);
    }
}

/**
 * Calculate tooltip position to keep it within chart bounds
 */
function calculateTooltipPosition(
    mouseX: number,
    mouseY: number,
    tooltipWidth: number,
    tooltipHeight: number,
    chartWidth: number,
    chartHeight: number
): { left: number; top: number } {
    const yMargin = 15;
    const xMargin = 15;
    let top = mouseY + yMargin;
    let left = mouseX + xMargin;

    if (left + tooltipWidth > chartWidth) {
        left = mouseX - tooltipWidth - xMargin;
    }
    if (top + tooltipHeight > chartHeight) {
        top = mouseY - tooltipHeight - yMargin;
    }

    return { left, top };
}

/**
 * Hook to manage chart tooltip display and interactions
 */
export function useChartTooltip({
    chart,
    containerRef,
    seriesRefs,
    twapSeriesRefs,
    colors,
    outcomeMessages,
    twaps,
    showTwap,
}: UseChartTooltipProps) {
    useEffect(() => {
        if (!chart || !containerRef.current) return;

        // Create tooltip element
        const toolTip = document.createElement("div");
        Object.assign(toolTip.style, TOOLTIP_STYLES);
        containerRef.current.appendChild(toolTip);

        const crosshairMoveHandler = (param: MouseEventParams) => {
            if (
                param.point === undefined ||
                !param.time ||
                !containerRef.current ||
                param.point.x < 0 ||
                param.point.x > containerRef.current.clientWidth ||
                param.point.y < 0 ||
                param.point.y > containerRef.current.clientHeight
            ) {
                toolTip.style.display = "none";
            } else {
                toolTip.style.display = "block";

                const tooltipEntries: TooltipEntry[] = [];

                // Add series data to tooltip
                param.seriesData.forEach((dataPoint, seriesApi) => {
                    const seriesIndex = seriesRefs.current.indexOf(seriesApi as ISeriesApi<"Line">);
                    if (seriesIndex > -1 && dataPoint && "value" in dataPoint) {
                        tooltipEntries.push({
                            value: dataPoint.value as number,
                            color: colors[seriesIndex],
                            title: outcomeMessages[seriesIndex],
                            formatter: seriesApi.priceFormatter(),
                            isDashed: false,
                        });
                    }

                    if (showTwap && twapSeriesRefs?.current) {
                        const twapIndex = twapSeriesRefs.current.indexOf(seriesApi as ISeriesApi<"Line">);
                        if (twapIndex > -1 && dataPoint && "value" in dataPoint) {
                            tooltipEntries.push({
                                value: dataPoint.value as number,
                                color: colors[twapIndex],
                                title: `${outcomeMessages[twapIndex]} TWAP`,
                                formatter: { format: (val: number) => val.toFixed(6) },
                                isDashed: true,
                            });
                        }
                    }
                });

                const hasHistoricalTwapAtCursor = tooltipEntries.some((entry) => entry.isDashed);

                // Fallback to current TWAP when the chart only has a flat current-value line.
                if (showTwap && !hasHistoricalTwapAtCursor) {
                    twaps.forEach((twap, index) => {
                        if (twap == null || twap <= 0) {
                            return;
                        }
                        tooltipEntries.push({
                            value: twap,
                            color: colors[index],
                            title: `${outcomeMessages[index]} TWAP`,
                            formatter: { format: (val: number) => val.toFixed(6) },
                            isDashed: true,
                        });
                    });
                }

                // Sort by value descending
                tooltipEntries.sort((a, b) => b.value - a.value);

                // Generate and set tooltip content
                buildTooltipDOM(toolTip, tooltipEntries);

                // Position tooltip
                const chartWidth = containerRef.current.clientWidth;
                const chartHeight = containerRef.current.clientHeight;
                const toolTipWidth = toolTip.offsetWidth;
                const toolTipHeight = toolTip.offsetHeight;

                const { left, top } = calculateTooltipPosition(
                    param.point.x,
                    param.point.y,
                    toolTipWidth,
                    toolTipHeight,
                    chartWidth,
                    chartHeight
                );

                toolTip.style.left = left + "px";
                toolTip.style.top = top + "px";
            }
        };

        chart.subscribeCrosshairMove(crosshairMoveHandler);

        return () => {
            chart.unsubscribeCrosshairMove(crosshairMoveHandler);
            if (toolTip.parentNode) {
                toolTip.parentNode.removeChild(toolTip);
            }
        };
    }, [chart, containerRef, seriesRefs, twapSeriesRefs, colors, outcomeMessages, twaps, showTwap]);
}
