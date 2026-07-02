/* eslint-disable max-lines */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { getActionByFullType } from "@govex/futarchy-sdk";
import { formatAddress, isValidSuiObjectId, parseStructTag } from "@mysten/sui/utils";
import { Transaction } from "@mysten/sui/transactions";
import toast from "react-hot-toast";
import {
    Clock,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    ChevronDown,
    ArrowRightLeft,
    Vault,
    Coins,
    Droplets,
    Gift,
    FileText,
    Package,
    Settings,
    type LucideIcon,
} from "lucide-react";
import type { IntentSummary, MultisigConfig } from "@/lib/sui/multisig";
import {
    MULTISIG_INTENT_STATUS,
    formatExpiration,
    approvalProgressFor,
    canAddressCancel,
    canAddressExecute,
    intentStatusLabel,
    isClosedIntentStatus,
    isAccountMember,
    isMultisigConfigIntentSummary,
    nextMaturingTimeBand,
    policyLabel,
    rejectionProgressFor,
} from "@/lib/sui/multisig";
import { useMultisigPackageInfo } from "@/hooks/useMultisig";
import {
    buildActionsExecution,
    getActionExecInfo,
    getActionExecutionRequirements,
    getUnsupportedActions,
    extractTypeArgs,
    normalizeTypeAddresses,
    type UpgradeExecutionInput,
} from "@/lib/sui/multisig-tx";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { useMultisigOwnedObjects } from "@/hooks/useMultisig";
import { cacheUpgradeBuildOutput, getCachedUpgradeBuildOutput, parseUpgradeBuildOutput } from "@/lib/upgradeBuildCache";
import { getSDK } from "@/lib/sdk";
import { decodeActionParams } from "@/lib/actionParams";
import { Input } from "@/components/inputs/Input";
import { Select } from "@/components/inputs/Select";
import { Textarea } from "@/components/inputs/Textarea";
import { CoinTypePicker } from "./CoinTypePicker";
import { UpgradeBuildCommand } from "./UpgradeBuildCommand";

interface Props {
    intent: IntentSummary;
    config: MultisigConfig;
    accountId: string;
    configNonce?: number;
    currentUserAddress?: string;
    onActionComplete?: () => void;
    previewMode?: boolean;
}

type PolicyProgress = ReturnType<typeof approvalProgressFor>;

const statusConfig: Record<number, { icon: typeof Clock; color: string }> = {
    [MULTISIG_INTENT_STATUS.ACTIVE]: { icon: Clock, color: "text-yellow-400" },
    [MULTISIG_INTENT_STATUS.APPROVED]: { icon: CheckCircle2, color: "text-green-400" },
    [MULTISIG_INTENT_STATUS.REJECTED]: { icon: XCircle, color: "text-red-400" },
    [MULTISIG_INTENT_STATUS.EXECUTED]: { icon: CheckCircle2, color: "text-blue-400" },
};

const CATEGORY_ICONS: Record<string, LucideIcon> = {
    transfer: ArrowRightLeft,
    vault: Vault,
    currency: Coins,
    stream: Droplets,
    vesting: Gift,
    memo: FileText,
    package: Package,
    package_registry: Package,
    package_upgrade: Package,
    config: Settings,
    dissolution: XCircle,
    launchpad: Gift,
    liquidity: Droplets,
    oracle: Clock,
    quota: Settings,
    custom: FileText,
    unknown: FileText,
};

const CATEGORY_COLORS: Record<string, string> = {
    transfer: "bg-green-500/15 text-green-400",
    vault: "bg-blue-500/15 text-blue-400",
    currency: "bg-yellow-500/15 text-yellow-400",
    stream: "bg-cyan-500/15 text-cyan-400",
    vesting: "bg-primary/15 text-primary",
    memo: "bg-gray-500/15 text-gray-400",
    package: "bg-teal-500/15 text-teal-400",
    package_registry: "bg-teal-500/15 text-teal-400",
    package_upgrade: "bg-teal-500/15 text-teal-400",
    config: "bg-orange-500/15 text-orange-400",
    dissolution: "bg-red-500/15 text-red-400",
    launchpad: "bg-primary/15 text-primary",
    liquidity: "bg-cyan-500/15 text-cyan-400",
    oracle: "bg-violet-500/15 text-violet-300",
    quota: "bg-amber-500/15 text-amber-300",
    custom: "bg-card-more-elevated border border-border-subtle text-text-secondary",
    unknown: "bg-card-more-elevated border border-border-subtle text-text-muted",
};

function VoterAddressChips({
    label,
    addresses,
    tone,
}: {
    label: string;
    addresses: string[];
    tone: "approve" | "reject";
}) {
    if (addresses.length === 0) return null;
    const chipClass = tone === "approve" ? "bg-green-500/10 text-green-400" : "bg-red-500/10 text-red-400";

    return (
        <div className="space-y-1">
            <p className="text-[10px] font-medium uppercase tracking-wider text-text-muted">{label}</p>
            <div className="flex flex-wrap gap-1">
                {addresses.map((addr) => (
                    <span key={addr} className={`rounded px-1.5 py-0.5 font-mono text-[10px] ${chipClass}`}>
                        {formatAddress(addr)}
                    </span>
                ))}
            </div>
        </div>
    );
}

function extractModuleType(fullType: string): string {
    try {
        const tag = parseStructTag(fullType);
        return `${tag.module}::${tag.name}`;
    } catch {
        const base = fullType.split("<")[0];
        const parts = base.split("::");
        return parts.length >= 3 ? `${parts[parts.length - 2]}::${parts[parts.length - 1]}` : base;
    }
}

function getPrebuiltActionDefinition(fullType: string) {
    return getActionByFullType(normalizeTypeAddresses(fullType));
}

function isKnownPrebuiltActionType(fullType: string): boolean {
    return Boolean(getActionExecInfo(fullType) || getPrebuiltActionDefinition(fullType));
}

function formatCategoryLabel(category: string): string {
    return category.replace(/_/g, " ");
}

const UPGRADE_CAP_OBJECT_TYPE = "0x2::package::UpgradeCap";

function compactAddress(address: string): string {
    const noPrefix = address.trim().toLowerCase().replace(/^0x/, "");
    return noPrefix.replace(/^0+/, "") || "0";
}

function isUpgradeCapTypeArg(typeArg: string | undefined): boolean {
    const normalized = typeArg?.trim() ? normalizeTypeAddresses(typeArg.trim()) : "";
    if (!normalized) return false;
    try {
        const tag = parseStructTag(normalized);
        return (
            compactAddress(tag.address) === compactAddress("0x2") &&
            tag.module === "package" &&
            tag.name === "UpgradeCap" &&
            tag.typeParams.length === 0
        );
    } catch {
        return normalized === UPGRADE_CAP_OBJECT_TYPE;
    }
}

function isUpgradeCapProvideAction(fullType: string): boolean {
    return (
        extractModuleType(fullType) === "owned::ProvideObjectToResources" &&
        isUpgradeCapTypeArg(extractTypeArgs(fullType)[0])
    );
}

function findPairedLockUpgradeCapActionIndex(actionTypes: string[], provideActionIndex: number): number | null {
    if (!isUpgradeCapProvideAction(actionTypes[provideActionIndex])) return null;

    for (let i = provideActionIndex + 1; i < actionTypes.length; i += 1) {
        if (isUpgradeCapProvideAction(actionTypes[i])) return null;
        if (extractModuleType(actionTypes[i]) === "package_upgrade::LockUpgradeCap") return i;
    }

    return null;
}

/** Action types that are neither recognized SDK actions nor frontend-executable actions. */
function getCustomActionTypes(actionTypes: string[]): string[] {
    return actionTypes.filter((t) => !isKnownPrebuiltActionType(t));
}

interface UpgradeInputDraft {
    packageId: string;
    modules: string;
    dependencies: string;
    buildOutputRaw?: string;
}

type ExecutionObjectSource = "wallet" | "account" | "registry" | "intent";

interface ExecutionObjectCandidate {
    objectId: string;
    objectType: string;
    source: ExecutionObjectSource;
    balance?: string;
}

function parseListInput(raw: string): string[] {
    return raw
        .split(/[\n,]/g)
        .map((v) => v.trim())
        .filter((v) => v.length > 0);
}

function formatTypeParam(param: unknown): string | null {
    if (typeof param === "string") return normalizeTypeAddresses(param);
    if (!param || typeof param !== "object") return null;

    const tag = param as {
        address?: string;
        module?: string;
        name?: string;
        typeParams?: unknown[];
    };
    if (!tag.address || !tag.module || !tag.name) return null;

    let typeName = `${tag.address}::${tag.module}::${tag.name}`;
    if (Array.isArray(tag.typeParams) && tag.typeParams.length > 0) {
        const nested = tag.typeParams
            .map((value) => formatTypeParam(value))
            .filter((value): value is string => !!value);
        if (nested.length > 0) {
            typeName += `<${nested.join(", ")}>`;
        }
    }

    return normalizeTypeAddresses(typeName);
}

