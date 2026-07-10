import { useEffect, useMemo, useState } from "react";
import { Shield } from "lucide-react";
import { validateLinkedImageUrl } from "@/lib/imageUrl";

const SIZE_CLASSES = {
    md: "h-10 w-10 rounded-lg text-sm",
    lg: "h-14 w-14 rounded-xl text-lg",
    xl: "h-16 w-16 rounded-xl text-xl",
} as const;

const ICON_CLASSES = {
    md: "h-5 w-5",
    lg: "h-7 w-7",
    xl: "h-8 w-8",
} as const;

interface Props {
    name: string;
    imageUrl?: string | null;
    fallbackImageUrl?: string | null;
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
}

export function MultisigAvatar({ name, imageUrl, fallbackImageUrl, size = "md", className = "" }: Props) {
    const [imageIndex, setImageIndex] = useState(0);
    const fallback = name.trim()[0]?.toUpperCase() || "";
    const safeImageUrls = useMemo(
        () =>
            [...new Set([imageUrl, fallbackImageUrl])]
                .map((value) => (value ? validateLinkedImageUrl(value, { allowRelative: true }).normalized : null))
                .filter((value): value is string => !!value),
        [fallbackImageUrl, imageUrl]
    );
    const safeImageUrl = safeImageUrls[imageIndex] ?? null;

    useEffect(() => {
        setImageIndex(0);
    }, [safeImageUrls]);

    return (
        <span
            className={`flex shrink-0 items-center justify-center overflow-hidden border border-primary/15 bg-primary/15 text-primary ${SIZE_CLASSES[size]} ${className}`}
        >
            {safeImageUrl ? (
                <img
                    key={safeImageUrl}
                    src={safeImageUrl}
                    alt=""
                    className="h-full w-full object-cover"
                    loading="lazy"
                    referrerPolicy="no-referrer"
                    onError={() => setImageIndex((current) => current + 1)}
                />
            ) : fallback ? (
                <span className="font-semibold">{fallback}</span>
            ) : (
                <Shield className={ICON_CLASSES[size]} />
            )}
        </span>
    );
}
