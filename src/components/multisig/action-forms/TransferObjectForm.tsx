import { useState } from "react";
import type { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress, parseStructTag } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { Select } from "@/components/inputs/Select";
import { VaultNamePicker } from "@/components/multisig/VaultNamePicker";
import { OwnedObjectPicker } from "@/components/multisig/OwnedObjectPicker";
import {
    addWithdrawObjectSpec,
    addTransferObjectSpec,
    addDepositObjectFromResourcesSpec,
    type ActionSpecBuilder,
} from "@/lib/sui/multisig-tx";

/** Extract the inner type from `0x2::coin::Coin<INNER>` */
function parseCoinTypeFromObjectType(objectType: string): string {
    try {
        const tag = parseStructTag(objectType);
        if (tag.name === "Coin" && tag.typeParams.length === 1) {
            const inner = tag.typeParams[0];
            if (typeof inner === "string") return inner;
            const p = inner as { address: string; module: string; name: string };
            return `${p.address}::${p.module}::${p.name}`;
        }
    } catch {
        /* fall through */
    }
    // Fallback: regex
    const match = objectType.match(/^0x[^:]+::coin::Coin<(.+)>$/);
    return match?.[1] ?? "";
}

type OwnedObjectMode = "transfer" | "deposit_to_vault";

export interface TransferObjectData {
    mode: OwnedObjectMode;
    objectId: string;
    objectType: string;
    recipient: string;
    coinType: string;
    vaultName: string;
}

interface Props {
    accountId: string;
    data: TransferObjectData;
    onChange: (data: TransferObjectData) => void;
}

const MODE_OPTIONS = [
    { value: "transfer", label: "Transfer to Address" },
    { value: "deposit_to_vault", label: "Deposit Coin to Vault" },
];

export function TransferObjectForm({ accountId, data, onChange }: Props) {
    const mode: OwnedObjectMode = data.mode ?? "transfer";
    const [transferObjectTypeDerived, setTransferObjectTypeDerived] = useState(false);
    const [depositCoinTypeDerived, setDepositCoinTypeDerived] = useState(false);

    return (
        <div className="space-y-3">
            <Select
                label="Operation"
                options={MODE_OPTIONS}
                value={mode}
                onChange={(v) => onChange({ ...data, mode: v as OwnedObjectMode })}
                allowSearch={false}
                allowClear={false}
            />

            {mode === "transfer" && (
                <>
                    <OwnedObjectPicker
                        accountId={accountId}
                        value={data.objectId}
                        onChange={(objectId, objectType, isDerived) => {
                            setTransferObjectTypeDerived(!!objectType && isDerived);
                            onChange({
                                ...data,
                                objectId,
                                objectType: !objectId
                                    ? ""
                                    : objectType || (transferObjectTypeDerived ? "" : data.objectType),
                            });
                        }}
                        label="Object"
                    />
                    {data.objectId.length > 0 && !transferObjectTypeDerived && (
                        <Input
                            label="Object Type"
                            value={data.objectType}
                            onChange={(v) => {
                                setTransferObjectTypeDerived(false);
                                onChange({ ...data, objectType: v });
                            }}
                            placeholder="0x...::module::StructName"
                        />
                    )}
                    <Input
                        label="Recipient Address"
                        value={data.recipient}
                        onChange={(v) => onChange({ ...data, recipient: v })}
                        placeholder="0x... recipient address"
                        error={data.recipient.length > 0 && !isValidSuiAddress(data.recipient)}
                    />
                    <p className="text-[11px] text-text-muted">
                        Withdraws an object owned by the account and transfers it to the recipient.
                    </p>
                </>
            )}

            {mode === "deposit_to_vault" && (
                <>
                    <OwnedObjectPicker
                        accountId={accountId}
                        value={data.objectId}
                        onChange={(objectId, objectType, isDerived) => {
                            setDepositCoinTypeDerived(!!objectType && isDerived);
                            const coinType = !objectId
                                ? ""
                                : objectType
                                  ? parseCoinTypeFromObjectType(objectType)
                                  : depositCoinTypeDerived
                                    ? ""
                                    : data.coinType;
                            onChange({ ...data, objectId, coinType });
                        }}
                        label="Coin Object"
                        typeFilter="0x2::coin::Coin"
                    />
                    {data.objectId.length > 0 && !depositCoinTypeDerived && (
                        <Input
                            label="Coin Type"
                            value={data.coinType}
                            onChange={(v) => {
                                setDepositCoinTypeDerived(false);
                                onChange({ ...data, coinType: v });
                            }}
                            placeholder="0x...::module::COIN"
                        />
                    )}
                    <VaultNamePicker
                        accountId={accountId}
                        value={data.vaultName}
                        onChange={(v) => onChange({ ...data, vaultName: v })}
                        label="Destination Vault"
                    />
                    <p className="text-[11px] text-text-muted">
                        Withdraws a Coin object owned by the account and deposits it into a vault.
                    </p>
                </>
            )}
        </div>
    );
}

export function addTransferObjectSpecs(tx: Transaction, builder: ActionSpecBuilder, data: TransferObjectData) {
    const mode: OwnedObjectMode = data.mode ?? "transfer";
    const resourceName = `obj-${mode}-${Date.now()}`;

    if (mode === "transfer") {
        addWithdrawObjectSpec(tx, builder, data.objectType, data.objectId, resourceName);
        addTransferObjectSpec(tx, builder, data.objectType, data.recipient, resourceName);
    } else {
        // deposit_to_vault
        const coinObjectType = `0x2::coin::Coin<${data.coinType}>`;
        addWithdrawObjectSpec(tx, builder, coinObjectType, data.objectId, resourceName);
        addDepositObjectFromResourcesSpec(tx, builder, data.coinType, data.vaultName, resourceName);
    }
}

export function validateTransferObject(data: TransferObjectData): boolean {
    const mode: OwnedObjectMode = data.mode ?? "transfer";
    if (!isValidSuiAddress(data.objectId)) return false;

    if (mode === "transfer") {
        return data.objectType.trim().length > 0 && isValidSuiAddress(data.recipient);
    }
    // deposit_to_vault
    return data.coinType.length > 0 && data.vaultName.trim().length > 0;
}
