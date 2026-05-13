import type { Proposal } from "./Proposal";

export interface Org {
    id: string;
    name: string;
    description: string;
    logo: string;
    links: {
        website?: string;
        twitter?: string;
        discord?: string;
        telegram?: string;
        github?: string;
        reddit?: string;
        docs?: string;
    };
    verification: {
        verified: boolean;
    };
    fundraiseId?: string;
    totalVolume: number;
    proposalCount: number;
    createdAt: Date;
    proposals?: Proposal[];

    treasuryValue: number;
    tokenPrice: number;
    marketCap: number;
    holders: number;
    monthlyAllowance: number;
    monthlyRevenue: number;
    tokenAddress: string;
    treasuryAddress: string;
    coverImage: string;
    proposalCreationFee?: number; // Legacy display-only field; prefer DAO config fee fields
}

export interface Pool {
    id: string;
    orgId: string;
    address: string;
    stableCurrency: string;
    assetCurrency: string;
    poolRatio: number; // percentage of stable currency
    totalStable: number;
    totalAsset: number;
    tvl: number;
    spotPrice: number; // price per asset token in stable currency
    conditionalPrice: number; // conditional market price
    userLiquidity?: {
        stableAmount: number;
        assetAmount: number;
        tvl: number;
        percentOfTotal: number;
    };
}
