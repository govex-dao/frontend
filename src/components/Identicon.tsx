import { useMemo, type JSX } from "react";

// Tiny identicon based on address. Deterministic 5x5 grid.
export function Identicon({ seed, size = 18 }: { seed?: string; size?: number }) {
    const blocks = useMemo(() => {
        const s = seed ?? "";
        let h = 2166136261 >>> 0; // FNV-1a
        for (let i = 0; i < s.length; i++) {
            h ^= s.charCodeAt(i);
            h = Math.imul(h, 16777619) >>> 0;
        }
        const color = `hsl(${h % 360}, 60%, 50%)`;
        const bits = Array.from({ length: 15 }, (_, i) => ((h >> (i % 31)) & 1) === 1);
        return { color, bits };
    }, [seed]);

    const cell = size / 5;
    const rects: JSX.Element[] = [];
    for (let y = 0; y < 5; y++) {
        for (let x = 0; x < 3; x++) {
            const idx = y * 3 + x;
            if (blocks.bits[idx]) {
                const rx = x * cell;
                const ry = y * cell;
                // mirror horizontally for 5x5 symmetry
                rects.push(<rect key={`l-${idx}`} x={rx} y={ry} width={cell} height={cell} rx={cell * 0.2} />);
                rects.push(
                    <rect key={`r-${idx}`} x={(4 - x) * cell} y={ry} width={cell} height={cell} rx={cell * 0.2} />
                );
            }
        }
    }

    return (
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
            <rect width={size} height={size} rx={Math.max(2, size * 0.18)} fill="#0b0f14" />
            <g fill={blocks.color}> {rects} </g>
        </svg>
    );
}
