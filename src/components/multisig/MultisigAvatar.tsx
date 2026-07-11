import { useMemo, useState } from "react";
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

const IMAGE_SIZES = { md: 40, lg: 56, xl: 64 } as const;

interface Props {
    name: string;
    imageUrl?: string | null;
    size?: keyof typeof SIZE_CLASSES;
    className?: string;
}

export function MultisigAvatar({ name, imageUrl, size = "md", className = "" }: Props) {
    const [failedImageUrl, setFailedImageUrl] = useState<string | null>(null);
    const fallback = name.trim()[0]?.toUpperCase() || "";
    const safeImageUrl = useMemo(
        () => (imageUrl ? validateLinkedImageUrl(imageUrl, { allowRelative: true }).normalized : null),
        [imageUrl]
    );
    const shouldLoadImage = safeImageUrl && failedImageUrl !== safeImageUrl;

    return (
        <span
            className={`flex shrink-0 items-center justify-center overflow-hidden border border-primary/15 bg-primary/15 text-primary ${SIZE_CLASSES[size]} ${className}`}
        >
            {shouldLoadImage ? (
                <img
                    key={safeImageUrl}
                    src={safeImageUrl}
                    alt=""
                    width={IMAGE_SIZES[size]}
                    height={IMAGE_SIZES[size]}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                    fetchPriority="low"
                    referrerPolicy="no-referrer"
                    onError={() => setFailedImageUrl(safeImageUrl)}
                />
            ) : fallback ? (
                <span className="font-semibold">{fallback}</span>
            ) : (
                <Shield className={ICON_CLASSES[size]} />
            )}
        </span>
    );
}
