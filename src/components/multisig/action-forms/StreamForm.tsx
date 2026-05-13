import { useMemo } from "react";
import type { Transaction } from "@mysten/sui/transactions";
import { formatAddress, isValidSuiAddress } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { Textarea } from "@/components/inputs/Textarea";
import { TokenInput } from "@/components/inputs/TokenInput";
import { Select } from "@/components/inputs/Select";
import { CoinTypePicker } from "@/components/multisig/CoinTypePicker";
import { VaultNamePicker } from "@/components/multisig/VaultNamePicker";
import { useMultisigStreams, useMultisigVaultBalances, useVaultApprovedCoinTypes } from "@/hooks/useMultisig";
import { useCoins } from "@/hooks/api/useCoins";
import { addCreateStreamSpec, addCancelStreamSpec, type ActionSpecBuilder } from "@/lib/sui/multisig-tx";
import { parseAmountToBigInt } from "@/lib/parseAmount";

type StreamMode = "create" | "create_spending_limit" | "cancel";

export interface StreamData {
    mode: StreamMode;
    coinType: string;
    coinDecimals: number;
    vaultName: string;
    capRecipient: string;
    amountPerIteration: string;
    iterationsTotal: string;
    iterationPeriodDays: string;
    expiryTime: string; // datetime-local, preapproved spending only
    whitelistedRecipients: string;
    // Cancel fields
    streamId: string;
}

interface Props {
    accountId: string;
    data: StreamData;
    onChange: (data: StreamData) => void;
}

const MODE_OPTIONS = [
    { value: "create", label: "Create Payment Stream" },
    { value: "create_spending_limit", label: "Create Preapproved Spending" },
    { value: "cancel", label: "Cancel Payment Stream / Preapproved Spending" },
];

function parseRecipients(input: string): string[] {
    return input
        .split(/[\s,]+/)
        .map((entry) => entry.trim())
        .filter((entry) => entry.length > 0);
}

function hasDuplicateRecipients(recipients: string[]): boolean {
    return new Set(recipients.map((recipient) => recipient.toLowerCase())).size !== recipients.length;
}

