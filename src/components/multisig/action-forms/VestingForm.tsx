import { useMemo } from "react";
import type { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { TokenInput } from "@/components/inputs/TokenInput";
import { Select } from "@/components/inputs/Select";
import { CoinTypePicker } from "@/components/multisig/CoinTypePicker";
import { VaultNamePicker } from "@/components/multisig/VaultNamePicker";
import { useMultisigLockedCurrencies, useVaultApprovedCoinTypes } from "@/hooks/useMultisig";
import { addCreateVestingSpec, addMintSpec, addSpendSpec, type ActionSpecBuilder } from "@/lib/sui/multisig-tx";
import { parseAmountToBigInt } from "@/lib/parseAmount";

export interface VestingData {
    coinType: string;
    coinDecimals: number;
    beneficiary: string;
    amountPerIteration: string;
    iterationsTotal: string;
    iterationPeriodDays: string;
    source: "mint" | "vault_spend";
    vaultName: string;
}

interface Props {
    accountId: string;
    data: VestingData;
    onChange: (data: VestingData) => void;
}

const SOURCE_OPTIONS = [
    { value: "mint", label: "Mint New Coins" },
    { value: "vault_spend", label: "Vault Spend" },
];

export function VestingForm({ accountId, data, onChange }: Props) {
    const update = (patch: Partial<VestingData>) => onChange({ ...data, ...patch });
    const { data: lockedCurrencies = [] } = useMultisigLockedCurrencies(accountId);
    const { data: approvedCoinTypes } = useVaultApprovedCoinTypes(
        data.source === "vault_spend" ? accountId : undefined,
        data.source === "vault_spend" ? data.vaultName || undefined : undefined
    );
    const mintableCoinTypes = useMemo(
        () => lockedCurrencies.filter((c) => c.hasTreasuryCap).map((c) => c.coinType),
        [lockedCurrencies]
    );
    const allowedCoinTypes =
        data.source === "mint"
            ? mintableCoinTypes.length > 0
                ? mintableCoinTypes
                : undefined
            : approvedCoinTypes?.length
              ? approvedCoinTypes
              : undefined;

    return (
        <div className="space-y-3">
            <CoinTypePicker
                value={data.coinType}
                onChange={(coinType, decimals) => update({ coinType, coinDecimals: decimals })}
                allowedCoinTypes={allowedCoinTypes}
            />
            <Input
                label="Beneficiary"
                value={data.beneficiary}
                onChange={(v) => update({ beneficiary: v })}
                placeholder="0x... address"
                error={data.beneficiary.length > 0 && !isValidSuiAddress(data.beneficiary)}
            />

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

            <div className="border-t border-border-subtle pt-3">
                <Select
                    label="Token Source"
                    options={SOURCE_OPTIONS}
                    value={data.source}
                    onChange={(v) => update({ source: v as "mint" | "vault_spend" })}
                    allowSearch={false}
                    allowClear={false}
                />
                {data.source === "vault_spend" && (
                    <div className="mt-3">
                        <VaultNamePicker
                            accountId={accountId}
                            value={data.vaultName}
                            onChange={(v) => update({ vaultName: v })}
                        />
                    </div>
                )}
                {parseFloat(data.amountPerIteration) > 0 && Number(data.iterationsTotal) > 0 && (
                    <p className="mt-2 text-[11px] text-text-muted">
                        Total: {(parseFloat(data.amountPerIteration) * Number(data.iterationsTotal)).toLocaleString()}{" "}
                        tokens will be {data.source === "mint" ? "minted" : "spent from vault"}
                    </p>
                )}
            </div>
        </div>
    );
}

function daysToMs(days: string): bigint {
    const d = parseFloat(days || "0");
    if (!Number.isFinite(d) || d <= 0) return 0n;
    return BigInt(Math.round(d * 86_400_000));
}

export function addVestingSpecs(tx: Transaction, builder: ActionSpecBuilder, data: VestingData) {
    const resourceName = `vesting-source-${Date.now()}`;
    const amountBaseUnits = parseAmountToBigInt(data.amountPerIteration || "0", data.coinDecimals);
    const iterations = BigInt(data.iterationsTotal || "0");
    const sourceBaseUnits = amountBaseUnits * iterations;
    const periodMs = daysToMs(data.iterationPeriodDays);

    // Add the source action first (mint or vault spend)
    if (data.source === "mint") {
        addMintSpec(tx, builder, data.coinType, sourceBaseUnits, resourceName);
    } else {
        addSpendSpec(tx, builder, data.coinType, data.vaultName, sourceBaseUnits, false, resourceName);
    }

    // Add the vesting action that consumes from the source
    addCreateVestingSpec(
        tx,
        builder,
        data.coinType,
        data.beneficiary,
        amountBaseUnits,
        null, // start_time: defaults to execution time onchain
        iterations,
        periodMs,
        false,
        resourceName
    );
}

export function validateVesting(data: VestingData): boolean {
    const base =
        data.coinType.length > 0 &&
        isValidSuiAddress(data.beneficiary) &&
        parseFloat(data.amountPerIteration) > 0 &&
        Number(data.iterationsTotal) > 0 &&
        parseFloat(data.iterationPeriodDays) > 0;

    if (data.source === "vault_spend") return base && data.vaultName.length > 0;
    return base;
}
