import { BadgeCheck } from "lucide-react";
import { Tooltip } from "../overlays/Tooltip";
import { Check } from "./Check";

interface VerifiedBadgeProps {
    variant?: "icon" | "compact" | "full";
    className?: string;
}

const tooltipContent = (
    <div className="w-52 space-y-1">
        <p className="font-semibold text-primary text-sm">Verified Organization</p>
        <p className="text-xs leading-relaxed">
            This organization has been verified by our team and is safe to interact with.
        </p>
    </div>
);

export function VerifiedBadge({ variant = "icon", className = "" }: VerifiedBadgeProps) {
    if (variant === "icon") {
        return (
            <Tooltip content={tooltipContent} position="top">
                <BadgeCheck className={`w-5 h-5 text-blue-500 shrink-0 ${className}`} />
            </Tooltip>
        );
    }

    if (variant === "compact") {
        return (
            <Tooltip content={tooltipContent} position="top">
                <div className={`flex items-center gap-1 bg-blue-500/10 rounded-full px-2 py-1 ${className}`}>
                    <BadgeCheck className="w-4 h-4 text-blue-400 shrink-0" />
                    <p className="text-xs text-blue-400">Verified</p>
                </div>
            </Tooltip>
        );
    }

    // variant === "full"
    return (
        <Tooltip content={tooltipContent} position="top">
            <div className={`flex items-center gap-1 bg-blue-500/10 rounded-full px-2 py-1 ${className}`}>
                <Check className="w-4 h-4 text-blue-400 shrink-0" />
                <p className="text-xs text-blue-400">Verified</p>
            </div>
        </Tooltip>
    );
}
