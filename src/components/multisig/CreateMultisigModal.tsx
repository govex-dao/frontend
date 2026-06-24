import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import { Transaction } from "@mysten/sui/transactions";
import { bcs } from "@mysten/sui/bcs";
import { MIST_PER_SUI, isValidSuiAddress } from "@mysten/sui/utils";
import { Copy, Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/inputs/Button";
import { Input } from "@/components/inputs/Input";
import { useSavedMultisigIds } from "@/hooks/useMultisigIds";
import { isNotifiedTransactionError, type TransactionResult, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import { network } from "@/lib/config";
import { createDefaultAdvancedDraft, parseAdvancedMultisigDraft } from "@/lib/sui/advancedMultisigConfig";
import {
    buildSimpleMultisigConfigInput,
    flattenMultisigConfigInput,
    parseU64Input,
    validateAndParseMultisigConfigDraft,
} from "@/lib/sui/multisigConfigValidation";
import { multisigKeys } from "@/hooks/api/useMultisigs";
import { AdvancedMultisigConfig } from "./AdvancedMultisigConfig";
import { MiddleEllipsizedAddress } from "./CopyableAddress";
import { CreateMultisigSuccessNote } from "./CreateMultisigSuccessNote";

interface Props {
    isOpen: boolean;
    onClose: () => void;
}

interface MemberDraft {
    address: string;
    weight: string;
    propose: boolean;
    vote: boolean;
    execute: boolean;
}

// Simple mode always grants the cancel role (bit 8) to every member. Onchain,
// cancel role is a pure membership check (time bands and weights are ignored),
// and finalizing cancellation still requires the reject quorum to have been met,
// so making everyone a canceller is permissive but safe. Keep this synced with
// `validateAndParseMultisigConfigDraft`, which requires hasCanceller=true.
function memberToPermissions(m: { propose: boolean; vote: boolean; execute: boolean }): number {
    return (m.propose ? 1 : 0) | (m.vote ? 2 : 0) | (m.execute ? 4 : 0) | 8;
}

const REQUIRED_ROLE_LABELS = [
    ["propose", "propose"],
    ["vote", "vote"],
    ["execute", "execute"],
] as const;

const PERMISSION_LABELS = {
    propose: "Propose",
    vote: "Vote",
    execute: "Execute",
} as const;

const FEE_SUI_DISPLAY = "20";
const FEE_MIST = 20n * MIST_PER_SUI;
const DEFAULT_INTENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;
const SUI_MAINNET_USDC_COIN_TYPE =
    "0xdba34672e30cb065b1f93e3ab55318768fd6fef66c15942c9f7cb846e2f900e7::usdc::USDC";
const SUI_TESTNET_USDC_COIN_TYPE =
    "0xa1ec7fc00a6f40db9693ad1415d0c193ad3906494428cf252621037bd7117e29::usdc::USDC";

function getMultisigTreasuryCoinType(): string {
    const override = import.meta.env.VITE_MULTISIG_TREASURY_COIN_TYPE?.trim();
    if (override) return override;
    return network === "testnet" ? SUI_TESTNET_USDC_COIN_TYPE : SUI_MAINNET_USDC_COIN_TYPE;
}

function defaultMember(address: string): MemberDraft {
    return { address, weight: "1", propose: true, vote: true, execute: true };
}

function extractCreatedMultisigAccountId(result: TransactionResult): string | null {
    for (const change of result.objectChanges ?? []) {
        if (!change.objectId || !change.objectType) continue;
        if (change.objectType.endsWith("::account::Account")) {
            return change.objectId;
        }
    }
    return null;
}

export function CreateMultisigModal({ isOpen, onClose }: Props) {
    const account = useCurrentAccount();
    const queryClient = useQueryClient();
    const { addId } = useSavedMultisigIds();
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);

    const creatorAddr = account?.address ?? "";

    const [accountName, setAccountName] = useState("");
    const [members, setMembers] = useState<MemberDraft[]>(() => [defaultMember(creatorAddr)]);
    const [globalThreshold, setGlobalThreshold] = useState("1");
    const [configMode, setConfigMode] = useState<"simple" | "advanced">("simple");
    const [advancedDraft, setAdvancedDraft] = useState(() => createDefaultAdvancedDraft(creatorAddr));
    const [successAccountId, setSuccessAccountId] = useState<string | null>(null);

    // Reset form when modal opens
    useEffect(() => {
        if (!isOpen) return;
        setAccountName("");
        setMembers([defaultMember(creatorAddr)]);
        setGlobalThreshold("1");
        setConfigMode("simple");
        setAdvancedDraft(createDefaultAdvancedDraft(creatorAddr));
        setSuccessAccountId(null);
    }, [isOpen, creatorAddr]);

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
    const isValid = configInput !== null;
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
        if (submittingRef.current || !account || !configInput) return;

        submittingRef.current = true;
        try {
            const sdk = getSDK();
            const pkg = sdk.packages.accountMultisig;
            const actionsPackage = sdk.packages.accountActions;
            const feeVault = sdk.sharedObjects.multisigFeeVault;
            const registryId = sdk.sharedObjects.packageRegistry.id;

            if (!pkg) throw new Error("accountMultisig package not configured");
            if (!actionsPackage) throw new Error("accountActions package not configured");
            if (!feeVault) throw new Error("multisigFeeVault not configured");

            const tx = new Transaction();
            const [feeCoin] = tx.splitCoins(tx.gas, [tx.pure.u64(FEE_MIST)]);

            const metadataKeys: string[] = [];
            const metadataValues: string[] = [];
            if (accountName.trim()) {
                metadataKeys.push("name");
                metadataValues.push(accountName.trim());
            }
            const configArgs = flattenMultisigConfigInput(configInput);

            const newAccount = tx.moveCall({
                target: `${pkg}::multisig::new_account`,
                arguments: [
                    tx.object(feeVault.id),
                    tx.object(registryId),
                    feeCoin,
                    tx.pure.vector("string", metadataKeys),
                    tx.pure.vector("string", metadataValues),
                    tx.pure.vector("string", configArgs.groupNames),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.groupMemberCounts).toBytes()),
                    tx.pure(bcs.vector(bcs.Address).serialize(configArgs.allMemberAddresses).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allMemberWeights).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.timeBandCounts).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allTimeBandAfters).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allTimeBandWeights).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.approvePathReqCounts).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allApproveGroupIndices).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allApproveThresholds).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.cancelPathReqCounts).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allCancelGroupIndices).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allCancelThresholds).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.proposeGroups).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.executeGroups).toBytes()),
                    tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.cancelGroups).toBytes()),
                    tx.pure.u64(configArgs.intentExpiryMs),
                ],
            });

            tx.moveCall({
                target: `${actionsPackage}::vault::init_treasury_vault_with_coin_type`,
                typeArguments: [getMultisigTreasuryCoinType()],
                arguments: [newAccount, tx.object(registryId)],
            });

            tx.moveCall({
                target: `${pkg}::multisig::share`,
                arguments: [newAccount],
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
    }, [account, accountName, configInput, executeTransaction, queryClient, addId]);

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
                    <div className="grid gap-2 sm:grid-cols-2">
                        {(["simple", "advanced"] as const).map((mode) => {
                            const selected = configMode === mode;
                            return (
                                <button
                                    key={mode}
                                    type="button"
                                    onClick={() => setConfigMode(mode)}
                                    className={`min-w-0 rounded-lg border p-3 text-left transition-colors ${
                                        selected
                                            ? "border-primary/40 bg-primary/10 text-primary"
                                            : "border-border-subtle bg-card-elevated text-text-muted hover:border-border-light hover:text-text-primary"
                                    }`}
                                >
                                    <span className="block text-xs font-semibold">
                                        {mode === "simple" ? "Simple" : "Advanced"}
                                    </span>
                                    <span className="mt-1 block text-[11px] leading-snug text-text-muted">
                                        {mode === "simple"
                                            ? "Best for: individuals and non-technical teams."
                                            : "Best for: professional teams that want multiple approval paths or backup custodians."}
                                        {/*
                                         * Remove this comment block to use advanced time banding configuration:
                                         * Advanced copy:
                                         * "Best for: professional teams that want multiple approval paths, backup custodians, or time-weighted approvals."
                                         */}
                                    </span>
                                </button>
                            );
                        })}
                    </div>

                <div className="flex justify-end gap-2 text-sm">
                    <span className="text-text-muted">Creation fee</span>
                    <span className="font-semibold text-text-primary">{FEE_SUI_DISPLAY} SUI</span>
                </div>

                {/* Account name */}
                <Input
                    label="Account name (optional)"
                    value={accountName}
                    onChange={setAccountName}
                    placeholder="e.g. Treasury"
                />

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
                                                        addressError ? "border-error/40 bg-error/5" : "border-border"
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
                    disabled={!isValid || submittingRef.current || !account}
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
