import { useEffect, useRef, useState, useCallback } from "react";
import { createChart } from "lightweight-charts";
import type { IChartApi } from "lightweight-charts";
import { getChartConfig } from "@/lib/chartConfig";

/**
 * Hook to create and manage a lightweight chart instance
 * @param containerRef - Reference to the container element
 * @returns Chart instance (null until created)
 */
export function useChartInstance(containerRef: React.RefObject<HTMLDivElement | null>) {
    const [chart, setChart] = useState<IChartApi | null>(null);
    const chartRef = useRef<IChartApi | null>(null);
    const observerRef = useRef<ResizeObserver | null>(null);

    const createChartInstance = useCallback(() => {
        if (!containerRef.current || chartRef.current) return false;

        const width = containerRef.current.clientWidth;
        const height = containerRef.current.clientHeight;

        // Don't create chart if container has no dimensions
        if (width === 0 || height === 0) return false;

        const config = getChartConfig(width, height);
        const chartInstance = createChart(containerRef.current, config);
        chartRef.current = chartInstance;
        setChart(chartInstance);
        return true;
    }, [containerRef]);

    useEffect(() => {
        if (!containerRef.current) return;

        // Try to create immediately if container has dimensions
        const created = createChartInstance();

        // If chart wasn't created (no dimensions yet), watch for when container gets dimensions
        if (!created && containerRef.current) {
            observerRef.current = new ResizeObserver((entries) => {
                const entry = entries[0];
                if (entry && entry.contentRect.width > 0 && entry.contentRect.height > 0) {
                    if (createChartInstance()) {
                        observerRef.current?.disconnect();
                    }
                }
            });
            observerRef.current.observe(containerRef.current);
        }

        return () => {
            observerRef.current?.disconnect();
            if (chartRef.current) {
                chartRef.current.remove();
                chartRef.current = null;
                setChart(null);
            }
        };
    }, [createChartInstance]);

    return chart;
}
