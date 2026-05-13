function formatWithCommas(intPart: string): string {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

export function formatUnits(
    amount: bigint,
    decimals: number,
    opts?: {
        maxFractionDigits?: number;
        trimTrailingZeros?: boolean;
        useGrouping?: boolean;
    }
): string {
    if (decimals <= 0) {
        const raw = amount.toString();
        return opts?.useGrouping === false ? raw : formatWithCommas(raw);
    }

    const raw = amount.toString();
    const padded = raw.padStart(decimals + 1, "0");
    const intPartRaw = padded.slice(0, -decimals) || "0";
    let fracPart = padded.slice(-decimals);

    const maxFractionDigits = opts?.maxFractionDigits ?? decimals;
    fracPart = fracPart.slice(0, Math.max(0, maxFractionDigits));

    if (opts?.trimTrailingZeros !== false) {
        fracPart = fracPart.replace(/0+$/, "");
    }

    const intPart = opts?.useGrouping === false ? intPartRaw : formatWithCommas(intPartRaw);
    return fracPart ? `${intPart}.${fracPart}` : intPart;
}

export function formatUnitsForInput(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals, {
        maxFractionDigits: decimals,
        trimTrailingZeros: true,
        useGrouping: false,
    });
}
