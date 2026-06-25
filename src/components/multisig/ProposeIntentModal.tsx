/* eslint-disable max-lines */
import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import {
    ArrowLeft,
    ArrowRight,
    Coins,
    Vault,
    FileText,
    Droplets,
    Gift,
    Package,
    Settings,
    Plus,
    Copy,
    Trash2,
    BoxSelect,
    ChevronDown,
    ChevronUp,
} from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/inputs/Button";
import { Input } from "@/components/inputs/Input";

import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import {
    buildSimpleMultisigConfigInput,
    validateAndParseMultisigConfigDraft,
} from "@/lib/sui/multisigConfigValidation";
import type { MultisigConfig, MultisigMember } from "@/lib/sui/multisig";
import type { ActionSpecBuilder } from "@/lib/sui/multisig-tx";

import { MintTransferForm, addMintTransferSpecs, validateMintTransfer } from "./action-forms/MintTransferForm";
import type { MintTransferData } from "./action-forms/MintTransferForm";
import { VaultOpsForm, addVaultOpsSpecs, validateVaultOps } from "./action-forms/VaultOpsForm";
import type { VaultOpsData } from "./action-forms/VaultOpsForm";
import { MemoForm, addMemoSpecs, validateMemo } from "./action-forms/MemoForm";
import type { MemoData } from "./action-forms/MemoForm";
import { StreamForm, addStreamSpecs, validateStream, getPastIterationsForStreamData } from "./action-forms/StreamForm";
import type { StreamData } from "./action-forms/StreamForm";
import { VestingForm, addVestingSpecs, validateVesting } from "./action-forms/VestingForm";
import type { VestingData } from "./action-forms/VestingForm";
import { UpgradeForm, addUpgradeSpecs, validateUpgrade } from "./action-forms/UpgradeForm";
import type { UpgradeData } from "./action-forms/UpgradeForm";
import { TransferObjectForm, addTransferObjectSpecs, validateTransferObject } from "./action-forms/TransferObjectForm";
import type { TransferObjectData } from "./action-forms/TransferObjectForm";

type ActionType =
    | "mint_transfer"
    | "vault_ops"
    | "memo"
    | "stream"
    | "vesting"
    | "upgrade"
    | "owned_object"
    | "config_change";
type Step = "pick_type" | "form" | "review";
type ActionGroup = "core" | "account" | "advanced";

interface MemberDraft {
    address: string;
    weight: string;
    propose: boolean;
    vote: boolean;
    execute: boolean;
}

const CONFIG_PERMISSION_LABELS = {
    propose: "Propose",
    vote: "Vote",
    execute: "Execute",
} as const;

interface ConfigChangeData {
    members: MemberDraft[];
    globalThreshold: string;
}

function memberFromConfig(m: MultisigMember): MemberDraft {
    return {
        address: m.address,
        weight: String(m.weight),
        propose: (m.permissions & 1) !== 0,
        vote: (m.permissions & 2) !== 0,
        execute: (m.permissions & (4 | 8)) !== 0,
    };
}

function memberToPermissions(m: MemberDraft): number {
    return (m.propose ? 1 : 0) | (m.vote ? 2 : 0) | (m.execute ? (4 | 8) : 0);
}

function validateConfigChange(data: ConfigChangeData): boolean {
    return (
        validateAndParseMultisigConfigDraft(
            data.members.map((m) => ({
                address: m.address,
                weight: m.weight,
                permissions: memberToPermissions(m),
            })),
            data.globalThreshold
        ) !== null
    );
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    accountId: string;
    config?: MultisigConfig;
    onSuccess?: () => void;
}

type ActionData =
    | MintTransferData
    | VaultOpsData
    | MemoData
    | StreamData
    | VestingData
    | UpgradeData
    | TransferObjectData
    | ConfigChangeData;

