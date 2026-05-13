/**
 * Constants for proposal creation and management
 */

// Storage Keys
export const getProposalDraftsStorageKey = (orgId: string) => `proposal-drafts-${orgId}`;

// Default Outcome
export const DEFAULT_OUTCOME = {
    id: "pass",
    name: "Approve",
    description: "",
    actions: [],
};

// Outcome Keywords for detection
export const FAIL_OUTCOME_KEYWORDS = ["fail", "reject", "no"] as const;

// UI Constants
export const DRAFT_SAVE_MESSAGE_DURATION = 2000; // milliseconds

// Action Type Colors (Tailwind classes)
export const ACTION_COLORS = {
    memo: {
        bg: "bg-green-500/10",
        border: "border-green-400/30",
        text: "text-green-400",
    },
    config: {
        bg: "bg-blue-500/10",
        border: "border-blue-400/30",
        text: "text-blue-400",
    },
    transfer: {
        bg: "bg-purple-500/10",
        border: "border-purple-400/30",
        text: "text-purple-400",
    },
    createStream: {
        bg: "bg-orange-500/10",
        border: "border-orange-400/30",
        text: "text-orange-400",
    },
    onChain: {
        bg: "bg-teal-500/10",
        border: "border-teal-400/30",
        text: "text-teal-400",
    },
} as const;

// Animation Heights
export const ACTION_CARD_COLLAPSED_HEIGHT = 140; // pixels
export const ACTION_CARD_EXPANDED_HEIGHT = 200; // pixels
export const ACTION_DROPDOWN_ESTIMATED_HEIGHT = 200; // pixels

// Memo Action
export const MEMO_MAX_HEIGHT = "25%";
