import type { DAO } from "@/types";
import { formatUnits } from "./units";

export interface ProposalFeeSummary {
    baseFeeRaw: bigint;
    perAdditionalOutcomeFeeRaw: bigint;
    additionalOutcomeFeeTotalRaw: bigint;
    totalFeeRaw: bigint;
    extraOutcomeCount: number;
    feeInAssetToken: boolean;
    decimals: number;
    symbol: string;
    baseFeeFormatted: string;
    perAdditionalOutcomeFeeFormatted: string;
    additionalOutcomeFeeTotalFormatted: string;
    totalFeeFormatted: string;
}

function formatFeeAmount(amount: bigint, decimals: number): string {
    return formatUnits(amount, decimals, {
        maxFractionDigits: Math.min(decimals, 4),
    });
}

export function getProposalFeeSummary(dao: DAO, customOutcomeCount: number): ProposalFeeSummary {
    const feeInAssetToken = dao.config?.dao_fee_in_asset_token ?? false;
    const baseFeeRaw = BigInt(dao.config?.dao_proposal_creation_fee ?? "0");
    const perAdditionalOutcomeFeeRaw = BigInt(dao.config?.dao_proposal_fee_per_outcome ?? "0");
    const extraOutcomeCount = Math.max(0, customOutcomeCount - 1);
    const additionalOutcomeFeeTotalRaw = perAdditionalOutcomeFeeRaw * BigInt(extraOutcomeCount);
    const totalFeeRaw = baseFeeRaw + additionalOutcomeFeeTotalRaw;
    const decimals = feeInAssetToken ? dao.asset_decimals : dao.stable_decimals;
    const symbol = feeInAssetToken ? dao.asset_symbol || "ASSET" : dao.stable_symbol || "STABLE";

    return {
        baseFeeRaw,
        perAdditionalOutcomeFeeRaw,
        additionalOutcomeFeeTotalRaw,
        totalFeeRaw,
        extraOutcomeCount,
        feeInAssetToken,
        decimals,
        symbol,
        baseFeeFormatted: formatFeeAmount(baseFeeRaw, decimals),
        perAdditionalOutcomeFeeFormatted: formatFeeAmount(perAdditionalOutcomeFeeRaw, decimals),
        additionalOutcomeFeeTotalFormatted: formatFeeAmount(additionalOutcomeFeeTotalRaw, decimals),
        totalFeeFormatted: formatFeeAmount(totalFeeRaw, decimals),
    };
}
