import { useEffect } from "react";

interface Props {
    valueBps: bigint;
    onChange: (bps: bigint) => void;
}

const DEFAULT_BPS = 30n;
const PRESETS_BPS: bigint[] = [10n, 30n, 100n];

function bpsToPercentString(bps: bigint): string {
    // 30n -> "0.3", 100n -> "1", 1234n -> "12.34"
    const integer = bps / 100n;
    const fraction = bps % 100n;
    if (fraction === 0n) return integer.toString();
    const fracStr = fraction.toString().padStart(2, "0").replace(/0+$/, "");
    return `${integer}.${fracStr}`;
}

export function SlippageSelector({ valueBps, onChange }: Props) {
    useEffect(() => {
        if (!PRESETS_BPS.includes(valueBps)) {
            onChange(DEFAULT_BPS);
        }
    }, [onChange, valueBps]);

    return (
        <div className="rounded-md border border-border/40 bg-card p-2">
            <div className="flex items-center justify-between mb-1.5">
                <span className="text-[10px] uppercase tracking-wide text-text-tertiary">Slippage Tolerance</span>
                <span className="text-xs font-mono text-text-primary tabular-nums">
                    {bpsToPercentString(valueBps)}%
                </span>
            </div>
            <div className="flex items-center gap-1">
                {PRESETS_BPS.map((bps) => {
                    const active = valueBps === bps;
                    return (
                        <button
                            key={bps.toString()}
                            type="button"
                            onClick={() => onChange(bps)}
                            className={`px-2 py-1 rounded text-xs font-medium transition-colors ${
                                active
                                    ? "bg-primary/20 text-primary border border-primary/40"
                                    : "bg-card-elevated text-text-muted border border-border-light hover:text-text-primary"
                            }`}
                        >
                            {bpsToPercentString(bps)}%
                        </button>
                    );
                })}
            </div>
        </div>
    );
}
