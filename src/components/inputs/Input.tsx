interface InputProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    onKeyDown?: (e: React.KeyboardEvent<HTMLInputElement>) => void;
    placeholder?: string;
    type?: "text" | "number" | "email" | "password" | "date" | "datetime-local";
    min?: string | number;
    max?: string | number;
    step?: string | number;
    inputMode?: "none" | "text" | "tel" | "url" | "email" | "numeric" | "decimal" | "search";
    pattern?: string;
    className?: string;
    required?: boolean;
    error?: boolean;
    autoFocus?: boolean;
    size?: "sm" | "md";
    leftIcon?: React.ReactNode;
}

export function Input(props: InputProps) {
    const {
        label,
        value,
        onChange,
        onKeyDown,
        placeholder,
        type = "text",
        min,
        max,
        step,
        inputMode,
        pattern,
        className = "",
        required = false,
        error = false,
        autoFocus = false,
        size = "md",
        leftIcon,
    } = props;

    const sizeClasses = {
        sm: "px-2 py-1 text-xs",
        md: "px-2.5 py-1.5 text-sm",
    };

    return (
        <div className={`flex flex-col gap-1`}>
            {label && (
                <label
                    className={`text-[10px] uppercase tracking-wide ${error ? "text-error-light" : "text-text-light/50"}`}
                >
                    {label}
                    {required && <span className="text-error-light ml-1">*</span>}
                </label>
            )}
            <div
                className={`relative flex items-center gap-2 bg-card-elevated border rounded-lg text-text-primary placeholder:text-text-lighter transition-colors ${sizeClasses[size]} ${error ? "border-error/30 focus-within:border-error/50 bg-error/5 focus-within:bg-error/10" : "border-border focus-within:border-border-light focus-within:bg-card-more-elevated"} ${className}`}
            >
                {leftIcon && <div className="">{leftIcon}</div>}
                <input
                    type={type}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={onKeyDown}
                    placeholder={placeholder}
                    min={min}
                    max={max}
                    step={step}
                    inputMode={inputMode}
                    pattern={pattern}
                    required={required}
                    autoFocus={autoFocus}
                    className="min-w-0 flex-1 ring-0 outline-none [&::-webkit-calendar-picker-indicator]:cursor-pointer [&::-webkit-calendar-picker-indicator]:brightness-0 [&::-webkit-calendar-picker-indicator]:invert [&::-webkit-calendar-picker-indicator]:opacity-50 [&::-webkit-calendar-picker-indicator]:hover:opacity-80"
                />
            </div>
        </div>
    );
}
