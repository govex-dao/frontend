import { useMemo } from "react";
import type { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { TokenInput } from "@/components/inputs/TokenInput";
import { Select } from "@/components/inputs/Select";
import { CoinTypePicker } from "@/components/multisig/CoinTypePicker";
import { VaultNamePicker } from "@/components/multisig/VaultNamePicker";
import { useVaultApprovedCoinTypes, useMultisigVaultBalances } from "@/hooks/useMultisig";
import {
    addOpenVaultSpec,
    addCloseVaultSpec,
    addSpendSpec,
    addTransferCoinSpec,
    addDepositExternalSpec,
    addApproveCoinTypeSpec,
    type ActionSpecBuilder,
} from "@/lib/sui/multisig-tx";
import { parseAmountToBigInt } from "@/lib/parseAmount";

type VaultMode = "open" | "close" | "spend_transfer" | "deposit_external" | "approve_coin_type";

export interface VaultOpsData {
    mode: VaultMode;
    vaultName: string;
    coinType: string;
    coinDecimals: number;
    amount: string;
    spendAll: boolean;
    recipient: string;
}

interface Props {
    accountId: string;
    data: VaultOpsData;
    onChange: (data: VaultOpsData) => void;
}

const MODE_OPTIONS = [
    { value: "spend_transfer", label: "Send from Vault" },
    { value: "deposit_external", label: "Deposit Executor Coin" },
    { value: "open", label: "Create Vault" },
    { value: "approve_coin_type", label: "Approve Coin for Vault" },
    { value: "close", label: "Close Vault" },
];

export function VaultOpsForm({ accountId, data, onChange }: Props) {
    const needsVaultFilter = data.mode === "spend_transfer" || data.mode === "deposit_external";
    const showVaultBalances = data.mode === "spend_transfer";
    const { data: approvedCoinTypes } = useVaultApprovedCoinTypes(
        needsVaultFilter ? accountId : undefined,
        needsVaultFilter ? data.vaultName || undefined : undefined
    );
    const { data: vaultBalances = [] } = useMultisigVaultBalances(showVaultBalances ? accountId : undefined);

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

    return (
        <div className="space-y-3">
            <Select
                label="Operation"
                options={MODE_OPTIONS}
                value={data.mode}
                onChange={(v) => onChange({ ...data, mode: v as VaultMode })}
                allowSearch={false}
                allowClear={false}
            />

            {data.mode === "open" ? (
                <Input
                    label="Vault Name"
                    value={data.vaultName}
                    onChange={(v) => onChange({ ...data, vaultName: v })}
                    placeholder="new-vault-name"
                />
            ) : (
                <VaultNamePicker
                    accountId={accountId}
                    value={data.vaultName}
                    onChange={(v) => onChange({ ...data, vaultName: v, coinType: "", coinDecimals: 9 })}
                />
            )}

            {(data.mode === "spend_transfer" ||
                data.mode === "deposit_external" ||
                data.mode === "approve_coin_type") && (
                <CoinTypePicker
                    value={data.coinType}
                    onChange={(coinType, decimals) => onChange({ ...data, coinType, coinDecimals: decimals })}
                    allowedCoinTypes={needsVaultFilter && approvedCoinTypes?.length ? approvedCoinTypes : undefined}
                    balanceOverrides={showVaultBalances && data.vaultName ? vaultBalanceMap : undefined}
                    label={data.vaultName && showVaultBalances ? `Coin Type (${data.vaultName} vault)` : "Coin Type"}
                />
            )}

            {(data.mode === "spend_transfer" || data.mode === "deposit_external") && (
                <TokenInput
                    label="Amount"
                    value={data.amount}
                    onChange={(v) => onChange({ ...data, amount: v })}
                    placeholder="0.00"
                    hideBalance
                />
            )}

            {data.mode === "spend_transfer" && (
                <>
                    <label className="flex items-center gap-2 text-xs text-text-muted cursor-pointer">
                        <input
                            type="checkbox"
                            checked={data.spendAll}
                            onChange={() => onChange({ ...data, spendAll: !data.spendAll })}
                            className="accent-primary"
                        />
                        Spend All
                    </label>
                    <Input
                        label="Recipient"
                        value={data.recipient}
                        onChange={(v) => onChange({ ...data, recipient: v })}
                        placeholder="0x... recipient address"
                        error={data.recipient.length > 0 && !isValidSuiAddress(data.recipient)}
                    />
                </>
            )}
        </div>
    );
}

export function addVaultOpsSpecs(tx: Transaction, builder: ActionSpecBuilder, data: VaultOpsData) {
    switch (data.mode) {
        case "open":
            addOpenVaultSpec(tx, builder, data.vaultName);
            break;
        case "close":
            addCloseVaultSpec(tx, builder, data.vaultName);
            break;
        case "spend_transfer": {
            const resourceName = `spend-${Date.now()}`;
            const baseUnits = parseAmountToBigInt(data.amount || "0", data.coinDecimals);
            addSpendSpec(tx, builder, data.coinType, data.vaultName, baseUnits, data.spendAll, resourceName);
            if (data.recipient) {
                addTransferCoinSpec(tx, builder, data.coinType, data.recipient, resourceName);
            }
            break;
        }
        case "deposit_external": {
            const baseUnits = parseAmountToBigInt(data.amount || "0", data.coinDecimals);
            addDepositExternalSpec(tx, builder, data.coinType, data.vaultName, baseUnits);
            break;
        }
        case "approve_coin_type":
            addApproveCoinTypeSpec(tx, builder, data.coinType, data.vaultName);
            break;
    }
}

export function validateVaultOps(data: VaultOpsData): boolean {
    if (!data.vaultName) return false;
    if (data.mode === "spend_transfer") {
        return data.coinType.length > 0 && parseFloat(data.amount) > 0 && isValidSuiAddress(data.recipient);
    }
    if (data.mode === "deposit_external") {
        return data.coinType.length > 0 && parseFloat(data.amount) > 0;
    }
    if (data.mode === "approve_coin_type") {
        return data.coinType.length > 0;
    }
    return true; // open/close just need vault name
}
