import { useState, useRef, useEffect } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";

interface TooltipProps {
    content: ReactNode;
    children: ReactNode;
    position?: "top" | "bottom" | "left" | "right";
    className?: string;
}

export function Tooltip({ content, children, position = "top", className = "" }: TooltipProps) {
    const [isVisible, setIsVisible] = useState(false);
    const [coords, setCoords] = useState({ top: 0, left: 0 });
    const [adjustedPosition, setAdjustedPosition] = useState(position);
    const triggerRef = useRef<HTMLDivElement>(null);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isVisible || !triggerRef.current) return;

        const calculatePosition = () => {
            const triggerRect = triggerRef.current!.getBoundingClientRect();
            const tooltipRect = tooltipRef.current?.getBoundingClientRect();

            const tooltipHeight = tooltipRect?.height || 80;
            const tooltipWidth = tooltipRect?.width || 200;
            const gap = 8;

            // Determine the best position based on available space
            let finalPosition = position;

            // Check if preferred position fits, otherwise flip
            if (position === "top" && triggerRect.top < tooltipHeight + gap) {
                finalPosition = "bottom";
            } else if (position === "bottom" && window.innerHeight - triggerRect.bottom < tooltipHeight + gap) {
                finalPosition = "top";
            } else if (position === "left" && triggerRect.left < tooltipWidth + gap) {
                finalPosition = "right";
            } else if (position === "right" && window.innerWidth - triggerRect.right < tooltipWidth + gap) {
                finalPosition = "left";
            }

            setAdjustedPosition(finalPosition);

            let top = 0;
            let left = 0;

            switch (finalPosition) {
                case "top":
                    top = triggerRect.top - tooltipHeight - gap;
                    left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
                    break;
                case "bottom":
                    top = triggerRect.bottom + gap;
                    left = triggerRect.left + triggerRect.width / 2 - tooltipWidth / 2;
                    break;
                case "left":
                    top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
                    left = triggerRect.left - tooltipWidth - gap;
                    break;
                case "right":
                    top = triggerRect.top + triggerRect.height / 2 - tooltipHeight / 2;
                    left = triggerRect.right + gap;
                    break;
            }

            // Clamp to viewport bounds
            const padding = 8;
            left = Math.max(padding, Math.min(left, window.innerWidth - tooltipWidth - padding));
            top = Math.max(padding, Math.min(top, window.innerHeight - tooltipHeight - padding));

            setCoords({ top, left });
        };

        // Calculate immediately, then recalculate after tooltip renders to get actual size
        calculatePosition();
        requestAnimationFrame(calculatePosition);
    }, [isVisible, position]);

    // Hide tooltip on scroll
    useEffect(() => {
        if (!isVisible) return;

        const handleScroll = () => {
            setIsVisible(false);
        };

        window.addEventListener("scroll", handleScroll, true);
        return () => {
            window.removeEventListener("scroll", handleScroll, true);
        };
    }, [isVisible]);

    const arrowClasses = {
        top: "top-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-b-transparent border-t-card-more-elevated",
        bottom: "bottom-full left-1/2 -translate-x-1/2 border-l-transparent border-r-transparent border-t-transparent border-b-card-more-elevated",
        left: "left-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-r-transparent border-l-card-more-elevated",
        right: "right-full top-1/2 -translate-y-1/2 border-t-transparent border-b-transparent border-l-transparent border-r-card-more-elevated",
    };

    return (
        <>
            <div
                ref={triggerRef}
                className="relative inline-flex"
                onMouseEnter={() => setIsVisible(true)}
                onMouseLeave={() => setIsVisible(false)}
            >
                {children}
            </div>
            {isVisible &&
                createPortal(
                    <div
                        ref={tooltipRef}
                        className="fixed z-[9999] pointer-events-none"
                        style={{ top: `${coords.top}px`, left: `${coords.left}px` }}
                        role="tooltip"
                    >
                        <div
                            className={`bg-card-more-elevated border border-border-light rounded-lg px-3 py-2 text-sm text-text-primary shadow-lg ${className}`}
                        >
                            {content}
                        </div>
                        {/* Arrow */}
                        <div className={`absolute w-0 h-0 border-4 ${arrowClasses[adjustedPosition]}`} />
                    </div>,
                    document.body
                )}
        </>
    );
}
