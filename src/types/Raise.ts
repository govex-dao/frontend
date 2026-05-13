/**
 * Raise/Launchpad types matching backend API responses
 */

export interface RaiseMetadata {
  name?: string;
  image?: string;
  header_image?: string;
  about?: string;
  team?: string; // JSON string of TeamMember[]
  website?: string;
  twitter?: string;
  discord?: string;
}

export interface TeamMember {
  name: string;
  role: string;
  twitter?: string;
}

export interface Contributor {
  address: string;
  amount: string;
  percentage: string;
}

export interface Reservation {
  wallet: string;
  amount: string;
  accepted: boolean;
}

/**
 * Raise lifecycle states from indexer/API.
 * `ended_early` is set when a raise ends before its deadline (target met or creator-triggered).
 * `completion_pending` means settlement succeeded and staged launchpad actions are still pending.
 */
export type RaiseState =
  | "funding"
  | "ended_early"
  | "completion_pending"
  | "successful"
  | "failed"
  | (string & {});

export interface Raise {
  id: string;
  dao_id: string | null;
  creator: string;
  asset_type: string;
  stable_type: string;
  asset_symbol: string | null;
  stable_symbol: string | null;
  asset_decimals: number;
  stable_decimals: number;
  state: RaiseState;
  pool_id: string | null;
  lp_type: string | null;
  target_amount: string | null;
  min_raise_amount: string | null;
  max_raise_amount: string | null;
  raised: string;
  tokens_for_sale: string | null;
  start_time: string;
  deadline: string | null;
  completion_started_ms?: string | null;
  description: string;
  metadata: RaiseMetadata;
  timestamp: string;
  // Only present on single raise fetch
  contributors?: Contributor[];
  reservations?: Reservation[];
  contributor_count?: number;
  success_actions?: unknown;
  failure_actions?: unknown;
}

/**
 * Helper to parse team from metadata JSON string
 */
export function parseTeam(raise: Raise): TeamMember[] {
  if (!raise.metadata?.team) return [];
  try {
    return JSON.parse(raise.metadata.team);
  } catch {
    return [];
  }
}

/**
 * Helper to get display name (from metadata or fallback to token symbol)
 */
export function getRaiseName(raise: Raise): string {
  return raise.metadata?.name || raise.asset_symbol || 'Raise';
}
