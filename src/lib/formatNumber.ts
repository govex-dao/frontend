export const formatNumber = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";

    if (absAmount >= 1000000) {
        // Format millions: $1.4M, $3.5M
        const millions = absAmount / 1000000;
        return `${sign}${millions % 1 === 0 ? millions.toFixed(0) : millions.toFixed(1)}M`;
    } else if (absAmount >= 1000) {
        // Format thousands: $750k, $1.2k
        const thousands = absAmount / 1000;
        return `${sign}${thousands % 1 === 0 ? thousands.toFixed(0) : thousands.toFixed(1)}k`;
    } else if (absAmount >= 1) {
        // Format amounts >= 1: $500, $42
        return `${sign}${absAmount.toFixed(0)}`;
    } else if (absAmount >= 0.01) {
        // Format cents: $0.50, $0.25
        return `${sign}${absAmount.toFixed(2)}`;
    } else if (absAmount > 0) {
        // Format very small amounts: $0.0012, $0.00045
        return `${sign}${absAmount.toFixed(4)}`;
    } else {
        // Zero
        return "0";
    }
};

export const formatNumberWithCommas = (amount: number): string => {
    const absAmount = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";

    if (absAmount >= 1) {
        // Format whole numbers with commas: 1,234, 500
        return `${sign}${absAmount.toFixed(0).replace(/\B(?=(\d{3})+(?!\d))/g, ",")}`;
    } else if (absAmount >= 0.01) {
        // Format cents: 0.50, 0.25
        return `${sign}${absAmount.toFixed(2)}`;
    } else if (absAmount > 0) {
        // Format very small amounts: 0.0012, 0.00045
        return `${sign}${absAmount.toFixed(4)}`;
    } else {
        // Zero
        return "0";
    }
};
