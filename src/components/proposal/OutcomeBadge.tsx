interface OutcomeBadgeProps {
    outcomeName: string;
    outcomeColor?: string;
    outcomeClass: string;
    dimmed?: boolean;
}

export function OutcomeBadge({ outcomeName, outcomeColor, outcomeClass, dimmed = false }: OutcomeBadgeProps) {
    const textClass = dimmed ? "text-xs font-medium text-text-tertiary" : "text-xs font-semibold";
    const style = !dimmed && outcomeColor ? { color: outcomeColor } : undefined;

    return (
        <div className="flex items-center gap-2">
            <div className={`w-1.5 h-1.5 rounded-full ${outcomeClass}`} />
            <span className={textClass} style={style}>
                {outcomeName}
            </span>
        </div>
    );
}
