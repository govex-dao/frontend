interface BadgeProps {
    children?: React.ReactNode;
    variant?: "green" | "red" | "blue" | "gray" | "yellow" | "default" | "elevated";
    className?: string;
    emphasize?: string | number; // The value to emphasize (make bold/bright)
    label?: string; // Optional label text
}

const variantStyles = {
    green: "bg-green-500/20 text-green-400",
    red: "bg-red-500/20 text-red-400",
    blue: "bg-blue-500/20 text-blue-400",
    gray: "bg-gray-500/20 text-gray-400",
    yellow: "bg-yellow-500/20 text-yellow-400",
    default: "bg-white/[0.08] text-text-secondary",
    elevated: "bg-card-elevated border border-border text-text-primary",
};

export function Badge({ children, variant = "default", className = "", emphasize, label }: BadgeProps) {
    if (emphasize !== undefined && label) {
        return (
            <span
                className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md text-xs ${variantStyles[variant]} ${className}`}
            >
                <span className="font-bold text-text-primary">{emphasize}</span>
                <span className="font-normal opacity-70">{label}</span>
            </span>
        );
    }

    return (
        <span
            className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-medium ${variantStyles[variant]} ${className}`}
        >
            {children}
        </span>
    );
}

interface BadgeButtonProps {
    children: React.ReactNode;
    onClick?: (e: React.MouseEvent) => void;
    onMouseEnter?: (e: React.MouseEvent) => void;
    onMouseLeave?: (e: React.MouseEvent) => void;
    className?: string;
}

export function BadgeButton({ children, onClick, onMouseEnter, onMouseLeave, className = "" }: BadgeButtonProps) {
    return (
        <button
            onClick={onClick}
            onMouseEnter={onMouseEnter}
            onMouseLeave={onMouseLeave}
            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white/[0.08] text-xs font-medium text-text-secondary hover:text-text-primary hover:bg-white/[0.12] transition-colors ${className}`}
        >
            {children}
        </button>
    );
}
