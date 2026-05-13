import type { ReactNode } from "react";
import { useEffect } from "react";

interface DrawerProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    position?: "left" | "right" | "bottom" | "top";
    className?: string;
    underHeader?: boolean;
    title?: string;
    showHandle?: boolean;
    zIndexAboveHeader?: boolean; // If true, drawer appears above header (z-50+), if false appears below (z-30-)
}

export function Drawer(props: DrawerProps) {
    const {
        isOpen,
        onClose,
        children,
        position = "right",
        className = "",
        underHeader = false,
        title,
        showHandle = false,
        zIndexAboveHeader = true,
    } = props;

    // Lock body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "unset";
        }

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) {
                onClose();
            }
        };

        if (isOpen) {
            document.addEventListener("keydown", handleKeyDown);
        }

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, onClose]);

    // Calculate translate class based on position
    const getTranslateClass = () => {
        switch (position) {
            case "left":
                return isOpen ? "translate-x-0" : "-translate-x-full";
            case "right":
                return isOpen ? "translate-x-0" : "translate-x-full";
            case "bottom":
                return isOpen ? "translate-y-0" : "translate-y-full";
            case "top":
                return isOpen ? "translate-y-0" : "-translate-y-full";
            default:
                return isOpen ? "translate-x-0" : "translate-x-full";
        }
    };

    // Calculate position classes
    const getPositionClasses = () => {
        switch (position) {
            case "left":
                return "top-0 left-0 bottom-0 w-full md:w-96";
            case "right":
                return "top-0 right-0 bottom-0 w-full md:w-96";
            case "bottom":
                return "bottom-0 left-0 right-0 max-h-[85vh] rounded-t-2xl";
            case "top":
                return "top-0 left-0 right-0 max-h-[85vh] rounded-b-2xl";
            default:
                return "top-0 right-0 bottom-0 w-full md:w-96";
        }
    };

    // Calculate border classes based on position
    const getBorderClasses = () => {
        switch (position) {
            case "left":
                return "border-r border-border-lighter/50";
            case "right":
                return "border-l border-border-lighter/50";
            case "bottom":
            case "top":
                return "";
            default:
                return "border-l border-border-lighter/50";
        }
    };

    const translateClass = getTranslateClass();
    const positionClasses = getPositionClasses();
    const borderClasses = getBorderClasses();

    // Set z-index based on whether drawer should be above or below header
    const overlayZIndex = zIndexAboveHeader ? "z-[9998]" : "z-20";
    const drawerZIndex = zIndexAboveHeader ? "z-[9999]" : "z-30";

    return (
        <>
            {/* Overlay */}
            <div
                className={`fixed inset-0 ${overlayZIndex} bg-black/50 backdrop-blur-sm transition-opacity duration-300 ${
                    isOpen ? "opacity-100" : "opacity-0 pointer-events-none"
                }`}
                onClick={onClose}
            />

            {/* Drawer */}
            <div
                className={`fixed ${underHeader ? "pt-[52px]" : "pt-0"} ${positionClasses} ${drawerZIndex} bg-card backdrop-blur-xl transition-transform duration-300 ease-out ${translateClass} ${className}`}
            >
                <div className={`h-full flex flex-col ${borderClasses}`}>
                    {/* Handle bar for bottom drawer */}
                    {showHandle && position === "bottom" && (
                        <div className="flex justify-center pt-3 pb-2 shrink-0">
                            <div className="w-12 h-1 bg-border rounded-full" />
                        </div>
                    )}

                    {/* Title */}
                    {title && (
                        <div className="px-4 py-3 shrink-0">
                            <h3 className="text-lg font-bold text-text-primary">{title}</h3>
                        </div>
                    )}

                    {/* Content */}
                    <div
                        className={`flex-1 overflow-y-auto ${position === "bottom" || position === "top" ? "px-4 pb-6" : ""}`}
                    >
                        {children}
                    </div>
                </div>
            </div>
        </>
    );
}
