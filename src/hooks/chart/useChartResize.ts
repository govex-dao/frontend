import { useEffect } from "react";
import type { IChartApi } from "lightweight-charts";

interface UseChartResizeProps {
    chart: IChartApi | null;
    containerRef: React.RefObject<HTMLDivElement | null>;
}

/**
 * Hook to handle chart resizing on container resize and window resize
 */
export function useChartResize({ chart, containerRef }: UseChartResizeProps) {
    useEffect(() => {
        if (!containerRef.current || !chart) return;

        const resizeChart = () => {
            if (chart && containerRef.current) {
                const { clientWidth, clientHeight } = containerRef.current;
                chart.applyOptions({
                    width: clientWidth,
                    height: clientHeight,
                });
            }
        };

        const resizeObserver = new ResizeObserver(resizeChart);

        if (containerRef.current) {
            resizeObserver.observe(containerRef.current);
        }

        window.addEventListener("resize", resizeChart);

        return () => {
            window.removeEventListener("resize", resizeChart);
            resizeObserver.disconnect();
        };
    }, [chart, containerRef]);
}
