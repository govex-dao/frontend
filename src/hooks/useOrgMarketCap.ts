import { useQuery } from "@tanstack/react-query";
import { getSDKForDAO, isSupportedProtocolDAO } from "@/lib/sdk";
import type { DAODisplay } from "@/types";

export function useOrgMarketCap(dao: DAODisplay | undefined) {
    const enabled = !!dao?.spotPoolId && isSupportedProtocolDAO(dao);

    return useQuery({
        queryKey: [
            "org-market-cap",
            dao?.id,
            dao?.spotPoolId,
            dao?.assetType,
            dao?.stableType,
            dao?.assetDecimals,
            dao?.stableDecimals,
        ],
        queryFn: async () => {
            if (!dao?.spotPoolId) {
                return { marketCap: 0, formatted: null };
            }

            const sdk = getSDKForDAO(dao);
            const [reserves, supply] = await Promise.all([
                sdk.market.getReserves(dao.spotPoolId),
                sdk.utils.currency.getTotalSupply(dao.assetType),
            ]);

            if (reserves.asset === 0n || reserves.stable === 0n || supply === 0n) {
                return { marketCap: 0, formatted: null };
            }

            const SCALE = 10n ** 12n;
            const priceScaled =
                (reserves.stable * 10n ** BigInt(dao.assetDecimals) * SCALE) /
                (reserves.asset * 10n ** BigInt(dao.stableDecimals));

            const marketCapScaled =
                (priceScaled * supply) / (10n ** BigInt(dao.assetDecimals));

            const marketCap = Number(marketCapScaled) / Number(SCALE);
            return {
                marketCap,
                formatted: formatPrice(marketCap),
            };
        },
        enabled,
        staleTime: 15_000,
        refetchInterval: 30_000,
    });
}

function formatPrice(price: number): string {
    if (price === 0) return "0";
    return price >= 1
        ? price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 4 })
        : price.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 6 });
}
