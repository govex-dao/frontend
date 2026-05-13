import React from "react";

interface SliderProps {
    value: number;
    onChange: (value: number) => void;
    min?: number;
    max?: number;
    step?: number;
    suffix?: string;
    showValue?: boolean;
    label?: string;
    quickSelections?: number[];
    className?: string;
}

export const Slider: React.FC<SliderProps> = ({
    value,
    onChange,
    min = 0,
    max = 100,
    step = 1,
    suffix = "%",
    showValue = true,
    label,
    quickSelections,
    className = "",
}) => {
    const percentage = ((value - min) / (max - min)) * 100;

    return (
        <div className={`space-y-1 ${className}`}>
            {(label || showValue) && (
                <div className="flex items-start justify-between">
                    {label && (
                        <div className="text-xs font-semibold text-text-muted/70 uppercase tracking-wider">{label}</div>
                    )}
                    {showValue && (
                        <div className="text-lg font-clash font-bold tracking-tight">
                            {value}
                            {suffix}
                        </div>
                    )}
                </div>
            )}

            <div className="relative h-2 py-1 px-1 bg-background/10 rounded-full">
                <div className="relative h-2">
                    <div className="absolute w-full h-2 bg-border rounded-full" />
                    <div
                        className="absolute h-2 bg-linear-to-r from-primary to-blue-400 rounded-full pointer-events-none shadow-lg shadow-primary/30"
                        style={{ width: `${percentage}%` }}
                    />
                    <input
                        type="range"
                        min={min}
                        max={max}
                        step={step}
                        value={value}
                        onChange={(e) => onChange(Number(e.target.value))}
                        className="absolute inset-0 w-full h-2 appearance-none cursor-pointer bg-transparent [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-4 [&::-webkit-slider-thumb]:h-4 [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:bg-white [&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary [&::-webkit-slider-thumb]:cursor-pointer [&::-webkit-slider-thumb]:shadow-lg [&::-webkit-slider-thumb]:transition-transform [&::-webkit-slider-thumb]:hover:scale-110 [&::-webkit-slider-runnable-track]:bg-transparent [&::-moz-range-thumb]:w-4 [&::-moz-range-thumb]:h-4 [&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:bg-white [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:cursor-pointer [&::-moz-range-thumb]:shadow-lg [&::-moz-range-track]:bg-transparent"
                    />
                </div>
            </div>

            {quickSelections && quickSelections.length > 0 && (
                <div className="flex gap-2 mt-4">
                    {quickSelections.map((selection) => (
                        <button
                            key={selection}
                            type="button"
                            onClick={() => onChange(selection)}
                            className={`flex-1 h-8 text-xs font-semibold rounded-lg transition-all cursor-pointer border ${
                                value === selection
                                    ? "bg-primary/10 hover:bg-primary/20 border-border-light text-text-primary"
                                    : "border-border-light/40 hover:border-border-light/50 bg-card-elevated hover:bg-card-more-elevated"
                            }`}
                        >
                            {selection}
                            {suffix}
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
};
