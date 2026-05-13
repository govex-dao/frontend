import { useState } from "react";

type ColorVariant = "green" | "blue" | "red" | "yellow" | "purple" | "pink" | "orange";

const colorClasses = {
    green: {
        bg: "bg-green-500/10 hover:bg-green-500/20",
        outerRing: "bg-green-400/30",
        middleRing: "bg-green-400/50",
        core: "bg-green-400",
        text: "text-green-400",
        shadow: "shadow-[0_0_8px_rgba(74,222,128,0.6)]",
    },
    blue: {
        bg: "bg-blue-500/10 hover:bg-blue-500/20",
        outerRing: "bg-blue-400/30",
        middleRing: "bg-blue-400/50",
        core: "bg-blue-400",
        text: "text-blue-400",
        shadow: "shadow-[0_0_8px_rgba(96,165,250,0.6)]",
    },
    red: {
        bg: "bg-red-500/10 hover:bg-red-500/20",
        outerRing: "bg-red-400/30",
        middleRing: "bg-red-400/50",
        core: "bg-red-400",
        text: "text-red-400",
        shadow: "shadow-[0_0_8px_rgba(248,113,113,0.6)]",
    },
    yellow: {
        bg: "bg-yellow-500/10 hover:bg-yellow-500/20",
        outerRing: "bg-yellow-400/30",
        middleRing: "bg-yellow-400/50",
        core: "bg-yellow-400",
        text: "text-yellow-400",
        shadow: "shadow-[0_0_8px_rgba(250,204,21,0.6)]",
    },
    purple: {
        bg: "bg-purple-500/10 hover:bg-purple-500/20",
        outerRing: "bg-purple-400/30",
        middleRing: "bg-purple-400/50",
        core: "bg-purple-400",
        text: "text-purple-400",
        shadow: "shadow-[0_0_8px_rgba(192,132,252,0.6)]",
    },
    pink: {
        bg: "bg-pink-500/10 hover:bg-pink-500/20",
        outerRing: "bg-pink-400/30",
        middleRing: "bg-pink-400/50",
        core: "bg-pink-400",
        text: "text-pink-400",
        shadow: "shadow-[0_0_8px_rgba(244,114,182,0.6)]",
    },
    orange: {
        bg: "bg-orange-500/10 hover:bg-orange-500/20",
        outerRing: "bg-orange-400/30",
        middleRing: "bg-orange-400/50",
        core: "bg-orange-400",
        text: "text-orange-400",
        shadow: "shadow-[0_0_8px_rgba(251,146,60,0.6)]",
    },
};

const sizeClasses = {
    container: {
        small: "py-0.5 px-1 gap-2.5",
        medium: "py-1 px-2 gap-2.5",
        large: "py-1.5 px-3 gap-2.5",
    },
    text: {
        small: "text-xs",
        medium: "text-sm",
        large: "text-lg",
    },
    ring: {
        small: "size-1",
        medium: "size-2",
        large: "size-2.5",
    },
};

interface Props {
    label?: string;
    className?: string;
    chipOnly?: boolean;
    color?: ColorVariant;
    nb?: number;
    size?: "small" | "medium" | "large";
    animated?: boolean;
}

export function LiveChip(props: Props) {
    const {
        label = "Live",
        className = "",
        chipOnly = false,
        color = "green",
        nb,
        size = "medium",
        animated = false,
    } = props;
    const colors = colorClasses[color];
    const [hover, setHover] = useState(false);

    return (
        <div
            onMouseEnter={() => setHover(true)}
            onMouseLeave={() => setHover(false)}
            style={{ fillOpacity: hover ? "1" : "0" }}
            className={`flex items-center rounded-md transition-all duration-300 ${className} ${chipOnly ? "p-0" : `px-2 py-1 ${colors.bg} ${sizeClasses.container[size]}`}`}
        >
            <div className="relative">
                <div
                    className={`${sizeClasses.ring[size]} rounded-full ${colors.outerRing} ${animated ? "animate-pulse" : ""}`}
                ></div>
                <div
                    className={`absolute inset-0 ${sizeClasses.ring[size]} rounded-full ${colors.middleRing} ${animated ? "animate-ping" : ""}`}
                ></div>
            </div>
            <span
                className={`${sizeClasses.text[size]} ${colors.text} font-medium overflow-hidden transition-all duration-300 whitespace-nowrap ${chipOnly ? "max-w-0 opacity-0" : " opacity-100"}`}
            >
                {nb ? `${nb} ${label}` : label}
            </span>
        </div>
    );
}
