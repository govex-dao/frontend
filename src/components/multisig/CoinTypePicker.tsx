import { useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { useQuery } from "@tanstack/react-query";
import { formatAddress, parseStructTag, SUI_DECIMALS, SUI_TYPE_ARG } from "@mysten/sui/utils";
import { Select, type SelectOption } from "@/components/inputs/Select";
import { Input } from "@/components/inputs/Input";
import { CoinAvatar } from "@/components/CoinAvatar";
import { useCoins } from "@/hooks/api/useCoins";
import type { CoinMetadata } from "@/lib/api/coins";
import { getCoinMetadata, mapWithConcurrency } from "@/lib/sui/batchedReads";

interface Props {
    value: string;
    onChange: (coinType: string, decimals: number, balanceRaw?: string) => void;
    label?: string;
    className?: string;
    /** When provided, only these coin types are shown (no custom input). */
    allowedCoinTypes?: string[];
    /** When provided, these balances are shown instead of user wallet balances. */
    balanceOverrides?: Map<string, string>;
}

const SUI_COIN_TYPE = SUI_TYPE_ARG;
const CUSTOM_VALUE = "__custom__";

function truncateCoinType(coinType: string): string {
    if (coinType.length <= 24) return coinType;
    try {
        const tag = parseStructTag(coinType);
        return `${formatAddress(tag.address)}::${tag.module}::${tag.name}`;
    } catch {
        return coinType;
    }
}

function formatBalance(rawBalance: string, decimals: number): string {
    if (!rawBalance || rawBalance === "0") return "0";
    const bi = BigInt(rawBalance);
    const divisor = 10n ** BigInt(decimals);
    const whole = bi / divisor;
    const remainder = bi % divisor;
    const fractionStr = remainder.toString().padStart(decimals, "0").slice(0, 4).replace(/0+$/, "");
    const wholeStr = whole.toLocaleString("en-US");
    return fractionStr ? `${wholeStr}.${fractionStr}` : wholeStr;
}

function coinToOption(coin: CoinMetadata, balance?: string): SelectOption {
    const balDisplay = balance !== undefined ? formatBalance(balance, coin.decimals) : undefined;
    return {
        value: coin.coin_type,
        label:
            balDisplay !== undefined
                ? `${coin.symbol} — ${truncateCoinType(coin.coin_type)} · ${balDisplay}`
                : `${coin.symbol} — ${truncateCoinType(coin.coin_type)}`,
    };
}

export function CoinTypePicker({
    value,
    onChange,
    label = "Coin Type",
    className,
    allowedCoinTypes,
    balanceOverrides,
}: Props) {
    const { data: coins } = useCoins();
    const client = useSuiClient();
    const account = useCurrentAccount();
    const [isCustom, setIsCustom] = useState(false);
    const [customType, setCustomType] = useState("");
    const [resolving, setResolving] = useState(false);

    // Fetch user's wallet balances
    const { data: balances } = useQuery({
        queryKey: ["allBalances", account?.address],
        queryFn: () => client.getAllBalances({ owner: account!.address }),
        enabled: !!account?.address,
        staleTime: 30_000,
    });

    const allowedMetadataKey = useMemo(
        () => (allowedCoinTypes ? [...allowedCoinTypes].sort() : []),
        [allowedCoinTypes]
    );

    const { data: resolvedAllowedMetadata } = useQuery({
        queryKey: ["coinMetadata", "allowed", allowedMetadataKey],
        queryFn: async () => {
            const cachedTypes = new Set((coins ?? []).map((coin) => coin.coin_type));
            const missingTypes = allowedMetadataKey.filter((coinType) => !cachedTypes.has(coinType));
            const results = await mapWithConcurrency(missingTypes, 4, async (coinType) => {
                const meta = await getCoinMetadata(client, coinType);
                return {
                    coin_type: coinType,
                    name: meta?.name ?? coinType.split("::").pop() ?? coinType,
                    symbol: meta?.symbol ?? coinType.split("::").pop() ?? "???",
                    decimals: meta?.decimals ?? SUI_DECIMALS,
                    description: meta?.description ?? "",
                    icon_url: meta?.iconUrl ?? null,
                    icon_cache_path: null,
                } satisfies CoinMetadata;
            });
            return results;
        },
        enabled: allowedMetadataKey.length > 0,
        staleTime: 5 * 60_000,
    });

    // Build balance lookup: coinType -> totalBalance (raw string)
    // Use overrides (e.g. vault balances) when provided, otherwise wallet balances
    const balanceMap = new Map<string, string>();
    if (balanceOverrides) {
        for (const [k, v] of balanceOverrides) {
            balanceMap.set(k, v);
        }
    } else if (balances) {
        for (const b of balances) {
            balanceMap.set(b.coinType, b.totalBalance);
        }
    }

    const allowedSet = allowedCoinTypes ? new Set(allowedCoinTypes) : null;

    // Build options from cached coins
    const coinOptions: SelectOption[] = [];
    const seen = new Set<string>();

    if (coins) {
        for (const coin of coins) {
            if (allowedSet && !allowedSet.has(coin.coin_type)) continue;
            coinOptions.push(coinToOption(coin, balanceMap.get(coin.coin_type)));
            seen.add(coin.coin_type);
        }
    }

    // Add allowed types that aren't in the coin metadata cache
    if (allowedSet) {
        for (const coin of resolvedAllowedMetadata ?? []) {
            if (seen.has(coin.coin_type)) continue;
            if (!allowedSet.has(coin.coin_type)) continue;
            coinOptions.push(coinToOption(coin, balanceMap.get(coin.coin_type)));
            seen.add(coin.coin_type);
        }
        for (const type of allowedSet) {
            if (seen.has(type)) continue;
            seen.add(type);
            const bal = balanceMap.get(type);
            const balDisplay = bal ? formatBalance(bal, SUI_DECIMALS) : "0";
            coinOptions.push({
                value: type,
                label: `${truncateCoinType(type)} · ${balDisplay}`,
            });
        }
    } else {
        // No filter — show SUI as default + custom option
        if (!seen.has(SUI_COIN_TYPE)) {
            const suiBal = balanceMap.get(SUI_COIN_TYPE);
            const suiDisplay = suiBal ? formatBalance(suiBal, SUI_DECIMALS) : "0";
            coinOptions.unshift({ value: SUI_COIN_TYPE, label: `SUI — ${SUI_COIN_TYPE} · ${suiDisplay}` });
        }
        coinOptions.push({ value: CUSTOM_VALUE, label: "Custom..." });
    }

    const handleSelect = (selected: string) => {
        if (selected === CUSTOM_VALUE) {
            setIsCustom(true);
            return;
        }
        setIsCustom(false);
        // Find decimals from cached coins
        const coin =
            coins?.find((c) => c.coin_type === selected) ??
            resolvedAllowedMetadata?.find((c) => c.coin_type === selected);
        const decimals = coin?.decimals ?? SUI_DECIMALS;
        onChange(selected, decimals, balanceMap.get(selected));
    };

    const handleCustomSubmit = async () => {
        if (!customType.trim()) return;
        setResolving(true);
        try {
            const meta = await getCoinMetadata(client, customType.trim());
            onChange(customType.trim(), meta?.decimals ?? SUI_DECIMALS);
            setIsCustom(false);
        } catch {
            // If metadata not found, default to 9 decimals
            onChange(customType.trim(), SUI_DECIMALS);
            setIsCustom(false);
        } finally {
            setResolving(false);
        }
    };

    if (isCustom) {
        return (
            <div className={`space-y-2 ${className ?? ""}`}>
                <Input label={label} value={customType} onChange={setCustomType} placeholder="0x2::sui::SUI" />
                <div className="flex gap-2">
                    <button
                        type="button"
                        onClick={handleCustomSubmit}
                        disabled={resolving || !customType.trim()}
                        className="px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors disabled:opacity-40"
                    >
                        {resolving ? "Resolving..." : "Use This Type"}
                    </button>
                    <button
                        type="button"
                        onClick={() => setIsCustom(false)}
                        className="px-3 py-1.5 rounded-lg bg-card-elevated border border-border text-text-muted text-xs font-medium hover:bg-card-more-elevated transition-colors"
                    >
                        Cancel
                    </button>
                </div>
            </div>
        );
    }

    // Show selected coin with icon if available
    const selectedCoin =
        coins?.find((c) => c.coin_type === value) ?? resolvedAllowedMetadata?.find((c) => c.coin_type === value);

    return (
        <div className={className}>
            {selectedCoin && value && (
                <div className="flex items-center gap-2 mb-2">
                    <CoinAvatar
                        coinType={selectedCoin.coin_type}
                        symbol={selectedCoin.symbol}
                        iconUrl={selectedCoin.icon_url}
                    />
                    <span className="text-xs text-text-secondary font-medium">{selectedCoin.symbol}</span>
                    <span className="text-[10px] text-text-muted">{selectedCoin.decimals} decimals</span>
                </div>
            )}
            <Select
                label={!selectedCoin || !value ? label : undefined}
                options={coinOptions}
                value={value}
                onChange={handleSelect}
                placeholder="Select a coin type..."
                searchPlaceholder="Search coins..."
            />
        </div>
    );
}
