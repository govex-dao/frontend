/**
 * DAO types matching backend API responses
 */

export interface DAOConfig {
    dao_name: string;
    dao_icon_url: string | null;
    dao_description: string | null;
    futarchy_operational_state: number | null;
    futarchy_verification_level?: number | null;
    protocol_fee_bps?: string | null;
    dao_conditional_amm_fee_bps?: string | null;
    dao_liquidity_ratio_percent?: string | null;
    dao_twap_threshold?: string | null;
    dao_sponsored_threshold?: string | null;
    dao_sponsorship_enabled?: boolean | null;
    dao_proposal_creation_fee?: string | null;
    dao_proposal_fee_per_outcome?: string | null;
    dao_fee_in_asset_token?: boolean | null;
    amm_fee_bps?: string | null;
}

export interface DAO {
    id: string;
    dao_name: string;
    asset_type: string;
    stable_type: string;
    asset_decimals: number;
    stable_decimals: number;
    asset_symbol: string | null;
    stable_symbol: string | null;
    creator: string;
    affiliate_id: string | null;
    creation_method: string | null;
    version: string | null;
    canonical_uuid: string | null;
    proposal_count: number;
    spot_pool_id: string | null;
    lp_type: string | null;
    treasury_stable_balance: string | null;
    treasury_updated_at: string | null;
    init_actions?: unknown;
    init_execution_tx?: string | null;
    init_execution_at?: string | null;
    timestamp: string;
    config: DAOConfig | null;
}
