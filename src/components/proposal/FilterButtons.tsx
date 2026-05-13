interface FilterButtonProps<T extends string> {
    options: readonly T[];
    selected: T;
    onChange: (value: T) => void;
    variant?: "default" | "colored";
    size?: "sm" | "xs";
    getColor?: (option: T) => { bg: string; text: string; border?: string } | null;
}

export function FilterButtons<T extends string>({
    options,
    selected,
    onChange,
    variant = "default",
    size = "xs",
    getColor,
}: FilterButtonProps<T>) {
    const sizeClasses = {
        xs: "text-[10px] px-2.5 py-0.5",
        sm: "text-xs px-2.5 py-1",
    };

    return (
        <div className="flex gap-1.5">
            {options.map((option) => {
                const isSelected = selected === option;
                const colors = getColor?.(option);

                let buttonClasses = `${sizeClasses[size]} rounded font-medium tracking-wide transition-colors`;

                if (variant === "colored" && colors && isSelected) {
                    buttonClasses += ` ${colors.bg} ${colors.text}`;
                    if (colors.border) {
                        buttonClasses += ` border ${colors.border}`;
                    }
                } else if (isSelected) {
                    buttonClasses += " bg-card-more-elevated text-text-primary";
                    if (variant === "colored") {
                        buttonClasses += " border border-transparent";
                    }
                } else {
                    buttonClasses += " text-text-tertiary hover:text-text-primary";
                    if (variant === "colored") {
                        buttonClasses += " border border-transparent";
                    }
                }

                return (
                    <button key={option} onClick={() => onChange(option)} className={buttonClasses}>
                        {option}
                    </button>
                );
            })}
        </div>
    );
}

interface FilterGroupProps<T extends string> {
    label: string;
    options: readonly T[];
    selected: T;
    onChange: (value: T) => void;
    variant?: "default" | "colored";
    size?: "sm" | "xs";
    getColor?: (option: T) => { bg: string; text: string; border?: string } | null;
}

export function FilterGroup<T extends string>({
    label,
    options,
    selected,
    onChange,
    variant = "default",
    size = "sm",
    getColor,
}: FilterGroupProps<T>) {
    return (
        <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-text-light whitespace-nowrap">{label}</span>
            <FilterButtons
                options={options}
                selected={selected}
                onChange={onChange}
                variant={variant}
                size={size}
                getColor={getColor}
            />
        </div>
    );
}
