interface Props {
    label?: string;
    value: string; // ISO string for datetime-local
    onChange: (isoString: string, timestampMs: number) => void;
    className?: string;
    required?: boolean;
    error?: boolean;
}

function toLocalDatetimeString(date: Date): string {
    const pad = (n: number) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function DateTimeInput({ label, value, onChange, className = "", required, error }: Props) {
    const handleChange = (raw: string) => {
        if (!raw) {
            onChange("", 0);
            return;
        }
        const date = new Date(raw);
        if (isNaN(date.getTime())) return;
        onChange(raw, date.getTime());
    };

    const handleNow = () => {
        const now = new Date();
        const local = toLocalDatetimeString(now);
        onChange(local, now.getTime());
    };

    return (
        <div className={`flex flex-col gap-1 ${className}`}>
            {label && (
                <label
                    className={`text-[10px] uppercase tracking-wide ${error ? "text-error-light" : "text-text-light/50"}`}
                >
                    {label}
                    {required && <span className="text-error-light ml-1">*</span>}
                </label>
            )}
            <div
                className={`relative flex items-center gap-2 bg-card-elevated border rounded-lg text-text-primary placeholder:text-text-lighter transition-colors px-2.5 py-1.5 text-sm ${
                    error
                        ? "border-error/30 focus-within:border-error/50 bg-error/5 focus-within:bg-error/10"
                        : "border-border focus-within:border-border-light focus-within:bg-card-more-elevated"
                }`}
            >
                <input
                    type="datetime-local"
                    value={value}
                    onChange={(e) => handleChange(e.target.value)}
                    required={required}
                    className="ring-0 outline-none flex-1 bg-transparent [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                />
                <button
                    type="button"
                    onClick={handleNow}
                    className="shrink-0 px-2 py-0.5 rounded text-[10px] font-medium bg-white/5 text-text-muted hover:bg-white/10 hover:text-text-secondary transition-colors"
                >
                    Now
                </button>
            </div>
        </div>
    );
}
