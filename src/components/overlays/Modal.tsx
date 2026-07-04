import { useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { Card } from "@/components/Card";

interface ModalProps {
    isOpen: boolean;
    onClose: () => void;
    title: string | React.ReactNode;
    ariaLabel?: string;
    subTitle?: string;
    children: React.ReactNode;
    className?: string;
}

export function Modal(props: ModalProps) {
    const { isOpen, onClose, title, ariaLabel, subTitle, children, className } = props;
    const dialogRef = useRef<HTMLDivElement>(null);
    const titleId = useId();

    useEffect(() => {
        if (!isOpen) return;

        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;
        window.requestAnimationFrame(() => {
            const focusable = getFocusableElements(dialogRef.current);
            (focusable[0] ?? dialogRef.current)?.focus();
        });

        return () => {
            previouslyFocused?.focus();
        };
    }, [isOpen]);

    useEffect(() => {
        document.body.style.overflow = isOpen ? "hidden" : "unset";

        return () => {
            document.body.style.overflow = "unset";
        };
    }, [isOpen]);

    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            if (event.key === "Escape") {
                onClose();
                return;
            }

            if (event.key !== "Tab") return;

            const focusable = getFocusableElements(dialogRef.current);
            if (focusable.length === 0) {
                event.preventDefault();
                dialogRef.current?.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            if (event.shiftKey && document.activeElement === first) {
                event.preventDefault();
                last.focus();
            } else if (!event.shiftKey && document.activeElement === last) {
                event.preventDefault();
                first.focus();
            }
        };

        if (isOpen) document.addEventListener("keydown", handleKeyDown);

        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) return null;

    return createPortal(
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            {/* Backdrop */}
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} aria-hidden="true" />

            {/* Modal */}
            <Card
                ref={dialogRef}
                role="dialog"
                aria-modal="true"
                aria-labelledby={typeof title === "string" ? titleId : undefined}
                aria-label={typeof title === "string" ? undefined : ariaLabel}
                tabIndex={-1}
                className={`relative max-w-[90vw] max-h-[90vh] md:max-h-[95vh] overflow-hidden flex flex-col ${className}`}
            >
                {/* Header */}
                <div className="flex items-center justify-between shrink-0">
                    <div>
                        {typeof title === "string" ? (
                            <h2 id={titleId} className="text-xl md:text-2xl font-bold text-text-primary">
                                {title}
                            </h2>
                        ) : (
                            title
                        )}
                        {subTitle && <p className="text-text-light text-sm">{subTitle}</p>}
                    </div>
                    <button
                        onClick={onClose}
                        className="p-2 rounded-lg hover:bg-white/10 transition-colors"
                        aria-label="Close modal"
                    >
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

function getFocusableElements(root: HTMLElement | null): HTMLElement[] {
    if (!root) return [];
    return Array.from(
        root.querySelectorAll<HTMLElement>(
            [
                "a[href]",
                "button:not([disabled])",
                "textarea:not([disabled])",
                "input:not([disabled])",
                "select:not([disabled])",
                "[tabindex]:not([tabindex='-1'])",
            ].join(",")
        )
    ).filter((element) => !element.hasAttribute("disabled") && element.getAttribute("aria-hidden") !== "true");
}
