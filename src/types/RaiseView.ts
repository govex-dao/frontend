/**
 * View layer type for Raise pages/components
 * Adapts the API Raise type to the format expected by UI components
 */

import type { Raise, TeamMember } from './Raise';

/**
 * Raise view model used by UI components
 * Contains computed/formatted values from API response
 */
export interface RaiseView {
    id: string;
    name: string;
    orgId: string | null;  // dao_id
    image?: string;
    headerImage?: string;
    raising: number;  // min raise amount (goal) in decimals
    raised: number;   // current raised amount in decimals
    maxRaise: number | null; // max raise amount (cap) in decimals, null = unlimited
    pendingReserved: number; // unaccepted reservation amount in decimals
    tokensForSale: number;  // total tokens being sold, in token decimals
    assetSymbol: string;    // token symbol (e.g. "GOV")
    raiseStart: Date;
    raiseEnd: Date;
    description: string;
    about?: string;
    team?: TeamMember[];
    website?: string;
    twitter?: string;
    discord?: string;
    // For completed raises
    accepted?: number;
    // Raw API data for reference
    _raw: Raise;
}

/**
 * Convert API Raise to RaiseView for UI components
 */
export function toRaiseView(raise: Raise): RaiseView {
    const stableDecimals = raise.stable_decimals || 6;
    const divisor = Math.pow(10, stableDecimals);

    // Parse metadata
    const metadata = raise.metadata || {};

    // Parse team from metadata JSON string
    let team: TeamMember[] | undefined;
    if (metadata.team) {
        try {
            team = JSON.parse(metadata.team);
        } catch {
            team = undefined;
        }
    }
    if ((!team || team.length === 0) && metadata.founder_twitter) {
        team = [{ name: "Founder", role: "Founder", twitter: metadata.founder_twitter }];
    }

    // Parse dates from milliseconds timestamps
    const startTime = raise.start_time ? Number(raise.start_time) : Date.now();
    const deadline = raise.deadline ? Number(raise.deadline) : Date.now() + 30 * 24 * 60 * 60 * 1000;

    // Parse amounts
    const targetAmount = raise.target_amount ? Number(raise.target_amount) / divisor : 0;
    const raisedAmount = raise.raised ? Number(raise.raised) / divisor : 0;
    // max_raise_amount: u64::MAX (18446744073709551615) means "no cap"
    const MAX_U64 = "18446744073709551615";
    const maxRaiseRaw = raise.max_raise_amount;
    const maxRaise = maxRaiseRaw && maxRaiseRaw !== MAX_U64
        ? Number(maxRaiseRaw) / divisor
        : null;

    const assetDecimals = raise.asset_decimals || 9;
    const assetDivisor = Math.pow(10, assetDecimals);
    const tokensForSale = raise.tokens_for_sale ? Number(raise.tokens_for_sale) / assetDivisor : 0;

    // Compute pending reserved from unaccepted reservations
    const pendingReserved = (raise.reservations || [])
        .filter(r => !r.accepted)
        .reduce((sum, r) => sum + Number(r.amount), 0) / divisor;

    return {
        id: raise.id,
        name: metadata.name || raise.asset_symbol || 'Raise',
        orgId: raise.dao_id,
        image: metadata.image,
        headerImage: metadata.header_image,
        raising: targetAmount,
        raised: raisedAmount,
        maxRaise,
        pendingReserved,
        tokensForSale,
        assetSymbol: raise.asset_symbol || metadata.name || 'Token',
        accepted: raise.state === 'successful' ? raisedAmount : undefined,
        raiseStart: new Date(startTime),
        raiseEnd: new Date(deadline),
        description: raise.description || '',
        about: metadata.about,
        team,
        website: metadata.website,
        twitter: metadata.twitter,
        discord: metadata.discord,
        _raw: raise,
    };
}
