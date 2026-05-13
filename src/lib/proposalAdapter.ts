/**
 * Adapter to transform API Proposal to page-friendly format
 */

import type { Proposal, StagedAction, ActionType, ActionData, ProposalAction } from "@/types/Proposal";
import { parseOutcomeMessages, parseStagedActions } from "@/types/Proposal";
import { proposalMetadataDescription } from "@/lib/proposalMetadata";

/**
 * Outcome format for the proposal page
 */
export interface PageOutcome {
    message: string;
    description?: string;
    twap: number | null;
    price: number | null;
    volume: number;
    likelihood: number | null;
    usdcBalance: number;
    tokenBalance: number;
    actions: ProposalAction[];
}

/**
 * Proposal format for the proposal page
 */
export interface PageProposal {
    id: string;
    txDigest: string;
    orgId: string;
    orgName: string;
    title: string;
    description: string;
    start: Date;
    end: Date;
    status: "passed" | "failed" | "active";
    volume: number;
    traderCount: number;
    tradedByMe: boolean;
    outcomes: PageOutcome[];
    winningOutcome: number | null;
    assetSymbol: string;
    stableSymbol: string;
    assetDecimals: number;
    stableDecimals: number;
}

/**
 * Map API proposal state to page status
 */
function mapState(state: string, winningOutcome: number | null): "passed" | "failed" | "active" {
    switch (state) {
        case "created":
        case "initialized":
        case "active":
        case "awaiting_execution":
            return "active";
        case "finalized":
        case "executed":
            // Outcome 0 is typically "reject", outcome > 0 is "pass"
            return winningOutcome !== null && winningOutcome > 0 ? "passed" : "failed";
        default:
            return "active";
    }
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

/**
 * Map indexed action type strings to display buckets.
 * Unknown indexed actions stay explicit instead of pretending to be memos.
 */
function mapActionType(rawType: string): ActionType {
    const lower = rawType.toLowerCase();
    if (lower.includes("memo")) return "memo";
    if (lower.includes("transfer")) return "transfer";
    if (lower.includes("config") || lower.includes("update") || lower.includes("set_")) return "config";
    if (lower.includes("stream") || lower.includes("vesting")) return "createStream";
    return "onChain";
}

/**
 * Convert staged actions to display format.
 * Handles the indexed action format: { type, fullType, actionData, params?: [...] }
 */
function convertActions(stagedActions: StagedAction[], outcomeIndex: number, proposal: Proposal): ProposalAction[] {
    return stagedActions.map((action, i) => {
        const fullType = normalizeMoveType(action.fullType || action.type);
        const rawType = extractActionName(action.type) || extractActionName(action.fullType) || "UnknownAction";
        const isIndexedAction = Boolean(action.fullType || action.actionData || action.actionVersion != null);
        const type = isIndexedAction && rawType.toLowerCase() !== "memo" ? "onChain" : mapActionType(rawType);
        const coinType = normalizeMoveType(action.coinType || extractFirstTypeArg(fullType));
        const coinSymbol = sameMoveType(coinType, proposal.asset_type)
            ? proposal.asset_symbol || undefined
            : sameMoveType(coinType, proposal.stable_type)
              ? proposal.stable_symbol || undefined
              : undefined;
        const coinDecimals = sameMoveType(coinType, proposal.asset_type)
            ? proposal.asset_decimals
            : sameMoveType(coinType, proposal.stable_type)
              ? proposal.stable_decimals
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
        // Extract params from indexed format (top-level array of {type, name, value})
        if (action.params && Array.isArray(action.params)) {
            for (const p of action.params) {
                if (p.name === "message" || p.name === "memo") data.message = p.value;
                if (p.name === "recipient" || p.name === "beneficiary") data.recipientAddress = p.value;
                if (p.name === "amount" || p.name === "amountPerIteration") data.amount = p.value;
                if (p.name === "description") data.description = p.value;
            }
        }
        // Fallback: try flat data fields (legacy format)
        else if (action.data) {
            if (action.data.message) data.message = String(action.data.message);
            if (action.data.recipient) data.recipientAddress = String(action.data.recipient);
            if (action.data.amount) data.amount = String(action.data.amount);
            if (action.data.token) data.token = String(action.data.token);
            if (action.data.description) data.description = String(action.data.description);
            if (action.data.category) data.category = String(action.data.category);
        }
        // Use the raw type as description fallback so users can see the actual action type
        if (!data.message && !data.description) {
            data.description = data.displayName || "Unknown action";
        }

        return {
            id: `${outcomeIndex}-${i}`,
            type,
            data,
        };
    });
}

/**
 * Calculate start and end dates from proposal timestamp and periods
 */
function calculateDates(proposal: Proposal): { start: Date; end: Date } {
    const tradingPeriod = parseInt(proposal.trading_period_ms, 10);

    // Use actual trading start time if available (captures late crank delays),
    // otherwise fall back to planned schedule
    const tradingStartMs = proposal.trading_started_at
        ? parseInt(proposal.trading_started_at, 10)
        : parseInt(proposal.timestamp, 10) + parseInt(proposal.review_period_ms, 10);
    const tradingEndMs = proposal.trading_ended_at
        ? parseInt(proposal.trading_ended_at, 10)
        : tradingStartMs + tradingPeriod;

    const start = new Date(tradingStartMs);
    const end = new Date(tradingEndMs);

    return { start, end };
}

/**
 * Transform API Proposal to page format
 */
export function toPageProposal(proposal: Proposal): PageProposal {
    const { start, end } = calculateDates(proposal);
    const messages = parseOutcomeMessages(proposal);
    const stagedActionsPerOutcome = parseStagedActions(proposal);

    // Calculate total volume for percentage calculations
    const totalVolume = proposal.volume ? Number(proposal.volume) : 0;
    const stableDecimals = proposal.stable_decimals || 6;

    // Build outcomes array
    const outcomes: PageOutcome[] = [];
    for (let i = 0; i < proposal.outcome_count; i++) {
        const price = proposal.prices[i] ? parseFloat(proposal.prices[i]) : null;
        const twap = proposal.twaps[i] ? parseFloat(proposal.twaps[i]) : null;
        const outcomeVolume = proposal.outcome_volumes?.[i]
            ? Number(proposal.outcome_volumes[i]) / Math.pow(10, stableDecimals)
            : 0;

        // TWAP is a dollar-denominated price in the 0-1 range for conditional tokens.
        // It represents the implied probability directly (e.g., $0.65 = 65% likelihood).
        const likelihood = twap;

        // Actions for this outcome
        const actions = stagedActionsPerOutcome[i] ? convertActions(stagedActionsPerOutcome[i], i, proposal) : [];

        outcomes.push({
            message: messages[i] || `Outcome ${i}`,
            twap,
            price,
            volume: outcomeVolume,
            likelihood,
            // These require chain fetch - defaulting to 0
            usdcBalance: 0,
            tokenBalance: 0,
            actions,
        });
    }

    return {
        id: String(proposal.id),
        txDigest: proposal.tx_digest,
        orgId: proposal.dao_id,
        orgName: proposal.dao_name,
        title: proposal.title,
        description: proposalMetadataDescription(proposal.metadata),
        start,
        end,
        status: mapState(proposal.state, proposal.winning_outcome),
        volume: totalVolume / Math.pow(10, stableDecimals),
        traderCount: proposal.trader_count || 0,
        tradedByMe: false, // Would need wallet connection to determine
        outcomes,
        winningOutcome: proposal.winning_outcome,
        assetSymbol: proposal.asset_symbol || "TOKEN",
        stableSymbol: proposal.stable_symbol || "USDC",
        assetDecimals: proposal.asset_decimals || 9,
        stableDecimals: proposal.stable_decimals || 6,
    };
}
