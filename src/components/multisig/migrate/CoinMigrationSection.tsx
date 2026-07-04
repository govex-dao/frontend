import { Check, Coins, Loader2 } from "lucide-react";
import { Input } from "@/components/inputs/Input";
import { MAX_COIN_OBJECTS_PER_DEPOSIT } from "./constants";
import type { MigrationCoinRow } from "./types";
import { formatRawAmount, normalizedType, shortType } from "./utils";

interface Props {
    coinRows: MigrationCoinRow[];
    balancesLoading: boolean;
    selectedCoinTypes: Set<string>;
    coinAmounts: Record<string, string>;
    resolvedVaultName: string;
    allowedCoinTypes: Set<string>;
    selectedCoinRowsCount: number;
    invalidCoinReason: (row: MigrationCoinRow) => string | null;
    onClearCoins: () => void;
    onSelectAllApprovedCoins: () => void;
    onToggleCoin: (coinType: string) => void;
    onCoinAmountChange: (coinType: string, value: string) => void;
}

export function CoinMigrationSection({
    coinRows,
    balancesLoading,
    selectedCoinTypes,
    coinAmounts,
    resolvedVaultName,
    allowedCoinTypes,
    selectedCoinRowsCount,
    invalidCoinReason,
    onClearCoins,
    onSelectAllApprovedCoins,
    onToggleCoin,
    onCoinAmountChange,
}: Props) {
    const approvedCoinRowsCount = coinRows.filter((row) => allowedCoinTypes.has(normalizedType(row.coinType))).length;

    return (
        <section className="space-y-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-center gap-2 text-sm font-semibold text-text-primary">
                    <Coins className="h-4 w-4 text-primary" />
                    Coins to vault
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                    {selectedCoinRowsCount > 0 && (
                        <button
                            type="button"
                            onClick={onClearCoins}
                            className="font-medium text-text-muted hover:text-text-primary"
                        >
                            Clear
                        </button>
                    )}
                    <button
                        type="button"
                        onClick={onSelectAllApprovedCoins}
                        disabled={!resolvedVaultName || approvedCoinRowsCount === 0}
                        className="font-medium text-primary transition-colors hover:text-primary-light disabled:cursor-not-allowed disabled:text-text-muted"
                    >
                        Select all approved
                    </button>
                    {selectedCoinRowsCount > 0 && (
                        <span className="text-text-muted">{selectedCoinRowsCount} selected</span>
                    )}
                </div>
            </div>
            <p className="text-[11px] leading-5 text-text-muted">
                Coin types must already be approved by the selected vault. Balances are shown by coin type; migration
                deposits the wallet coin objects behind each selected balance.
            </p>

            <div className="space-y-2">
                {balancesLoading ? (
                    <div className="flex items-center justify-center py-6 text-text-muted">
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Loading address balances...
                    </div>
                ) : coinRows.length === 0 ? (
                    <p className="py-3 text-sm text-text-muted">No coin balances found for this address.</p>
                ) : (
                    coinRows.map((row) => {
                        const selected = selectedCoinTypes.has(row.coinType);
                        const reason = invalidCoinReason(row);
                        const disabled = !resolvedVaultName || !allowedCoinTypes.has(normalizedType(row.coinType));

                        return (
                            <div
                                key={row.coinType}
                                className={`grid gap-2 rounded-lg border p-3 sm:grid-cols-[minmax(0,1fr)_11rem] ${
                                    selected
                                        ? "border-primary/40 bg-primary/10"
                                        : disabled
                                          ? "border-border-subtle bg-card-elevated/20 opacity-70"
                                          : "border-border-subtle bg-card-elevated/40"
                                }`}
                            >
                                <button
                                    type="button"
                                    onClick={() => onToggleCoin(row.coinType)}
                                    disabled={disabled}
                                    className="flex min-w-0 items-start gap-3 text-left disabled:cursor-not-allowed"
                                >
                                    <span
                                        className={`mt-1 flex h-4 w-4 shrink-0 items-center justify-center rounded border ${selected ? "border-primary bg-primary text-black" : "border-border-light"}`}
                                    >
                                        {selected && <Check className="h-3 w-3" />}
                                    </span>
                                    <span className="min-w-0">
                                        <span className="block text-sm font-semibold text-text-primary">
                                            {row.symbol}
                                        </span>
                                        <span className="block truncate text-xs text-text-muted">{row.name}</span>
                                        <span className="block break-all font-mono text-[10px] text-text-muted">
                                            {shortType(row.coinType)}
                                        </span>
                                    </span>
                                </button>
                                <div className="space-y-1">
                                    <Input
                                        value={coinAmounts[row.coinType] ?? ""}
                                        onChange={(value) => {
                                            if (!disabled) onCoinAmountChange(row.coinType, value);
                                        }}
                                        placeholder="0.00"
                                        size="sm"
                                        disabled={disabled}
                                    />
                                    <div className="text-right text-[10px] text-text-muted">
                                        {row.objectBalanceLoading
                                            ? "Scanning coin objects..."
                                            : row.objectBalanceKnown
                                              ? `Migratable ${formatRawAmount(row.objectBalance, row.decimals)}`
                                              : "Select to scan migratable coin objects"}
                                    </div>
                                    {row.objectScanTruncated && (
                                        <div className="text-right text-[10px] text-yellow-200">
                                            First {MAX_COIN_OBJECTS_PER_DEPOSIT} coin objects scanned
                                        </div>
                                    )}
                                    {row.coinObjectCount > 0 && (
                                        <div className="text-right text-[10px] text-text-muted">
                                            {row.objectScanComplete ? "" : "First "}
                                            {row.coinObjectCount} coin object{row.coinObjectCount === 1 ? "" : "s"}
                                        </div>
                                    )}
                                    {(selected || disabled) && reason && (
                                        <div
                                            className={`text-right text-[10px] ${disabled ? "text-text-muted" : "text-red-400"}`}
                                        >
                                            {reason}
                                        </div>
                                    )}
                                </div>
                            </div>
                        );
                    })
                )}
            </div>
        </section>
    );
}
