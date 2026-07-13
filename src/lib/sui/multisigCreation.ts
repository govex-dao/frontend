export function formatSuiFee(mist: bigint | null): string {
    if (mist === null) return "Loading...";
    if (mist === 0n) return "Free";

    const decimals = 1_000_000_000n;
    const whole = mist / decimals;
    const fraction = mist % decimals;
    if (fraction === 0n) return `${whole.toString()} SUI`;

    const trimmedFraction = fraction.toString().padStart(9, "0").replace(/0+$/, "");
    return `${whole.toString()}.${trimmedFraction} SUI`;
}
