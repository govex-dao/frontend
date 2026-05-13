import { Clock, Users, BarChart3, DollarSign, TrendingUp, MapPin, Coins } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export interface ParamConfig {
    label: string;
    unit: string;
    currentValue: string;
}

export interface ConfigCategory {
    value: string;
    label: string;
    icon: LucideIcon;
}

// Config parameter definitions matching the org config structure
export const configParameters = {
    addresses: {
        vault: { label: "Vault", unit: "", currentValue: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb" },
        conditionalTokens: {
            label: "Conditional Tokens",
            unit: "",
            currentValue: "0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb",
        },
    },
    trading: {
        minimumAssetAmount: { label: "Minimum Asset Amount", unit: "ASSET", currentValue: "1,000" },
        minimumStableAmount: { label: "Minimum Stable Amount", unit: "STABLE", currentValue: "1,000" },
        reviewPeriodMs: { label: "Review Period", unit: "ms", currentValue: "3600000" },
        tradingPeriodMs: { label: "Trading Period", unit: "ms", currentValue: "86400000" },
        conditionalAMMFee: { label: "Conditional AMM Fee", unit: "bps", currentValue: "25" },
        conditionalLiquidityRatio: { label: "Conditional Liquidity Ratio", unit: "%", currentValue: "80" },
    },
    twap: {
        twapInitialObservation: { label: "TWAP Initial Observation", unit: "", currentValue: "1000" },
        twapStartDelay: { label: "TWAP Start Delay", unit: "ms", currentValue: "0" },
        twapCapPpm: { label: "TWAP Max Movement", unit: "ppm", currentValue: "10000" },
        twapThreshold: { label: "TWAP Threshold", unit: "base 100k", currentValue: "100" },
        sponsoredThreshold: { label: "Sponsored Threshold", unit: "base 100k", currentValue: "0" },
    },
    governance: {
        maxOutcomes: { label: "Max Outcomes", unit: "", currentValue: "2" },
        maxActionsPerOutcome: { label: "Max Actions Per Outcome", unit: "", currentValue: "50" },
        proposalCreationFee: { label: "Proposal Creation Fee", unit: "tokens", currentValue: "0" },
        proposalFeePerOutcome: { label: "Fee Per Outcome", unit: "tokens", currentValue: "0" },
        proposalIntentExpiryMs: { label: "Intent Expiry", unit: "ms", currentValue: "86400000" },
    },
    quota: {
        feelessQuota: { label: "Feeless Quota", unit: "", currentValue: "0" },
        sponsorQuota: { label: "Sponsor Quota", unit: "", currentValue: "0" },
    },
    sponsorship: {
        sponsorshipEnabled: { label: "Sponsorship Enabled", unit: "", currentValue: "false" },
    },
    conditionalCoin: {
        name: { label: "Name", unit: "", currentValue: "Conditional Token" },
        symbol: { label: "Symbol", unit: "", currentValue: "cTOKEN" },
        decimals: { label: "Decimals", unit: "", currentValue: "9" },
    },
} as const;

export type ConfigCategoryKey = keyof typeof configParameters;

// All categories including addresses (for ConfigTab display)
export const allConfigCategories: ConfigCategory[] = [
    { value: "addresses", label: "Addresses", icon: MapPin },
    { value: "trading", label: "Trading", icon: TrendingUp },
    { value: "twap", label: "TWAP", icon: Clock },
    { value: "governance", label: "Governance", icon: Users },
    { value: "quota", label: "Quota", icon: BarChart3 },
    { value: "sponsorship", label: "Sponsorship", icon: DollarSign },
    { value: "conditionalCoin", label: "Conditional Coin", icon: Coins },
];

// Editable categories (excludes addresses - for proposal config form)
export const editableConfigCategories: ConfigCategory[] = allConfigCategories.filter(
    (cat) => cat.value !== "addresses"
);

// Helper to format camelCase keys to readable labels
export const formatParamLabel = (key: string): string => {
    return key
        .replace(/([A-Z])/g, " $1")
        .replace(/^./, (str) => str.toUpperCase())
        .trim();
};

// Helper to get parameters for a category (as array)
export const getParamsForCategory = (category: ConfigCategoryKey) => {
    const params = configParameters[category];
    if (!params) return [];

    return Object.entries(params).map(([key, config]) => ({
        key,
        label: config.label,
        unit: config.unit,
        currentValue: config.currentValue,
    }));
};

// Helper to get parameters for a category (as object)
export const getCategoryParams = (category: ConfigCategoryKey) => {
    return configParameters[category];
};