export function StreamForm({ accountId, data, onChange }: Props) {
    const update = (patch: Partial<StreamData>) => onChange({ ...data, ...patch });
    const mode: StreamMode = data.mode ?? "create";
    const isCreateMode = mode === "create" || mode === "create_spending_limit";
    const isSpendingLimitMode = mode === "create_spending_limit";
    const { data: streams = [] } = useMultisigStreams(accountId);
    const { data: vaultBalances = [] } = useMultisigVaultBalances(accountId);
    const { data: coins = [] } = useCoins();
    const { data: approvedCoinTypes } = useVaultApprovedCoinTypes(accountId, data.vaultName || undefined);
    const selectedStream = streams.find((stream) => stream.id === data.streamId);
    const whitelistedRecipients = parseRecipients(data.whitelistedRecipients ?? "");
    const hasInvalidWhitelist =
        isSpendingLimitMode &&
        (whitelistedRecipients.length === 0 ||
            whitelistedRecipients.some((recipient) => !isValidSuiAddress(recipient)) ||
            hasDuplicateRecipients(whitelistedRecipients));

    // Build balance map for selected vault
    const vaultBalanceMap = useMemo(() => {
        const map = new Map<string, string>();
        if (!data.vaultName) return map;
        for (const vb of vaultBalances) {
            if (vb.vaultName === data.vaultName) {
                map.set(vb.coinType, vb.amount.toString());
            }
        }
        return map;
    }, [vaultBalances, data.vaultName]);

    const streamOptions = useMemo(
        () =>
            streams.map((s) => ({
                value: s.id,
                label: `${s.vaultName} → ${s.isSpendingLimit ? "preapproved spending" : "payment stream"} (${s.coinType.split("::").pop()})`,
            })),
        [streams]
    );

    const handleStreamSelect = (streamId: string) => {
        const stream = streams.find((entry) => entry.id === streamId);
        if (!stream) {
            update({ streamId });
            return;
        }

        const decimals = coins.find((coin) => coin.coin_type === stream.coinType)?.decimals ?? 9;
        update({
            streamId,
            vaultName: stream.vaultName,
            coinType: stream.coinType,
            coinDecimals: decimals,
        });
    };

    return (
        <div className="space-y-3">
            <Select
                label="Operation"
                options={MODE_OPTIONS}
                value={mode}
                onChange={(v) => update({ mode: v as StreamMode })}
                allowSearch={false}
                allowClear={false}
            />

            {isCreateMode && (
                <>
                    <VaultNamePicker
                        accountId={accountId}
                        value={data.vaultName}
                        onChange={(v) => update({ vaultName: v, coinType: "", coinDecimals: 9 })}
                    />
                    <CoinTypePicker
                        value={data.coinType}
                        onChange={(coinType, decimals) => update({ coinType, coinDecimals: decimals })}
                        allowedCoinTypes={approvedCoinTypes?.length ? approvedCoinTypes : undefined}
                        balanceOverrides={data.vaultName ? vaultBalanceMap : undefined}
                        label={data.vaultName ? `Coin Type (${data.vaultName} vault)` : "Coin Type"}
                    />
                    <Input
                        label={isSpendingLimitMode ? "Delegate" : "Beneficiary"}
                        value={data.capRecipient}
                        onChange={(v) => update({ capRecipient: v })}
                        placeholder="0x... address"
                        error={data.capRecipient.length > 0 && !isValidSuiAddress(data.capRecipient)}
                    />
                    {isSpendingLimitMode && (
                        <Textarea
                            label="Whitelisted Recipients"
                            value={data.whitelistedRecipients ?? ""}
                            onChange={(v) => update({ whitelistedRecipients: v })}
                            placeholder="0x... addresses, separated by commas or new lines"
                            rows={3}
                            error={(data.whitelistedRecipients ?? "").length > 0 && hasInvalidWhitelist}
                        />
                    )}
                    <div className="grid grid-cols-2 gap-3">
                        <TokenInput
                            label="Amount per Iteration"
                            value={data.amountPerIteration}
                            onChange={(v) => update({ amountPerIteration: v })}
                            placeholder="0.00"
                            hideBalance
                        />
                        <Input
                            label="Total Iterations"
                            type="number"
                            value={data.iterationsTotal}
                            onChange={(v) => update({ iterationsTotal: v })}
                            placeholder="12"
                        />
                    </div>
                    <Input
                        label="Iteration Period (days)"
                        type="number"
                        value={data.iterationPeriodDays}
                        onChange={(v) => update({ iterationPeriodDays: v })}
                        placeholder="30"
                    />
                    {isSpendingLimitMode && (
                        <Input
                            label="Expiry (optional)"
                            type="datetime-local"
                            value={data.expiryTime ?? ""}
                            onChange={(v) => update({ expiryTime: v })}
                            error={
                                (data.expiryTime ?? "").length > 0 &&
                                (!Number.isFinite(new Date(data.expiryTime).getTime()) ||
                                    new Date(data.expiryTime).getTime() <= Date.now())
                            }
                        />
                    )}
                </>
            )}

            {mode === "cancel" && (
                <>
                    {streamOptions.length > 0 ? (
                        <>
                            <Select
                                label="Payment Stream / Preapproved Spending"
                                options={streamOptions}
                                value={data.streamId ?? ""}
                                onChange={handleStreamSelect}
                                allowSearch
                                allowClear={false}
                            />
                            {selectedStream && (
                                <div className="rounded-lg border border-border-subtle bg-card-more-elevated/40 p-3 text-[11px] text-text-muted space-y-1">
                                    <p>
                                        Vault: <span className="text-text-primary">{selectedStream.vaultName}</span>
                                    </p>
                                    <p>
                                        Coin:{" "}
                                        <span className="text-text-primary">
                                            {selectedStream.coinType.split("::").pop()}
                                        </span>
                                    </p>
                                    {selectedStream.capHolder && (
                                        <p>
                                            {selectedStream.isSpendingLimit ? "Delegate" : "Beneficiary"}:{" "}
                                            <span className="font-mono text-text-primary">
                                                {formatAddress(selectedStream.capHolder)}
                                            </span>
                                        </p>
                                    )}
                                    {selectedStream.isSpendingLimit && (
                                        <p>
                                            Recipients:{" "}
                                            <span className="text-text-primary">
                                                {selectedStream.whitelistedRecipients.length}
                                            </span>
                                        </p>
                                    )}
                                </div>
                            )}
                        </>
                    ) : (
                        <>
                            <Input
                                label="Payment Stream / Preapproved Spending ID"
                                value={data.streamId ?? ""}
                                onChange={(v) => update({ streamId: v })}
                                placeholder="0x... (stream object ID)"
                                error={(data.streamId ?? "").length > 0 && !isValidSuiAddress(data.streamId ?? "")}
                            />
                            <VaultNamePicker
                                accountId={accountId}
                                value={data.vaultName}
                                onChange={(v) => update({ vaultName: v, coinType: "", coinDecimals: 9 })}
                            />
                            <CoinTypePicker
                                value={data.coinType}
                                onChange={(coinType, decimals) => update({ coinType, coinDecimals: decimals })}
                                allowedCoinTypes={approvedCoinTypes?.length ? approvedCoinTypes : undefined}
                                balanceOverrides={data.vaultName ? vaultBalanceMap : undefined}
                                label={data.vaultName ? `Coin Type (${data.vaultName} vault)` : "Coin Type"}
                            />
                        </>
                    )}
                    <p className="text-[11px] text-text-muted">
                        Cancels the payment stream or preapproved spending and returns remaining funds to the vault.
                    </p>
                </>
            )}
        </div>
    );
}