function getFirstTypeParam(typeStr: string): string | null {
    try {
        const tag = parseStructTag(typeStr);
        if (tag.typeParams.length === 0) return null;
        return formatTypeParam(tag.typeParams[0]);
    } catch {
        const match = typeStr.match(/<(.+)>$/);
        return match?.[1] ? normalizeTypeAddresses(match[1].trim()) : null;
    }
}

function shortObjectType(fullType: string): string {
    if (!fullType) return "unknown type";

    try {
        const tag = parseStructTag(fullType);
        const addr = formatAddress(tag.address);
        let short = `${addr}::${tag.module}::${tag.name}`;
        if (tag.typeParams.length > 0) {
            const params = tag.typeParams
                .map((param) => formatTypeParam(param))
                .filter((param): param is string => !!param)
                .map((param) => {
                    const parts = param.split("::");
                    return parts.length >= 3
                        ? `${formatAddress(parts[0])}::${parts[1]}::${parts.slice(2).join("::")}`
                        : param;
                });
            if (params.length > 0) {
                short += `<${params.join(", ")}>`;
            }
        }
        return short;
    } catch {
        return fullType.length > 72 ? `${fullType.slice(0, 69)}...` : fullType;
    }
}

function makeExecutionCandidate(
    objectId: string,
    objectType: string,
    source: ExecutionObjectSource,
    balance?: string
): ExecutionObjectCandidate {
    return { objectId, objectType, source, balance };
}

function mergeExecutionCandidates(...lists: ExecutionObjectCandidate[][]): ExecutionObjectCandidate[] {
    const merged = new Map<string, ExecutionObjectCandidate>();

    for (const list of lists) {
        for (const candidate of list) {
            const existing = merged.get(candidate.objectId);
            if (!existing) {
                merged.set(candidate.objectId, candidate);
                continue;
            }

            merged.set(candidate.objectId, {
                objectId: candidate.objectId,
                objectType: existing.objectType || candidate.objectType,
                source:
                    existing.source === "intent" && candidate.source !== "intent" ? candidate.source : existing.source,
                balance: existing.balance || candidate.balance,
            });
        }
    }

    return Array.from(merged.values());
}

function isCoinObjectType(objectType: string, coinType?: string): boolean {
    const normalizedObjectType = normalizeTypeAddresses(objectType);
    if (!normalizedObjectType.includes("::coin::Coin<")) return false;
    if (!coinType) return true;
    return getFirstTypeParam(normalizedObjectType) === normalizeTypeAddresses(coinType);
}

function isVestingObjectType(objectType: string, coinType?: string): boolean {
    const normalizedObjectType = normalizeTypeAddresses(objectType);
    if (!normalizedObjectType.includes("::vesting::Vesting<")) return false;
    if (!coinType) return true;
    return getFirstTypeParam(normalizedObjectType) === normalizeTypeAddresses(coinType);
}

function isUpgradeCapObjectType(objectType: string): boolean {
    return normalizeTypeAddresses(objectType) === UPGRADE_CAP_OBJECT_TYPE;
}

function getCoinTypeFromExecutionObject(objectType: string): string | null {
    const normalizedObjectType = normalizeTypeAddresses(objectType);
    if (
        normalizedObjectType.includes("::coin::Coin<") ||
        normalizedObjectType.includes("::coin::TreasuryCap<") ||
        normalizedObjectType.includes("::coin_registry::MetadataCap<") ||
        normalizedObjectType.includes("::currency::Currency<") ||
        normalizedObjectType.includes("::vesting::Vesting<")
    ) {
        return getFirstTypeParam(normalizedObjectType);
    }

    return null;
}

function getExecutionCandidateLabel(candidate: ExecutionObjectCandidate): string {
    const sourceLabel: Record<ExecutionObjectSource, string> = {
        wallet: "wallet",
        account: "account",
        registry: "registry",
        intent: "intent",
    };

    const parts = [formatAddress(candidate.objectId)];
    if (candidate.objectType) parts.push(shortObjectType(candidate.objectType));
    if (candidate.balance) parts.push(`balance ${candidate.balance}`);
    parts.push(sourceLabel[candidate.source]);
    return parts.join(" — ");
}

function decodedParamValue(params: Array<{ name: string; value: string }>, name: string): string | null {
    return params.find((param) => param.name === name)?.value ?? null;
}

function parseDecodedU64(value: string | null): number | null {
    if (!value || value === "none") return null;
    const numeric = Number(value);
    return Number.isFinite(numeric) && numeric >= 0 ? numeric : null;
}

interface StreamTimingWarning {
    actionIndex: number;
    kind: "spending limit";
    pastIterations: number;
    totalIterations: number;
}

function getStreamTimingWarning(
    actionType: string,
    actionData: string | undefined,
    actionIndex: number,
    nowMs = Date.now()
): StreamTimingWarning | null {
    if (extractModuleType(actionType) !== "vault::CreateStream" || !actionData) return null;

    const decoded = decodeActionParams({ fullType: actionType, actionData });
    if (!decoded || decoded.params.length === 0) return null;

    const startTimeMs = parseDecodedU64(decodedParamValue(decoded.params, "startTime"));
    const totalIterations = parseDecodedU64(decodedParamValue(decoded.params, "iterationsTotal"));
    const iterationPeriodMs = parseDecodedU64(decodedParamValue(decoded.params, "iterationPeriodMs"));
    if (startTimeMs == null || !totalIterations || !iterationPeriodMs || nowMs < startTimeMs) return null;

    const completedIterations = Math.floor((nowMs - startTimeMs) / iterationPeriodMs);
    const pastIterations = Math.min(completedIterations, totalIterations);
    if (pastIterations <= 2) return null;

    return {
        actionIndex,
        kind: "spending limit",
        pastIterations,
        totalIterations,
    };
}

function VoteProgressMeter({
    label,
    progress,
    tone,
}: {
    label: string;
    progress: PolicyProgress;
    tone: "approve" | "reject";
}) {
    const percent = Math.max(0, Math.min(100, progress.percent));
    const fillClass = tone === "approve" ? "bg-green-500" : "bg-red-500/80";
    const textClass = progress.satisfied ? (tone === "approve" ? "text-green-400" : "text-red-300") : "text-text-muted";

    return (
        <div className="space-y-1">
            <div className="flex items-center justify-between gap-3 text-[10px]">
                <span className="font-medium text-text-muted">{label}</span>
                <span className={textClass}>{progress.label}</span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-card-more-elevated">
                <div className={`h-full rounded-full ${fillClass}`} style={{ width: `${percent}%` }} />
            </div>
        </div>
    );
}

type MultisigService = NonNullable<ReturnType<typeof getSDK>["multisig"]>;
type MultisigTx = Parameters<MultisigService["approveIntent"]>[0];

