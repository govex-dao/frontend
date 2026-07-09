import { useMemo } from "react";
import { useCurrentAccount } from "@/lib/sui/dapp-kit-compat";
import type { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress, formatAddress, parseStructTag } from "@mysten/sui/utils";
import { Input } from "@/components/inputs/Input";
import { Select } from "@/components/inputs/Select";
import { TokenInput } from "@/components/inputs/TokenInput";
import { CoinTypePicker } from "@/components/multisig/CoinTypePicker";
import { VaultNamePicker } from "@/components/multisig/VaultNamePicker";
import { useMultisigLockedCurrencies, useMultisigOwnedObjects } from "@/hooks/useMultisig";
import {
    addApproveCoinTypeSpec,
    addBurnSpec,
    addDepositFromResourcesSpec,
    addProvideObjectSpec,
    addMintSpec,
    addSpendSpec,
    addTransferCoinSpec,
    addLockTreasuryCapSpec,
    addLockMetadataCapSpec,
    addUnlockTreasuryCapToAddressSpec,
    addUnlockMetadataCapToAddressSpec,
    type ActionSpecBuilder,
} from "@/lib/sui/multisig-tx";
import { parseAmountToBigInt } from "@/lib/parseAmount";

type CurrencyMode =
    | "mint_to_address"
    | "mint_to_vault"
    | "burn_from_vault"
    | "lock_treasury_cap"
    | "lock_metadata_cap"
    | "transfer_treasury_cap"
    | "transfer_metadata_cap";

export interface MintTransferData {
    mode: CurrencyMode;
    coinType: string;
    capObjectId?: string;
    coinDecimals: number;
    amount: string;
    recipient: string;
    vaultName: string;
}

interface Props {
    accountId: string;
    data: MintTransferData;
    onChange: (data: MintTransferData) => void;
}

const MODE_OPTIONS = [
    { value: "mint_to_address", label: "Mint & send to address" },
    { value: "mint_to_vault", label: "Mint into vault" },
    { value: "burn_from_vault", label: "Burn from vault" },
    { value: "lock_treasury_cap", label: "Lock TreasuryCap" },
    { value: "lock_metadata_cap", label: "Lock MetadataCap" },
    { value: "transfer_treasury_cap", label: "Transfer TreasuryCap" },
    { value: "transfer_metadata_cap", label: "Transfer MetadataCap" },
];

/** Extract the coin type param from a TreasuryCap<T> or MetadataCap<T> type string */
function extractCapCoinType(objectType: string): string | null {
    const match = objectType.match(/<(.+)>$/);
    return match ? match[1] : null;
}

function shortCoinType(coinType: string): string {
    try {
        const tag = parseStructTag(coinType);
        return `${formatAddress(tag.address)}::${tag.module}::${tag.name}`;
    } catch {
        return coinType.length > 50 ? coinType.slice(0, 47) + "..." : coinType;
    }
}

