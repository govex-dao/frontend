import type { TransactionResult } from "@/hooks/useSuiTransaction";

export interface MemberDraft {
    address: string;
    weight: string;
    propose: boolean;
    vote: boolean;
    execute: boolean;
}

// Simple mode always grants the cancel role (bit 8) to every member. Onchain,
// cancel role is a pure membership check (time bands and weights are ignored),
// and finalizing cancellation still requires the reject quorum to have been met,
// so making everyone a canceller is permissive but safe. Keep this synced with
// `validateAndParseMultisigConfigDraft`, which requires hasCanceller=true.
export function memberToPermissions(m: { propose: boolean; vote: boolean; execute: boolean }): number {
    return (m.propose ? 1 : 0) | (m.vote ? 2 : 0) | (m.execute ? 4 : 0) | 8;
}

export const REQUIRED_ROLE_LABELS = [
    ["propose", "propose"],
    ["vote", "vote"],
    ["execute", "execute"],
] as const;

export const PERMISSION_LABELS = {
    propose: "Propose",
    vote: "Vote",
    execute: "Execute",
} as const;

export type ConfigMode = "simple" | "advanced";

// Advanced multisig setup remains implemented but hidden from the public create
// flow for now. Add "advanced" here to restore the selector.
export const VISIBLE_CONFIG_MODES: ConfigMode[] = ["simple"];

export const DEFAULT_INTENT_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export function defaultMember(address: string): MemberDraft {
    return { address, weight: "1", propose: true, vote: true, execute: true };
}

export function extractCreatedMultisigAccountId(result: TransactionResult): string | null {
    for (const change of result.objectChanges ?? []) {
        if (!change.objectId || !change.objectType) continue;
        if (change.objectType.endsWith("::account::Account")) {
            return change.objectId;
        }
    }
    return null;
}
