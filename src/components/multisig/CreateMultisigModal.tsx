import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useCurrentAccount, useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { Copy, ImageIcon, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/inputs/Button";
import { Input } from "@/components/inputs/Input";
import { LINKED_IMAGE_HELP_TEXT, validateLinkedImageUrl } from "@/lib/imageUrl";
import { useSavedMultisigIds } from "@/hooks/useMultisigIds";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import { createDefaultAdvancedDraft, parseAdvancedMultisigDraft } from "@/lib/sui/advancedMultisigConfig";
import {
    buildSimpleMultisigConfigInput,
    parseU64Input,
    validateAndParseMultisigConfigDraft,
} from "@/lib/sui/multisigConfigValidation";
import { appendCreateMultisigAccount, fetchMultisigCreationFeeMist, formatSuiFee } from "@/lib/sui/multisigCreation";
import { multisigKeys } from "@/hooks/api/useMultisigs";
import { AdvancedMultisigConfig } from "./AdvancedMultisigConfig";
import { MiddleEllipsizedAddress } from "./CopyableAddress";
import { CreateMultisigSuccessNote } from "./CreateMultisigSuccessNote";
import { MultisigAvatar } from "./MultisigAvatar";
import {
    DEFAULT_INTENT_EXPIRY_MS,
    PERMISSION_LABELS,
    REQUIRED_ROLE_LABELS,
    VISIBLE_CONFIG_MODES,
    defaultMember,
    extractCreatedMultisigAccountId,
    memberToPermissions,
    type ConfigMode,
    type MemberDraft,
} from "./CreateMultisigModal.helpers";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

export function CreateMultisigModal({ isOpen, onClose }: Props) {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();
    const { addId } = useSavedMultisigIds();
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);

    const creatorAddr = account?.address ?? "";

    const [accountName, setAccountName] = useState("");
    const [accountImageUrl, setAccountImageUrl] = useState("");
    const [members, setMembers] = useState<MemberDraft[]>(() => [defaultMember(creatorAddr)]);
    const [globalThreshold, setGlobalThreshold] = useState("1");
    const [configMode, setConfigMode] = useState<ConfigMode>("simple");
    const [advancedDraft, setAdvancedDraft] = useState(() => createDefaultAdvancedDraft(creatorAddr));
    const [successAccountId, setSuccessAccountId] = useState<string | null>(null);
    const [creationFeeMist, setCreationFeeMist] = useState<bigint | null>(null);
    const [creationFeeError, setCreationFeeError] = useState<string | null>(null);

    // Reset form when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setAccountName("");
        setAccountImageUrl("");
        setMembers([defaultMember(creatorAddr)]);
        setGlobalThreshold("1");
        setConfigMode("simple");
        setAdvancedDraft(createDefaultAdvancedDraft(creatorAddr));
        setSuccessAccountId(null);
    }, [isOpen, creatorAddr]);

    useEffect(() => {
        if (!isOpen) return;

        let cancelled = false;
        setCreationFeeMist(null);
        setCreationFeeError(null);

        const loadCreationFee = async () => {
            try {
                const sdk = getSDK();
                const fee = await fetchMultisigCreationFeeMist(sdk, suiClient);
                if (!cancelled) setCreationFeeMist(fee);
            } catch (error) {
                console.error("Failed to fetch multisig creation fee:", error);
                if (!cancelled) {
                    setCreationFeeError(error instanceof Error ? error.message : "Failed to fetch multisig fee");
                }
            }
        };

        void loadCreationFee();

        return () => {
            cancelled = true;
        };
    }, [isOpen, suiClient]);

    const addMember = () =>
        setMembers((prev) => [...prev, { address: "", weight: "1", propose: true, vote: true, execute: true }]);

    const removeMember = (idx: number) => setMembers((prev) => prev.filter((_, i) => i !== idx));

    const updateMember = (idx: number, patch: Partial<MemberDraft>) =>
        setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

    const copyAddress = useCallback(async (address: string) => {
        const trimmed = address.trim();
        if (!trimmed) return;

        try {
            await navigator.clipboard.writeText(trimmed);
            toast.success("Address copied");
        } catch {
            toast.error("Could not copy address");
        }
    }, []);

    const handleClose = useCallback(() => {
        setSuccessAccountId(null);
        onClose();
    }, [onClose]);

    const configValidation = useMemo(
        () =>
            validateAndParseMultisigConfigDraft(
                members.map((m) => ({
                    address: m.address,
                    weight: m.weight,
                    permissions: memberToPermissions(m),
                })),
                globalThreshold
            ),
        [globalThreshold, members]
    );
    const advancedValidation = useMemo(() => parseAdvancedMultisigDraft(advancedDraft), [advancedDraft]);
    const isAdvancedMode = configMode === "advanced";
    const configInput = useMemo(() => {
        if (isAdvancedMode) return advancedValidation.configInput;
        if (!configValidation) return null;
        return buildSimpleMultisigConfigInput(configValidation, DEFAULT_INTENT_EXPIRY_MS);
    }, [advancedValidation.configInput, configValidation, isAdvancedMode]);
    const imageValidation = useMemo(() => validateLinkedImageUrl(accountImageUrl), [accountImageUrl]);
    const imageInvalid = accountImageUrl.trim().length > 0 && Boolean(imageValidation.error);
    const normalizedImageUrl = imageValidation.normalized;
    const isValid = configInput !== null && !imageInvalid;
    const parsedThreshold = parseU64Input(globalThreshold);
    const totalVoterWeight = useMemo(
        () =>
            members.reduce((total, member) => {
                if ((memberToPermissions(member) & 2) !== 2) return total;
                const weight = parseU64Input(member.weight);
                if (weight === null || weight <= 0n) return total;
                return total + weight;
            }, 0n),
        [members]
    );
    const missingRequiredRoles = useMemo(
        () =>
            REQUIRED_ROLE_LABELS.filter(([role]) => !members.some((member) => member[role])).map(([, label]) => label),
        [members]
    );
    const thresholdTooHigh = parsedThreshold !== null && parsedThreshold > totalVoterWeight;
    const thresholdInvalid = globalThreshold.trim() !== "" && (parsedThreshold === null || parsedThreshold < 1n);

    const handleCreate = useCallback(async () => {
        if (submittingRef.current || !account || !configInput || creationFeeMist === null || imageInvalid) return;

        submittingRef.current = true;
        try {
            const sdk = getSDK();
            if (!sdk.multisig) throw new Error("multisig service not configured");

            const tx = new Transaction();
            const paymentCoin =
                creationFeeMist > 0n ? tx.splitCoins(tx.gas, [tx.pure.u64(creationFeeMist)])[0] : undefined;

            const metadata: Record<string, string> = {};
            const trimmedName = accountName.trim();
            if (trimmedName) metadata.name = trimmedName;
            if (normalizedImageUrl) metadata.image = normalizedImageUrl;

            appendCreateMultisigAccount(tx, sdk, {
                configInput,
                metadata: Object.keys(metadata).length > 0 ? metadata : undefined,
                paymentCoin,
            });

            await executeTransaction(
                tx,
                {
                    onSuccess: (result) => {
                        const createdAccountId = extractCreatedMultisigAccountId(result);
                        if (createdAccountId) addId(createdAccountId);
                        setSuccessAccountId(createdAccountId ?? "");
                        queryClient.invalidateQueries({ queryKey: multisigKeys.all });
                        queryClient.invalidateQueries({ queryKey: ["multisig-rpc"] });
                        window.setTimeout(() => {
                            void queryClient.refetchQueries({
                                queryKey: multisigKeys.list(account.address),
                                type: "all",
                            });
                        }, 5000);
                    },
                },
                {
                    loadingMessage: "Creating multisig account...",
                    showSuccessToast: false,
                }
            );
        } catch (error) {
            console.error("Failed to create multisig:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Failed to create multisig");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [
        account,
        accountName,
        normalizedImageUrl,
        configInput,
        creationFeeMist,
        imageInvalid,
        executeTransaction,
        queryClient,
        addId,
    ]);

    return (
        <Modal
            isOpen={isOpen}
            onClose={handleClose}
            title={successAccountId !== null ? "Multisig created" : "Create your multisig"}
            className={`w-full ${isAdvancedMode ? "max-w-4xl!" : "max-w-2xl!"}`}
        >
            {successAccountId !== null ? (
                <CreateMultisigSuccessNote accountId={successAccountId} onClose={handleClose} />
            ) : (
                <div className="space-y-5">
                    <div className="grid gap-2">
                        {VISIBLE_CONFIG_MODES.map((mode) => {
                            const selected = configMode === mode;
                            const isAdvancedOption = mode === "advanced";
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setConfigMode(mode)}
                                    className={`min-w-0 rounded-lg border text-left transition-colors ${
                                        isAdvancedOption ? "p-2.5" : "p-3"
                                    } ${
                                        selected
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "border-border-subtle bg-card-elevated text-text-muted hover:border-border-light hover:text-text-primary"
                                    }`}
                                >
                                    <span
                                        className={`block font-semibold ${
                                            isAdvancedOption ? "text-[11px]" : "text-xs"
                                        }`}
                                    >
                                        {mode === "simple" ? "Simple" : "Advanced"}
                                    </span>
                                    <span
                                        className={`mt-1 block leading-snug text-text-muted ${
                                            isAdvancedOption ? "text-[10px]" : "text-[11px]"
                                        }`}
                                    >
                                        {mode === "simple"
                                            ? "Best for: individuals and non-technical teams."
                                            : "Best for: teams with complex OpSec requirements."}
                                        {/*
                                         * Remove this comment block to use advanced time banding configuration:
                                         * Advanced copy:
                                         * "Best for: teams with complex OpSec requirements or time-weighted approvals."
                                         */}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                    <div className="flex justify-end gap-2 text-sm">
                        <span className="text-text-muted">Creation fee</span>
                        <span className="font-semibold text-text-primary">{formatSuiFee(creationFeeMist)}</span>
                    </div>
                    {creationFeeError && (
                        <p className="text-right text-[10px] text-red-400">
                            Could not load creation fee: {creationFeeError}
                        </p>
                    )}

                    {/* Account name */}
                    <Input
                        label="Account name (optional)"
                        value={accountName}
                        onChange={setAccountName}
                        placeholder="e.g. Treasury"
                    />

                    <div className="grid grid-cols-[4rem_minmax(0,1fr)] items-end gap-3">
                        <MultisigAvatar name={accountName || "Multisig"} imageUrl={normalizedImageUrl} size="xl" />
                        <div>
                            <Input
                                label="Image URL (optional)"
                                value={accountImageUrl}
                                onChange={setAccountImageUrl}
                                placeholder="https://example.com/multisig.png"
                                inputMode="url"
                                error={imageInvalid}
                                leftIcon={<ImageIcon className="h-4 w-4 text-text-muted" />}
                            />
                            {imageInvalid && <p className="mt-1 text-xs text-error-light">{imageValidation.error}</p>}
                            <p className="mt-1 text-[11px] text-text-muted">{LINKED_IMAGE_HELP_TEXT}</p>
                        </div>
                    </div>

                    {!isAdvancedMode && (
                        <>
                            {/* Signers */}
                            <div>
                                <div className="flex items-center justify-between mb-2">
                                    <label className="text-[10px] uppercase tracking-wide text-text-light/50">
                                        Signers ({members.length})
                                    </label>
                                </div>

                                <div className="space-y-3">
                                    {members.map((m, idx) => {
                                        const isCreator = idx === 0 && m.address === creatorAddr;
                                        const hasAddress = m.address.trim().length > 0;
                                        const addressError = hasAddress && !isValidSuiAddress(m.address);
                                        return (
                                            <div
                                                key={idx}
                                                className="bg-card-elevated border border-border-subtle rounded-lg p-3 space-y-2"
                                            >
                                                <div
                                                    className={`grid items-center gap-2 ${
                                                        isCreator
                                                            ? "grid-cols-[auto_minmax(0,1fr)_auto_auto_auto]"
                                                            : "grid-cols-[auto_minmax(0,1fr)_auto_auto]"
                                                    }`}
                                                >
                                                    <div className="w-14 shrink-0 text-[11px] font-medium text-text-secondary">
                                                        Signer {idx + 1}
                                                    </div>
                                                    <div
                                                        className={`min-w-0 flex items-center gap-1 rounded-lg border bg-card-more-elevated text-text-primary transition-colors ${
                                                            addressError
                                                                ? "border-error/40 bg-error/5"
                                                                : "border-border"
                                                        }`}
                                                    >
                                                        {isCreator ? (
                                                            <span
                                                                className={`min-w-0 flex-1 overflow-hidden px-2 py-1 font-mono text-[10px] ${
                                                                    hasAddress ? "text-text-primary" : "text-text-muted"
                                                                }`}
                                                                title={m.address}
                                                            >
                                                                {hasAddress ? (
                                                                    <MiddleEllipsizedAddress address={m.address} />
                                                                ) : (
                                                                    "Add address here"
                                                                )}
                                                            </span>
                                                        ) : (
                                                            <input
                                                                value={m.address}
                                                                onChange={(event) =>
                                                                    updateMember(idx, { address: event.target.value })
                                                                }
                                                                placeholder="Add address here"
                                                                aria-label={`Signer ${idx + 1} address`}
                                                                className={`min-w-0 flex-1 truncate bg-transparent px-2 py-1 font-mono text-[10px] outline-none placeholder:text-text-muted ${
                                                                    hasAddress ? "text-text-primary" : "text-text-muted"
                                                                }`}
                                                            />
                                                        )}
                                                        <button
                                                            type="button"
                                                            onClick={() => copyAddress(m.address)}
                                                            disabled={!hasAddress}
                                                            title="Copy address"
                                                            aria-label={`Copy signer ${idx + 1} address`}
                                                            className="mr-1 rounded p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary disabled:pointer-events-none disabled:opacity-30"
                                                        >
                                                            <Copy className="h-3.5 w-3.5" />
                                                        </button>
                                                    </div>
                                                    {isCreator && (
                                                        <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-primary/15 text-primary whitespace-nowrap">
                                                            You
                                                        </span>
                                                    )}
                                                    <div className="flex w-24 shrink-0 items-center gap-1">
                                                        <span className="text-[10px] text-text-muted">Weight</span>
                                                        <input
                                                            type="text"
                                                            inputMode="numeric"
                                                            pattern="[0-9]*"
                                                            value={m.weight}
                                                            onChange={(event) =>
                                                                updateMember(idx, { weight: event.target.value })
                                                            }
                                                            placeholder="1"
                                                            aria-label={`Signer ${idx + 1} weight`}
                                                            className="w-11 rounded-lg border border-border bg-card-more-elevated px-2 py-1 text-xs text-text-primary outline-none transition-colors placeholder:text-text-lighter focus:border-border-light"
                                                        />
                                                    </div>
                                                    <button
                                                        type="button"
                                                        onClick={() => removeMember(idx)}
                                                        className="p-1.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                                                        title="Remove signer"
                                                        aria-label={`Remove signer ${idx + 1}`}
                                                    >
                                                        <Trash2 className="w-3.5 h-3.5" />
                                                    </button>
                                                </div>

                                                <div className="space-y-1.5">
                                                    <div className="text-[10px] uppercase tracking-wide text-text-light/50">
                                                        Roles for this signer
                                                    </div>
                                                    <div className="flex gap-1.5 text-xs">
                                                        {(["propose", "vote", "execute"] as const).map((permission) => (
                                                            <button
                                                                key={permission}
                                                                type="button"
                                                                onClick={() =>
                                                                    updateMember(idx, { [permission]: !m[permission] })
                                                                }
                                                                className={`rounded-full border px-2 py-0.5 transition-colors ${
                                                                    m[permission]
                                                                        ? "border-primary/30 bg-primary/10 text-primary"
                                                                        : "border-border-subtle bg-card-more-elevated/40 text-text-muted hover:bg-white/5 hover:text-text-primary"
                                                                }`}
                                                            >
                                                                {PERMISSION_LABELS[permission]}
                                                            </button>
                                                        ))}
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })}
                                </div>
                                <div className="mt-3 flex justify-end">
                                    <button
                                        type="button"
                                        onClick={addMember}
                                        className="flex items-center gap-1 text-xs text-primary transition-colors hover:text-primary-light"
                                    >
                                        <Plus className="h-3 w-3" /> Add signer
                                    </button>
                                </div>
                                {missingRequiredRoles.length > 0 && (
                                    <p className="text-[10px] text-red-400 mt-2">
                                        Every multisig needs at least one signer who can propose, vote, and execute.
                                    </p>
                                )}
                            </div>

                            {/* Approval threshold */}
                            <div>
                                <label className="text-[10px] uppercase tracking-wide text-text-light/50 mb-2 block">
                                    Total approval required for actions
                                </label>
                                <div className="flex items-center gap-2">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={globalThreshold}
                                        onChange={setGlobalThreshold}
                                        placeholder="1"
                                        className="w-20"
                                        size="sm"
                                        error={thresholdTooHigh || thresholdInvalid}
                                    />
                                    <span className="text-lg text-text-muted">/</span>
                                    <span className="text-sm text-text-muted">
                                        {totalVoterWeight.toString()} total weight
                                    </span>
                                </div>
                                {thresholdTooHigh && (
                                    <p className="text-[10px] text-red-400 mt-1">
                                        Threshold cannot exceed total voter weight
                                    </p>
                                )}
                                {thresholdInvalid && (
                                    <p className="text-[10px] text-red-400 mt-1">Threshold must be at least 1</p>
                                )}
                            </div>
                        </>
                    )}

                    {isAdvancedMode && (
                        <AdvancedMultisigConfig
                            draft={advancedDraft}
                            onChange={setAdvancedDraft}
                            error={advancedValidation.error}
                        />
                    )}

                    {/* Submit */}
                    <Button
                        className="w-full h-11 font-medium"
                        disabled={
                            !isValid ||
                            submittingRef.current ||
                            !account ||
                            creationFeeMist === null ||
                            creationFeeError !== null
                        }
                        isLoading={isLoading}
                        onClick={handleCreate}
                    >
                        {!account ? "Connect wallet" : isAdvancedMode ? "Create advanced multisig" : "Create multisig"}
                    </Button>
                </div>
            )}
        </Modal>
    );
}
