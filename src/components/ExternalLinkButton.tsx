import type { LucideIcon } from "lucide-react";
import { ArrowUp } from "lucide-react";
import { motion } from "motion/react";
import { Tooltip } from "./overlays/Tooltip";
import { Button } from "./inputs/Button";

interface ExternalLinkButtonProps {
    href: string;
    icon: LucideIcon;
    label: string;
    variant?: "outline" | "primary" | "secondary" | "elevated";
    size?: "sm" | "base" | "lg";
}

export function ExternalLinkButton({ href, icon: Icon, label, variant = "outline", size }: ExternalLinkButtonProps) {
    const iconSize = size === "sm" ? "w-3.5 h-3.5" : "w-4 h-4";

    return (
        <Tooltip
            content={
                <div className="flex items-center gap-2">
                    <span>{label}</span>
                    <motion.div animate={{ rotate: 60 }}>
                        <ArrowUp className="size-4 " />
                    </motion.div>
                </div>
            }
        >
            <Button
                variant={variant}
                square
                size={size}
                onClick={() => {
                    try {
                        const parsed = new URL(href);
                        if (parsed.protocol === "http:" || parsed.protocol === "https:") {
                            window.open(href, "_blank", "noopener,noreferrer");
                        }
                    } catch { /* invalid URL, ignore */ }
                }}
            >
                <Icon className={iconSize} />
            </Button>
        </Tooltip>
    );
}
