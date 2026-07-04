import type { ActionData, ActionType, ProposalAction, StagedAction } from "@/types/Proposal";

export interface IndexedActionContext {
    assetType?: string;
    stableType?: string;
    assetSymbol?: string | null;
    stableSymbol?: string | null;
    assetDecimals?: number;
    stableDecimals?: number;
}

function extractActionName(fullType: string | undefined): string {
    if (!fullType) return "";
    const withoutTypeArgs = fullType.split("<")[0] || fullType;
    const parts = withoutTypeArgs.split("::");
    return parts[parts.length - 1] || withoutTypeArgs;
}

function normalizeMoveType(type: string | undefined): string | undefined {
    if (!type) return undefined;
    return type.replace(/^([0-9a-fA-F]+::)/, "0x$1");
}

function sameMoveType(left: string | undefined, right: string | undefined): boolean {
    return Boolean(left && right && normalizeMoveType(left) === normalizeMoveType(right));
}

function extractFirstTypeArg(fullType: string | undefined): string | undefined {
    if (!fullType) return undefined;
    const start = fullType.indexOf("<");
    if (start < 0) return undefined;

    let depth = 0;
    let value = "";
    for (let i = start + 1; i < fullType.length; i += 1) {
        const char = fullType[i];
        if (char === "<") {
            depth += 1;
            value += char;
            continue;
        }
        if (char === ">") {
            if (depth === 0) break;
            depth -= 1;
            value += char;
            continue;
        }
        if (char === "," && depth === 0) break;
        value += char;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
}

function formatActionName(rawType: string): string {
    const shortType = extractActionName(rawType) || rawType;
    const spaced = shortType
        .replace(/_/g, " ")
        .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
        .replace(/\s+/g, " ")
        .trim();
    return spaced.replace(/\b(dao|lp|v2|v3|usdc|govex|id)\b/gi, (match) => match.toUpperCase());
}

function mapActionType(rawType: string): ActionType {
    const lower = rawType.toLowerCase();
    if (lower.includes("memo")) return "memo";
    if (lower.includes("transfer")) return "transfer";
    if (lower.includes("config") || lower.includes("update") || lower.includes("set_")) return "config";
    if (lower.includes("stream") || lower.includes("vesting")) return "createStream";
    return "onChain";
}

function parseIndexedActions(actions: unknown): StagedAction[] {
    if (!actions) return [];
    if (Array.isArray(actions)) return actions as StagedAction[];
    if (typeof actions !== "string") return [];
    try {
        const parsed = JSON.parse(actions);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

export function indexedActionsToProposalActions(
    actions: unknown,
    idPrefix: string,
    context: IndexedActionContext = {}
): ProposalAction[] {
    return parseIndexedActions(actions).map((action, i) => {
        const fullType = normalizeMoveType(action.fullType || action.type);
        const rawType = extractActionName(action.type) || extractActionName(action.fullType) || "UnknownAction";
        const isIndexedAction = Boolean(action.fullType || action.actionData || action.actionVersion != null);
        const type = isIndexedAction && rawType.toLowerCase() !== "memo" ? "onChain" : mapActionType(rawType);
        const coinType = normalizeMoveType(action.coinType || extractFirstTypeArg(fullType));
        const coinSymbol = sameMoveType(coinType, context.assetType)
            ? context.assetSymbol || undefined
            : sameMoveType(coinType, context.stableType)
              ? context.stableSymbol || undefined
              : undefined;
        const coinDecimals = sameMoveType(coinType, context.assetType)
            ? context.assetDecimals
            : sameMoveType(coinType, context.stableType)
              ? context.stableDecimals
              : undefined;

        const data: ActionData = {
            actionType: rawType,
            displayName: formatActionName(rawType),
            fullType,
            packageId: action.packageId,
            coinType,
            coinSymbol,
            coinDecimals,
            actionVersion: action.actionVersion,
            actionData: action.actionData,
            index: action.index,
            params: action.params,
        };

        if (action.params && Array.isArray(action.params)) {
            for (const param of action.params) {
                if (param.name === "message" || param.name === "memo") data.message = param.value;
                if (param.name === "recipient" || param.name === "beneficiary") data.recipientAddress = param.value;
                if (param.name === "amount" || param.name === "amountPerIteration") data.amount = param.value;
                if (param.name === "description") data.description = param.value;
            }
        } else if (action.data) {
            if (action.data.message) data.message = String(action.data.message);
            if (action.data.recipient) data.recipientAddress = String(action.data.recipient);
            if (action.data.amount) data.amount = String(action.data.amount);
            if (action.data.token) data.token = String(action.data.token);
            if (action.data.description) data.description = String(action.data.description);
            if (action.data.category) data.category = String(action.data.category);
        }

        if (!data.message && !data.description) {
            data.description = data.displayName || "Unknown action";
        }

        return {
            id: `${idPrefix}-${action.index ?? i}`,
            type,
            data,
        };
    });
}