const ACTION_TYPES: Array<{
    type: ActionType;
    label: string;
    description: string;
    icon: typeof Coins;
    group: ActionGroup;
}> = [
    {
        type: "vault_ops",
        label: "Vaults & Payments",
        description: "Send vault funds, deposit coins, or manage vaults",
        icon: Vault,
        group: "core",
    },
    {
        type: "stream",
        label: "Spending Limits",
        description: "Create or cancel spending limits",
        icon: Droplets,
        group: "core",
    },
    {
        type: "vesting",
        label: "Vesting Coins",
        description: "Create or cancel vesting coins",
        icon: Gift,
        group: "core",
    },
    {
        type: "config_change",
        label: "Members & Policy",
        description: "Change members, weights, and permissions",
        icon: Settings,
        group: "account",
    },
    {
        type: "mint_transfer",
        label: "Currency Admin",
        description: "Mint, burn, or manage coin caps",
        icon: Coins,
        group: "advanced",
    },
    {
        type: "upgrade",
        label: "Package Admin",
        description: "Upgrade, restrict, or lock UpgradeCap",
        icon: Package,
        group: "advanced",
    },
    {
        type: "owned_object",
        label: "Owned Objects",
        description: "Transfer objects or deposit coin objects",
        icon: BoxSelect,
        group: "advanced",
    },
    { type: "memo", label: "Memo", description: "Record an onchain note", icon: FileText, group: "advanced" },
];

const DEFAULT_INTENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

const ACTION_GROUPS: Array<{
    id: ActionGroup;
    title: string;
    description: string;
    collapsible?: boolean;
}> = [
    { id: "core", title: "Core", description: "Treasury workflows most members use" },
    { id: "account", title: "Account", description: "Membership and policy changes" },
    { id: "advanced", title: "Advanced", description: "Caps, packages, objects, and notes", collapsible: true },
];

