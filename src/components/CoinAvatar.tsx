import { useEffect, useMemo, useState } from "react";
import { useCoins } from "@/hooks/api/useCoins";
import { getKnownCoinIcon } from "@/lib/coin/icons";

interface Props {
    coinType?: string;
    symbol?: string;
    iconUrl?: string | null;
    size?: "sm" | "md" | "lg";
}

const sizeClasses = {
    sm: "w-4 h-4",
    md: "w-5 h-5",
    lg: "w-8 h-8",
};

const textSizeClasses = {
    sm: "text-[7px]",
    md: "text-[9px]",
    lg: "text-xs",
};

export function CoinAvatar({ coinType, symbol, iconUrl, size = "md" }: Props) {
    const { data: coins } = useCoins();
    const [failedSrcs, setFailedSrcs] = useState<string[]>([]);

    // Resolve from coinType if icon/symbol not provided directly
    let resolvedIcon = iconUrl;
    let resolvedSymbol = symbol;
    if (coinType && coins && (resolvedIcon === undefined || !resolvedSymbol)) {
        const coin = coins.find((c) => c.coin_type === coinType);
        if (coin) {
            if (resolvedIcon === undefined) resolvedIcon = coin.icon_url;
            if (!resolvedSymbol) resolvedSymbol = coin.symbol;
        }
    }

    const knownIcon = getKnownCoinIcon({ coinType, symbol: resolvedSymbol });
    const iconCandidates = useMemo(
        () => Array.from(new Set([knownIcon, resolvedIcon].filter((src): src is string => !!src))),
        [knownIcon, resolvedIcon]
    );

    useEffect(() => {
        setFailedSrcs([]);
    }, [iconCandidates]);

    resolvedIcon = iconCandidates.find((src) => !failedSrcs.includes(src)) ?? null;

    const sizeClass = sizeClasses[size];
    const textClass = textSizeClasses[size];

    if (resolvedIcon) {
        return (
            <span
                className={`${sizeClass} shrink-0 overflow-hidden rounded-full ring-1 ring-border flex items-center justify-center`}
            >
                <img
                    src={resolvedIcon}
                    alt={resolvedSymbol || "coin"}
                    className="h-full w-full rounded-full object-contain"
                    onError={() =>
                        setFailedSrcs((prev) => (prev.includes(resolvedIcon!) ? prev : [...prev, resolvedIcon!]))
                    }
                />
            </span>
        );
    }

    return (
        <div className={`${sizeClass} rounded-full bg-primary/15 flex items-center justify-center ring-1 ring-border`}>
            <span className={`${textClass} font-bold text-primary`}>{resolvedSymbol?.charAt(0) || "?"}</span>
        </div>
    );
}
