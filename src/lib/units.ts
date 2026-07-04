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

export function normalizeUnitsForSort(amount: bigint, decimals: number, targetDecimals = 18): bigint {
    const sourceDecimals = Math.max(0, Math.trunc(decimals));
    const normalizedTarget = Math.max(0, Math.trunc(targetDecimals));

    if (sourceDecimals === normalizedTarget) return amount;
    if (sourceDecimals > normalizedTarget) {
        return amount / 10n ** BigInt(sourceDecimals - normalizedTarget);
    }
    return amount * 10n ** BigInt(normalizedTarget - sourceDecimals);
}

function formatCompactScaled(amount: bigint, divisor: bigint): string {
    const scaled = (amount * 100n) / divisor;
    const whole = scaled / 100n;
    const fraction = scaled % 100n;
    const fractionText = fraction.toString().padStart(2, "0").replace(/0+$/, "");
    return fractionText ? `${whole}.${fractionText}` : whole.toString();
}

export function formatCompactBigInt(amount: bigint): string {
    const sign = amount < 0n ? "-" : "";
    const absolute = amount < 0n ? -amount : amount;

    if (absolute >= 1_000_000_000_000n) {
        return `${sign}${formatCompactScaled(absolute, 1_000_000_000_000n)}T`;
    }
    if (absolute >= 1_000_000_000n) {
        return `${sign}${formatCompactScaled(absolute, 1_000_000_000n)}B`;
    }
    if (absolute >= 1_000_000n) {
        return `${sign}${formatCompactScaled(absolute, 1_000_000n)}M`;
    }
    if (absolute >= 1_000n) {
        return `${sign}${formatCompactScaled(absolute, 1_000n)}K`;
    }
    return amount.toString();
}
