import { forwardRef, type HTMLAttributes, type MouseEvent, type ReactNode } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
    children: ReactNode;
    className?: string;
    variant?: "default" | "elevated" | "more-elevated" | "glass";
    interactive?: boolean;
}

export const Card = forwardRef<HTMLDivElement, CardProps>(function Card(props, ref) {
    const {
        children,
        className = "",
        variant = "default",
        interactive = false,
        onClick,
        role,
        tabIndex,
        onKeyDown,
        ...rest
    } = props;
    const baseStyles = "rounded-xl p-4";

    const variantStyles = {
        default: "bg-card border border-border shadow-card",
        elevated: "bg-card-elevated border border-border shadow-card-elevated",
        "more-elevated": "bg-card-more-elevated border border-border-light shadow-card-more-elevated",
        glass: "glass-flow-panel shadow-none",
    };

    const interactiveStyles =
        interactive || onClick
            ? `cursor-pointer transition-all hover:border-border-lighter/50 ${variant === "glass" ? "" : "hover:bg-card-elevated"}`
            : "";

    const combinedClassName = `${baseStyles} ${variantStyles[variant]} ${interactiveStyles} ${className}`;

    return (
        <div
            {...rest}
            ref={ref}
            className={combinedClassName}
            onClick={onClick}
            role={role ?? (onClick ? "button" : undefined)}
            tabIndex={tabIndex ?? (onClick ? 0 : undefined)}
            onKeyDown={
                onKeyDown ??
                (onClick
                    ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              onClick(e as unknown as MouseEvent<HTMLDivElement>);
                          }
                      }
                    : undefined)
            }
        >
            {children}
        </div>
    );
});

interface CardHeaderProps {
    children: ReactNode;
    className?: string;
}

export function CardHeader({ children, className = "" }: CardHeaderProps) {
    return <div className={`mb-4 ${className}`}>{children}</div>;
}

interface CardTitleProps {
    children: ReactNode;
    className?: string;
}

export function CardTitle({ children, className = "" }: CardTitleProps) {
    return <h3 className={`text-xl font-semibold ${className}`}>{children}</h3>;
}

interface CardDescriptionProps {
    children: ReactNode;
    className?: string;
}

export function CardDescription({ children, className = "" }: CardDescriptionProps) {
    return <p className={`text-text-light text-sm ${className}`}>{children}</p>;
}

interface CardContentProps {
    children: ReactNode;
    className?: string;
}

export function CardContent({ children, className = "" }: CardContentProps) {
    return <div className={className}>{children}</div>;
}

interface CardFooterProps {
    children: ReactNode;
    className?: string;
}

export function CardFooter({ children, className = "" }: CardFooterProps) {
    return <div className={`mt-4 pt-4 border-t border-border-subtle ${className}`}>{children}</div>;
}