export function MintTransferForm({ accountId, data, onChange }: Props) {
    const account = useCurrentAccount();
    const { data: lockedCurrencies = [] } = useMultisigLockedCurrencies(accountId);
    // Lock modes: caps are in the proposer's WALLET (they get locked into the account at execution).
    // Other modes: show objects from the multisig account.
    const isLockMode = data.mode === "lock_treasury_cap" || data.mode === "lock_metadata_cap";
    const isTransferMode = data.mode === "transfer_treasury_cap" || data.mode === "transfer_metadata_cap";
    const lockOwner = isLockMode ? account?.address : undefined;
    const { data: ownedObjects = [], isLoading: loadingObjects } = useMultisigOwnedObjects(
        isLockMode ? lockOwner : accountId
    );

    // Handle legacy data that used destinationType instead of mode
    const mode: CurrencyMode = data.mode ?? "mint_to_address";

    const capTypeFilter = mode === "lock_treasury_cap" ? "::coin::TreasuryCap<" : "::coin_registry::MetadataCap<";

    // For lock modes, find matching cap objects owned by the account
    const capOptions = useMemo(() => {
        if (!isLockMode) return [];
        return ownedObjects
            .filter((obj) => obj.objectType.includes(capTypeFilter))
            .map((obj) => {
                const coinType = extractCapCoinType(obj.objectType) ?? "";
                return { objectId: obj.objectId, coinType, objectType: obj.objectType };
            });
    }, [ownedObjects, isLockMode, capTypeFilter]);

    const capSelectOptions = useMemo(
        () =>
            capOptions.map((cap) => ({
                value: cap.coinType,
                label: `${shortCoinType(cap.coinType)} — ${formatAddress(cap.objectId)}`,
            })),
        [capOptions]
    );

    // For mint/burn modes, only offer coin types with locked TreasuryCaps
    const mintableCoinTypes = useMemo(
        () => lockedCurrencies.filter((c) => c.hasTreasuryCap).map((c) => c.coinType),
        [lockedCurrencies]
    );

    // For transfer modes, offer coin types with the relevant locked cap
    const transferableCoinTypes = useMemo(() => {
        if (!isTransferMode) return [];
        return lockedCurrencies
            .filter((c) => (data.mode === "transfer_treasury_cap" ? c.hasTreasuryCap : c.hasMetadataCap))
            .map((c) => c.coinType);
    }, [lockedCurrencies, isTransferMode, data.mode]);

    const lockedInfo = data.coinType ? lockedCurrencies.find((c) => c.coinType === data.coinType) : null;

    return (
        <div className="space-y-3">
            <Select
                label="Operation"
                options={MODE_OPTIONS}
                value={mode}
                onChange={(v) => onChange({ ...data, mode: v as CurrencyMode, capObjectId: undefined })}
                allowSearch={false}
                allowClear={false}
            />

            {isLockMode ? (
                <>
                    {capSelectOptions.length > 0 ? (
                        <Select
                            label={mode === "lock_treasury_cap" ? "TreasuryCap" : "MetadataCap"}
                            options={capSelectOptions}
                            value={data.coinType}
                            onChange={(coinType) => {
                                const cap = capOptions.find((entry) => entry.coinType === coinType);
                                onChange({
                                    ...data,
                                    coinType,
                                    capObjectId: cap?.objectId ?? data.capObjectId,
                                    coinDecimals: 9,
                                });
                            }}
                            placeholder={`Select a ${mode === "lock_treasury_cap" ? "TreasuryCap" : "MetadataCap"}...`}
                            allowSearch
                            allowClear={false}
                        />
                    ) : (
                        <Input
                            label="Coin Type"
                            value={data.coinType}
                            onChange={(v) => onChange({ ...data, coinType: v, coinDecimals: 9 })}
                            placeholder="0x...::module::COIN"
                        />
                    )}
                    <Input
                        label={`${mode === "lock_treasury_cap" ? "TreasuryCap" : "MetadataCap"} Object ID`}
                        value={data.capObjectId ?? ""}
                        onChange={(v) => onChange({ ...data, capObjectId: v })}
                        placeholder="0x... cap object ID"
                        error={!!data.capObjectId && !isValidSuiAddress(data.capObjectId)}
                    />
                    {loadingObjects && <p className="text-[11px] text-text-muted">Scanning account objects...</p>}
                    {!loadingObjects && capSelectOptions.length === 0 && (
                        <p className="text-[11px] text-text-muted">
                            No {mode === "lock_treasury_cap" ? "TreasuryCap" : "MetadataCap"} objects found in your
                            wallet. Enter the coin type manually.
                        </p>
                    )}
                </>
            ) : isTransferMode ? (
                <CoinTypePicker
                    value={data.coinType}
                    onChange={(coinType, decimals) => onChange({ ...data, coinType, coinDecimals: decimals })}
                    allowedCoinTypes={transferableCoinTypes.length > 0 ? transferableCoinTypes : undefined}
                />
            ) : (
                <CoinTypePicker
                    value={data.coinType}
                    onChange={(coinType, decimals) => onChange({ ...data, coinType, coinDecimals: decimals })}
                    allowedCoinTypes={mintableCoinTypes.length > 0 ? mintableCoinTypes : undefined}
                />
            )}

            {lockedInfo && (mode === "mint_to_address" || mode === "mint_to_vault" || mode === "burn_from_vault") && (
                <p className="text-[11px] text-text-muted">
                    This coin has{lockedInfo.hasTreasuryCap ? " TreasuryCap" : ""}
                    {lockedInfo.hasTreasuryCap && lockedInfo.hasMetadataCap ? " and" : ""}
                    {lockedInfo.hasMetadataCap ? " MetadataCap" : ""} locked in this account.
                </p>
            )}

            {(mode === "mint_to_address" || mode === "mint_to_vault" || mode === "burn_from_vault") && (
                <TokenInput
                    label="Amount"
                    value={data.amount}
                    onChange={(v) => onChange({ ...data, amount: v })}
                    placeholder="0.00"
                    hideBalance
                />
            )}

            {mode === "mint_to_address" && (
                <Input
                    label="Recipient Address"
                    value={data.recipient}
                    onChange={(v) => onChange({ ...data, recipient: v })}
                    placeholder="0x... recipient address"
                    error={data.recipient.length > 0 && !isValidSuiAddress(data.recipient)}
                />
            )}

            {(mode === "mint_to_vault" || mode === "burn_from_vault") && (
                <>
                    <VaultNamePicker
                        accountId={accountId}
                        value={data.vaultName}
                        onChange={(v) => onChange({ ...data, vaultName: v })}
                        label={mode === "burn_from_vault" ? "Source Vault" : "Destination Vault"}
                    />
                    {mode === "burn_from_vault" && (
                        <p className="text-[11px] text-text-muted">Spends coins from the vault and burns them.</p>
                    )}
                </>
            )}

            {mode === "lock_treasury_cap" && (
                <p className="text-[11px] text-text-muted">
                    The executor must provide the TreasuryCap object when executing this intent. Once locked, minting
                    and burning will be governed by the account.
                </p>
            )}

            {mode === "lock_metadata_cap" && (
                <p className="text-[11px] text-text-muted">
                    The executor must provide the MetadataCap object when executing this intent. Once locked, metadata
                    updates will be governed by the account.
                </p>
            )}

            {isTransferMode && (
                <>
                    <Input
                        label="Recipient Address"
                        value={data.recipient}
                        onChange={(v) => onChange({ ...data, recipient: v })}
                        placeholder="0x... recipient address"
                        error={data.recipient.length > 0 && !isValidSuiAddress(data.recipient)}
                    />
                    <p className="text-[11px] text-text-muted">
                        Permanently removes the {mode === "transfer_treasury_cap" ? "TreasuryCap" : "MetadataCap"} from
                        this account and transfers it to the recipient.
                    </p>
                </>
            )}
        </div>
    );
}

