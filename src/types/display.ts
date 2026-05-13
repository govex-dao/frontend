/**
 * Display types for UI components
 * These transform backend API types into shapes easier for components to consume
 */

import { proposalMetadataDescription } from "@/lib/proposalMetadata";
import type { DAO, Proposal } from "./index";
import { parseOutcomeMessages } from "./Proposal";

/**
 * DAO display info for cards and lists
 */
export interface DAODisplay {
    id: string;
    name: string;
    description: string | null;
    iconUrl: string | null;
    assetSymbol: string | null;
    stableSymbol: string | null;
    version: string | null;
    canonicalUuid: string | null;
    stableDecimals: number;
    proposalCount: number;
    verified: boolean;
    treasuryStableBalance: string | null;
    createdAt: Date;
}

/**
 * Transform a DAO to display format
 */
export function toDAODisplay(dao: DAO): DAODisplay {
    const verificationLevel = dao.config?.futarchy_verification_level;
    return {
        id: dao.id,
        name: dao.config?.dao_name || dao.dao_name || "",
        description: dao.config?.dao_description || null,
        iconUrl: dao.config?.dao_icon_url || null,
        assetSymbol: dao.asset_symbol,
        stableSymbol: dao.stable_symbol,
        version: dao.version,
        canonicalUuid: dao.canonical_uuid,
        stableDecimals: dao.stable_decimals,
        proposalCount: dao.proposal_count,
        verified: verificationLevel === 1,
        treasuryStableBalance: dao.treasury_stable_balance,
        createdAt: new Date(parseInt(dao.timestamp)),
    };
}

/**
 * Proposal outcome for display
 */
export interface OutcomeDisplay {
    index: number;
    message: string;
    twap: number | null;
    price: number | null;
}

/**
 * Proposal display status (simplified from backend state)
 */
export type ProposalDisplayStatus = "pending" | "active" | "passed" | "failed";

/**
 * Proposal display info for cards and lists
 */
export interface ProposalDisplay {
    id: string;
    daoId: string;
    daoName: string;
    daoIconUrl: string | null;
    title: string;
    description: string | null;
    status: ProposalDisplayStatus;
    outcomes: OutcomeDisplay[];
    winningOutcome: number | null;
    timestamp: Date;
}

/**
 * Map backend state to display status
 */
function mapProposalState(state: string, winningOutcome: number | null): ProposalDisplayStatus {
    switch (state) {
        case "created":
        case "initialized":
            return "pending";
        case "active":
        case "awaiting_execution":
            return "active";
        case "finalized":
        case "executed":
            // Outcome 0 is "reject", outcome > 0 is "pass/accept"
            return winningOutcome !== null && winningOutcome > 0 ? "passed" : "failed";
        default:
            return "pending";
    }
}

/**
 * Transform a Proposal to display format
 */
export function toProposalDisplay(proposal: Proposal): ProposalDisplay {
    const messages = parseOutcomeMessages(proposal);

    const outcomes: OutcomeDisplay[] = [];
    for (let i = 0; i < proposal.outcome_count; i++) {
        outcomes.push({
            index: i,
            message: messages[i] || `Outcome ${i}`,
            twap: proposal.twaps[i] ? parseFloat(proposal.twaps[i]) : null,
            price: proposal.prices[i] ? parseFloat(proposal.prices[i]) : null,
        });
    }

    return {
        id: String(proposal.id),
        daoId: proposal.dao_id,
        daoName: proposal.dao_name,
        daoIconUrl: proposal.dao_icon_url || null,
        title: proposal.title,
        description: proposalMetadataDescription(proposal.metadata),
        status: mapProposalState(proposal.state, proposal.winning_outcome),
        outcomes,
        winningOutcome: proposal.winning_outcome,
        timestamp: new Date(parseInt(proposal.timestamp)),
    };
}
