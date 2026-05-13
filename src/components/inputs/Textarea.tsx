interface TextareaProps {
    label?: string;
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    className?: string;
    rows?: number;
    required?: boolean;
    error?: boolean;
    containerClassName?: string;
}

export function Textarea(props: TextareaProps) {
    const {
        label,
        value,
        onChange,
        placeholder,
        className = "",
        rows = 4,
        required = false,
        error = false,
        containerClassName = "",
    } = props;
    return (
        <div className={`flex flex-col gap-1 ${containerClassName}`}>
            {label && (
                <label className={`text-[10px] uppercase tracking-wide ${error ? "text-error" : "text-text-light/50"}`}>
                    {label}
                    {required && <span className="text-error ml-1">*</span>}
                </label>
            )}
            <textarea
                value={value}
                onChange={(e) => onChange(e.target.value)}
                placeholder={placeholder}
                required={required}
                rows={rows}
                className={`bg-card-elevated border rounded-lg px-2.5 py-2 text-text-primary placeholder:text-text-lighter focus:outline-none transition-colors resize-none ${
                    error
                        ? "border-error/30 focus:border-error/40 bg-error/5 focus:bg-error/10"
                        : "border-border focus:border-border-light focus:bg-card-more-elevated"
                } ${className}`}
            />
        </div>
    );
}
