import { describe, expect, it } from "vitest";
import { calculateGovexRedemptionAmount, GOVEX_REDEMPTION, isGovexRedemptionDAO } from "./govexRedemption";

describe("calculateGovexRedemptionAmount", () => {
    it("matches the live 1,000 GOVEX redemption estimate", () => {
        expect(calculateGovexRedemptionAmount(121_384_095_790n, 1_000_000_000_000n, 50_755_968_547_745_351n)).toBe(
            2_391_523n
        );
    });

    it("uses floor division like the Move contract", () => {
        expect(calculateGovexRedemptionAmount(10n, 1n, 3n)).toBe(3n);
    });

    it("returns zero when no redemption is possible", () => {
        expect(calculateGovexRedemptionAmount(0n, 100n, 1_000n)).toBe(0n);
        expect(calculateGovexRedemptionAmount(100n, 0n, 1_000n)).toBe(0n);
        expect(calculateGovexRedemptionAmount(100n, 100n, 0n)).toBe(0n);
    });
});

describe("isGovexRedemptionDAO", () => {
    const govexDAO = {
        id: GOVEX_REDEMPTION.daoId,
        asset_type: GOVEX_REDEMPTION.assetType,
        stable_type: GOVEX_REDEMPTION.redeemCoinType,
    };

    it("only enables redemption for the exact Govex DAO on mainnet", () => {
        expect(isGovexRedemptionDAO(govexDAO, "mainnet")).toBe(true);
        expect(isGovexRedemptionDAO(govexDAO, "testnet")).toBe(false);
        expect(isGovexRedemptionDAO({ ...govexDAO, id: "0x123" }, "mainnet")).toBe(false);
    });
});