export function IntentCard({
    intent,
    config,
    accountId,
    configNonce,
    currentUserAddress,
    onActionComplete,
    previewMode = false,
}: Props) {
    const { approvals } = intent;
    const cfg = statusConfig[approvals.status] || statusConfig[MULTISIG_INTENT_STATUS.ACTIVE];
    const StatusIcon = cfg.icon;
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);
    const discoveryRequestKeyRef = useRef("");

    const [actionsExpanded, setActionsExpanded] = useState(false);
    const [executeCoinType, setExecuteCoinType] = useState("");
    const [executeObjectTypes, setExecuteObjectTypes] = useState<Record<number, string>>({});
    const [executeObjectIds, setExecuteObjectIds] = useState<Record<number, string>>({});
    const [executeUpgradeInputs, setExecuteUpgradeInputs] = useState<Record<number, UpgradeInputDraft>>({});
    const [discoveredObjectCandidates, setDiscoveredObjectCandidates] = useState<
        Record<number, ExecutionObjectCandidate[]>
    >({});

    const { data: accountOwnedObjects = [] } = useMultisigOwnedObjects(accountId);
    const { data: walletOwnedObjects = [] } = useMultisigOwnedObjects(previewMode ? undefined : currentUserAddress);

    // Fetch package info for any package-related intent
    const hasPackageAction = intent.actionTypes.some((t) => {
        const mod = extractModuleType(t);
        return mod.startsWith("package_upgrade::");
    });
    const hasUpgradeAction = intent.actionTypes.some((t) => extractModuleType(t) === "package_upgrade::PackageUpgrade");
    const { data: packageInfoList = [] } = useMultisigPackageInfo(hasPackageAction ? accountId : undefined);

    // Frontend and linked SDK can resolve distinct Transaction class instances.
    // Cast through unknown to keep TS compatibility across package boundaries.
    const asMultisigTx = useCallback((tx: Transaction): MultisigTx => tx as unknown as MultisigTx, []);

    const nowMs = Date.now();
    const elapsedMs = Math.max(0, nowMs - intent.createdAtMs);
    const normalizedCurrentUser = currentUserAddress?.toLowerCase();
    const hasAlreadyApproved = normalizedCurrentUser
        ? approvals.approved.some((address) => address.toLowerCase() === normalizedCurrentUser)
        : false;
    const hasAlreadyRejected = normalizedCurrentUser
        ? approvals.rejected.some((address) => address.toLowerCase() === normalizedCurrentUser)
        : false;
    const projectedApprovedAddresses = useMemo(() => {
        if (!currentUserAddress || hasAlreadyApproved) return approvals.approved;
        return [...approvals.approved, currentUserAddress];
    }, [approvals.approved, currentUserAddress, hasAlreadyApproved]);
    const approvalProgress = approvalProgressFor(config, approvals.approved, elapsedMs);
    const projectedApprovalProgress = approvalProgressFor(config, projectedApprovedAddresses, elapsedMs);
    const rejectionProgress = rejectionProgressFor(config, approvals.rejected);

    const expInfo = formatExpiration(intent.expirationMs);
    const isExpired = expInfo.isExpired;
    const isActive = approvals.status === MULTISIG_INTENT_STATUS.ACTIVE;
    const isApproved = approvals.status === MULTISIG_INTENT_STATUS.APPROVED;
    const isExecuted = approvals.status === MULTISIG_INTENT_STATUS.EXECUTED;
    const isDone = isClosedIntentStatus(approvals.status);
    const isStale = configNonce !== undefined && approvals.configNonce !== configNonce;

    const canVote = currentUserAddress && isAccountMember(config, currentUserAddress);
    const canExecute = currentUserAddress && canAddressExecute(config, currentUserAddress);
    const canCancel = currentUserAddress && canAddressCancel(config, currentUserAddress);

    const showApprove = canVote && isActive && !hasAlreadyApproved && !isExpired && !isStale;
    const showUndoApproval = canVote && isActive && hasAlreadyApproved && !isStale;
    const showReject = canVote && (isActive || isApproved) && !hasAlreadyRejected && !isExpired && !isStale;
    const showEvaluate = !!(
        canExecute &&
        isActive &&
        (approvalProgress.satisfied || rejectionProgress.satisfied) &&
        !isExpired &&
        !isStale
    );
    const showExecute = canExecute && isApproved && !isExpired && !isStale;
    const finalApprovalByExecutor = !!(
        showApprove &&
        canExecute &&
        !approvalProgress.satisfied &&
        projectedApprovalProgress.satisfied
    );
    const prepareExecutionInputs = showExecute || finalApprovalByExecutor;
    const showCancelPending = !!(
        canCancel &&
        (isActive || isApproved) &&
        rejectionProgress.satisfied &&
        !isExpired &&
        !isStale
    );
    const showVoteProgress = approvalProgress.threshold > 0 || rejectionProgress.threshold > 0;
    const voteProgressPanelClass = rejectionProgress.satisfied
        ? "border-red-500/35 bg-red-500/[0.08] shadow-[0_0_18px_rgba(239,68,68,0.08)]"
        : approvalProgress.satisfied
          ? "border-green-500/35 bg-green-500/[0.08] shadow-[0_0_18px_rgba(34,197,94,0.08)]"
          : "border-border-subtle bg-card-more-elevated/35";

    const isConfig = isMultisigConfigIntentSummary(intent, getSDK().packages.accountMultisig);
    const executionRequirements = !isConfig ? getActionExecutionRequirements(intent.actionTypes) : [];
    const needsCoinType = executionRequirements.some((r) => r.kind === "coinType");
    const objectTypeRequirements = executionRequirements.filter((r) => r.kind === "objectType");
    const objectIdRequirements = executionRequirements.filter((r) => r.kind === "objectId");
    const upgradeRequirements = executionRequirements.filter((r) => r.kind === "upgradeArtifacts");
    const hasInputRequirements = executionRequirements.length > 0;
    const unsupportedReasons = !isConfig ? getUnsupportedActions(intent.actionTypes) : [];
    const hasUnsupported = unsupportedReasons.length > 0;
    const customActionTypes = !isConfig ? getCustomActionTypes(intent.actionTypes) : [];
    const hasCustomActionTypes = customActionTypes.length > 0;
    const unsupportedPrebuiltActionTypes = !isConfig
        ? intent.actionTypes.filter(
              (actionType) => getPrebuiltActionDefinition(actionType) && !getActionExecInfo(actionType)
          )
        : [];
    const hasUnsupportedPrebuiltActions = unsupportedPrebuiltActionTypes.length > 0;
    const hasUnparsedActions = !isConfig && intent.actionTypes.length === 0 && intent.actionCount > 0;
    const hasGenericExecutionGap = hasCustomActionTypes || hasUnparsedActions;

    const missingObjectTypeRequirements = objectTypeRequirements.filter((req) => {
        return !executeObjectTypes[req.actionIndex]?.trim();
    });
    const missingObjectIdRequirements = objectIdRequirements.filter((req) => {
        return !executeObjectIds[req.actionIndex]?.trim();
    });
    const missingObjectTypeSet = new Set(missingObjectTypeRequirements.map((r) => r.actionIndex));
    const missingObjectIdSet = new Set(missingObjectIdRequirements.map((r) => r.actionIndex));

    const { missingUpgradeRequirements, upgradeByAction } = useMemo(() => {
        const nextUpgradeByAction: Record<number, UpgradeExecutionInput> = {};
        const nextMissingUpgradeRequirements = upgradeRequirements.filter((req) => {
            const draft = executeUpgradeInputs[req.actionIndex];
            const packageId = draft?.packageId?.trim() || "";
            const modules = parseListInput(draft?.modules || "");
            const dependencies = parseListInput(draft?.dependencies || "");
            if (!packageId || modules.length === 0 || dependencies.length === 0) return true;

            nextUpgradeByAction[req.actionIndex] = {
                packageId,
                modules,
                dependencies,
            };
            return false;
        });

        return {
            missingUpgradeRequirements: nextMissingUpgradeRequirements,
            upgradeByAction: nextUpgradeByAction,
        };
    }, [executeUpgradeInputs, upgradeRequirements]);
    const missingCoinType = needsCoinType && !executeCoinType.trim();
    const missingUpgradeSet = new Set(missingUpgradeRequirements.map((r) => r.actionIndex));
    const hasMissingInputs =
        missingCoinType ||
        missingObjectTypeRequirements.length > 0 ||
        missingObjectIdRequirements.length > 0 ||
        missingUpgradeRequirements.length > 0;

    const requiredInputByAction = new Set<number>(executionRequirements.map((r) => r.actionIndex));
    const objectIdRequirementKey = objectIdRequirements.map((req) => `${req.actionIndex}:${req.actionType}`).join("|");
    const executeCoinTypeTrimmed = executeCoinType.trim();

    // Resolve action details for display from SDK metadata first, then execution metadata.
    const actionDetails = intent.actionTypes.map((fullType, actionIndex) => {
        const definition = getPrebuiltActionDefinition(fullType);
        const info = getActionExecInfo(fullType);
        const actionData = intent.actionDataByAction?.[actionIndex];
        const decoded = actionData ? decodeActionParams({ fullType, actionData }) : null;

        return {
            fullType,
            name: definition?.name || info?.name || "Custom action",
            category: definition?.category || info?.category || "custom",
            description: definition?.description,
            decodedParams: decoded?.params || [],
            decodeError: decoded?.error,
            requiresInput: requiredInputByAction.has(actionIndex),
        };
    });

    const objectTypeRequirementSet = useMemo(
        () => new Set(objectTypeRequirements.map((req) => req.actionIndex)),
        [objectTypeRequirements]
    );

    const intentFixedObjectIdsByAction = useMemo(() => {
        const fixedIds: Record<number, string> = { ...(intent.fixedObjectIdByAction || {}) };

        for (const req of objectIdRequirements) {
            const fullType = intent.actionTypes[req.actionIndex];
            const modType = extractModuleType(fullType);

            if (modType === "package_upgrade::LockUpgradeCap") {
                const expectedCapId = intent.expectedCapIdByAction?.[req.actionIndex];
                if (expectedCapId) fixedIds[req.actionIndex] = expectedCapId;
                continue;
            }

            if (modType === "owned::ProvideObjectToResources") {
                const pairedLockIndex = findPairedLockUpgradeCapActionIndex(intent.actionTypes, req.actionIndex);
                const expectedCapId =
                    pairedLockIndex !== null ? intent.expectedCapIdByAction?.[pairedLockIndex] : undefined;
                if (expectedCapId) fixedIds[req.actionIndex] = expectedCapId;
            }
        }

        return fixedIds;
    }, [intent.actionTypes, intent.expectedCapIdByAction, intent.fixedObjectIdByAction, objectIdRequirements]);

    const objectIdCandidatesByAction = useMemo(() => {
        const next: Record<number, ExecutionObjectCandidate[]> = {};

        for (const req of objectIdRequirements) {
            const actionIndex = req.actionIndex;
            const fullType = intent.actionTypes[actionIndex];
            const modType = extractModuleType(fullType);
            const actionTypeArg = extractTypeArgs(fullType)[0]?.trim();
            const fixedObjectId = intentFixedObjectIdsByAction[actionIndex];
            const resolvedObjectType = actionTypeArg
                ? normalizeTypeAddresses(actionTypeArg)
                : executeObjectTypes[actionIndex]?.trim()
                  ? normalizeTypeAddresses(executeObjectTypes[actionIndex])
                  : undefined;
            const resolvedCoinType = actionTypeArg
                ? normalizeTypeAddresses(actionTypeArg)
                : executeCoinTypeTrimmed
                  ? normalizeTypeAddresses(executeCoinTypeTrimmed)
                  : undefined;

            const fixedAccountObject = fixedObjectId
                ? accountOwnedObjects.find((obj) => obj.objectId === fixedObjectId)
                : undefined;
            const fixedWalletObject = fixedObjectId
                ? walletOwnedObjects.find((obj) => obj.objectId === fixedObjectId)
                : undefined;

            const fixedIntentCandidates = fixedObjectId
                ? [
                      makeExecutionCandidate(
                          fixedObjectId,
                          fixedWalletObject?.objectType ||
                              fixedAccountObject?.objectType ||
                              (modType === "package_upgrade::LockUpgradeCap" ||
                              modType === "owned::ProvideObjectToResources"
                                  ? UPGRADE_CAP_OBJECT_TYPE
                                  : ""),
                          "intent"
                      ),
                  ]
                : [];

            let localCandidates: ExecutionObjectCandidate[] = [];
            if (modType === "owned::OwnedWithdrawObject") {
                localCandidates = accountOwnedObjects
                    .filter((obj) => {
                        if (fixedObjectId) return obj.objectId === fixedObjectId;
                        if (!resolvedObjectType) return true;
                        return normalizeTypeAddresses(obj.objectType) === resolvedObjectType;
                    })
                    .map((obj) => makeExecutionCandidate(obj.objectId, obj.objectType, "account"));
            } else if (modType === "owned::ProvideObjectToResources") {
                localCandidates = walletOwnedObjects
                    .filter((obj) => {
                        if (fixedObjectId) return obj.objectId === fixedObjectId;
                        if (!resolvedObjectType) return true;
                        return normalizeTypeAddresses(obj.objectType) === resolvedObjectType;
                    })
                    .map((obj) => makeExecutionCandidate(obj.objectId, obj.objectType, "wallet"));
            } else if (modType === "package_upgrade::LockUpgradeCap") {
                localCandidates = walletOwnedObjects
                    .filter((obj) => {
                        if (fixedObjectId) return obj.objectId === fixedObjectId;
                        return isUpgradeCapObjectType(obj.objectType);
                    })
                    .map((obj) => makeExecutionCandidate(obj.objectId, obj.objectType, "wallet"));
            } else if (modType === "vault::VaultDepositExternal") {
                localCandidates = walletOwnedObjects
                    .filter((obj) => isCoinObjectType(obj.objectType, resolvedCoinType))
                    .map((obj) => makeExecutionCandidate(obj.objectId, obj.objectType, "wallet"));
            } else if (modType === "vesting::CancelVesting") {
                localCandidates = walletOwnedObjects
                    .filter((obj) => {
                        if (fixedObjectId) return obj.objectId === fixedObjectId;
                        return isVestingObjectType(obj.objectType, resolvedCoinType);
                    })
                    .map((obj) => makeExecutionCandidate(obj.objectId, obj.objectType, "wallet"));
            }

            const discovered = discoveredObjectCandidates[actionIndex] || [];
            const prefersDiscovered =
                modType === "currency::CurrencyUpdate" || modType === "vault::VaultDepositExternal";
            next[actionIndex] =
                prefersDiscovered && discovered.length > 0
                    ? mergeExecutionCandidates(fixedIntentCandidates, discovered)
                    : mergeExecutionCandidates(fixedIntentCandidates, localCandidates, discovered);
        }

        return next;
    }, [
        accountOwnedObjects,
        discoveredObjectCandidates,
        executeCoinTypeTrimmed,
        executeObjectTypes,
        intent.actionTypes,
        intentFixedObjectIdsByAction,
        objectIdRequirements,
        walletOwnedObjects,
    ]);

    const selectedObjectCandidateByAction = useMemo(() => {
        const next: Record<number, ExecutionObjectCandidate> = {};

        for (const req of objectIdRequirements) {
            const selectedId =
                executeObjectIds[req.actionIndex]?.trim() || intentFixedObjectIdsByAction[req.actionIndex];
            if (!selectedId) continue;

            const candidate = objectIdCandidatesByAction[req.actionIndex]?.find(
                (entry) => entry.objectId === selectedId
            );
            if (candidate) {
                next[req.actionIndex] = candidate;
            }
        }

        return next;
    }, [executeObjectIds, intentFixedObjectIdsByAction, objectIdCandidatesByAction, objectIdRequirements]);

    const objectIdOptionsByAction = useMemo(() => {
        const next: Record<number, Array<{ value: string; label: string }>> = {};

        for (const req of objectIdRequirements) {
            const actionIndex = req.actionIndex;
            const options = (objectIdCandidatesByAction[actionIndex] || []).map((candidate) => ({
                value: candidate.objectId,
                label: getExecutionCandidateLabel(candidate),
            }));
            const currentValue = executeObjectIds[actionIndex]?.trim();

            if (currentValue && !options.some((option) => option.value === currentValue)) {
                options.unshift({
                    value: currentValue,
                    label: `${formatAddress(currentValue)} — selected`,
                });
            }

            next[actionIndex] = options;
        }

        return next;
    }, [executeObjectIds, objectIdCandidatesByAction, objectIdRequirements]);

    const handleExecutionObjectIdChange = useCallback(
        (actionIndex: number, value: string) => {
            setExecuteObjectIds((prev) => (prev[actionIndex] === value ? prev : { ...prev, [actionIndex]: value }));

            const candidate = objectIdCandidatesByAction[actionIndex]?.find((entry) => entry.objectId === value);
            if (!candidate?.objectType) return;

            if (objectTypeRequirementSet.has(actionIndex)) {
                setExecuteObjectTypes((prev) =>
                    prev[actionIndex] === candidate.objectType ? prev : { ...prev, [actionIndex]: candidate.objectType }
                );
            }

            const derivedCoinType = getCoinTypeFromExecutionObject(candidate.objectType);
            if (derivedCoinType) {
                setExecuteCoinType((prev) => (prev === derivedCoinType ? prev : derivedCoinType));
            }
        },
        [objectIdCandidatesByAction, objectTypeRequirementSet]
    );

    useEffect(() => {
        if (
            !prepareExecutionInputs ||
            isConfig ||
            hasGenericExecutionGap ||
            hasUnsupportedPrebuiltActions ||
            hasUnsupported ||
            !currentUserAddress ||
            objectIdRequirements.length === 0
        ) {
            discoveryRequestKeyRef.current = "";
            setDiscoveredObjectCandidates((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }

        const sdk = getSDK();
        if (!sdk.multisig?.discoverExecutionInputs) {
            discoveryRequestKeyRef.current = "";
            setDiscoveredObjectCandidates((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            return;
        }

        const requestKey = JSON.stringify({
            owner: currentUserAddress,
            actionTypes: intent.actionTypes,
            coinType: executeCoinTypeTrimmed || undefined,
            objectIdRequirementKey,
            expectedAmountByAction: intent.expectedAmountByAction || undefined,
        });
        if (discoveryRequestKeyRef.current === requestKey) return;
        discoveryRequestKeyRef.current = requestKey;

        let cancelled = false;
        (async () => {
            try {
                const discovered = await sdk.multisig!.discoverExecutionInputs({
                    owner: currentUserAddress,
                    actionTypes: intent.actionTypes,
                    coinType: executeCoinTypeTrimmed || undefined,
                    expectedAmountByAction: intent.expectedAmountByAction,
                });
                if (cancelled) return;

                const next: Record<number, ExecutionObjectCandidate[]> = {};
                for (const [idxStr, candidates] of Object.entries(discovered.candidatesByAction)) {
                    const idx = Number(idxStr);
                    const modType = extractModuleType(intent.actionTypes[idx] || "");
                    const source: ExecutionObjectSource =
                        modType === "currency::CurrencyUpdate" ? "registry" : "wallet";
                    next[idx] = candidates.map((candidate) =>
                        makeExecutionCandidate(candidate.objectId, candidate.type, source, candidate.balance)
                    );
                }
                setDiscoveredObjectCandidates(next);
            } catch (error) {
                if (cancelled) return;
                console.error("Auto-discovery of execution object candidates failed:", error);
                setDiscoveredObjectCandidates((prev) => (Object.keys(prev).length === 0 ? prev : {}));
            }
        })();

        return () => {
            cancelled = true;
        };
    }, [
        currentUserAddress,
        executeCoinTypeTrimmed,
        hasGenericExecutionGap,
        hasUnsupported,
        hasUnsupportedPrebuiltActions,
        intent.actionTypes,
        intent.expectedAmountByAction,
        isConfig,
        objectIdRequirementKey,
        objectIdRequirements.length,
        prepareExecutionInputs,
    ]);

    useEffect(() => {
        if (!prepareExecutionInputs || isConfig || objectIdRequirements.length === 0) return;

        setExecuteObjectIds((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const req of objectIdRequirements) {
                if (prev[req.actionIndex]?.trim()) continue;

                const fixedId = intentFixedObjectIdsByAction[req.actionIndex];
                if (fixedId) {
                    next[req.actionIndex] = fixedId;
                    changed = true;
                    continue;
                }

                const candidates = objectIdCandidatesByAction[req.actionIndex] || [];
                if (candidates.length === 1) {
                    next[req.actionIndex] = candidates[0].objectId;
                    changed = true;
                }
            }

            return changed ? next : prev;
        });
    }, [
        intentFixedObjectIdsByAction,
        isConfig,
        objectIdCandidatesByAction,
        objectIdRequirements,
        prepareExecutionInputs,
    ]);

    // Auto-fill upgrade package ID from the account's locked package info + intent's package name
    useEffect(() => {
        if (!prepareExecutionInputs || isConfig || upgradeRequirements.length === 0 || packageInfoList.length === 0) {
            return;
        }
        if (!intent.upgradePackageNameByAction) return;

        setExecuteUpgradeInputs((prev) => {
            let changed = false;
            const next = { ...prev };
            for (const req of upgradeRequirements) {
                const pkgName = intent.upgradePackageNameByAction![req.actionIndex];
                if (!pkgName) continue;
                if (prev[req.actionIndex]?.packageId?.trim()) continue;
                const info = packageInfoList.find((p) => p.name === pkgName);
                if (!info) continue;
                next[req.actionIndex] = {
                    ...prev[req.actionIndex],
                    packageId: info.packageAddress,
                    modules: prev[req.actionIndex]?.modules || "",
                    dependencies: prev[req.actionIndex]?.dependencies || "",
                };
                changed = true;
            }
            return changed ? next : prev;
        });
    }, [intent.upgradePackageNameByAction, isConfig, packageInfoList, prepareExecutionInputs, upgradeRequirements]);

    useEffect(() => {
        if (!prepareExecutionInputs || isConfig || upgradeRequirements.length === 0) return;
        if (!intent.upgradeDigestByAction) return;

        setExecuteUpgradeInputs((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const req of upgradeRequirements) {
                const digest = intent.upgradeDigestByAction?.[req.actionIndex];
                if (!digest) continue;

                const draft = prev[req.actionIndex];
                if (draft?.modules?.trim() && draft?.dependencies?.trim()) continue;

                const cachedRaw = getCachedUpgradeBuildOutput(digest);
                if (!cachedRaw) continue;

                const parsed = parseUpgradeBuildOutput(cachedRaw);
                if (!parsed) continue;

                next[req.actionIndex] = {
                    ...prev[req.actionIndex],
                    packageId: prev[req.actionIndex]?.packageId || "",
                    modules: parsed.modules.join("\n"),
                    dependencies: parsed.dependencies.join("\n"),
                    buildOutputRaw: cachedRaw,
                };
                changed = true;
            }

            return changed ? next : prev;
        });
    }, [intent.upgradeDigestByAction, isConfig, prepareExecutionInputs, upgradeRequirements]);

    useEffect(() => {
        if (!prepareExecutionInputs || isConfig) return;

        setExecuteObjectTypes((prev) => {
            let changed = false;
            const next = { ...prev };

            for (const req of objectTypeRequirements) {
                if (prev[req.actionIndex]?.trim()) continue;

                const candidate = selectedObjectCandidateByAction[req.actionIndex];
                if (!candidate?.objectType) continue;

                next[req.actionIndex] = candidate.objectType;
                changed = true;
            }

            return changed ? next : prev;
        });

        if (!needsCoinType || executeCoinTypeTrimmed) return;

        const derivedCoinTypes = new Set<string>();
        for (const candidate of Object.values(selectedObjectCandidateByAction)) {
            const coinType = getCoinTypeFromExecutionObject(candidate.objectType);
            if (coinType) derivedCoinTypes.add(coinType);
        }

        if (derivedCoinTypes.size === 1) {
            setExecuteCoinType(Array.from(derivedCoinTypes)[0]);
        }
    }, [
        executeCoinTypeTrimmed,
        isConfig,
        needsCoinType,
        objectTypeRequirements,
        selectedObjectCandidateByAction,
        prepareExecutionInputs,
    ]);

    const upgradeDelayInfo = useMemo(() => {
        if (!hasUpgradeAction || packageInfoList.length === 0 || intent.createdAtMs <= 0) return null;

        const relevantDelays = intent.actionTypes.flatMap((actionType, actionIndex) => {
            if (extractModuleType(actionType) !== "package_upgrade::PackageUpgrade") return [];
            const packageName = intent.upgradePackageNameByAction?.[actionIndex];
            if (!packageName) return [];
            const packageInfo = packageInfoList.find((pkg) => pkg.name === packageName);
            return packageInfo ? [packageInfo.delayMs] : [];
        });

        if (relevantDelays.length === 0) return null;

        const maxDelay = Math.max(...relevantDelays);
        if (maxDelay <= 0) return null;

        const executableAt = intent.createdAtMs + maxDelay;
        return { maxDelayMs: maxDelay, executableAt, isDelayElapsed: nowMs >= executableAt };
    }, [
        hasUpgradeAction,
        intent.actionTypes,
        intent.createdAtMs,
        intent.upgradePackageNameByAction,
        nowMs,
        packageInfoList,
    ]);
    const upgradeDelayBlocked = !!(upgradeDelayInfo && !upgradeDelayInfo.isDelayElapsed);
    const nextExecutionTimeMs = intent.executionTimesMs?.[0] ?? 0;
    const executionTimeBlocked = nextExecutionTimeMs > 0 && nowMs < nextExecutionTimeMs;
    const autoExecutionUnavailable =
        !isConfig && (hasUnsupported || hasGenericExecutionGap || hasUnsupportedPrebuiltActions);
    const canPrepareApproveAndExecute =
        finalApprovalByExecutor && !autoExecutionUnavailable && !upgradeDelayBlocked && !executionTimeBlocked;
    const approveExecuteBlocked = !!(canPrepareApproveAndExecute && !isConfig && hasMissingInputs);
    const shouldApproveAndExecute = canPrepareApproveAndExecute && !approveExecuteBlocked;
    const showExecutionInputControls = !!(
        (showExecute || canPrepareApproveAndExecute) &&
        !isConfig &&
        !hasUnsupported &&
        !hasGenericExecutionGap &&
        !hasUnsupportedPrebuiltActions &&
        hasInputRequirements
    );
    const executeBlocked = !!(
        showExecute &&
        (executionTimeBlocked ||
            (!isConfig &&
                (hasMissingInputs ||
                    hasUnsupported ||
                    hasGenericExecutionGap ||
                    hasUnsupportedPrebuiltActions ||
                    upgradeDelayBlocked)))
    );

    const runAction = useCallback(
        async (buildTx: (tx: Transaction) => void, label: string) => {
            if (submittingRef.current) return;
            submittingRef.current = true;
            try {
                const tx = new Transaction();
                buildTx(tx);
                await executeTransaction(
                    tx,
                    { onSuccess: () => onActionComplete?.() },
                    {
                        loadingMessage: `${label}...`,
                        successMessage: label,
                    }
                );
            } catch (error) {
                console.error(`${label} failed:`, error);
                if (!isNotifiedTransactionError(error)) {
                    toast.error(error instanceof Error ? error.message : `${label} failed`);
                }
            } finally {
                submittingRef.current = false;
            }
        },
        [executeTransaction, onActionComplete]
    );

    const appendExecution = useCallback(
        (tx: Transaction) => {
            if (isConfig) {
                const sdk = getSDK();
                if (!sdk.multisig) throw new Error("accountMultisig package not configured");
                sdk.multisig.executeConfigChange(asMultisigTx(tx), accountId, intent.key);
                return;
            }

            buildActionsExecution(tx, accountId, intent.key, intent.actionTypes, {
                coinType: needsCoinType ? executeCoinType : undefined,
                objectTypeByAction: executeObjectTypes,
                objectIdByAction: executeObjectIds,
                upgradeByAction,
            });
        },
        [
            accountId,
            asMultisigTx,
            executeCoinType,
            executeObjectIds,
            executeObjectTypes,
            intent.actionTypes,
            intent.key,
            isConfig,
            needsCoinType,
            upgradeByAction,
        ]
    );

    const handleApprove = useCallback(() => {
        const sdk = getSDK();
        if (!sdk.multisig) return;
        if (shouldApproveAndExecute) {
            runAction(
                (tx) => {
                    sdk.multisig!.approveIntent(asMultisigTx(tx), accountId, intent.key);
                    appendExecution(tx);
                },
                isConfig ? "Config change approved and executed" : "Intent approved and executed"
            );
            return;
        }
        runAction((tx) => sdk.multisig!.approveIntent(asMultisigTx(tx), accountId, intent.key), "Intent approved");
    }, [accountId, appendExecution, asMultisigTx, intent.key, isConfig, runAction, shouldApproveAndExecute]);

    const handleDisapprove = useCallback(() => {
        const sdk = getSDK();
        if (!sdk.multisig) return;
        runAction((tx) => sdk.multisig!.disapproveIntent(asMultisigTx(tx), accountId, intent.key), "Approval removed");
    }, [accountId, asMultisigTx, intent.key, runAction]);

    const handleReject = useCallback(() => {
        const sdk = getSDK();
        if (!sdk.multisig) return;
        runAction((tx) => sdk.multisig!.rejectIntent(asMultisigTx(tx), accountId, intent.key), "Intent rejected");
    }, [accountId, asMultisigTx, intent.key, runAction]);

    const handleEvaluate = useCallback(() => {
        const sdk = getSDK();
        if (!sdk.multisig) return;
        // evaluate_intent can transition ACTIVE -> APPROVED (approve path satisfied
        // via time-band maturity) or ACTIVE -> REJECTED (reject path satisfied
        // first). Neutral toast because the winning path decides the outcome.
        runAction((tx) => sdk.multisig!.evaluateIntent(asMultisigTx(tx), accountId, intent.key), "Intent re-evaluated");
    }, [accountId, asMultisigTx, intent.key, runAction]);

    const handleExecute = useCallback(() => {
        runAction(appendExecution, isConfig ? "Config change executed" : "Intent executed");
    }, [appendExecution, isConfig, runAction]);

    const handleCancelPending = useCallback(() => {
        const sdk = getSDK();
        if (!sdk.multisig) return;
        runAction(
            (tx) =>
                isConfig
                    ? sdk.multisig!.cancelPendingConfigChange(asMultisigTx(tx), accountId, intent.key)
                    : sdk.multisig!.cancelPendingActions(asMultisigTx(tx), accountId, intent.key),
            "Intent cancelled"
        );
    }, [accountId, asMultisigTx, intent.key, isConfig, runAction]);

    const handlePreviewAction = useCallback((action: string) => {
        toast.success(`${action} preview only`);
    }, []);

    // Earliest-future time-band maturation across any group used in the approve
    // policy. Lets active intents preview when delayed-quorum approval becomes
    // reachable without new votes.
    const nextTimeBandInfo = useMemo(() => {
        if (!isActive || intent.createdAtMs <= 0) return null;
        const referencedGroups = new Set<number>();
        for (const path of config.approvePolicy.paths) {
            for (const req of path.requirements) referencedGroups.add(req.groupIndex);
        }
        const band = nextMaturingTimeBand(config, Array.from(referencedGroups), elapsedMs, approvals.approved);
        if (!band) return null;
        const maturesAtMs = Date.now() + band.etaMs;
        return { ...band, maturesAtMs };
    }, [approvals.approved, config, elapsedMs, intent.createdAtMs, isActive]);

    const streamTimingWarnings = useMemo(() => {
        if (isDone) return [];
        return intent.actionTypes
            .map((actionType, actionIndex) =>
                getStreamTimingWarning(actionType, intent.actionDataByAction?.[actionIndex], actionIndex)
            )
            .filter((warning): warning is StreamTimingWarning => warning !== null);
    }, [intent.actionDataByAction, intent.actionTypes, isDone]);

    const hasActions =
        showApprove || showUndoApproval || showReject || showEvaluate || showExecute || showCancelPending;

    const genericExecutionGapMessage =
        "Voting and cancellation are supported in this UI. Execution for unknown custom intents is not currently supported in the public frontend.";
    const prebuiltExecutionGapMessage =
        "This prebuilt action is recognized, but execution for this action type is not currently wired into the public frontend.";
    const approveButtonLabel = !previewMode && shouldApproveAndExecute ? "Approve & Execute" : "Approve";
    const approveButtonTitle = previewMode
        ? "Example preview only."
        : shouldApproveAndExecute
          ? "Cast the final approval and execute this intent in one transaction."
          : approveExecuteBlocked
            ? "Cast an approval vote. Fill required execution inputs first to approve and execute in one transaction."
          : hasAlreadyRejected
            ? "Approving will clear your prior reject vote."
            : "Cast an approval vote.";

    const primaryActionName = isConfig
        ? "Config Change"
        : actionDetails.length > 0
          ? actionDetails.map((a) => a.name).join(", ")
          : `${intent.actionCount} action${intent.actionCount !== 1 ? "s" : ""}`;
    const primaryActionDescription =
        intent.description || (actionDetails.length === 1 ? actionDetails[0]?.description : undefined);
    const primaryCategory = isConfig ? "config" : actionDetails[0]?.category || "unknown";
    const PrimaryCategoryIcon = CATEGORY_ICONS[primaryCategory] || CATEGORY_ICONS.unknown;

    return (
        <div
            className={`bg-card-elevated border border-border-subtle rounded-xl p-4 flex flex-col gap-3 ${isDone ? "opacity-75" : ""}`}
        >
            {/* Header */}
            <div className="flex items-start justify-between gap-3">
                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                        {PrimaryCategoryIcon && (
                            <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded ${CATEGORY_COLORS[primaryCategory] || "text-text-muted"}`}
                            >
                                <PrimaryCategoryIcon className="w-3.5 h-3.5" />
                            </span>
                        )}
                        <h4 className="text-sm font-semibold text-text-primary truncate">{primaryActionName}</h4>
                    </div>
                    {primaryActionDescription && (
                        <p className="text-xs text-text-muted mt-0.5 line-clamp-2">{primaryActionDescription}</p>
                    )}
                </div>
                <div className={`flex items-center gap-1.5 shrink-0 ${cfg.color}`}>
                    <StatusIcon className="w-4 h-4" />
                    <span className="text-xs font-medium">{intentStatusLabel(approvals.status)}</span>
                </div>
            </div>

            {/* Meta row */}
            {intent.createdAtMs > 0 && (
                <div className="text-[10px] text-text-muted">{new Date(intent.createdAtMs).toLocaleDateString()}</div>
            )}

            {/* Approval audit trail: which approve_policy path matched, and when. */}
            {(isApproved || isExecuted) && approvals.matchedVotePath !== null && (
                <div className="text-[10px] flex items-center gap-1 text-green-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>
                        Approved via path {approvals.matchedVotePath + 1}
                        {approvals.approvedAtMs > 0 ? ` - ${new Date(approvals.approvedAtMs).toLocaleString()}` : ""}
                    </span>
                </div>
            )}

            {/* Expandable action details */}
            {intent.actionTypes.length > 0 && (
                <div>
                    <button
                        type="button"
                        onClick={() => setActionsExpanded(!actionsExpanded)}
                        className="flex items-center gap-1.5 text-[10px] text-text-muted hover:text-text-secondary transition-colors"
                    >
                        <ChevronDown
                            className={`w-3 h-3 transition-transform ${actionsExpanded ? "rotate-180" : ""}`}
                        />
                        <span>
                            {intent.actionTypes.length} action{intent.actionTypes.length !== 1 ? "s" : ""}
                        </span>
                    </button>

                    {actionsExpanded && (
                        <div className="mt-2 space-y-1.5">
                            {actionDetails.map((action, i) => {
                                const CategoryIcon = CATEGORY_ICONS[action.category];
                                return (
                                    <div
                                        key={`${action.fullType}-${i}`}
                                        className="rounded-lg border border-border-subtle bg-card-more-elevated/40 p-2"
                                    >
                                        <div className="flex items-center gap-2">
                                            <span
                                                className={`text-[10px] px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1 ${CATEGORY_COLORS[action.category] || "bg-card-more-elevated border border-border-subtle text-text-muted"}`}
                                            >
                                                {CategoryIcon && <CategoryIcon className="w-3 h-3" />}
                                                {formatCategoryLabel(action.category)}
                                            </span>
                                            <span className="text-xs text-text-secondary">{action.name}</span>
                                        </div>
                                        {action.description && (
                                            <p className="mt-1 text-[10px] leading-4 text-text-muted">
                                                {action.description}
                                            </p>
                                        )}
                                        {action.decodedParams.length > 0 && (
                                            <div className="mt-2 grid gap-1">
                                                {action.decodedParams.map((param) => (
                                                    <div
                                                        key={`${action.fullType}-${i}-${param.name}`}
                                                        className="grid grid-cols-[minmax(0,0.85fr)_minmax(0,1.4fr)] gap-2 text-[10px]"
                                                    >
                                                        <span className="truncate text-text-muted">{param.name}</span>
                                                        <span className="break-all font-mono text-text-secondary">
                                                            {param.value}
                                                        </span>
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                        {action.decodeError && (
                                            <p className="mt-1 text-[10px] text-yellow-400">
                                                Action data could not be decoded: {action.decodeError}
                                            </p>
                                        )}
                                        <div className="mt-1 break-all font-mono text-[10px] text-text-muted">
                                            {action.fullType}
                                        </div>
                                        {action.requiresInput && (
                                            <div className="mt-1 text-[9px] px-1 py-0.5 rounded bg-yellow-500/10 text-yellow-400 w-fit">
                                                input required
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}

            {/* Fallback for intents without parsed action types */}
            {intent.actionTypes.length === 0 && intent.actionCount > 0 && (
                <div className="text-[10px] text-text-muted">
                    {intent.actionCount} action{intent.actionCount !== 1 ? "s" : ""}
                </div>
            )}

            {/* Expiration display */}
            {intent.expirationMs > 0 && (
                <div
                    className={`text-[10px] flex items-center gap-1 ${
                        expInfo.isExpired ? "text-red-400" : expInfo.isSoon ? "text-yellow-400" : "text-text-muted"
                    }`}
                >
                    <Clock className="w-3 h-3" />
                    <span>{expInfo.label}</span>
                </div>
            )}

            {showVoteProgress && (
                <div className={`space-y-2 rounded-lg border p-2.5 transition-colors ${voteProgressPanelClass}`}>
                    <VoteProgressMeter label="Approve votes" progress={approvalProgress} tone="approve" />
                    <VoteProgressMeter label="Reject votes" progress={rejectionProgress} tone="reject" />
                </div>
            )}

            {streamTimingWarnings.map((warning) => (
                <div
                    key={`stream-timing-${warning.actionIndex}`}
                    className="text-[10px] flex items-center gap-1 text-yellow-400"
                >
                    <AlertTriangle className="w-3 h-3" />
                    <span>
                        Action {warning.actionIndex + 1}: {warning.pastIterations} out of {warning.totalIterations}{" "}
                        {warning.kind} iterations are in the past.
                    </span>
                </div>
            ))}

            {/* Time-band maturation preview */}
            {nextTimeBandInfo && (
                <div className="text-[10px] flex items-center gap-1 text-yellow-400/80">
                    <Clock className="w-3 h-3" />
                    <span>
                        {nextTimeBandInfo.groupName || `Group ${nextTimeBandInfo.groupIndex + 1}`} weight rises +
                        {nextTimeBandInfo.weight} at {new Date(nextTimeBandInfo.maturesAtMs).toLocaleString()}
                    </span>
                </div>
            )}

            {/* Upgrade delay display */}
            {upgradeDelayInfo && (
                <div
                    className={`text-[10px] flex items-center gap-1 ${
                        upgradeDelayInfo.isDelayElapsed ? "text-green-400" : "text-yellow-400"
                    }`}
                >
                    <Clock className="w-3 h-3" />
                    <span>
                        {upgradeDelayInfo.isDelayElapsed
                            ? `Upgrade delay elapsed (${Math.round(upgradeDelayInfo.maxDelayMs / 86_400_000)}d)`
                            : `Executable after ${new Date(upgradeDelayInfo.executableAt).toLocaleString()} (${Math.round(upgradeDelayInfo.maxDelayMs / 86_400_000)}d delay)`}
                    </span>
                </div>
            )}

            {/* Package info for package-related intents */}
            {hasPackageAction && packageInfoList.length > 0 && actionsExpanded && (
                <div className="text-[10px] text-text-muted space-y-0.5 pl-1 border-l-2 border-border-subtle ml-1">
                    {packageInfoList.map((pkg) => (
                        <div key={pkg.name} className="flex items-center gap-2">
                            <span className="font-medium">{pkg.name}</span>
                            <span className="font-mono">{pkg.packageAddress.slice(0, 10)}...</span>
                            <span className="text-text-muted">
                                {policyLabel(pkg.policy)} |{" "}
                                {pkg.delayMs > 0 ? `${Math.round(pkg.delayMs / 86_400_000)}d delay` : "no delay"}
                            </span>
                        </div>
                    ))}
                </div>
            )}

            {/* Stale warning */}
            {isStale && !isExpired && (isActive || isApproved) && (
                <div className="text-[10px] flex items-center gap-1 text-orange-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>Stale — config has changed since this intent was created</span>
                </div>
            )}

            {/* Custom intent warning */}
            {hasGenericExecutionGap && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2 text-[10px] text-yellow-200">
                    <div className="flex items-center gap-1 font-semibold text-yellow-300">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Custom intent</span>
                    </div>
                    <div className="mt-1">{genericExecutionGapMessage}</div>
                    {hasCustomActionTypes && (
                        <div className="mt-1 break-all font-mono text-[9px] text-yellow-100/70">
                            {customActionTypes.length} custom action type{customActionTypes.length > 1 ? "s" : ""}:{" "}
                            {customActionTypes.join(", ")}
                        </div>
                    )}
                    {hasUnparsedActions && (
                        <div className="mt-1 text-yellow-100/70">
                            This intent has {intent.actionCount} onchain action
                            {intent.actionCount !== 1 ? "s" : ""}, but parsed action metadata was not returned to this
                            UI.
                        </div>
                    )}
                </div>
            )}

            {hasUnsupportedPrebuiltActions && !hasGenericExecutionGap && (
                <div className="rounded-lg border border-yellow-500/20 bg-yellow-500/10 p-2 text-[10px] text-yellow-200">
                    <div className="flex items-center gap-1 font-semibold text-yellow-300">
                        <AlertTriangle className="w-3 h-3" />
                        <span>Prebuilt action execution unavailable</span>
                    </div>
                    <div className="mt-1">{prebuiltExecutionGapMessage}</div>
                    <div className="mt-1 break-all font-mono text-[9px] text-yellow-100/70">
                        {unsupportedPrebuiltActionTypes
                            .map((actionType) => getPrebuiltActionDefinition(actionType)?.name || actionType)
                            .join(", ")}
                    </div>
                </div>
            )}

            {/* Unsupported action warning */}
            {hasUnsupported && !hasGenericExecutionGap && !hasUnsupportedPrebuiltActions && (
                <div className="space-y-1">
                    {unsupportedReasons.map((reason, i) => (
                        <div key={i} className="text-[10px] flex items-center gap-1 text-yellow-400">
                            <AlertTriangle className="w-3 h-3 shrink-0" />
                            <span>{reason}</span>
                        </div>
                    ))}
                </div>
            )}

            {/* Upgrade delay blocks execution */}
            {(showExecute || finalApprovalByExecutor) && upgradeDelayBlocked && (
                <div className="text-[10px] flex items-center gap-1 text-yellow-400">
                    <Clock className="w-3 h-3" />
                    <span>
                        Upgrade delay has not elapsed — execution blocked until{" "}
                        {new Date(upgradeDelayInfo!.executableAt).toLocaleString()}
                    </span>
                </div>
            )}

            {(showExecute || finalApprovalByExecutor) && executionTimeBlocked && (
                <div className="text-[10px] flex items-center gap-1 text-yellow-400">
                    <Clock className="w-3 h-3" />
                    <span>Execution available after {new Date(nextExecutionTimeMs).toLocaleString()}</span>
                </div>
            )}

            {/* Missing required execution inputs */}
            {showExecutionInputControls && hasMissingInputs && (
                <div className="text-[10px] flex items-center gap-1 text-yellow-400">
                    <AlertTriangle className="w-3 h-3" />
                    <span>
                        Fill required execution inputs to enable{" "}
                        {canPrepareApproveAndExecute ? "Approve & Execute" : "Execute"}
                    </span>
                </div>
            )}

            {(approvals.approved.length > 0 || approvals.rejected.length > 0) && (
                <div className="space-y-2">
                    <VoterAddressChips label="Approve votes" addresses={approvals.approved} tone="approve" />
                    <VoterAddressChips label="Reject votes" addresses={approvals.rejected} tone="reject" />
                </div>
            )}

            {/* Required execution inputs */}
            {showExecutionInputControls && (
                <div className="border-t border-border-subtle pt-3 space-y-3">
                    <p className="text-[10px] text-text-muted">Provide required execution inputs:</p>

                    {needsCoinType && (
                        <CoinTypePicker
                            value={executeCoinType}
                            onChange={(coinType) => setExecuteCoinType(coinType)}
                            label="Coin Type"
                        />
                    )}

                    {objectTypeRequirements.map((req) =>
                        (objectIdCandidatesByAction[req.actionIndex] || []).some(
                            (candidate) => candidate.objectType
                        ) ? null : (
                            <Input
                                key={`object-type-${req.actionIndex}`}
                                label={`${req.label} (Action ${req.actionIndex + 1}: ${req.actionName})`}
                                value={executeObjectTypes[req.actionIndex] || ""}
                                onChange={(value) => {
                                    setExecuteObjectTypes((prev) => ({ ...prev, [req.actionIndex]: value }));
                                }}
                                placeholder={req.placeholder}
                                error={missingObjectTypeSet.has(req.actionIndex)}
                                size="sm"
                            />
                        )
                    )}

                    {objectIdRequirements.map((req) => {
                        const actionIndex = req.actionIndex;
                        const val = executeObjectIds[actionIndex] || "";
                        const fixedIntentId = intentFixedObjectIdsByAction[actionIndex];
                        const options = objectIdOptionsByAction[actionIndex] || [];

                        if (fixedIntentId) return null;

                        if (options.length > 0) {
                            return (
                                <Select
                                    key={`object-id-${actionIndex}`}
                                    label={`${req.label} (Action ${actionIndex + 1}: ${req.actionName})`}
                                    options={options}
                                    value={val}
                                    onChange={(value) => handleExecutionObjectIdChange(actionIndex, value)}
                                    placeholder={req.placeholder || "Select an object..."}
                                    allowSearch
                                    allowClear={false}
                                />
                            );
                        }

                        return (
                            <div key={`object-id-${actionIndex}`} className="space-y-1">
                                <Input
                                    label={`${req.label} (Action ${actionIndex + 1}: ${req.actionName})`}
                                    value={val}
                                    onChange={(value) => {
                                        setExecuteObjectIds((prev) => ({ ...prev, [actionIndex]: value }));
                                    }}
                                    placeholder={req.placeholder}
                                    error={
                                        missingObjectIdSet.has(actionIndex) ||
                                        (val.length > 0 && !isValidSuiObjectId(val))
                                    }
                                    size="sm"
                                />
                                <p className="text-[11px] text-text-muted">
                                    No matching derived objects found for this action. Paste the object ID manually.
                                </p>
                            </div>
                        );
                    })}

                    {upgradeRequirements.map((req) => {
                        const draft = executeUpgradeInputs[req.actionIndex] || {
                            packageId: "",
                            modules: "",
                            dependencies: "",
                        };
                        const isMissing = missingUpgradeSet.has(req.actionIndex);
                        const parsedModules = parseListInput(draft.modules);
                        const parsedDeps = parseListInput(draft.dependencies);
                        const isFilled = draft.packageId.trim() && parsedModules.length > 0 && parsedDeps.length > 0;

                        return (
                            <div
                                key={`upgrade-${req.actionIndex}`}
                                className="space-y-2 p-2.5 rounded-lg border border-border-subtle bg-card-more-elevated/40"
                            >
                                <p className="text-[10px] text-text-muted">
                                    Action {req.actionIndex + 1}: {req.actionName}
                                </p>
                                <Textarea
                                    label="Build output"
                                    value={isFilled ? "" : (draft.buildOutputRaw ?? "")}
                                    onChange={(raw) => {
                                        const trimmed = raw.trim();
                                        if (!trimmed) return;
                                        const parsed = parseUpgradeBuildOutput(trimmed);
                                        if (!parsed) return;

                                        cacheUpgradeBuildOutput(trimmed);
                                        setExecuteUpgradeInputs((prev) => ({
                                            ...prev,
                                            [req.actionIndex]: {
                                                packageId: prev[req.actionIndex]?.packageId || "",
                                                modules: parsed.modules.join("\n"),
                                                dependencies: parsed.dependencies.join("\n"),
                                                buildOutputRaw: raw,
                                            },
                                        }));
                                    }}
                                    placeholder="Paste output of: sui move build --dump-bytecode-as-base64"
                                    rows={isFilled ? 1 : 3}
                                    error={false}
                                />
                                {isFilled ? (
                                    <div className="text-[10px] text-text-muted space-y-1 p-2 rounded bg-card-more-elevated/60 border border-border-subtle">
                                        <div className="flex items-center gap-2">
                                            <span className="text-green-400">Parsed</span>
                                            <span>
                                                {parsedModules.length} module{parsedModules.length !== 1 ? "s" : ""}
                                            </span>
                                            <span>
                                                {parsedDeps.length} dep{parsedDeps.length !== 1 ? "s" : ""}
                                            </span>
                                        </div>
                                        {draft.packageId.trim() && (
                                            <div className="font-mono text-[9px] truncate">
                                                pkg: {draft.packageId.trim()}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    <div className="text-[10px] text-text-muted p-2 rounded bg-card-more-elevated/60 border border-border-subtle space-y-1">
                                        <p className="font-medium text-text-secondary">
                                            Step 3 of 3: Provide build output to execute
                                        </p>
                                        <p>
                                            If this browser has the proposal-time build cached it will auto-fill.
                                            Otherwise re-run:
                                        </p>
                                        <UpgradeBuildCommand codeClassName="bg-card-more-elevated/80" />
                                        <p>The onchain digest will verify the bytecode matches what was approved.</p>
                                    </div>
                                )}
                                {draft.packageId.trim() ? (
                                    <div className="text-[10px] text-text-muted font-mono truncate">
                                        Package: {draft.packageId.trim()}
                                    </div>
                                ) : (
                                    <Input
                                        label="Upgrade Package ID"
                                        value={draft.packageId}
                                        onChange={(value) => {
                                            setExecuteUpgradeInputs((prev) => ({
                                                ...prev,
                                                [req.actionIndex]: {
                                                    ...prev[req.actionIndex],
                                                    packageId: value,
                                                    modules: prev[req.actionIndex]?.modules || "",
                                                    dependencies: prev[req.actionIndex]?.dependencies || "",
                                                },
                                            }));
                                        }}
                                        placeholder="0x... (auto-filled if package is locked in account)"
                                        error={isMissing && !draft.packageId.trim()}
                                        size="sm"
                                    />
                                )}
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Action buttons */}
            {hasActions && (
                <div className="flex items-center gap-2 pt-3 border-t border-border-subtle">
                    {showApprove && (
                        <button
                            onClick={previewMode ? () => handlePreviewAction(approveButtonLabel) : handleApprove}
                            disabled={!previewMode && (isLoading || submittingRef.current)}
                            title={approveButtonTitle}
                            className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            {approveButtonLabel}
                        </button>
                    )}
                    {showUndoApproval && (
                        <button
                            onClick={previewMode ? () => handlePreviewAction("Undo approval") : handleDisapprove}
                            disabled={!previewMode && (isLoading || submittingRef.current)}
                            title={
                                previewMode
                                    ? "Example preview only."
                                    : "Remove your approval. Only available while the intent is still Active; once approved, you can only Reject to flip status."
                            }
                            className="px-3 py-1.5 rounded-lg bg-yellow-500/20 text-yellow-400 text-xs font-medium hover:bg-yellow-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Undo Approval
                        </button>
                    )}
                    {showReject && (
                        <button
                            onClick={previewMode ? () => handlePreviewAction("Reject") : handleReject}
                            disabled={!previewMode && (isLoading || submittingRef.current)}
                            title={
                                previewMode
                                    ? "Example preview only."
                                    : hasAlreadyApproved
                                      ? "Rejecting will clear your prior approval vote."
                                      : isApproved
                                        ? "Reject the already-approved intent. If the cancel quorum is met, cancellation unlocks."
                                        : "Cast a reject vote. Reaches the cancel quorum and the intent can be cancelled."
                            }
                            className="px-3 py-1.5 rounded-lg bg-red-500/20 text-red-400 text-xs font-medium hover:bg-red-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Reject
                        </button>
                    )}
                    {showCancelPending && (
                        <button
                            onClick={previewMode ? () => handlePreviewAction("Cancel") : handleCancelPending}
                            disabled={!previewMode && (isLoading || submittingRef.current)}
                            title={
                                previewMode
                                    ? "Example preview only."
                                    : "Cancel quorum has been reached. This cancels the live intent and removes it from onchain storage."
                            }
                            className="px-3 py-1.5 rounded-lg bg-red-500/10 text-red-400 text-xs font-medium hover:bg-red-500/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Cancel
                        </button>
                    )}
                    {showEvaluate && (
                        <button
                            onClick={previewMode ? () => handlePreviewAction("Re-evaluate") : handleEvaluate}
                            disabled={!previewMode && (isLoading || submittingRef.current)}
                            title={
                                previewMode
                                    ? "Example preview only."
                                    : "Re-check the policy against current time and vote state. Approve path satisfied via time bands? Marks Approved. Reject quorum already met? Marks Rejected."
                            }
                            className="px-3 py-1.5 rounded-lg bg-green-500/20 text-green-400 text-xs font-medium hover:bg-green-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Re-evaluate
                        </button>
                    )}
                    {showExecute && (
                        <button
                            onClick={previewMode ? () => handlePreviewAction("Execute") : handleExecute}
                            disabled={(!previewMode && (isLoading || submittingRef.current)) || executeBlocked}
                            title={
                                previewMode
                                    ? "Example preview only."
                                    : hasGenericExecutionGap
                                      ? genericExecutionGapMessage
                                      : hasUnsupportedPrebuiltActions
                                        ? prebuiltExecutionGapMessage
                                        : undefined
                            }
                            className="px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-400 text-xs font-medium hover:bg-blue-500/30 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
                        >
                            Execute
                        </button>
                    )}
                </div>
            )}
        </div>
    );
}
