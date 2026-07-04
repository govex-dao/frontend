import { useCallback, useEffect, useMemo, useState } from "react";
import { SUI_DECIMALS, SUI_TYPE_ARG } from "@mysten/sui/utils";
import { useCoins } from "@/hooks/api/useCoins";
import { useMergedCoinMetadata } from "@/hooks/useOnChainCoinMetadata";
import { MAX_COIN_OBJECTS_PER_DEPOSIT } from "./constants";
import { useSelectedCoinObjectScans, useWalletBalances } from "./queries";
import type { MigrationCoinRow } from "./types";
import { defaultCoinAmount, maxCoinObjectAmount, normalizedType, tryParseAmount } from "./utils";

interface Args {
    owner: string | undefined;
    queryEnabled: boolean;
    isOpen: boolean;
    resolvedVaultName: string;
    approvedCoinTypes: string[];
}

export function useMigrationCoins({ owner, queryEnabled, isOpen, resolvedVaultName, approvedCoinTypes }: Args) {
    const [selectedCoinTypes, setSelectedCoinTypes] = useState<Set<string>>(() => new Set());
    const [coinAmounts, setCoinAmounts] = useState<Record<string, string>>({});

    const { data: walletBalances = [], isLoading: balancesLoading } = useWalletBalances(owner, queryEnabled);
    const { data: backendCoins } = useCoins();
    const coinTypes = useMemo(() => walletBalances.map((balance) => balance.coinType), [walletBalances]);
    const coins = useMergedCoinMetadata(coinTypes, backendCoins);
    const selectedCoinTypesForObjectScan = useMemo(
        () => [...selectedCoinTypes].filter((coinType) => coinType !== SUI_TYPE_ARG).sort((a, b) => a.localeCompare(b)),
        [selectedCoinTypes]
    );
    const { data: coinObjectScans = [], isLoading: coinObjectScansLoading } = useSelectedCoinObjectScans(
        owner,
        selectedCoinTypesForObjectScan,
        queryEnabled
    );
    const coinObjectScanByType = useMemo(
        () => new Map(coinObjectScans.map((scan) => [scan.coinType, scan])),
        [coinObjectScans]
    );
    const approvedCoinTypeSet = useMemo(() => new Set(approvedCoinTypes.map(normalizedType)), [approvedCoinTypes]);

    const coinRows = useMemo<MigrationCoinRow[]>(() => {
        const metadataByType = new Map((coins ?? []).map((coin) => [coin.coin_type, coin]));
        return walletBalances
            .filter((balance) => BigInt(balance.totalBalance || "0") > 0n)
            .map((balance) => {
                const meta = metadataByType.get(balance.coinType);
                const scan = coinObjectScanByType.get(balance.coinType);
                const isSui = balance.coinType === SUI_TYPE_ARG;
                const objectBalanceKnown = isSui || !!scan;
                return {
                    coinType: balance.coinType,
                    totalBalance: balance.totalBalance,
                    objectBalance: isSui ? balance.totalBalance : (scan?.objectBalance ?? "0"),
                    coinObjectCount: isSui ? 0 : (scan?.coinObjectCount ?? 0),
                    objectBalanceKnown,
                    objectBalanceLoading:
                        !isSui && selectedCoinTypes.has(balance.coinType) && coinObjectScansLoading && !scan,
                    objectScanComplete: isSui || !!scan?.isComplete,
                    objectScanTruncated: !isSui && !!scan?.hitObjectLimit,
                    symbol:
                        meta?.symbol ??
                        (balance.coinType === SUI_TYPE_ARG ? "SUI" : (balance.coinType.split("::").pop() ?? "???")),
                    name: meta?.name ?? balance.coinType.split("::").pop() ?? "Unknown",
                    decimals: meta?.decimals ?? SUI_DECIMALS,
                };
            })
            .sort((a, b) =>
                a.coinType === SUI_TYPE_ARG ? -1 : b.coinType === SUI_TYPE_ARG ? 1 : a.symbol.localeCompare(b.symbol)
            );
    }, [coinObjectScanByType, coinObjectScansLoading, coins, selectedCoinTypes, walletBalances]);

    const allowedCoinTypes = approvedCoinTypeSet;

    const selectedCoinRows = useMemo(
        () => coinRows.filter((row) => selectedCoinTypes.has(row.coinType)),
        [coinRows, selectedCoinTypes]
    );
    const invalidCoinReason = useCallback(
        (row: MigrationCoinRow): string | null => {
            if (!allowedCoinTypes.has(normalizedType(row.coinType))) {
                return resolvedVaultName ? `Approve ${row.symbol} for ${resolvedVaultName} first` : "Select a vault";
            }
            if (row.objectBalanceLoading) return "Scanning coin objects";
            if (!row.objectBalanceKnown) return "Select to scan coin objects";
            const amountRaw = tryParseAmount(coinAmounts[row.coinType] ?? "", row.decimals);
            if (amountRaw === null || amountRaw <= 0n) return "Enter an amount";
            const maxRaw = maxCoinObjectAmount(row);
            if (maxRaw === 0n) return row.coinType === SUI_TYPE_ARG ? "Leave SUI for gas" : "No coin objects to move";
            if (amountRaw > maxRaw && row.objectScanTruncated) {
                return `Amount exceeds first ${MAX_COIN_OBJECTS_PER_DEPOSIT} coin objects`;
            }
            if (amountRaw > maxRaw) {
                return row.coinType === SUI_TYPE_ARG ? "Leave SUI for gas" : "Amount exceeds balance";
            }
            return null;
        },
        [allowedCoinTypes, coinAmounts, resolvedVaultName]
    );
    const selectedCoinErrors = useMemo(
        () => selectedCoinRows.map(invalidCoinReason).filter((reason): reason is string => !!reason),
        [invalidCoinReason, selectedCoinRows]
    );

    useEffect(() => {
        if (!isOpen) {
            setSelectedCoinTypes(new Set());
            setCoinAmounts({});
        }
    }, [isOpen]);

    useEffect(() => {
        if (!isOpen) return;
        setSelectedCoinTypes(new Set());
        setCoinAmounts({});
    }, [isOpen, owner, resolvedVaultName]);

    useEffect(() => {
        if (!queryEnabled || coinRows.length === 0) return;
        setCoinAmounts((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const row of coinRows) {
                if (row.objectBalanceKnown && next[row.coinType] == null) {
                    next[row.coinType] = defaultCoinAmount(row.coinType, row.objectBalance, row.decimals);
                    changed = true;
                }
            }
            return changed ? next : prev;
        });
    }, [coinRows, queryEnabled]);

    const toggleCoin = useCallback(
        (coinType: string) => {
            if (!resolvedVaultName || !allowedCoinTypes.has(normalizedType(coinType))) return;
            setSelectedCoinTypes((prev) => {
                const next = new Set(prev);
                if (next.has(coinType)) next.delete(coinType);
                else next.add(coinType);
                return next;
            });
        },
        [allowedCoinTypes, resolvedVaultName]
    );

    const selectAllApprovedCoins = useCallback(() => {
        if (!resolvedVaultName) return;
        setSelectedCoinTypes(
            new Set(
                coinRows.filter((row) => allowedCoinTypes.has(normalizedType(row.coinType))).map((row) => row.coinType)
            )
        );
    }, [allowedCoinTypes, coinRows, resolvedVaultName]);

    const clearCoins = useCallback(() => {
        setSelectedCoinTypes(new Set());
    }, []);

    const setCoinAmount = useCallback((coinType: string, value: string) => {
        setCoinAmounts((prev) => ({ ...prev, [coinType]: value }));
    }, []);

    return {
        allowedCoinTypes,
        balancesLoading,
        coinAmounts,
        coinRows,
        invalidCoinReason,
        selectedCoinErrors,
        selectedCoinRows,
        selectedCoinTypes,
        clearCoins,
        selectAllApprovedCoins,
        setCoinAmount,
        toggleCoin,
    };
}
