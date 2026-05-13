import { DollarSign } from "lucide-react";
import { Button } from "@/components/inputs/Button";

interface GovexBadgeProps {
    className?: string;
    size?: "sm" | "md" | "textOnly";
    showIcon?: boolean;
    onClick: (e: React.MouseEvent) => void;
}

export function GovexBadge({ className = "", size = "md", showIcon = true, onClick }: GovexBadgeProps) {
    const sizeClasses = {
        sm: "px-2 py-0.5 text-xs",
        md: "px-2.5 py-1 text-xs",
        textOnly: "p-0! bg-transparent! border-none! text-xs m-0!",
    };
    const baseClasses = `inline-flex items-center gap-1.5 rounded-md bg-primary/10 border border-primary/20 ${sizeClasses[size]} ${className}`;

    return (
        <div className="inline-block group/badge">
            <Button
                onClick={(e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    onClick(e);
                }}
                innerLink
                variant="outline"
                size="sm"
                className={`${baseClasses} hover:bg-primary/20 hover:border-primary/30 transition-all duration-300 text-primary-light`}
            >
                {showIcon && size !== "textOnly" && <DollarSign className="w-3 h-3" />}
                <span className="font-medium whitespace-nowrap">Raised on Govex</span>
            </Button>
        </div>
    );
}
