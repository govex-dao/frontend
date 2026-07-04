/**
 * Treasury balance hook using SDK devInspect on vault.move
 * Cached for 1 hour with jitter to avoid thundering herd
 */

import { useQuery } from "@tanstack/react-query";
import { resolveCoinIcon } from "@/lib/coin/icons";
import { formatUnits } from "@/lib/units";
import { useDAO } from "./useDAOs";
import { useCoins } from "./useCoins";
import { getProtocolVersionForDAO, getSDKForDAO, isSupportedProtocolDAO } from "../../lib/sdk";

export const treasuryKeys = {
    all: ["treasury"] as const,
    balance: (daoId: string, protocolVersion?: string | null) =>
        [...treasuryKeys.all, "balance", daoId, protocolVersion ?? "current"] as const,
};

export interface TreasuryHolding {
    token: string;
    symbol: string;
    logo: string;
    balance: number;
    balanceDisplay: string;
    coinType: string;
}

const STALE_TIME_BASE = 60 * 60 * 1000; // 1 hour

// Stable jitter per daoId to avoid thundering herd
const jitterCache = new Map<string, number>();
function getStaleTime(daoId: string): number {
    if (!jitterCache.has(daoId)) {
        // Add 0-10% random jitter
        jitterCache.set(daoId, STALE_TIME_BASE + Math.floor(Math.random() * STALE_TIME_BASE * 0.1));
    }
    return jitterCache.get(daoId)!;
}

/**
 * Query DAO treasury stable coin balance via devInspect on vault.move's get_total_balance
 */
export function useTreasuryHoldings(daoId?: string) {
    const { data: dao } = useDAO(daoId);
    const { data: coins } = useCoins();
    const protocolVersion = getProtocolVersionForDAO(dao);
    const isSupportedProtocol = isSupportedProtocolDAO(dao);

    return useQuery({
        queryKey: treasuryKeys.balance(daoId!, protocolVersion),
        queryFn: async (): Promise<TreasuryHolding[]> => {
            const sdk = getSDKForDAO(dao);
            const stableType = dao!.stable_type;
            const decimals = dao!.stable_decimals || 9;

            const balanceRaw = await sdk.dao.vault.getTotalBalance(daoId!, stableType);
            const balance = Number(balanceRaw) / Math.pow(10, decimals);
            const balanceDisplay = formatUnits(BigInt(balanceRaw), decimals, {
                maxFractionDigits: Math.min(decimals, 6),
            });

            const stableSymbol = dao!.stable_symbol || "USDC";
            const coinMeta =
                coins?.find((c) => c.coin_type === stableType) ?? coins?.find((c) => c.symbol === stableSymbol);

            return [
                {
                    token: coinMeta?.name || stableSymbol,
                    symbol: stableSymbol,
                    logo: resolveCoinIcon({
                        coinType: stableType,
                        symbol: stableSymbol,
                        iconUrl: coinMeta?.icon_url,
                    }),
                    balance,
                    balanceDisplay,
                    coinType: stableType,
                },
            ];
        },
        enabled: !!daoId && !!dao && isSupportedProtocol,
        staleTime: daoId ? getStaleTime(daoId) : STALE_TIME_BASE,
        gcTime: 2 * 60 * 60 * 1000, // 2 hours
    });
}
