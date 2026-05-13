/**
 * Parse a decimal string amount to bigint with the given decimals.
 * Avoids floating point precision issues by operating on strings directly.
 *
 * Examples:
 *   parseAmountToBigInt("1.005", 9)  → 1005000000n
 *   parseAmountToBigInt("0.1", 6)    → 100000n
 *   parseAmountToBigInt("100", 9)    → 100000000000n
 */
export function parseAmountToBigInt(amount: string, decimals: number): bigint {
    if (!amount || amount === "0" || amount === "") return 0n;

    // Remove leading/trailing whitespace
    const trimmed = amount.trim();
    if (trimmed === "" || trimmed === ".") return 0n;

    const [whole = "0", fraction = ""] = trimmed.split(".");

    // Truncate fraction to max decimals, then pad with zeros
    const truncated = fraction.slice(0, decimals);
    const padded = truncated.padEnd(decimals, "0");

    const combined = whole + padded;

    // Remove leading zeros (but keep at least one digit)
    const cleaned = combined.replace(/^0+/, "") || "0";

    return BigInt(cleaned);
}
