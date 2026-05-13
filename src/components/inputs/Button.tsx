import { ChevronRight, Loader2 } from "lucide-react";

interface Props {
    children?: React.ReactNode;
    onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
    variant?: keyof typeof variantStyles;
    type?: "button" | "submit" | "reset";
    disabled?: boolean;
    className?: string;
    size?: "sm" | "base" | "lg";
    leftIcon?: React.ReactNode;
    rightIcon?: React.ReactNode;
    square?: boolean;
    isLoading?: boolean;
    innerLink?: boolean;
    title?: string;
}

const sizeClasses = {
    sm: "px-3 py-1 text-sm gap-1",
    base: "px-4 py-2 text-base gap-2.5",
    lg: "px-9 py-3 text-lg gap-3",
};

const squareSizeClasses = {
    sm: "p-1.5",
    base: "p-2",
    lg: "p-3",
};

const variantStyles = {
    primary: "bg-white text-black hover:bg-gray-100",
    secondary: "bg-card border border-border text-text-primary hover:border-border-light",
    outline: "bg-card-elevated border border-border-light hover:bg-border",
    elevated: "bg-card-elevated hover:bg-card-more-elevated border border-border text-text-primary",
    error: "bg-error text-white hover:bg-error-dark",
    ghost: "bg-transparent text-text-tertiary hover:bg-card-elevated p-1! -m-1! text-xs",
};

export function Button(props: Props) {
    const {
        children,
        onClick,
        variant = "primary",
        type = "button",
        disabled = false,
        className = "",
        size = "base",
        leftIcon,
        rightIcon,
        square = false,
        isLoading = false,
        innerLink = false,
        title = "",
    } = props;

    const paddingStyles = square ? squareSizeClasses[size] : sizeClasses[size];
    const baseStyles = `${paddingStyles} rounded-lg transition-colors font-medium cursor-pointer flex items-center justify-center group/button`;
    const disabledStyles = disabled || isLoading ? "opacity-50 cursor-not-allowed" : "";

    return (
        <button
            onClick={onClick}
            type={type}
            disabled={disabled || isLoading}
            className={`${baseStyles} ${variantStyles[variant]} ${disabledStyles} ${className} group`}
            title={title}
        >
            {isLoading ? (
                <>
                    <Loader2 className="animate-spin h-5 w-5" />
                    <span className="opacity-70">{children}</span>
                </>
            ) : (
                <>
                    {leftIcon && <span>{leftIcon}</span>}
                    {children}
                    {rightIcon && <span>{rightIcon}</span>}
                    {innerLink && (
                        <ChevronRight
                            className="w-3 h-3 group-hover/button:translate-x-1 transition-transform"
                            color="currentColor"
                        />
                    )}
                </>
            )}
        </button>
    );
}
