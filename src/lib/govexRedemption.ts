import type { DAO } from "@/types";

export const GOVEX_REDEMPTION = {
    daoId: "0x2d6e466623b393e69a476bb22dc96aff388ec18d1d6da4c821d12c36456eea1a",
    poolId: "0x06526cd01b991460e0df74f9e77af8d57dc6fd9a9dde70b6affa52c19ce3eb5b",
    capabilityId: "0xa00a02d0378818707e74e6b6ecef4f4d44c5c369925b932f7ba8fbf4c2965b6f",
    futarchyActionsPackageId: "0x17fca531a63ee76e437f6cc579d82171a1ec6163cd6e37cd7216f50906ad6bab",
    assetType: "0x0f5a49f57d89b812eface201194381d5c81b462f39b90b220a024750737ea5d4::govex::GOVEX",
    redeemCoinType: "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC",
    assetDecimals: 9,
    redeemCoinDecimals: 6,
} as const;

export function isGovexRedemptionDAO(
    dao: Pick<DAO, "id" | "asset_type" | "stable_type">,
    currentNetwork: string
): boolean {
    return (
        currentNetwork === "mainnet" &&
        dao.id.toLowerCase() === GOVEX_REDEMPTION.daoId &&
        dao.asset_type.toLowerCase() === GOVEX_REDEMPTION.assetType.toLowerCase() &&
        dao.stable_type.toLowerCase() === GOVEX_REDEMPTION.redeemCoinType.toLowerCase()
    );
}

/** Mirrors the Move claim calculation, including its integer truncation. */
export function calculateGovexRedemptionAmount(
    poolBalance: bigint,
    walletGovexBalance: bigint,
    currentGovexSupply: bigint
): bigint {
    if (poolBalance <= 0n || walletGovexBalance <= 0n || currentGovexSupply <= 0n) return 0n;
    return (poolBalance * walletGovexBalance) / currentGovexSupply;
}
