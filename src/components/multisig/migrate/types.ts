import type { OwnedObjectInfo } from "@govex/futarchy-sdk/multisig/reads";

export interface MigrationCoinRow {
    coinType: string;
    totalBalance: string;
    objectBalance: string;
    coinObjectCount: number;
    objectBalanceKnown: boolean;
    objectBalanceLoading: boolean;
    objectScanComplete: boolean;
    objectScanTruncated: boolean;
    symbol: string;
    name: string;
    decimals: number;
}

export type ManagedCapKind = "upgrade" | "treasury" | "metadata";
export type CapMigrationMode = "lock" | "move";

export interface MigrationCapLockEntry {
    object: OwnedObjectInfo;
    kind: ManagedCapKind;
    coinType?: string;
    packageName?: string;
    delayDays?: string;
}

export interface MigrationPlan {
    selectedCoinRows: MigrationCoinRow[];
    coinAmounts: Record<string, string>;
    selectedMoveObjects: OwnedObjectInfo[];
    selectedCapLockEntries: MigrationCapLockEntry[];
    selectedCoinErrors: string[];
    capLockErrors: string[];
    hasSelectedAssets: boolean;
    isReady: boolean;
}

export interface WalletBalance {
    coinType: string;
    totalBalance: string;
}

export interface CoinObjectScan {
    coinType: string;
    objectBalance: string;
    coinObjectCount: number;
    isComplete: boolean;
    hitObjectLimit: boolean;
}

export interface ObjectTransferAbility {
    canKeep: boolean;
    checked: boolean;
    error?: boolean;
}
