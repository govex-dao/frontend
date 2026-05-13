/**
 * Proposal types matching backend API responses
 */

export type ProposalState = "created" | "initialized" | "active" | "awaiting_execution" | "finalized" | "executed";

// Legacy action types used by proposal creation/editor UI, plus indexed on-chain actions.
export type ActionType = "memo" | "config" | "transfer" | "createStream" | "onChain";

export interface ConfigUpdate {
    category: string;
    parameter: string;
    value: string;
    unit: string;
    currentValue?: string;
}

export interface ActionData {
    message?: string;
    configUpdates?: ConfigUpdate[];
    recipientAddress?: string;
    recipient?: string;
    amount?: string;
    token?: string;
    description?: string;
    category?: string;
    startDate?: string;
    endDate?: string;
    cancelable?: boolean;
    actionType?: string;
    displayName?: string;
    fullType?: string;
    packageId?: string;
    coinType?: string;
    coinSymbol?: string;
    coinDecimals?: number;
    actionVersion?: number;
    actionData?: string;
    index?: number;
    params?: StagedActionParam[];
}

export interface ProposalAction {
    id: string;
    type: ActionType;
    data: ActionData;
}

export interface OutcomeData {
    id: string;
    name: string;
    description: string;
    actions: ProposalAction[];
}

export interface StagedActionParam {
    type: string;
    name: string;
    value: string;
}

export interface StagedAction {
    index?: number;
    type: string;
    fullType?: string;
    packageId?: string;
    coinType?: string;
    actionVersion?: number;
    actionData?: string;
    params?: StagedActionParam[];
    // Legacy flat format fallback
    data?: Record<string, unknown>;
}

export interface ProposalOutcome {
    message: string;
    description?: string;
    twap: number | null;
    price: number | null;
    volume?: number;
    likelihood?: number;
    usdcBalance?: number;
    tokenBalance?: number;
    actions?: ProposalAction[];
}

export interface Proposal {
    id: string | number;
    tx_digest: string;
    dao_id: string;
    dao_name: string;
    dao_icon_url?: string | null;
    proposer: string;
    title: string;
    metadata: string | null;
    version: string | null;
    outcome_count: number;
    outcome_messages: string | null; // JSON array string
    asset_type: string;
    stable_type: string;
    asset_decimals: number;
    stable_decimals: number;
    asset_symbol: string | null;
    stable_symbol: string | null;
    conditional_asset_types: string | null; // JSON array string
    conditional_stable_types: string | null; // JSON array string
    review_period_ms: string;
    trading_period_ms: string;
    escrow_id: string | null;
    market_state_id: string | null;
    state: ProposalState;
    winning_outcome: number | null;
    approved: boolean | null;
    protocol_fee_bps?: string | null;
    dao_conditional_amm_fee_bps?: string | null;
    dao_twap_start_delay?: string | null;
    dao_twap_threshold?: string | null;
    dao_sponsored_threshold?: string | null;
    dao_sponsorship_enabled?: boolean | null;
    dao_proposal_creation_fee?: string | null;
    dao_proposal_fee_per_outcome?: string | null;
    dao_fee_in_asset_token?: boolean | null;
    amm_fee_bps?: string | null;
    spot_pool_id: string | null;
    lp_type: string | null;
    timestamp: string;
    trading_started_at?: string | null; // Actual wall-clock time of REVIEW→TRADING transition
    trading_ended_at?: string | null; // Actual wall-clock time when trading ended
    execution_at?: string | null;
    has_twap: boolean;
    twaps: Record<number, string>;
    prices: Record<number, string>;
    staged_actions?: Record<string, StagedAction[]> | null; // Parsed JSON object from Prisma (only in single proposal response)
    // Sponsorship info
    sponsorship_types?: string | null;
    sponsor?: string | null;
    sponsored_at?: string | null;
    // Volume and trader stats (single proposal response only)
    volume?: string;
    trader_count?: number;
    outcome_volumes?: Record<number, string>;

    // Legacy UI compatibility fields
    orgId: string;
    status: "passed" | "failed" | "active" | "pending";
    description: string;
    start: Date;
    end: Date;
    traderCount: number;
    tradedByMe: boolean;
    outcomes: ProposalOutcome[];
}

/**
 * Helper to parse outcome messages from JSON string
 */
export function parseOutcomeMessages(proposal: Proposal): string[] {
    if (!proposal.outcome_messages) return [];
    try {
        return JSON.parse(proposal.outcome_messages);
    } catch {
        return [];
    }
}

/**
 * Helper to parse conditional coin types from JSON strings
 */
export function parseConditionalTypes(proposal: Proposal): {
    assetTypes: string[];
    stableTypes: string[];
} {
    const assetTypes = proposal.conditional_asset_types ? JSON.parse(proposal.conditional_asset_types) : [];
    const stableTypes = proposal.conditional_stable_types ? JSON.parse(proposal.conditional_stable_types) : [];
    return { assetTypes, stableTypes };
}

/**
 * Helper to parse staged actions.
 * Backend returns staged_actions as a parsed JSON object (Prisma Json type),
 * keyed by outcome index: { "0": [...], "1": [...] }
 */
export function parseStagedActions(proposal: Proposal): StagedAction[][] {
    if (!proposal.staged_actions) return [];
    try {
        // staged_actions is already a parsed object from Prisma (Json type),
        // keyed by outcome index string: { "0": [...], "1": [...] }
        const actions = proposal.staged_actions;
        // If it's a string (legacy), parse it
        const obj = typeof actions === "string" ? JSON.parse(actions) : actions;
        // Convert object keyed by outcome index to ordered array
        if (Array.isArray(obj)) return obj;
        const result: StagedAction[][] = [];
        for (let i = 0; i < proposal.outcome_count; i++) {
            result.push(obj[String(i)] || []);
        }
        return result;
    } catch {
        return [];
    }
}
