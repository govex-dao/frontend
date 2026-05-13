import { useState, useCallback, useEffect, useMemo, useRef } from "react";
import { Transaction } from "@mysten/sui/transactions";
import { isValidSuiAddress } from "@mysten/sui/utils";
import { Plus, Trash2 } from "lucide-react";
import toast from "react-hot-toast";
import { Modal } from "@/components/overlays/Modal";
import { Button } from "@/components/inputs/Button";
import { Input } from "@/components/inputs/Input";
import { DateTimeInput } from "@/components/inputs/DateTimeInput";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import {
    buildSimpleMultisigConfigInput,
    validateAndParseMultisigConfigDraft,
} from "@/lib/sui/multisigConfigValidation";
import type { MultisigConfig, MultisigMember } from "@/lib/sui/multisig";

interface Props {
    isOpen: boolean;
    onClose: () => void;
    accountId: string;
    config: MultisigConfig;
    onSuccess?: () => void;
}

interface MemberDraft {
    address: string;
    weight: string;
    propose: boolean;
    vote: boolean;
    execute: boolean;
    cancel: boolean;
}

function memberToPermissions(m: { propose: boolean; vote: boolean; execute: boolean; cancel: boolean }): number {
    return (m.propose ? 1 : 0) | (m.vote ? 2 : 0) | (m.execute ? 4 : 0) | (m.cancel ? 8 : 0);
}

function memberFromConfig(m: MultisigMember): MemberDraft {
    return {
        address: m.address,
        weight: String(m.weight),
        propose: (m.permissions & 1) !== 0,
        vote: (m.permissions & 2) !== 0,
        execute: (m.permissions & 4) !== 0,
        cancel: (m.permissions & 8) !== 0,
    };
}

function formatDurationMs(ms: number): string {
    const minutes = Math.floor(ms / 60_000);
    const hours = Math.floor(ms / 3_600_000);
    const days = Math.floor(ms / 86_400_000);
    if (days > 0) return `${days}d ${hours % 24}h`;
    if (hours > 0) return `${hours}h ${minutes % 60}m`;
    return `${minutes}m`;
}

type MultisigService = NonNullable<ReturnType<typeof getSDK>["multisig"]>;
type MultisigTx = Parameters<MultisigService["proposeConfigChange"]>[0];
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
};

function asMultisigTx(tx: Transaction): MultisigTx {
    return tx as unknown as MultisigTx;
}

export function ConfigChangeModal({ isOpen, onClose, accountId, config, onSuccess }: Props) {
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);
    const intentExpiryMs = config.intentExpiryMs;

    const [members, setMembers] = useState<MemberDraft[]>(() => config.members.map(memberFromConfig));
    const [globalThreshold, setGlobalThreshold] = useState(String(config.globalThreshold));
    const [executionDate, setExecutionDate] = useState("");

    useEffect(() => {
        if (!isOpen) return;
        setMembers(config.members.map(memberFromConfig));
        setGlobalThreshold(String(config.globalThreshold));
        setExecutionDate("");
    }, [isOpen, config]);

    const addMember = () =>
        setMembers((prev) => [
            ...prev,
            { address: "", weight: "1", propose: true, vote: true, execute: true, cancel: true },
        ]);

    const removeMember = (idx: number) => setMembers((prev) => prev.filter((_, i) => i !== idx));

    const updateMember = (idx: number, patch: Partial<MemberDraft>) =>
        setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

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
    const isValid = configValidation !== null;

    const handleSubmit = useCallback(async () => {
        if (submittingRef.current || !configValidation) return;
        submittingRef.current = true;

        try {
            const sdk = getSDK();
            if (!sdk.multisig) throw new Error("Multisig service not available");
            const multisig = sdk.multisig as unknown as FrontendMultisigService;

            const tx = new Transaction();
            const key = `config-${Date.now()}`;
            const executionTimeMs = executionDate ? BigInt(new Date(executionDate).getTime()) : 0n;

            multisig.proposeConfigChange(asMultisigTx(tx), {
                accountId,
                key,
                description: "Config change from UI",
                executionTimeMs,
                ...buildSimpleMultisigConfigInput(configValidation, intentExpiryMs),
            });

            await executeTransaction(
                tx,
                {
                    onSuccess: () => {
                        onSuccess?.();
                        onClose();
                    },
                },
                {
                    loadingMessage: "Proposing config change...",
                    successMessage: "Config change proposed!",
                }
            );
        } catch (error) {
            console.error("Failed to propose config change:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Failed to propose config change");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [accountId, configValidation, executionDate, executeTransaction, onSuccess, onClose, intentExpiryMs]);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Edit Config" className="w-full max-w-2xl!">
            <div className="space-y-6">
                {/* Global threshold + execution policy */}
                <div className="grid grid-cols-2 gap-4">
                    <Input
                        label="Global Threshold"
                        type="text"
                        inputMode="numeric"
                        pattern="[0-9]*"
                        value={globalThreshold}
                        onChange={setGlobalThreshold}
                        placeholder="1"
                    />
                    <DateTimeInput
                        label="Earliest Execution (optional)"
                        value={executionDate}
                        onChange={(iso) => setExecutionDate(iso)}
                    />
                </div>
                <p className="text-[11px] text-text-muted">
                    Intent expiry is derived from multisig config: {formatDurationMs(intentExpiryMs)}.
                </p>

                {/* Members */}
                <div>
                    <div className="flex items-center justify-between mb-2">
                        <label className="text-[10px] uppercase tracking-wide text-text-light/50">
                            Members ({members.length})
                        </label>
                        <button
                            onClick={addMember}
                            className="flex items-center gap-1 text-xs text-primary hover:text-primary-light transition-colors"
                        >
                            <Plus className="w-3 h-3" /> Add
                        </button>
                    </div>

                    <div className="space-y-3">
                        {members.map((m, idx) => (
                            <div
                                key={idx}
                                className="bg-card-elevated border border-border-subtle rounded-lg p-3 space-y-2"
                            >
                                <div className="flex items-center gap-2">
                                    <Input
                                        value={m.address}
                                        onChange={(v) => updateMember(idx, { address: v })}
                                        placeholder="0x... address"
                                        className="flex-1"
                                        size="sm"
                                        error={m.address.length > 0 && !isValidSuiAddress(m.address)}
                                    />
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                        value={m.weight}
                                        onChange={(v) => updateMember(idx, { weight: v })}
                                        placeholder="1"
                                        className="w-16"
                                        size="sm"
                                    />
                                    <button
                                        onClick={() => removeMember(idx)}
                                        className="p-1.5 rounded hover:bg-red-500/20 text-text-muted hover:text-red-400 transition-colors"
                                    >
                                        <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                </div>

                                <div className="flex gap-1.5 text-xs">
                                    {(["propose", "vote", "execute", "cancel"] as const).map((permission) => (
                                        <button
                                            key={permission}
                                            type="button"
                                            onClick={() => updateMember(idx, { [permission]: !m[permission] })}
                                            className={`px-2 py-0.5 rounded-full transition-colors ${
                                                m[permission]
                                                    ? "bg-primary/10 text-primary"
                                                    : "bg-white/5 text-text-muted hover:text-text-primary"
                                            }`}
                                        >
                                            {permission[0].toUpperCase()}
                                            {permission.slice(1)}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>

                {/* Submit */}
                <Button
                    className="w-full h-11 font-medium"
                    disabled={!isValid || submittingRef.current}
                    isLoading={isLoading}
                    onClick={handleSubmit}
                >
                    Propose Config Change
                </Button>
            </div>
        </Modal>
    );
}
