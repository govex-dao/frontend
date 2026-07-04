/* eslint-disable max-lines */
import { type ReactNode, useCallback, useEffect, useMemo, useState } from "react";
import { Helmet } from "react-helmet-async";
import { useParams } from "react-router";
import {
    Loader2,
    Shield,
    Plus,
    Coins,
    ArrowDownToLine,
    Package,
    WalletCards,
    ChevronDown,
    ChevronUp,
    Copy,
    Check,
    Hourglass,
    Trash2,
    Archive,
    ArrowRightLeft,
    KeyRound,
} from "lucide-react";
import { formatAddress, parseStructTag } from "@mysten/sui/utils";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { MemberRow } from "@/components/multisig/MemberRow";
import { GroupsSection } from "@/components/multisig/GroupsSection";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
import { IntentCard } from "@/components/multisig/IntentCard";
import { StreamCard } from "@/components/multisig/StreamCard";
import { VestingCard } from "@/components/VestingCard";
import { CoinAvatar } from "@/components/CoinAvatar";
import { ProposeIntentModal } from "@/components/multisig/ProposeIntentModal";
import { DepositModal } from "@/components/multisig/DepositModal";
import { MigrateToMultisigModal } from "@/components/multisig/MigrateToMultisigModal";
import {
    useMultisigConfig,
    useMultisigIntents,
    useMultisigStreams,
    useMultisigVaultBalances,
    useMultisigVaultNames,
    useMultisigPackageInfo,
    useMultisigLockedCaps,
    useMultisigVestings,
    multisigRpcKeys,
} from "@/hooks/useMultisig";
import { useCoins } from "@/hooks/api/useCoins";
import { useMergedCoinMetadata } from "@/hooks/useOnChainCoinMetadata";
import {
    approvalPolicyLabel,
    canAddressCancel,
    canAddressPropose,
    formatExpiration,
    isClosedIntentStatus,
    isMultisigConfigIntentSummary,
    isOpenIntentStatus,
    memberPermissionsForAddress,
    MULTISIG_INTENT_STATUS,
    normalizeSuiAddress,
    permissionLabels,
    policyLabel,
} from "@/lib/sui/multisig";
import type { IntentSummary, LockedCapInfo, VaultCoinBalance } from "@/lib/sui/multisig";
import {
    cancelExpiredActions,
    cancelExpiredConfigChange,
    cancelRejectedActions,
    cancelRejectedConfigChange,
    cancelStaleActions,
    cancelStaleConfigChange,
} from "@/lib/sui/multisig-tx";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import type { CoinMetadata } from "@/lib/api/coins";
import { formatUnits, normalizeUnitsForSort } from "@/lib/units";

const CLEANUP_INTENTS_LIMIT = 25;

type CleanupIntentAction = "expired" | "stale" | "rejected";

interface CleanupIntentTarget {
    intent: IntentSummary;
    action: CleanupIntentAction;
    isConfig: boolean;
}

const LOCKED_CAP_KIND_LABELS: Record<LockedCapInfo["kind"], string> = {
    controlled: "Controlled",
    treasury: "TreasuryCap",
    metadata: "MetadataCap",
};

function addMoveTypeAddressPrefixes(type: string): string {
    return type.replace(/(^|[<,\s])([0-9a-fA-F]{1,64})(?=::)/g, (_match, prefix: string, address: string) => {
        if (address.startsWith("0x")) return `${prefix}${address}`;
        return `${prefix}0x${address}`;
    });
}

function shortMoveType(fullType: string): string {
    try {
        const label = shortStructTag(parseStructTag(addMoveTypeAddressPrefixes(fullType)));
        return label.length > 96 ? `${label.slice(0, 93)}...` : label;
    } catch {
        return fullType.length > 96 ? `${fullType.slice(0, 93)}...` : fullType;
    }
}

function shortStructTag(tag: ReturnType<typeof parseStructTag>): string {
    let label = `${formatAddress(tag.address)}::${tag.module}::${tag.name}`;
    if (tag.typeParams.length > 0) {
        label += `<${tag.typeParams
            .map((param) => (typeof param === "string" ? param : shortStructTag(param)))
            .join(", ")}>`;
    }
    return label;
}

interface CollapsibleSectionProps {
    title: string;
    count?: number;
    icon?: ReactNode;
    defaultOpen?: boolean;
    muted?: boolean;
    children: ReactNode;
}

