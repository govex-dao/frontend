import { ColorType, PriceScaleMode, TickMarkType } from "lightweight-charts";
import type { DeepPartial, ChartOptions, Time } from "lightweight-charts";

/**
 * Get the base configuration for a lightweight chart
 * @param width - Chart width in pixels
 * @param height - Chart height in pixels
 * @returns Chart configuration object
 */
export function getChartConfig(width: number, height: number): DeepPartial<ChartOptions> {
    return {
        width,
        height,
        layout: {
            background: { type: ColorType.Solid, color: "transparent" },
            textColor: "#ffffff70",
            fontSize: 14,
            attributionLogo: false,
        },
        grid: {
            horzLines: { color: "rgba(255, 255, 255, 0.05)" },
            vertLines: { color: "rgba(255, 255, 255, 0.05)" },
        },
        crosshair: {
            horzLine: {
                visible: false,
                labelVisible: false,
            },
            vertLine: {
                visible: true,
                labelVisible: true,
                style: 0,
                color: "rgba(255, 255, 255, 0.16)",
                width: 1,
            },
        },

        kineticScroll: {},
        timeScale: {
            timeVisible: true,
            secondsVisible: false,
            borderColor: "transparent",
            rightOffset: 0,
            // Keeping both edges fixed lets lightweight-charts compress MAX data onto narrow mobile screens.
            fixLeftEdge: true,
            fixRightEdge: true,
            lockVisibleTimeRangeOnResize: true,
            rightBarStaysOnScroll: false,
            tickMarkFormatter: (time: Time, tickType: TickMarkType, locale: string) => {
                const date = new Date((time as number) * 1000);
                const hours = date.getUTCHours().toString().padStart(2, "0");
                const minutes = date.getUTCMinutes().toString().padStart(2, "0");
                switch (tickType) {
                    case TickMarkType.DayOfMonth:
                        return date.toLocaleDateString(locale, {
                            day: "numeric",
                            month: "short",
                            timeZone: "UTC",
                        });
                    case TickMarkType.Time:
                        return `${hours}:${minutes}`;
                    default:
                        return `${date.getUTCFullYear()}-${(date.getUTCMonth() + 1).toString().padStart(2, "0")}-${date.getUTCDate().toString().padStart(2, "0")}`;
                }
            },
        },
        autoSize: true,
        rightPriceScale: {
            borderColor: "transparent",
            autoScale: true,
            mode: PriceScaleMode.Normal,
            minimumWidth: 50,
            scaleMargins: { top: 0.1, bottom: 0.1 },
        },
        handleScroll: {
            mouseWheel: true,
            pressedMouseMove: true,
            horzTouchDrag: true,
            vertTouchDrag: false,
        },
        handleScale: {
            mouseWheel: true,
            pinch: true,
            axisPressedMouseMove: true,
            axisDoubleClickReset: true,
        },
    };
}

/**
 * Tooltip styling constants
 */
export const TOOLTIP_STYLES = {
    position: "absolute",
    display: "none",
    padding: "8px",
    boxSizing: "border-box",
    fontSize: "14px",
    textAlign: "left",
    zIndex: "1000",
    top: "12px",
    left: "12px",
    pointerEvents: "none",
    fontFamily: "inherit",
    backgroundColor: "rgba(0, 0, 0, 0.75)",
    border: "1px solid rgba(255, 255, 255, 0.1)",
    borderRadius: "8px",
    color: "rgb(209, 213, 219)",
    backdropFilter: "blur(12px)",
} as const;
