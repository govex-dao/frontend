/**
 * Utility functions for handling outcome colors across the application
 *
 * Rules:
 * - 2 outcomes: Use success (green) for accept/pass, error (red) for reject/fail
 * - 3+ outcomes: First outcome is error (red), rest use outcome colors (no green)
 */

/**
 * Convert a hex color to rgba format
 * @param hex - Hex color string (e.g., "#ff0000")
 * @param alpha - Alpha value between 0 and 1
 * @returns rgba color string
 */
export function hexToRgba(hex: string, alpha: number): string {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Color values matching index.css theme
export const OUTCOME_COLORS = {
    success: "#00d492",
    successLight: "#4ade80",
    error: "#ef4444",
    errorLight: "#f87171",
    outcome0: "#3b82f6", // Blue
    outcome0Light: "#60a5fa",
    outcome1: "#8b5cf6", // Purple
    outcome1Light: "#a78bfa",
    outcome2: "#ec4899", // Pink
    outcome2Light: "#f472b6",
    outcome3: "#f59e0b", // Amber
    outcome3Light: "#fbbf24",
    outcome4: "#06b6d4", // Cyan
    outcome4Light: "#22d3ee",
    outcome5: "#6366f1", // Indigo
    outcome5Light: "#818cf8",
} as const;

// Tailwind class names for outcome colors
export const OUTCOME_CLASSES = {
    success: "bg-success",
    successLight: "bg-success-light",
    error: "bg-error",
    errorLight: "bg-error-light",
    outcome0: "bg-outcome-0",
    outcome0Light: "bg-outcome-0-light",
    outcome1: "bg-outcome-1",
    outcome1Light: "bg-outcome-1-light",
    outcome2: "bg-outcome-2",
    outcome2Light: "bg-outcome-2-light",
    outcome3: "bg-outcome-3",
    outcome3Light: "bg-outcome-3-light",
    outcome4: "bg-outcome-4",
    outcome4Light: "bg-outcome-4-light",
    outcome5: "bg-outcome-5",
    outcome5Light: "bg-outcome-5-light",
} as const;

/**
 * Get the color for an outcome based on its index and total number of outcomes
 * @param index - The outcome index (0-based)
 * @param totalOutcomes - Total number of outcomes
 * @param variant - Color variant: 'normal' or 'light'
 * @returns Hex color string
 */
export function getOutcomeColor(index: number, totalOutcomes: number, variant: "normal" | "light" = "normal"): string {
    if (totalOutcomes === 2) {
        // For binary outcomes: success (index 0) and error (index 1)
        if (index === 0) {
            return variant === "light" ? OUTCOME_COLORS.errorLight : OUTCOME_COLORS.error;
        }
        return variant === "light" ? OUTCOME_COLORS.successLight : OUTCOME_COLORS.success;
    }

    // For 3+ outcomes: first is always error, rest use outcome colors
    if (index === 0) {
        return variant === "light" ? OUTCOME_COLORS.errorLight : OUTCOME_COLORS.error;
    }

    // Map remaining indices to outcome colors (cycling if needed)
    const outcomeIndex = (index - 1) % 6;
    const suffix = variant === "light" ? "Light" : "";
    const key = `outcome${outcomeIndex}${suffix}` as keyof typeof OUTCOME_COLORS;
    return OUTCOME_COLORS[key];
}

/**
 * Get the Tailwind class name for an outcome
 * @param index - The outcome index (0-based)
 * @param totalOutcomes - Total number of outcomes
 * @param variant - Color variant: 'normal' or 'light'
 * @returns Tailwind class string
 */
export function getOutcomeClass(index: number, totalOutcomes: number, variant: "normal" | "light" = "normal"): string {
    if (totalOutcomes === 2) {
        if (index === 0) {
            return variant === "light" ? OUTCOME_CLASSES.errorLight : OUTCOME_CLASSES.error;
        }
        return variant === "light" ? OUTCOME_CLASSES.successLight : OUTCOME_CLASSES.success;
    }

    if (index === 0) {
        return variant === "light" ? OUTCOME_CLASSES.errorLight : OUTCOME_CLASSES.error;
    }

    const outcomeIndex = (index - 1) % 6;
    const suffix = variant === "light" ? "Light" : "";
    const key = `outcome${outcomeIndex}${suffix}` as keyof typeof OUTCOME_CLASSES;
    return OUTCOME_CLASSES[key];
}

/**
 * Get all colors for a set of outcomes
 * @param totalOutcomes - Total number of outcomes
 * @param variant - Color variant: 'normal' or 'light'
 * @returns Array of hex color strings
 */
export function getOutcomeColors(totalOutcomes: number, variant: "normal" | "light" = "normal"): string[] {
    return Array.from({ length: totalOutcomes }, (_, i) => getOutcomeColor(i, totalOutcomes, variant));
}

/**
 * Get all Tailwind classes for a set of outcomes
 * @param totalOutcomes - Total number of outcomes
 * @param variant - Color variant: 'normal' or 'light'
 * @returns Array of Tailwind class strings
 */
export function getOutcomeClasses(totalOutcomes: number, variant: "normal" | "light" = "normal"): string[] {
    return Array.from({ length: totalOutcomes }, (_, i) => getOutcomeClass(i, totalOutcomes, variant));
}