function formatDurationMs(ms: number | undefined): string {
    if (!ms || ms <= 0) return "Unknown";
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

function getDefaultData(type: ActionType, config?: MultisigConfig): ActionData {
    switch (type) {
        case "mint_transfer":
            return {
                mode: "mint_to_address" as const,
                coinType: "",
                coinDecimals: 9,
                amount: "",
                recipient: "",
                vaultName: "",
            };
        case "vault_ops":
            return {
                mode: "spend_transfer" as const,
                vaultName: "",
                coinType: "",
                coinDecimals: 9,
                amount: "",
                spendAll: false,
                recipient: "",
            };
        case "memo":
            return { memo: "" };
        case "stream":
            return {
                mode: "create" as const,
                coinType: "",
                coinDecimals: 9,
                vaultName: "",
                capRecipient: "",
                amountPerIteration: "",
                iterationsTotal: "",
                iterationPeriodDays: "",
                startTime: "",
                expiryTime: "",
                whitelistedRecipients: "",
                streamId: "",
            };
        case "vesting":
            return {
                coinType: "",
                coinDecimals: 9,
                beneficiary: "",
                amountPerIteration: "",
                iterationsTotal: "",
                iterationPeriodDays: "",
                source: "vault_spend" as const,
                vaultName: "",
            };
        case "upgrade":
            return {
                mode: "upgrade" as const,
                packageName: "",
                digest: "",
                policy: "0",
                delayDays: "0",
                expectedCapId: "",
                resourceName: "upgrade_cap",
                recipient: "",
            };
        case "owned_object":
            return {
                mode: "transfer" as const,
                objectId: "",
                objectType: "",
                recipient: "",
                coinType: "",
                vaultName: "",
            };
        case "config_change":
            return {
                members: config
                    ? config.members.map(memberFromConfig)
                    : [{ address: "", weight: "1", propose: true, vote: true, execute: true }],
                globalThreshold: config ? String(config.globalThreshold) : "1",
            };
    }
}

function validateData(type: ActionType, data: ActionData): boolean {
    switch (type) {
        case "mint_transfer":
            return validateMintTransfer(data as MintTransferData);
        case "vault_ops":
            return validateVaultOps(data as VaultOpsData);
        case "memo":
            return validateMemo(data as MemoData);
        case "stream":
            return validateStream(data as StreamData);
        case "vesting":
            return validateVesting(data as VestingData);
        case "upgrade":
            return validateUpgrade(data as UpgradeData);
        case "owned_object":
            return validateTransferObject(data as TransferObjectData);
        case "config_change":
            return validateConfigChange(data as ConfigChangeData);
    }
}

function shortCoin(coinType: string): string {
    const parts = coinType.split("::");
    return parts.length >= 3 ? parts[parts.length - 1] : coinType;
}

function shortAddr(addr: string): string {
    if (addr.length <= 12) return addr;
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function buildDescription(actionType: ActionType, data: ActionData): string {
    switch (actionType) {
        case "mint_transfer": {
            const d = data as MintTransferData;
            const coin = shortCoin(d.coinType);
            switch (d.mode) {
                case "mint_to_address":
                    return `Mint ${d.amount} ${coin} to ${shortAddr(d.recipient)}`;
                case "mint_to_vault":
                    return `Mint ${d.amount} ${coin} to vault "${d.vaultName}"`;
                case "burn_from_vault":
                    return `Burn ${d.amount} ${coin} from vault "${d.vaultName}"`;
                case "lock_treasury_cap":
                    return `Lock TreasuryCap for ${coin}`;
                case "lock_metadata_cap":
                    return `Lock MetadataCap for ${coin}`;
                case "transfer_treasury_cap":
                    return `Transfer TreasuryCap for ${coin} to ${shortAddr(d.recipient)}`;
                case "transfer_metadata_cap":
                    return `Transfer MetadataCap for ${coin} to ${shortAddr(d.recipient)}`;
                default:
                    return `Currency: ${coin}`;
            }
        }
        case "vault_ops": {
            const d = data as VaultOpsData;
            const coin = shortCoin(d.coinType);
            switch (d.mode) {
                case "open":
                    return `Open vault "${d.vaultName}"`;
                case "close":
                    return `Close vault "${d.vaultName}"`;
                case "spend_transfer":
                    return `Spend ${d.spendAll ? "all" : d.amount} ${coin} from "${d.vaultName}" to ${shortAddr(d.recipient)}`;
                case "deposit_external":
                    return `Executor deposits ${d.amount} ${coin} into vault "${d.vaultName}"`;
                case "approve_coin_type":
                    return `Approve ${coin} for vault "${d.vaultName}"`;
                default:
                    return `Vault: ${d.vaultName}`;
            }
        }
        case "memo": {
            const d = data as MemoData;
            const text = d.memo.length > 80 ? d.memo.slice(0, 80) + "..." : d.memo;
            return `Memo: ${text}`;
        }
        case "stream": {
            const d = data as StreamData;
            const coin = shortCoin(d.coinType);
            if (d.mode === "cancel") return `Cancel spending limit ${shortAddr(d.streamId)}`;
            const total = parseFloat(d.amountPerIteration) * Number(d.iterationsTotal);
            const pastIterations = getPastIterationsForStreamData(d);
            const totalIterations = Number(d.iterationsTotal || "0");
            const pastWarning =
                pastIterations > 2 && totalIterations > 0
                    ? `, ${pastIterations} out of ${totalIterations} iterations in the past`
                    : "";
            return `Spending limit ${total || "?"} ${coin} for delegate ${shortAddr(d.capRecipient)} (${d.iterationsTotal} x ${d.iterationPeriodDays}d${pastWarning})`;
        }
        case "vesting": {
            const d = data as VestingData;
            const coin = shortCoin(d.coinType);
            const total = parseFloat(d.amountPerIteration) * Number(d.iterationsTotal);
            return `Vest ${total || "?"} ${coin} to ${shortAddr(d.beneficiary)} (${d.iterationsTotal} x ${d.iterationPeriodDays}d, ${d.source === "mint" ? "mint" : "vault"})`;
        }
        case "upgrade": {
            const d = data as UpgradeData;
            if (d.mode === "lock_upgrade_cap") return `Lock UpgradeCap for "${d.packageName}" (${d.delayDays}d delay)`;
            if (d.mode === "unlock_upgrade_cap")
                return `Unlock & transfer UpgradeCap "${d.packageName}" to ${shortAddr(d.recipient)}`;
            if (d.mode === "restrict") return `Restrict "${d.packageName}" to policy ${d.policy}`;
            return `Upgrade "${d.packageName}"`;
        }
        case "owned_object": {
            const d = data as TransferObjectData;
            if (d.mode === "deposit_to_vault")
                return `Deposit object ${shortAddr(d.objectId)} to vault "${d.vaultName}"`;
            return `Transfer object ${shortAddr(d.objectId)} to ${shortAddr(d.recipient)}`;
        }
        case "config_change": {
            const d = data as ConfigChangeData;
            return `Config change: ${d.members.length} members, threshold ${d.globalThreshold}`;
        }
        default:
            return actionType;
    }
}

type MultisigService = NonNullable<ReturnType<typeof getSDK>["multisig"]>;
type SimpleConfigInput = ReturnType<typeof buildSimpleMultisigConfigInput>;
type FrontendMultisigService = Omit<MultisigService, "proposeConfigChange"> & {
    proposeConfigChange: (
        tx: MultisigTx,
        params: SimpleConfigInput & {
            accountId: string;
            key: string;
            description: string;
            executionTimeMs?: bigint | number;
        }
    ) => MultisigTx;
    proposeActionsIntent: (
        tx: MultisigTx,
        params: {
            accountId: string;
            key: string;
            description: string;
            executionTimeMs?: bigint | number;
            builderSetup: (tx: Transaction, builder: ActionSpecBuilder) => void;
        }
    ) => MultisigTx;
};
type MultisigTx = Parameters<MultisigService["proposeActionsIntent"]>[0];

function asMultisigTx(tx: Transaction): MultisigTx {
    return tx as unknown as MultisigTx;
}

export function ProposeIntentModal({ isOpen, onClose, accountId, config, onSuccess }: Props) {
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);
    const intentExpiryMs = config?.intentExpiryMs ?? DEFAULT_INTENT_EXPIRY_MS;

    const [step, setStep] = useState<Step>("pick_type");
    const [actionType, setActionType] = useState<ActionType | null>(null);
    const [actionData, setActionData] = useState<ActionData | null>(null);
    const [showAdvancedActions, setShowAdvancedActions] = useState(false);

    const reset = useCallback(() => {
        setStep("pick_type");
        setActionType(null);
        setActionData(null);
        setShowAdvancedActions(false);
    }, []);

    useEffect(() => {
        if (isOpen) reset();
    }, [isOpen, reset]);

    const handleClose = useCallback(() => {
        reset();
        onClose();
    }, [onClose, reset]);

    const handlePickType = (type: ActionType) => {
        setActionType(type);
        setActionData(getDefaultData(type, config));
        setStep("form");
    };

    const copyMemberAddress = useCallback(async (address: string) => {
        const trimmed = address.trim();
        if (!trimmed) return;

        try {
            await navigator.clipboard.writeText(trimmed);
            toast.success("Address copied", { id: "clipboard-copy" });
        } catch {
            toast.error("Could not copy address");
        }
    }, []);

    const canProceedForm = actionType && actionData && validateData(actionType, actionData);
    const parsedConfigChange = useMemo(() => {
        if (actionType !== "config_change" || !actionData) return null;
        const configData = actionData as ConfigChangeData;
        return validateAndParseMultisigConfigDraft(
            configData.members.map((m) => ({
                address: m.address,
                weight: m.weight,
                permissions: memberToPermissions(m),
            })),
            configData.globalThreshold
        );
    }, [actionData, actionType]);

    const handleSubmit = useCallback(async () => {
        if (submittingRef.current || !actionType || !actionData) return;
        submittingRef.current = true;

        try {
            const tx = new Transaction();
            const executionTimeMs = 0n;
            const sdk = getSDK();
            if (!sdk.multisig) throw new Error("Multisig service not available");
            const multisig = sdk.multisig as unknown as FrontendMultisigService;

            const autoKey = `${actionType}-${Date.now()}`;
            const autoDescription = buildDescription(actionType, actionData);

            // Build the transaction (synchronous phase)
            try {
                if (actionType === "config_change") {
                    if (!parsedConfigChange) {
                        throw new Error("Invalid multisig configuration");
                    }
                    multisig.proposeConfigChange(asMultisigTx(tx), {
                        accountId,
                        key: autoKey,
                        description: autoDescription,
                        executionTimeMs,
                        ...buildSimpleMultisigConfigInput(parsedConfigChange, intentExpiryMs),
                    });
                } else {
                    multisig.proposeActionsIntent(asMultisigTx(tx), {
                        accountId,
                        key: autoKey,
                        description: autoDescription,
                        executionTimeMs,
                        builderSetup: (sdkTx, builder) => {
                            const tx = sdkTx as unknown as Transaction;
                            switch (actionType) {
                                case "mint_transfer":
                                    addMintTransferSpecs(tx, builder, actionData as MintTransferData);
                                    break;
                                case "vault_ops":
                                    addVaultOpsSpecs(tx, builder, actionData as VaultOpsData);
                                    break;
                                case "memo":
                                    addMemoSpecs(tx, builder, actionData as MemoData);
                                    break;
                                case "stream":
                                    addStreamSpecs(tx, builder, actionData as StreamData);
                                    break;
                                case "vesting":
                                    addVestingSpecs(tx, builder, actionData as VestingData);
                                    break;
                                case "upgrade":
                                    addUpgradeSpecs(tx, builder, actionData as UpgradeData);
                                    break;
                                case "owned_object":
                                    addTransferObjectSpecs(tx, builder, actionData as TransferObjectData);
                                    break;
                            }
                        },
                    });
                }
            } catch (buildError) {
                console.error(
                    "[ProposeIntent] Transaction build failed:",
                    buildError,
                    "\nAction data:",
                    JSON.stringify(actionData, null, 2)
                );
                throw buildError;
            }

            await executeTransaction(
                tx,
                {
                    onSuccess: () => {
                        onSuccess?.();
                        handleClose();
                    },
                },
                {
                    loadingMessage: "Proposing intent...",
                    successMessage: "Intent proposed!",
                }
            );
        } catch (error) {
            console.error("Failed to propose intent:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Failed to propose intent");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [
        accountId,
        actionType,
        actionData,
        executeTransaction,
        onSuccess,
        handleClose,
        intentExpiryMs,
        parsedConfigChange,
    ]);

    const actionInfo = actionType ? ACTION_TYPES.find((a) => a.type === actionType) : null;

    const title =
        step === "pick_type"
            ? "Propose Intent"
            : step === "form"
              ? actionInfo?.label || "Configure Action"
              : "Review & Submit";

    const formattedIntentExpiry = formatDurationMs(intentExpiryMs);

    return (
        <Modal isOpen={isOpen} onClose={handleClose} title={title} className="w-full max-w-2xl!">
            {/* Step 1: Action Type Picker + execution policy */}
            {step === "pick_type" && (
                <div className="space-y-4">
                    {ACTION_GROUPS.map((group) => {
                        const actions = ACTION_TYPES.filter((action) => action.group === group.id);
                        const isOpen = !group.collapsible || showAdvancedActions;
                        return (
                            <section key={group.id} className="space-y-2">
                                <div className="flex items-center justify-between gap-3">
                                    <div>
                                        <h3 className="text-xs font-semibold text-text-primary">{group.title}</h3>
                                        <p className="text-[10px] text-text-muted">{group.description}</p>
                                    </div>
                                    {group.collapsible && (
                                        <button
                                            type="button"
                                            onClick={() => setShowAdvancedActions((value) => !value)}
                                            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                                        >
                                            {showAdvancedActions ? "Hide" : "Show"}
                                            {showAdvancedActions ? (
                                                <ChevronUp className="w-3.5 h-3.5" />
                                            ) : (
                                                <ChevronDown className="w-3.5 h-3.5" />
                                            )}
                                        </button>
                                    )}
                                </div>
                                {isOpen && (
                                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                        {actions.map(({ type, label, description: desc, icon: Icon }) => (
                                            <button
                                                key={type}
                                                onClick={() => handlePickType(type)}
                                                className="bg-card-elevated border border-border-subtle rounded-lg p-4 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors group min-h-[92px]"
                                            >
                                                <Icon className="w-5 h-5 text-primary mb-2 group-hover:text-primary-light" />
                                                <p className="text-sm font-semibold text-text-primary">{label}</p>
                                                <p className="text-[10px] text-text-muted mt-0.5 leading-snug">
                                                    {desc}
                                                </p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </section>
                        );
                    })}
                    <p className="text-[11px] text-text-muted">
                        Intent expiry: {formattedIntentExpiry} (from multisig config).
                    </p>
                </div>
            )}

            {/* Step 3: Action Form */}
            {step === "form" && actionType && actionData && (
                <div className="space-y-4">
                    {actionType === "mint_transfer" && (
                        <MintTransferForm
                            accountId={accountId}
                            data={actionData as MintTransferData}
                            onChange={setActionData}
                        />
                    )}
                    {actionType === "vault_ops" && (
                        <VaultOpsForm
                            accountId={accountId}
                            data={actionData as VaultOpsData}
                            onChange={setActionData}
                        />
                    )}
                    {actionType === "memo" && <MemoForm data={actionData as MemoData} onChange={setActionData} />}
                    {actionType === "stream" && (
                        <StreamForm accountId={accountId} data={actionData as StreamData} onChange={setActionData} />
                    )}
                    {actionType === "vesting" && (
                        <VestingForm accountId={accountId} data={actionData as VestingData} onChange={setActionData} />
                    )}
                    {actionType === "upgrade" && (
                        <UpgradeForm accountId={accountId} data={actionData as UpgradeData} onChange={setActionData} />
                    )}
                    {actionType === "owned_object" && (
                        <TransferObjectForm
                            accountId={accountId}
                            data={actionData as TransferObjectData}
                            onChange={setActionData}
                        />
                    )}
                    {actionType === "config_change" &&
                        (() => {
                            const data = actionData as ConfigChangeData;
                            const updateMembers = (fn: (prev: MemberDraft[]) => MemberDraft[]) =>
                                setActionData({ ...data, members: fn(data.members) });
                            return (
                                <div className="space-y-4">
                                    <Input
                                        label="Global Threshold"
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={data.globalThreshold}
                                        onChange={(v) => setActionData({ ...data, globalThreshold: v })}
                                        placeholder="1"
                                    />
                                    <div>
                                        <div className="flex items-center justify-between mb-2">
                                            <label className="text-[10px] uppercase tracking-wide text-text-light/50">
                                                Members ({data.members.length})
                                            </label>
                                            <button
                                                onClick={() =>
                                                    updateMembers((prev) => [
                                                        ...prev,
                                                        {
                                                            address: "",
                                                            weight: "1",
                                                            propose: true,
                                                            vote: true,
                                                            execute: true,
                                                        },
                                                    ])
                                                }
                                                className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors"
                                            >
                                                <Plus className="w-3 h-3" /> Add
                                            </button>
                                        </div>
                                        <div className="space-y-3">
                                            {data.members.map((m, idx) => (
                                                <div
                                                    key={idx}
                                                    className="bg-card-elevated border border-border-subtle rounded-lg p-3 space-y-2"
                                                >
                                                    <div className="grid grid-cols-[minmax(0,1fr)_72px_28px_28px] items-center gap-2">
                                                        <div className="min-w-0">
                                                            <Input
                                                                value={m.address}
                                                                onChange={(v) =>
                                                                    updateMembers((prev) =>
                                                                        prev.map((x, i) =>
                                                                            i === idx ? { ...x, address: v } : x
                                                                        )
                                                                    )
                                                                }
                                                                placeholder="0x... address"
                                                                className="min-w-0 w-full"
                                                                size="sm"
                                                                error={
                                                                    m.address.length > 0 &&
                                                                    !isValidSuiAddress(m.address)
                                                                }
                                                            />
                                                        </div>
                                                        <div className="w-[72px]">
                                                            <Input
                                                                type="text"
                                                                inputMode="numeric"
                                                                pattern="[0-9]*"
                                                                value={m.weight}
                                                                onChange={(v) =>
                                                                    updateMembers((prev) =>
                                                                        prev.map((x, i) =>
                                                                            i === idx ? { ...x, weight: v } : x
                                                                        )
                                                                    )
                                                                }
                                                                placeholder="1"
                                                                className="w-full"
                                                                size="sm"
                                                            />
                                                        </div>
                                                        <button
                                                            type="button"
                                                            onClick={() => copyMemberAddress(m.address)}
                                                            disabled={m.address.trim().length === 0}
                                                            title="Copy member address"
                                                            aria-label={`Copy member ${idx + 1} address`}
                                                            className="rounded p-1.5 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
                                                        >
                                                            <Copy className="w-3.5 h-3.5" />
                                                        </button>
                                                        <button
                                                            type="button"
                                                            onClick={() =>
                                                                updateMembers((prev) =>
                                                                    prev.filter((_, i) => i !== idx)
                                                                )
                                                            }
                                                            className="p-1.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-3.5 h-3.5" />
                                                        </button>
                                                    </div>
                                                    <div className="flex gap-1.5 text-xs">
                                                        {(["propose", "vote", "execute"] as const).map(
                                                            (permission) => (
                                                                <button
                                                                    key={permission}
                                                                    type="button"
                                                                    onClick={() =>
                                                                        updateMembers((prev) =>
                                                                            prev.map((x, i) =>
                                                                                i === idx
                                                                                    ? {
                                                                                          ...x,
                                                                                          [permission]: !x[permission],
                                                                                      }
                                                                                    : x
                                                                            )
                                                                        )
                                                                    }
                                                                    className={`px-2 py-0.5 rounded-full transition-colors ${
                                                                        m[permission]
                                                                            ? "bg-primary/10 text-primary"
                                                                            : "bg-white/5 text-text-muted hover:text-text-primary"
                                                                    }`}
                                                                >
                                                                    {CONFIG_PERMISSION_LABELS[permission]}
                                                                </button>
                                                            )
                                                        )}
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </div>
                            );
                        })()}

                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setStep("pick_type")}
                            leftIcon={<ArrowLeft className="w-4 h-4" />}
                        >
                            Back
                        </Button>
                        <Button
                            className="flex-1"
                            disabled={!canProceedForm}
                            onClick={() => setStep("review")}
                            rightIcon={<ArrowRight className="w-4 h-4" />}
                        >
                            Review
                        </Button>
                    </div>
                </div>
            )}

            {/* Step 3: Review */}
            {step === "review" && (
                <div className="space-y-4">
                    <div className="bg-card-elevated border border-border-subtle rounded-xl p-4 space-y-2 text-sm">
                        <div className="flex justify-between">
                            <span className="text-text-muted">Intent Expiry Time</span>
                            <span className="text-text-primary">{formattedIntentExpiry}</span>
                        </div>
                        <div className="flex justify-between">
                            <span className="text-text-muted">Action</span>
                            <span className="text-text-primary">{actionInfo?.label}</span>
                        </div>
                    </div>

                    <div className="flex gap-3">
                        <Button
                            variant="secondary"
                            className="flex-1"
                            onClick={() => setStep("form")}
                            leftIcon={<ArrowLeft className="w-4 h-4" />}
                        >
                            Back
                        </Button>
                        <Button
                            className="flex-1"
                            disabled={submittingRef.current}
                            isLoading={isLoading}
                            onClick={handleSubmit}
                        >
                            Submit Proposal
                        </Button>
                    </div>
                </div>
            )}
        </Modal>
    );
}