function CollapsibleSection({
    title,
    count,
    icon,
    defaultOpen = false,
    muted = false,
    children,
}: CollapsibleSectionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    useEffect(() => {
        setIsOpen(defaultOpen);
    }, [defaultOpen]);

    return (
        <section className={`space-y-3 ${muted ? "opacity-90" : ""}`}>
            <button
                type="button"
                onClick={() => setIsOpen((open) => !open)}
                className="flex w-full items-center justify-between gap-3 border-b border-border-subtle pb-2 text-left transition-colors hover:border-border-light"
            >
                <span
                    className={`flex items-center gap-2 text-lg font-semibold ${muted ? "text-text-muted" : "text-text-primary"}`}
                >
                    {icon}
                    {title}
                    {count != null && count > 0 ? (
                        <span className="text-sm font-semibold text-white">({count})</span>
                    ) : null}
                </span>
                {isOpen ? (
                    <ChevronUp className="h-4 w-4 shrink-0 text-text-muted" />
                ) : (
                    <ChevronDown className="h-4 w-4 shrink-0 text-text-muted" />
                )}
            </button>
            {isOpen && <div>{children}</div>}
        </section>
    );
}

/** Aggregate balances by coinType across vaults, resolve metadata */
function aggregateBalances(
    balances: VaultCoinBalance[],
    coins?: CoinMetadata[]
): {
    coinType: string;
    symbol: string;
    name: string;
    iconUrl: string | null;
    decimals: number;
    amount: bigint;
    vaults: string[];
}[] {
    const map = new Map<string, { amount: bigint; vaults: Set<string> }>();
    for (const b of balances) {
        const entry = map.get(b.coinType) ?? { amount: 0n, vaults: new Set<string>() };
        entry.amount += b.amount;
        entry.vaults.add(b.vaultName);
        map.set(b.coinType, entry);
    }

    return Array.from(map.entries())
        .map(([coinType, { amount, vaults }]) => {
            const meta = coins?.find((c) => c.coin_type === coinType);
            return {
                coinType,
                symbol: meta?.symbol ?? coinType.split("::").pop() ?? "???",
                name: meta?.name ?? coinType.split("::").pop() ?? "Unknown",
                iconUrl: meta?.icon_url ?? null,
                decimals: meta?.decimals ?? 9,
                amount,
                vaults: Array.from(vaults).sort(),
            };
        })
        .sort((a, b) => {
            const aVal = normalizeUnitsForSort(a.amount, a.decimals);
            const bVal = normalizeUnitsForSort(b.amount, b.decimals);
            return bVal > aVal ? 1 : bVal < aVal ? -1 : 0;
        });
}

function VaultHoldings({
    balances,
    coins,
    vaultNames,
    isLoading,
}: {
    balances?: VaultCoinBalance[];
    coins?: CoinMetadata[];
    vaultNames?: string[];
    isLoading: boolean;
}) {
    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
        );
    }

    if (vaultNames && vaultNames.length === 0) {
        return (
            <div className="rounded-xl border border-primary/20 bg-primary/10 px-4 py-4">
                <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/15 text-primary">
                        <WalletCards className="h-4 w-4" />
                    </div>
                    <p className="text-sm font-medium text-text-primary">
                        Create your first vault to hold coins with through an intent.
                    </p>
                </div>
            </div>
        );
    }

    if (!balances || balances.length === 0) {
        return <p className="text-text-muted text-sm py-4">No coins in vaults.</p>;
    }

    const rows = aggregateBalances(balances, coins);

    return (
        <div className="overflow-x-auto rounded-xl border border-white/[0.085] bg-white/[0.035] backdrop-blur-md">
            <table className="w-full">
                <thead>
                    <tr className="border-b border-white/[0.075] bg-white/[0.04]">
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Asset
                        </th>
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Vaults
                        </th>
                        <th className="text-right py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Balance
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {rows.map((row) => {
                        const formatted = formatUnits(row.amount, row.decimals, {
                            maxFractionDigits: Math.min(row.decimals, 9),
                        });
                        return (
                            <tr
                                key={row.coinType}
                                className="border-b border-white/[0.065] last:border-b-0 transition-colors hover:bg-white/[0.035]"
                            >
                                <td className="py-3 px-4">
                                    <div className="flex items-center gap-3">
                                        <CoinAvatar
                                            coinType={row.coinType}
                                            symbol={row.symbol}
                                            iconUrl={row.iconUrl}
                                            size="lg"
                                        />
                                        <div>
                                            <p className="text-sm font-medium text-text-primary">{row.name}</p>
                                            <p className="text-xs text-text-muted">{row.symbol}</p>
                                        </div>
                                    </div>
                                </td>
                                <td className="py-3 px-4">
                                    <div className="flex gap-1.5 flex-wrap">
                                        {row.vaults.map((v) => (
                                            <span
                                                key={v}
                                                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                                            >
                                                {v}
                                            </span>
                                        ))}
                                    </div>
                                </td>
                                <td className="py-3 px-4 text-right">
                                    <span className="font-mono font-medium text-text-primary">{formatted}</span>
                                </td>
                            </tr>
                        );
                    })}
                </tbody>
            </table>
        </div>
    );
}

