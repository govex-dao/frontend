import { useQuery } from "@tanstack/react-query";
import { getProtocolVersionForDAO, getSDKForDAO, isSupportedProtocolDAO } from "@/lib/sdk";
import type { DAO } from "@/types";

/**
 * Fetch the current spot AMM price for a DAO's asset token.
 * Reads pool reserves via RPC — works regardless of whether a proposal is live.
 *
 * Returns the price as "stable per 1 asset" (human-readable, decimal-adjusted).
 */
export function useSpotPrice(dao: DAO | undefined, enabled = true) {
    const poolId = dao?.spot_pool_id;
    const protocolVersion = getProtocolVersionForDAO(dao);
    const isSupportedProtocol = isSupportedProtocolDAO(dao);

    return useQuery({
        queryKey: [
            "spot-price",
            poolId,
            dao?.asset_type,
            dao?.stable_type,
            dao?.asset_decimals,
            dao?.stable_decimals,
            protocolVersion,
        ],
        queryFn: async () => {
            const sdk = getSDKForDAO(dao);
            const reserves = await sdk.market.getReserves(poolId!);

            if (reserves.asset === 0n || reserves.stable === 0n) {
                return { price: 0, formatted: null, reserves };
            }

            const assetDecimals = dao!.asset_decimals;
            const stableDecimals = dao!.stable_decimals;

            // price = (stableReserve / 10^stableDecimals) / (assetReserve / 10^assetDecimals)
            // Use BigInt precision: scale numerator by 10^12 then divide
            const SCALE = 10n ** 12n;
            const scaledPrice =
                (reserves.stable * 10n ** BigInt(assetDecimals) * SCALE) /
                (reserves.asset * 10n ** BigInt(stableDecimals));
            const price = Number(scaledPrice) / Number(SCALE);

            // Format to display string
            const formatted = formatPrice(price);

            return { price, formatted, reserves };
        },
        enabled: enabled && !!poolId && isSupportedProtocol,
        staleTime: 15_000,
        refetchInterval: 30_000,
    });
}

function formatPrice(price: number): string {
    if (price === 0) return "0";
    if (price >= 1) return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    // For small prices, show more decimals
    const digits = Math.max(2, -Math.floor(Math.log10(price)) + 3);
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}