function daysToMs(days: string): bigint {
    const d = parseFloat(days || "0");
    if (!Number.isFinite(d) || d <= 0) return 0n;
    return BigInt(Math.round(d * 86_400_000));
}

function expiryTimeToMs(value: string): number | null {
    if (!value) return null;
    const ms = new Date(value).getTime();
    return Number.isFinite(ms) ? ms : null;
}

export function addStreamSpecs(tx: Transaction, builder: ActionSpecBuilder, data: StreamData) {
    const mode: StreamMode = data.mode ?? "create";

    if (mode === "cancel") {
        addCancelStreamSpec(tx, builder, data.coinType, data.vaultName, data.streamId);
        return;
    }

    const baseUnits = parseAmountToBigInt(data.amountPerIteration || "0", data.coinDecimals);
    addCreateStreamSpec(
        tx,
        builder,
        data.coinType,
        data.vaultName,
        data.capRecipient,
        baseUnits,
        null, // start_time: defaults to execution time onchain
        BigInt(data.iterationsTotal || "0"),
        daysToMs(data.iterationPeriodDays),
        null, // claim_window: no limit
        mode === "create_spending_limit" ? expiryTimeToMs(data.expiryTime ?? "") : null,
        mode === "create_spending_limit" ? parseRecipients(data.whitelistedRecipients ?? "") : []
    );
}

export function validateStream(data: StreamData): boolean {
    const mode: StreamMode = data.mode ?? "create";

    if (mode === "cancel") {
        return data.coinType.length > 0 && data.vaultName.length > 0 && isValidSuiAddress(data.streamId ?? "");
    }

    const base =
        data.coinType.length > 0 &&
        data.vaultName.length > 0 &&
        isValidSuiAddress(data.capRecipient) &&
        parseFloat(data.amountPerIteration) > 0 &&
        Number(data.iterationsTotal) > 0 &&
        parseFloat(data.iterationPeriodDays) > 0;

    if (!base) return false;
    if (mode !== "create_spending_limit") return true;

    const recipients = parseRecipients(data.whitelistedRecipients ?? "");
    if (recipients.length === 0) return false;
    if (recipients.some((recipient) => !isValidSuiAddress(recipient))) return false;
    if (hasDuplicateRecipients(recipients)) return false;

    const expiryMs = expiryTimeToMs(data.expiryTime ?? "");
    if (data.expiryTime && (!expiryMs || expiryMs <= Date.now() + Number(daysToMs(data.iterationPeriodDays)))) {
        return false;
    }

    return true;
}
