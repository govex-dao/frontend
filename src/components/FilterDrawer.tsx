import { X } from "lucide-react";
import { useEffect } from "react";
import { Drawer } from "./overlays/Drawer";

interface FilterDrawerProps {
    isOpen: boolean;
    onClose: () => void;
    children: React.ReactNode;
}

export function FilterDrawer({ isOpen, onClose, children }: FilterDrawerProps) {
    // Close on escape key
    useEffect(() => {
        const handleEscape = (e: KeyboardEvent) => {
            if (e.key === "Escape" && isOpen) {
                onClose();
            }
        };

        document.addEventListener("keydown", handleEscape);
        return () => document.removeEventListener("keydown", handleEscape);
    }, [isOpen, onClose]);

    // Prevent body scroll when drawer is open
    useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }
        return () => {
            document.body.style.overflow = "";
        };
    }, [isOpen]);

    return (
        <Drawer
            isOpen={isOpen}
            onClose={onClose}
            position="left"
            className="lg:hidden w-80 bg-card border-r border-border"
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-border">
                <h2 className="text-lg font-semibold text-text-primary">Filters</h2>
                <button
                    onClick={onClose}
                    className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                    aria-label="Close filters"
                >
                    <X className="w-5 h-5 text-text-light" />
                </button>
            </div>

            {/* Content */}
            <div className="p-4 overflow-y-auto h-[calc(100%-64px)]">{children}</div>
        </Drawer>
    );
}
