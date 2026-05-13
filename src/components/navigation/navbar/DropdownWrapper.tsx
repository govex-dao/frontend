import type { ReactNode } from "react";
import { motion } from "motion/react";
import { createPortal } from "react-dom";

interface Props {
    title: string;
    subtitle: string;
    onViewAll: () => void;
    onMouseLeave?: () => void;
    children: ReactNode;
}

export function DropdownWrapper(props: Props) {
    const { title, subtitle, onViewAll, onMouseLeave, children } = props;

    return createPortal(
        <div
            className="fixed left-0 right-0 top-0 z-40 pt-18 bg-white/2 backdrop-blur-xl border-b border-white/10 shadow-2xl"
            onMouseLeave={onMouseLeave}
        >
            <div className="w-full mx-auto px-8 md:px-12 lg:px-20 py-8">
                <motion.div
                    className="flex items-center justify-between mb-6"
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2, delay: 0.05 }}
                >
                    <div>
                        <h3 className="text-sm font-semibold text-text-primary mb-1">{title}</h3>
                        <p className="text-xs text-text-muted">{subtitle}</p>
                    </div>
                    <button
                        onClick={onViewAll}
                        className="text-xs text-primary hover:text-primary-light transition-colors font-medium"
                    >
                        View all →
                    </button>
                </motion.div>
                <motion.div
                    className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 max-h-128 overflow-y-auto pr-2"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.3, delay: 0.1 }}
                >
                    {children}
                </motion.div>
            </div>
        </div>,
        document.body
    );
}
