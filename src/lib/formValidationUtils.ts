import toast from "react-hot-toast";

/**
 * Displays validation errors in a consistent way across all creation forms
 */
export function showValidationErrors(errors: string[]) {
    const errorCount = errors.length;
    const message = `Please complete all required fields (${errorCount} error${errorCount > 1 ? "s" : ""})`;

    toast.error(message, {
        duration: 4000,
    });
}

/**
 * Helper to check if a tab has any errors
 */
export function hasTabError(tabIndex: number, tabErrors: Record<number, boolean>): boolean {
    return tabErrors[tabIndex] === true;
}

/**
 * Helper to get the first tab with errors
 */
export function getFirstErrorTab(tabErrors: Record<number, boolean>): number | null {
    const errorTabs = Object.entries(tabErrors)
        .filter(([, hasError]) => hasError)
        .map(([tab]) => parseInt(tab, 10))
        .sort((a, b) => a - b);

    return errorTabs.length > 0 ? errorTabs[0] : null;
}
