import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface Props {
    trigger: ReactNode;
    children: ReactNode;
    open?: boolean;
    onOpenChange?: (open: boolean) => void;
    align?: "left" | "center" | "right";
    side?: "top" | "bottom";
    className?: string;
    triggerClassName?: string;
    contentClassName?: string;
    offset?: number;
    closeOnClick?: boolean;
}

export function Popover(props: Props) {
    const {
        trigger,
        children,
        open: controlledOpen,
        onOpenChange,
        align = "right",
        side = "bottom",
        className = "",
        triggerClassName = "",
        contentClassName = "",
        offset = 8,
        closeOnClick = true,
    } = props;

    const [internalOpen, setInternalOpen] = useState(false);
    const [actualSide, setActualSide] = useState(side);
    const popoverRef = useRef<HTMLDivElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);

    // Determine if controlled or uncontrolled
    const isControlled = controlledOpen !== undefined;
    const open = isControlled ? controlledOpen : internalOpen;

    const setOpen = useCallback(
        (value: boolean) => {
            if (!isControlled) {
                setInternalOpen(value);
            }
            onOpenChange?.(value);
        },
        [isControlled, onOpenChange]
    );

    // Calculate optimal side based on viewport position
    useEffect(() => {
        if (!open || !popoverRef.current || !contentRef.current) {
            return;
        }

        const triggerRect = popoverRef.current.getBoundingClientRect();
        const contentRect = contentRef.current.getBoundingClientRect();
        const viewportHeight = window.innerHeight;

        // Check if there's enough space below
        const spaceBelow = viewportHeight - triggerRect.bottom;
        const spaceAbove = triggerRect.top;

        // If preferred side is bottom but not enough space, flip to top
        if (side === "bottom" && spaceBelow < contentRect.height + offset + 20) {
            // Check if there's more space above
            if (spaceAbove > spaceBelow) {
                setActualSide("top");
                return;
            }
        }

        // If preferred side is top but not enough space, flip to bottom
        if (side === "top" && spaceAbove < contentRect.height + offset + 20) {
            // Check if there's more space below
            if (spaceBelow > spaceAbove) {
                setActualSide("bottom");
                return;
            }
        }

        // Otherwise use the preferred side
        setActualSide(side);
    }, [open, side, offset]);

    // Handle click outside to close popover
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (popoverRef.current && !popoverRef.current.contains(event.target as Node)) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener("mousedown", handleClickOutside);
        }

        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [open, setOpen]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && open) {
                setOpen(false);
            }
        };

        if (open) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [open, setOpen]);

    // Handle click inside content
    const handleContentClick = useCallback(() => {
        if (closeOnClick) {
            setOpen(false);
        }
    }, [closeOnClick, setOpen]);

    // Calculate alignment classes
    const alignmentClasses = {
        left: "left-0",
        center: "left-1/2 -translate-x-1/2",
        right: "right-0",
    };

    return (
        <div className={`relative ${className}`} ref={popoverRef}>
            {/* Trigger */}
            <div onClick={() => setOpen(!open)} className={triggerClassName}>
                {trigger}
            </div>

            {/* Popover Content */}
            {open && (
                <div
                    ref={contentRef}
                    className={`absolute z-50 ${alignmentClasses[align]} ${actualSide === "top" ? "bottom-full" : "top-full"} ${contentClassName}`}
                    style={{ [actualSide === "top" ? "marginBottom" : "marginTop"]: `${offset * 0.25}rem` }}
                    onClick={handleContentClick}
                >
                    {children}
                </div>
            )}
        </div>
    );
}

// Optional: Export a PopoverContent component for consistent styling
interface PopoverContentProps {
    children: ReactNode;
    className?: string;
}

export function PopoverContent(props: PopoverContentProps) {
    const { children, className = "" } = props;

    return (
        <div
            className={`bg-card-elevated border border-border rounded-xl shadow-card-more-elevated overflow-hidden backdrop-blur-xl ${className}`}
        >
            {children}
        </div>
    );
}

// Optional: Export a PopoverMenuItem component for menu-style popovers
interface PopoverMenuItemProps {
    children: ReactNode;
    onClick?: () => void;
    className?: string;
    variant?: "default" | "danger";
    disabled?: boolean;
}

export function PopoverMenuItem(props: PopoverMenuItemProps) {
    const { children, onClick, className = "", variant = "default", disabled = false } = props;

    const variantClasses = {
        default: "text-text-secondary hover:bg-white/5",
        danger: "text-red-400 hover:bg-red-500/10",
    };

    return (
        <button
            onClick={onClick}
            disabled={disabled}
            className={`w-full px-4 py-2.5 text-left text-sm transition-colors cursor-pointer ${variantClasses[variant]} ${disabled ? "opacity-50 cursor-not-allowed" : ""} ${className}`}
        >
            {children}
        </button>
    );
}

// Optional: Export a PopoverHeader component for headers
interface PopoverHeaderProps {
    children: ReactNode;
    className?: string;
}

export function PopoverHeader(props: PopoverHeaderProps) {
    const { children, className = "" } = props;

    return <div className={`px-4 py-3 border-b border-border ${className}`}>{children}</div>;
}
