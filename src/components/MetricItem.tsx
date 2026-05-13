import type { ReactNode } from "react";

interface MetricItemProps {
    label: string;
    value: string | number;
    suffix?: string;
    size?: "sm" | "base" | "lg" | "xl" | "2xl" | "3xl";
    className?: string;
    valueClassName?: string;
    icon?: ReactNode;
    hoverable?: boolean;
    noUppercase?: boolean;
}

export function MetricItem({
    label,
    value,
    suffix,
    size = "sm",
    className,
    valueClassName,
    icon,
    hoverable = false,
    noUppercase = false,
}: MetricItemProps) {
    const sizeStyles = {
        sm: {
            label: "text-[8px]",
            value: "text-sm font-semibold text-text-primary",
            suffix: "text-[10px] text-text-muted/60 ml-0.5",
        },
        base: {
            label: "text-[9px]",
            value: "text-base font-semibold text-text-primary",
            suffix: "text-[10px] text-text-muted/60 ml-0.5",
        },
        lg: {
            label: "text-[10px]",
            value: "text-lg font-bold text-text-primary",
            suffix: "text-[10px] text-text-muted/60 ml-1",
        },
        xl: {
            label: "text-[11px]",
            value: "text-2xl font-bold text-text-primary",
            suffix: "text-[12px] text-text-muted/60 ml-1",
        },
        "2xl": {
            label: "text-[11px]",
            value: "text-3xl font-bold text-text-primary",
            suffix: "text-[12px] text-text-muted/60 ml-1",
        },
        "3xl": {
            label: "text-[12px]",
            value: "text-5xl font-bold text-text-primary",
            suffix: "text-[12px] text-text-muted/60 ml-1",
        },
    };

    const styles = sizeStyles[size];

    return (
        <div
            className={`${className} ${hoverable ? "group hover:bg-primary/5 p-2.5 rounded-lg transition-colors cursor-pointer" : ""}`}
        >
            <div className={`flex items-center gap-1.5 ${icon ? "mb-1.5" : ""}`}>
                {icon && <div className="text-text-muted/40 group-hover:text-primary/60 transition-colors">{icon}</div>}
                <p
                    className={
                        styles.label + ` ${noUppercase ? "" : "uppercase"} tracking-wide font-medium text-text-muted/60`
                    }
                >
                    {label}
                </p>
            </div>
            <p className={`${styles.value} ${valueClassName || ""}`}>
                {value}
                {suffix && <span className={styles.suffix}>{suffix}</span>}
            </p>
        </div>
    );
}
