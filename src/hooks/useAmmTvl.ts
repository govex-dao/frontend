import { useQuery } from "@tanstack/react-query";
import { type ConditionalAmmReserve } from "@govex/futarchy-sdk";
import { getSDKForDAO, isSupportedProtocolDAO } from "@/lib/sdk";
import type { DAO } from "@/types";

export interface AmmTvlSlice {
    assetRaw: bigint;
    stableRaw: bigint;
    assetValueStableRaw: bigint;
    tvlStableRaw: bigint;
}

export interface AmmTvlPoolRow extends ConditionalAmmReserve {
    assetValueStableRaw: bigint;
    tvlStableRaw: bigint;
}

export interface AmmTvlData {
    spotPrice: number;
    spotPriceFormatted: string | null;
    totalTvlStableRaw: bigint;
    spot: AmmTvlSlice;
    proposal: AmmTvlSlice & {
        active: boolean;
        marketStateId: string | null;
        proposalId: string | null;
        pools: AmmTvlPoolRow[];
    };
}

export function useAmmTvl(dao: DAO | undefined, queryEnabled = true) {
    const poolId = dao?.spot_pool_id;
    const isSupportedProtocol = isSupportedProtocolDAO(dao);

    return useQuery({
        queryKey: [
            "amm-tvl",
            poolId,
            dao?.version,
            dao?.asset_decimals,
            dao?.stable_decimals,
            dao?.asset_type,
            dao?.stable_type,
        ],
        queryFn: async (): Promise<AmmTvlData> => {
            const reserves = await getSDKForDAO(dao).market.getTotalReserves(poolId!);
            const spot = {
                assetRaw: reserves.spot.asset,
                stableRaw: reserves.spot.stable,
                assetValueStableRaw: reserves.spot.stable,
                tvlStableRaw: reserves.spot.stableValue,
            };
            const proposal = {
                assetRaw: reserves.proposal.asset,
                stableRaw: reserves.proposal.stable,
                assetValueStableRaw: reserves.proposal.assetStableValue,
                tvlStableRaw: reserves.proposal.stableValue,
            };
            const pools = reserves.proposal.pools.map((pool) => {
                const assetValueStableRaw = valueAssetInStable(pool.asset, reserves.spot);
                return {
                    ...pool,
                    assetValueStableRaw,
                    tvlStableRaw: pool.stable + assetValueStableRaw,
                };
            });
            const spotPrice = calculateSpotPrice(
                reserves.spot.asset,
                reserves.spot.stable,
                dao!.asset_decimals,
                dao!.stable_decimals
            );

            return {
                spotPrice,
                spotPriceFormatted: spotPrice > 0 ? formatPrice(spotPrice) : null,
                totalTvlStableRaw: reserves.totalStableValue,
                spot,
                proposal: {
                    ...proposal,
                    active: reserves.proposal.active,
                    marketStateId: reserves.proposal.marketStateId,
                    proposalId: reserves.proposal.proposalId,
                    pools,
                },
            };
        },
        enabled: queryEnabled && !!poolId && isSupportedProtocol,
        staleTime: 15_000,
        refetchInterval: 30_000,
    });
}

function valueAssetInStable(assetRaw: bigint, spot: { asset: bigint; stable: bigint }): bigint {
    if (assetRaw === 0n || spot.asset === 0n || spot.stable === 0n) return 0n;
    return (assetRaw * spot.stable) / spot.asset;
}

function calculateSpotPrice(
    assetReserve: bigint,
    stableReserve: bigint,
    assetDecimals: number,
    stableDecimals: number
): number {
    if (assetReserve === 0n || stableReserve === 0n) return 0;
    const scale = 10n ** 12n;
    const scaledPrice =
        (stableReserve * 10n ** BigInt(assetDecimals) * scale) / (assetReserve * 10n ** BigInt(stableDecimals));
    return Number(scaledPrice) / Number(scale);
}

function formatPrice(price: number): string {
    if (price === 0) return "0";
    if (price >= 1) {
        return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 });
    }
    const digits = Math.max(2, -Math.floor(Math.log10(price)) + 3);
    return price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: digits });
}
