import { useEffect } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Card } from "@/components/Card";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    subTitle?: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal(props: ModalProps) {
    const { isOpen, onClose, title, subTitle, children, className } = props;

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "unset";

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    // Handle escape key
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (event.key === "Escape" && isOpen) onClose();
        };

        if (isOpen) document.addEventListener("keydown", handleKeyDown);

        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

            {/* Modal */}
            <Card
                className={`relative max-w-[90vw] max-h-[90vh] md:max-h-[95vh] overflow-hidden flex flex-col ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        {typeof title === "string" ? (
                            <h2 className="text-xl md:text-2xl font-bold text-text-primary">{title}</h2>
                        ) : (
                            title
                        )}
                        {subTitle && <p className="text-text-light text-sm">{subTitle}</p>}
                    </div>
                    <button onClick={onClose} className="p-2 rounded-lg hover:bg-white/10 transition-colors">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="h-px w-full bg-border-subtle my-4 shrink-0" />

                {/* Content */}
                <div className="flex-1 overflow-y-auto min-h-0 flex flex-col gap-4">{children}</div>
            </Card>
        </div>,
        document.body
    );
}