function LockedCapsTable({ caps }: { caps: LockedCapInfo[] }) {
    if (caps.length === 0) return null;

    return (
        <div className="overflow-x-auto rounded-xl border border-border">
            <table className="w-full table-fixed">
                <thead>
                    <tr className="border-b border-border bg-card-elevated">
                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Type
                        </th>
                        <th className="w-[34%] text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Object ID
                        </th>
                        <th className="w-32 text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                            Kind
                        </th>
                    </tr>
                </thead>
                <tbody>
                    {caps.map((cap) => (
                        <tr
                            key={`${cap.keyType}:${cap.objectId || cap.capType}`}
                            className="border-b border-border last:border-b-0 hover:bg-card-elevated/50 transition-colors"
                        >
                            <td className="min-w-0 py-3 px-4">
                                <div
                                    className="max-w-[520px] truncate font-mono text-xs text-text-primary"
                                    title={cap.capType}
                                >
                                    {shortMoveType(cap.capType)}
                                </div>
                                {cap.coinType ? (
                                    <div
                                        className="mt-1 max-w-[520px] truncate font-mono text-[10px] text-text-muted"
                                        title={cap.coinType}
                                    >
                                        {shortMoveType(cap.coinType)}
                                    </div>
                                ) : null}
                            </td>
                            <td className="min-w-0 py-3 px-4">
                                {cap.objectId ? (
                                    <CopyableAddress
                                        address={cap.objectId}
                                        className="min-w-0 w-full"
                                        textClassName="text-xs text-text-muted"
                                        copyLabel="Copy cap object ID"
                                        toastMessage="Cap object ID copied"
                                    />
                                ) : (
                                    <span className="text-xs text-text-muted">—</span>
                                )}
                            </td>
                            <td className="py-3 px-4">
                                <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                    {LOCKED_CAP_KIND_LABELS[cap.kind]}
                                </span>
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}

export function Multisig() {
    const { accountId } = useParams<{ accountId: string }>();
    const account = useCurrentAccount();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading: cleanupLoading } = useSuiTransaction();
    const { data: config, isLoading: configLoading } = useMultisigConfig(accountId);
    const { data: intents, isLoading: intentsLoading } = useMultisigIntents(accountId);
    const { data: streams, isLoading: streamsLoading } = useMultisigStreams(accountId);
    const { data: accountVestings = [], isLoading: vestingsLoading } = useMultisigVestings(accountId);
    const { data: vaultBalances, isLoading: vaultBalancesLoading } = useMultisigVaultBalances(accountId);
    const { data: vaultNames, isLoading: vaultNamesLoading } = useMultisigVaultNames(accountId);
    const { data: packageInfos, isLoading: packagesLoading } = useMultisigPackageInfo(accountId);
    const { data: lockedCaps, isLoading: lockedCapsLoading } = useMultisigLockedCaps(accountId);
    const { data: backendCoins } = useCoins();
    const vaultCoinTypes = useMemo(() => (vaultBalances ?? []).map((b) => b.coinType), [vaultBalances]);
    const coins = useMergedCoinMetadata(vaultCoinTypes, backendCoins);

    const [showProposeModal, setShowProposeModal] = useState(false);
    const [showDepositModal, setShowDepositModal] = useState(false);
    const [showMigrateModal, setShowMigrateModal] = useState(false);
    const [showAllExecuted, setShowAllExecuted] = useState(false);
    const [copiedAccountId, setCopiedAccountId] = useState(false);

    // Reset ephemeral UI state when navigating between multisig accounts
    useEffect(() => {
        setShowProposeModal(false);
        setShowDepositModal(false);
        setShowMigrateModal(false);
        setShowAllExecuted(false);
        setCopiedAccountId(false);
    }, [accountId]);

    const CLOSED_INTENTS_LIMIT = 8;
    const CLOSED_INTENTS_WARNING_THRESHOLD = 50;

    const isLoading = configLoading || intentsLoading;

    const normalizedCurrentUserAddress = normalizeSuiAddress(account?.address);
    const isSinglePlainGroup = config?.groups.length === 1 && config.groups[0]?.timeBands.length === 0;
    const currentMember = config?.members.find((m) => normalizeSuiAddress(m.address) === normalizedCurrentUserAddress);
    const currentUserPermissions = config ? memberPermissionsForAddress(config, account?.address) : 0;
    const canPropose = config && canAddressPropose(config, account?.address);
    const currentUserGroups = useMemo<string[]>(() => {
        if (!config || !normalizedCurrentUserAddress) return [];
        return config.groups
            .filter((group) =>
                group.members.some((m) => normalizeSuiAddress(m.address) === normalizedCurrentUserAddress)
            )
            .map((group, idx) => group.name || `Group ${idx + 1}`);
    }, [config, normalizedCurrentUserAddress]);
    const sortedMembers = useMemo(() => {
        if (!config) return [];
        if (!normalizedCurrentUserAddress) return config.members;

        return [...config.members].sort((a, b) => {
            const aIsCurrent = normalizeSuiAddress(a.address) === normalizedCurrentUserAddress;
            const bIsCurrent = normalizeSuiAddress(b.address) === normalizedCurrentUserAddress;
            if (aIsCurrent === bIsCurrent) return 0;
            return aIsCurrent ? -1 : 1;
        });
    }, [config, normalizedCurrentUserAddress]);

    const pendingIntents = useMemo(
        () => (intents ?? []).filter((i) => isOpenIntentStatus(i.approvals.status)),
        [intents]
    );
    const closedIntents = useMemo(
        () => (intents ?? []).filter((i) => isClosedIntentStatus(i.approvals.status)),
        [intents]
    );
    const accountPaymentStreams = useMemo(() => (streams ?? []).filter((stream) => !stream.isSpendingLimit), [streams]);
    const accountSpendingLimits = useMemo(() => (streams ?? []).filter((stream) => stream.isSpendingLimit), [streams]);
    const accountStreamsAndSpendingLimits = useMemo(
        () => [...accountPaymentStreams, ...accountSpendingLimits],
        [accountPaymentStreams, accountSpendingLimits]
    );
    const canCleanRejectedIntents = config ? canAddressCancel(config, account?.address) : false;
    const cleanupTargets = useMemo<CleanupIntentTarget[]>(() => {
        if (!account || !config) return [];

        const accountMultisigPackageId = getSDK().packages.accountMultisig;
        return (intents ?? []).flatMap((intent) => {
            const isExpired = intent.expirationMs > 0 && formatExpiration(intent.expirationMs).isExpired;
            const isExecuted = intent.approvals.status === MULTISIG_INTENT_STATUS.EXECUTED;
            const isStale = intent.approvals.configNonce !== config.configNonce;
            const isRejected = intent.approvals.status === MULTISIG_INTENT_STATUS.REJECTED;
            let action: CleanupIntentAction | null = null;

            if (isExpired) {
                action = "expired";
            } else if (isStale && !isExecuted) {
                action = "stale";
            } else if (isRejected && canCleanRejectedIntents) {
                action = "rejected";
            }

            if (!action) return [];

            return [
                {
                    intent,
                    action,
                    isConfig: isMultisigConfigIntentSummary(intent, accountMultisigPackageId),
                },
            ];
        });
    }, [account, canCleanRejectedIntents, config, intents]);
    const cleanupBatch = useMemo(() => cleanupTargets.slice(0, CLEANUP_INTENTS_LIMIT), [cleanupTargets]);
    const showIntentStorageSection = closedIntents.length > 0 || cleanupTargets.length > 0;
    const showStreamsAndSpendingLimitsSection = !streamsLoading && accountStreamsAndSpendingLimits.length > 0;
    const showVestingsSection = !vestingsLoading && accountVestings.length > 0;
    const packageInfoCount = packageInfos?.length ?? 0;
    const lockedCapCount = lockedCaps?.length ?? 0;
    const showPackagesSection = packagesLoading || packageInfoCount > 0;
    const showLockedCapsSection = lockedCapsLoading || lockedCapCount > 0;
    const openMaintenanceByDefault = cleanupTargets.length >= CLOSED_INTENTS_WARNING_THRESHOLD;

    const handleIntentAction = useCallback(() => {
        if (!accountId) return;
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.intents(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.config(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.streams(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.vestings(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.vaultNames(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.vaultBalances(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.packageInfo(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.lockedCaps(accountId) });
        queryClient.invalidateQueries({ queryKey: multisigRpcKeys.lockedCurrencies(accountId) });
    }, [accountId, queryClient]);

    const handleCleanupOldIntents = useCallback(async () => {
        if (!accountId || cleanupBatch.length === 0) return;

        try {
            const tx = new Transaction();
            for (const { intent, action, isConfig } of cleanupBatch) {
                if (action === "expired") {
                    if (isConfig) cancelExpiredConfigChange(tx, accountId, intent.key);
                    else cancelExpiredActions(tx, accountId, intent.key);
                } else if (action === "stale") {
                    if (isConfig) cancelStaleConfigChange(tx, accountId, intent.key);
                    else cancelStaleActions(tx, accountId, intent.key);
                } else if (isConfig) {
                    cancelRejectedConfigChange(tx, accountId, intent.key);
                } else {
                    cancelRejectedActions(tx, accountId, intent.key);
                }
            }

            const count = cleanupBatch.length;
            await executeTransaction(
                tx,
                { onSuccess: handleIntentAction },
                {
                    loadingMessage: `Removing ${count} old intent${count === 1 ? "" : "s"}...`,
                    successMessage: `Removed ${count} old intent${count === 1 ? "" : "s"}`,
                }
            );
        } catch (error) {
            console.error("Intent removal failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Intent removal failed");
            }
        }
    }, [accountId, cleanupBatch, executeTransaction, handleIntentAction]);

    const handleIntentCreated = useCallback(() => {
        handleIntentAction();
        if (!accountId) return;
        setTimeout(() => {
            queryClient.invalidateQueries({ queryKey: multisigRpcKeys.intents(accountId) });
        }, 3000);
    }, [accountId, queryClient, handleIntentAction]);

    const copyAccountId = useCallback(async () => {
        if (!accountId) return;

        try {
            await navigator.clipboard.writeText(accountId);
            setCopiedAccountId(true);
            toast.success("Multisig address copied", { id: "clipboard-copy" });
            window.setTimeout(() => setCopiedAccountId(false), 1600);
        } catch {
            toast.error("Could not copy address");
        }
    }, [accountId]);

    return (
        <div className="route-container min-h-full flex flex-col gap-6 pb-16">
            <Helmet>
                <title>
                    {config?.name || "Multisig"} {accountId ? formatAddress(accountId) : ""}
                </title>
            </Helmet>
            <Breadcrumbs
                items={[
                    { label: "Home", href: "/" },
                    { label: "Multisigs", href: "/multisig" },
                    { label: accountId ? formatAddress(accountId) : "..." },
                ]}
            />

            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="flex items-center gap-3">
                        <Shield className="w-7 h-7 text-primary" />
                        {config?.name || "Multisig Account"}
                    </h1>
                    {accountId && (
                        <div className="mt-1 max-w-full text-sm text-text-muted">
                            <span className="break-all font-mono">{accountId}</span>
                            <button
                                type="button"
                                onClick={copyAccountId}
                                className="ml-1 inline-flex align-[-2px] rounded p-1 text-text-muted transition-colors hover:bg-white/10 hover:text-text-primary"
                                title="Copy multisig address"
                                aria-label="Copy multisig address"
                            >
                                {copiedAccountId ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                            </button>
                        </div>
                    )}
                </div>
                {canPropose && config && (
                    <div className="flex items-center gap-2 shrink-0">
                        <button
                            onClick={() => setShowProposeModal(true)}
                            className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
                        >
                            <Plus className="w-3.5 h-3.5" />
                            Propose Intent
                        </button>
                    </div>
                )}
            </div>

            {/* Your permissions summary bar */}
            {currentMember && config && !isSinglePlainGroup && (
                <div className="glass-flow-panel glass-flow-panel-accent rounded-xl p-3 flex items-center gap-4 flex-wrap">
                    <span className="text-xs font-semibold text-text-primary">Your Permissions</span>
                    <div className="flex gap-1.5 flex-wrap">
                        {permissionLabels(currentUserPermissions).map((p) => (
                            <span
                                key={p}
                                className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary"
                            >
                                {p}
                            </span>
                        ))}
                    </div>
                    {currentUserGroups.length > 0 && (
                        <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[10px] text-text-muted">in</span>
                            {currentUserGroups.map((groupName) => (
                                <span
                                    key={groupName}
                                    className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-card-more-elevated text-text-primary"
                                >
                                    {groupName}
                                </span>
                            ))}
                        </div>
                    )}
                    <span className="text-xs text-text-muted">Approval: {approvalPolicyLabel(config)}</span>
                    {config.isExecutionPermissionless && (
                        <span className="text-xs text-text-muted">Execution: open</span>
                    )}
                </div>
            )}

            {isLoading ? (
                <div className="flex items-center justify-center py-24">
                    <Loader2 className="w-8 h-8 animate-spin text-primary" />
                </div>
            ) : !config ? (
                <div className="flex flex-col items-center justify-center py-24">
                    <div className="w-20 h-20 rounded-full border border-white/10 bg-white/5 backdrop-blur-sm flex items-center justify-center mb-6">
                        <Shield className="w-10 h-10 text-text-disabled" />
                    </div>
                    <h3 className="mb-2">No Multisig Config</h3>
                    <p className="text-text-muted text-center max-w-md">
                        This account does not have a MultisigConfig, or it could not be fetched from chain.
                    </p>
                </div>
            ) : (
                <>
                    {/* Vault Holdings */}
                    <div>
                        <div className="flex items-center justify-between mb-3">
                            <h2 className="text-lg font-semibold flex items-center gap-2">
                                <Coins className="w-5 h-5 text-primary" />
                                Vault Holdings
                                {vaultBalances && vaultBalances.length > 0 ? (
                                    <span className="text-sm font-semibold text-white">
                                        ({aggregateBalances(vaultBalances, coins).length})
                                    </span>
                                ) : null}
                            </h2>
                            {account && (
                                <div className="flex flex-wrap items-center justify-end gap-2">
                                    <button
                                        onClick={() => setShowMigrateModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-primary/15 text-primary text-xs font-medium hover:bg-primary/25 transition-colors"
                                    >
                                        <ArrowRightLeft className="w-3.5 h-3.5" />
                                        Migrate to this Govex multisig
                                    </button>
                                    <button
                                        onClick={() => setShowDepositModal(true)}
                                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-green-500/15 text-green-400 text-xs font-medium hover:bg-green-500/25 transition-colors"
                                    >
                                        <ArrowDownToLine className="w-3.5 h-3.5" />
                                        Deposit
                                    </button>
                                </div>
                            )}
                        </div>
                        <VaultHoldings
                            balances={vaultBalances}
                            coins={coins}
                            vaultNames={vaultNames}
                            isLoading={vaultBalancesLoading || vaultNamesLoading}
                        />
                    </div>

                    {/* Pending Intents */}
                    <div className="space-y-3">
                        <div className="flex items-center justify-between gap-3 border-b border-border-subtle pb-2">
                            <h2 className="flex items-center gap-2 text-lg font-semibold">
                                <Hourglass className="w-5 h-5 text-primary" />
                                Pending Intents
                                {pendingIntents.length > 0 ? (
                                    <span className="text-sm font-semibold text-white">({pendingIntents.length})</span>
                                ) : null}
                            </h2>
                        </div>
                        {intentsLoading ? (
                            <div className="flex items-center justify-center py-8">
                                <Loader2 className="w-6 h-6 animate-spin text-primary" />
                            </div>
                        ) : pendingIntents.length === 0 ? (
                            <p className="text-text-muted text-sm py-4">No pending intents.</p>
                        ) : (
                            <div className="max-h-[600px] overflow-y-auto overscroll-contain scrollbar-always pr-1">
                                <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                                    {pendingIntents.map((intent) => (
                                        <IntentCard
                                            key={intent.key}
                                            intent={intent}
                                            config={config}
                                            accountId={accountId!}
                                            configNonce={config.configNonce}
                                            currentUserAddress={account?.address}
                                            onActionComplete={handleIntentAction}
                                        />
                                    ))}
                                </div>
                            </div>
                        )}
                    </div>

                    {showStreamsAndSpendingLimitsSection && (
                        <CollapsibleSection
                            title="Spending Limits"
                            count={accountStreamsAndSpendingLimits.length}
                            icon={<WalletCards className="h-4 w-4 text-primary" />}
                        >
                            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                                {accountStreamsAndSpendingLimits.map((stream) => (
                                    <StreamCard key={stream.id} stream={stream} />
                                ))}
                            </div>
                        </CollapsibleSection>
                    )}

                    {showVestingsSection && (
                        <CollapsibleSection
                            title="Vesting Coins"
                            count={accountVestings.length}
                            icon={<Coins className="h-4 w-4 text-primary" />}
                        >
                            <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                                {accountVestings.map((vesting) => (
                                    <VestingCard key={vesting.vestingId} vesting={vesting} />
                                ))}
                            </div>
                        </CollapsibleSection>
                    )}

                    <CollapsibleSection
                        title="Members"
                        count={config.members.length}
                        icon={<Shield className="h-4 w-4 text-primary" />}
                    >
                        <div className="overflow-x-auto rounded-xl border border-border">
                            <table className="w-full table-fixed">
                                <thead>
                                    <tr className="border-b border-border bg-card-elevated">
                                        <th className="w-[58%] text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                            Address
                                        </th>
                                        <th className="w-24 text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                            Weight
                                        </th>
                                        <th className="text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                            Permissions
                                        </th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {sortedMembers.map((member) => (
                                        <MemberRow
                                            key={member.address}
                                            member={member}
                                            isCurrentUser={
                                                normalizedCurrentUserAddress === normalizeSuiAddress(member.address)
                                            }
                                        />
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </CollapsibleSection>

                    {!isSinglePlainGroup && (
                        <CollapsibleSection
                            title="Policy Details"
                            count={config.groups.length}
                            icon={<Shield className="h-4 w-4 text-primary" />}
                        >
                            <GroupsSection config={config} currentUserAddress={account?.address} />
                        </CollapsibleSection>
                    )}

                    {showPackagesSection && (
                        <CollapsibleSection
                            title="Packages"
                            count={packageInfoCount}
                            icon={<Package className="h-4 w-4 text-primary" />}
                        >
                            {packagesLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            ) : packageInfos && packageInfos.length > 0 ? (
                                <div className="overflow-x-auto rounded-xl border border-border">
                                    <table className="w-full table-fixed">
                                        <thead>
                                            <tr className="border-b border-border bg-card-elevated">
                                                <th className="w-[18%] text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                                    Name
                                                </th>
                                                <th className="w-[28%] text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                                    Object ID
                                                </th>
                                                <th className="w-[28%] text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                                    Package
                                                </th>
                                                <th className="w-28 text-left py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                                    Policy
                                                </th>
                                                <th className="w-24 text-right py-2.5 px-4 text-[10px] font-semibold text-text-muted uppercase tracking-wider">
                                                    Timelock
                                                </th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {packageInfos.map((pkg) => (
                                                <tr
                                                    key={pkg.name}
                                                    className="border-b border-border last:border-b-0 hover:bg-card-elevated/50 transition-colors"
                                                >
                                                    <td className="py-3 px-4">
                                                        <span className="text-sm font-medium text-text-primary">
                                                            {pkg.name}
                                                        </span>
                                                    </td>
                                                    <td className="min-w-0 py-3 px-4">
                                                        {pkg.capObjectId ? (
                                                            <CopyableAddress
                                                                address={pkg.capObjectId}
                                                                className="min-w-0 w-full"
                                                                textClassName="text-xs text-text-muted"
                                                                copyLabel="Copy package cap object ID"
                                                                toastMessage="Package cap object ID copied"
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-text-muted">—</span>
                                                        )}
                                                    </td>
                                                    <td className="min-w-0 py-3 px-4">
                                                        {pkg.packageAddress ? (
                                                            <CopyableAddress
                                                                address={pkg.packageAddress}
                                                                className="min-w-0 w-full"
                                                                textClassName="text-xs text-text-muted"
                                                                copyLabel="Copy package ID"
                                                                toastMessage="Package ID copied"
                                                            />
                                                        ) : (
                                                            <span className="text-xs text-text-muted">—</span>
                                                        )}
                                                    </td>
                                                    <td className="py-3 px-4">
                                                        <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-primary/10 text-primary">
                                                            {policyLabel(pkg.policy)}
                                                        </span>
                                                    </td>
                                                    <td className="py-3 px-4 text-right">
                                                        <span className="font-mono text-sm text-text-primary">
                                                            {pkg.delayMs > 0
                                                                ? `${Math.round(pkg.delayMs / 3_600_000)}h`
                                                                : "None"}
                                                        </span>
                                                    </td>
                                                </tr>
                                            ))}
                                        </tbody>
                                    </table>
                                </div>
                            ) : null}
                        </CollapsibleSection>
                    )}

                    {showLockedCapsSection && (
                        <CollapsibleSection
                            title="Locked Caps"
                            count={lockedCapCount}
                            icon={<KeyRound className="h-4 w-4 text-primary" />}
                        >
                            {lockedCapsLoading ? (
                                <div className="flex items-center justify-center py-8">
                                    <Loader2 className="w-6 h-6 animate-spin text-primary" />
                                </div>
                            ) : lockedCaps && lockedCaps.length > 0 ? (
                                <LockedCapsTable caps={lockedCaps} />
                            ) : null}
                        </CollapsibleSection>
                    )}

                    {showIntentStorageSection && (
                        <CollapsibleSection
                            title="Intent History & Cleanup"
                            count={closedIntents.length}
                            icon={<Archive className="h-4 w-4 text-primary" />}
                            defaultOpen={openMaintenanceByDefault}
                            muted
                        >
                            {(cleanupBatch.length > 0 || closedIntents.length > CLOSED_INTENTS_LIMIT) && (
                                <div className="mb-3 flex shrink-0 items-center justify-end gap-2">
                                    {cleanupBatch.length > 0 && (
                                        <button
                                            type="button"
                                            onClick={handleCleanupOldIntents}
                                            disabled={cleanupLoading}
                                            title={
                                                cleanupTargets.length > CLEANUP_INTENTS_LIMIT
                                                    ? `Removes the first ${CLEANUP_INTENTS_LIMIT} eligible old intents. Run again for the rest.`
                                                    : "Remove eligible expired, stale, and rejected intents from the onchain intent store."
                                            }
                                            className="flex items-center gap-1.5 rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-400 transition-colors hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-40"
                                        >
                                            {cleanupLoading ? (
                                                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                                            ) : (
                                                <Trash2 className="h-3.5 w-3.5" />
                                            )}
                                            {cleanupTargets.length > CLEANUP_INTENTS_LIMIT
                                                ? `Remove ${CLEANUP_INTENTS_LIMIT}/${cleanupTargets.length} old`
                                                : `Remove old (${cleanupTargets.length})`}
                                        </button>
                                    )}
                                    {closedIntents.length > CLOSED_INTENTS_LIMIT && (
                                        <button
                                            onClick={() => setShowAllExecuted(!showAllExecuted)}
                                            className="flex items-center gap-1 text-xs text-text-muted hover:text-text-primary transition-colors"
                                        >
                                            {showAllExecuted ? (
                                                <>
                                                    Show less <ChevronUp className="w-3.5 h-3.5" />
                                                </>
                                            ) : (
                                                <>
                                                    Show all <ChevronDown className="w-3.5 h-3.5" />
                                                </>
                                            )}
                                        </button>
                                    )}
                                </div>
                            )}
                            {cleanupTargets.length >= CLOSED_INTENTS_WARNING_THRESHOLD && (
                                <div className="mb-3 rounded-lg border border-yellow-500/20 bg-yellow-500/10 px-3 py-2 text-xs text-yellow-100">
                                    <p className="font-medium">Storage cleanup recommended</p>
                                    <p className="mt-1 text-yellow-100/80">
                                        This account has {cleanupTargets.length} old intents eligible for onchain
                                        removal. Large intent histories can slow RPC reads and make account pages less
                                        reliable. Remove eligible old intents to keep the account responsive.
                                    </p>
                                </div>
                            )}
                            {closedIntents.length > 0 ? (
                                <div className="max-h-[600px] overflow-y-auto overscroll-contain scrollbar-always pr-1">
                                    <div className="grid grid-cols-1 items-start gap-3 lg:grid-cols-2">
                                        {(showAllExecuted
                                            ? closedIntents
                                            : closedIntents.slice(0, CLOSED_INTENTS_LIMIT)
                                        ).map((intent) => (
                                            <IntentCard
                                                key={intent.key}
                                                intent={intent}
                                                config={config}
                                                accountId={accountId!}
                                                configNonce={config.configNonce}
                                                currentUserAddress={account?.address}
                                                onActionComplete={handleIntentAction}
                                            />
                                        ))}
                                    </div>
                                </div>
                            ) : (
                                <p className="text-text-muted text-sm py-4">
                                    Old intents are eligible for removal from onchain storage.
                                </p>
                            )}
                        </CollapsibleSection>
                    )}
                </>
            )}

            {/* Modals */}
            {config && accountId && (
                <>
                    <ProposeIntentModal
                        isOpen={showProposeModal}
                        onClose={() => setShowProposeModal(false)}
                        accountId={accountId}
                        config={config}
                        onSuccess={handleIntentCreated}
                    />
                    <DepositModal
                        isOpen={showDepositModal}
                        onClose={() => setShowDepositModal(false)}
                        accountId={accountId}
                        onSuccess={handleIntentAction}
                    />
                    <MigrateToMultisigModal
                        isOpen={showMigrateModal}
                        onClose={() => setShowMigrateModal(false)}
                        accountId={accountId}
                        canStageLockIntents={!!canPropose}
                        onSuccess={handleIntentAction}
                    />
                </>
            )}
        </div>
    );
}