export function addMintTransferSpecs(tx: Transaction, builder: ActionSpecBuilder, data: MintTransferData) {
    const mode: CurrencyMode = data.mode ?? "mint_to_address";

    if (mode === "lock_treasury_cap") {
        const resourceName = `treasury_cap_${Date.now()}`;
        addProvideObjectSpec(
            tx,
            builder,
            `0x2::coin::TreasuryCap<${data.coinType}>`,
            data.capObjectId ?? "",
            resourceName
        );
        addLockTreasuryCapSpec(tx, builder, data.coinType, null, true, true, true, true, true, resourceName);
        return;
    }

    if (mode === "lock_metadata_cap") {
        const resourceName = `metadata_cap_${Date.now()}`;
        addProvideObjectSpec(
            tx,
            builder,
            `0x2::coin_registry::MetadataCap<${data.coinType}>`,
            data.capObjectId ?? "",
            resourceName
        );
        addLockMetadataCapSpec(tx, builder, data.coinType, true, true, true, resourceName);
        return;
    }

    if (mode === "transfer_treasury_cap") {
        addUnlockTreasuryCapToAddressSpec(tx, builder, data.coinType, data.recipient);
        return;
    }

    if (mode === "transfer_metadata_cap") {
        addUnlockMetadataCapToAddressSpec(tx, builder, data.coinType, data.recipient);
        return;
    }

    const baseUnits = parseAmountToBigInt(data.amount || "0", data.coinDecimals);

    if (mode === "burn_from_vault") {
        // VaultSpend → CurrencyBurn
        const resourceName = `burn-${Date.now()}`;
        addSpendSpec(tx, builder, data.coinType, data.vaultName, baseUnits, false, resourceName);
        addBurnSpec(tx, builder, data.coinType, baseUnits, resourceName);
        return;
    }

    // Mint modes
    const resourceName = `mint-${Date.now()}`;
    addMintSpec(tx, builder, data.coinType, baseUnits, resourceName);

    if (mode === "mint_to_address") {
        addTransferCoinSpec(tx, builder, data.coinType, data.recipient, resourceName);
    } else {
        // mint_to_vault
        addApproveCoinTypeSpec(tx, builder, data.coinType, data.vaultName);
        addDepositFromResourcesSpec(tx, builder, data.coinType, data.vaultName, resourceName);
    }
}

export function validateMintTransfer(data: MintTransferData): boolean {
    const mode: CurrencyMode = data.mode ?? "mint_to_address";
    if (data.coinType.length === 0) return false;
    if (mode === "lock_treasury_cap" || mode === "lock_metadata_cap") return isValidSuiAddress(data.capObjectId ?? "");
    if (mode === "transfer_treasury_cap" || mode === "transfer_metadata_cap") return isValidSuiAddress(data.recipient);
    if (parseFloat(data.amount) <= 0) return false;
    if (mode === "mint_to_address") return isValidSuiAddress(data.recipient);
    return data.vaultName.trim().length > 0;
}
