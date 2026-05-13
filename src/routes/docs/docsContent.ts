import { decisionMarketDocsPages } from "./decisionMarketDocsContent";

export interface DocsSection {
    id: string;
    title: string;
    paragraphs?: string[];
    bullets?: string[];
    links?: Array<{
        label: string;
        href: string;
    }>;
    callout?: string;
    code?: string;
}

export interface DocsPage {
    slug: string;
    navTitle: string;
    title: string;
    sections: DocsSection[];
}

export interface DocsNavGroup {
    title: string;
    slugs: string[];
}

export const docsPages: DocsPage[] = [
    {
        slug: "quick-start",
        navTitle: "Overview",
        title: "Overview",
        sections: [
            {
                id: "create-account",
                title: "1. Create the account",
                paragraphs: [
                    "Start with the simple configuration unless you already need separate operating groups. Choose member addresses, weights, an approval threshold, a cancellation threshold, and an intent expiry.",
                ],
            },
            {
                id: "open-vaults",
                title: "2. Open vaults",
                paragraphs: [
                    "Vaults are named and isolated coin balances inside the account. New vaults approve SUI deposits by default. Additional coin types must be approved by governance unless the vault name is exactly \"donations\", or starts with \"donations_\" or \"donations-\".",
                ],
            },
            {
                id: "stage-actions",
                title: "3. Stage actions",
                paragraphs: [
                    "Build an action intent from one or more typed action specs. Common examples are spending from a vault and transferring funds, creating a payment stream, creating preapproved spending, locking an upgrade cap, or emitting a memo.",
                    "A multisig intent can contain up to 10 action specs and uses one execution time. The expiration time must match the account's configured intent expiry.",
                ],
            },
            {
                id: "approve-execute",
                title: "4. Approve and execute",
                paragraphs: [
                    "Members approve or reject. Approval and rejection votes can be changed before the intent is executed or canceled. Once an approval path is satisfied, an executor can run the actions in order.",
                    "If the account configuration changes, older pending intents can become stale. Stale intents cannot be executed; they can only be canceled.",
                ],
            },
        ],
    },
    {
        slug: "security",
        navTitle: "Security",
        title: "Security",
        sections: [
            {
                id: "contract-control",
                title: "Contract control",
                paragraphs: [
                    "Govex multisig contracts are immutable and include no Govex-controlled admin backdoor. Funds can only move through the account's configured approval policies and authorized actions, so custody remains with the multisig configuration you and your team create.",
                ],
            },
            {
                id: "repositories",
                title: "Repositories",
                links: [
                    {
                        label: "SDK",
                        href: "https://github.com/govex-dao/sdk-v3",
                    },
                    {
                        label: "Smart account",
                        href: "https://github.com/govex-dao/smart-account-v3",
                    },
                    {
                        label: "Multisig",
                        href: "https://github.com/govex-dao/multisig-v3",
                    },
                    {
                        label: "Security",
                        href: "https://github.com/govex-dao/security",
                    },
                ],
            },
        ],
    },
    {
        slug: "configuration-simple",
        navTitle: "Simple Multisig Config",
        title: "Simple Multisig Configuration",
        sections: [
            {
                id: "shape",
                title: "Shape",
                paragraphs: [
                    "A simple multisig has members with their own weights. The multisig has a total weight threshold that must be met for a proposal to be executed or canceled.",
                ],
            },
            {
                id: "fields",
                title: "Fields",
                bullets: [
                    "Members are Sui addresses with positive weights.",
                    "Approval threshold is the member weight needed to mark an intent approved.",
                    "Reject threshold is the member reject weight needed to unlock cancellation.",
                    "Propose roles allow addresses to stage intents.",
                    "Execute roles allow addresses to execute approved intents. No selected executor makes execution permissionless, which is useful for third-party keeper bots or intent solvers.",
                    "Cancel roles allow addresses to finalize cancellation after the cancellation policy is satisfied.",
                    "Intent expiry time is how long intents have from the point of creation until they are no longer able to be approved.",
                ],
            },
        ],
    },
    {
        slug: "configuration-advanced",
        navTitle: "Advanced Multisig Config",
        title: "Advanced Multisig Configuration",
        sections: [
            {
                id: "groups-and-paths",
                title: "Groups and paths",
                paragraphs: [
                    "Groups are named member sets. The same address may appear in more than one group with different weights.",
                    "A policy is OR across paths: any one path can satisfy the policy. A path is AND across requirements: every group threshold in that path must be met at the same time.",
                ],
                bullets: [
                    "Example approve path: Team >= 2 and Auditor >= 1.",
                    "Example fallback path: Team >= 3.",
                    "Example cancel path: Team >= 1.",
                ],
            },
            {
                id: "time-bands",
                title: "Time bands",
                paragraphs: [
                    "Time bands add delayed approval weight to a group after an intent has been pending for a configured time. The highest matured band counts; bands are not cumulative.",
                    "Time bands are considered only for approvals, never for rejections.",
                    "Time bands only relax approval over time. Time-banded approval protects against deadlock. Cancellation is controlled by cancel thresholds and intent expiry.",
                ],
                callout:
                    "A time band is a review window before approval matures. It is not a separate post-approval timelock.",
            },
            {
                id: "roles",
                title: "Role gates",
                bullets: [
                    "Propose groups can stage new intents.",
                    "Execute groups can execute approved intents. Empty execute groups allow any caller to execute, which is useful for third-party keeper bots or intent solvers.",
                    "Cancel groups can finalize cancellation after reject weight satisfies a cancel path or the intent is otherwise rejected.",
                ],
            },
            {
                id: "config-changes",
                title: "Config changes",
                paragraphs: [
                    "A config change is its own single-action intent. The proposed config is stored on the account while the intent is pending.",
                    "When the config change executes, it replaces the account configuration. Pending intents from the old configuration become stale and cannot execute.",
                ],
            },
            {
                id: "limits",
                title: "Limits and validation",
                bullets: [
                    "Max 20 groups per multisig.",
                    "Max 200 member entries per multisig.",
                    "Max 20 approval paths and max 20 cancellation paths per multisig.",
                    "Max 10 time bands per group.",
                    "Group names must be non-empty and unique.",
                    "Member weights and path thresholds must be positive.",
                    "Time bands must have positive delays and mature before intent expiry.",
                ],
            },
        ],
    },
    {
        slug: "spending-limits",
        navTitle: "Preapproved Spending and Payment Streams",
        title: "Preapproved Spending and Payment Streams",
        sections: [
            {
                id: "spending-limit-model",
                title: "Preapproved spending model",
                paragraphs: [
                    "Preapproved spending is created by the same action used for payment streams, but with a non-empty recipient whitelist. The action mints a SpendingCap and transfers it to the delegate.",
                    "The delegate can call spend_with_cap to send vested budget directly from the vault to a whitelisted recipient. The funds go straight to the recipient, not to the delegate.",
                ],
            },
            {
                id: "streams",
                title: "Payment streams",
                paragraphs: [
                    "A payment stream has an empty recipient whitelist. It mints a StreamCap to the beneficiary, and the cap holder can collect vested tokens from the vault.",
                    "Payment streams do not support expiry_ms. They are always cancellable by governance, and cancellation removes stream metadata but does not automatically move funds out of the vault.",
                ],
            },
        ],
    },
    {
        slug: "whitelists",
        navTitle: "Whitelists and Allow Lists",
        title: "Whitelists and Allow Lists",
        sections: [
            {
                id: "vault-coin-allowlist",
                title: "Vault coin allow list",
                paragraphs: [
                    "Vaults have an approved_types list for deposit coin types. SUI is approved by default for new vaults. Other coin types need a governance action before regular deposits are accepted.",
                    "Vault names that are exactly \"donations\", or start with \"donations_\" or \"donations-\", bypass the deposit coin allow list. This is meant for inbox-style vaults that accept arbitrary inbound assets.",
                ],
            },
            {
                id: "spending-recipients",
                title: "Spending recipients",
                paragraphs: [
                    "Preapproved spending has its own recipient whitelist. The delegate can only spend vested budget to addresses on that list.",
                    "Changing recipient policy means creating, replacing, or cancelling preapproved spending through governance; the recipient list is part of the approved action data.",
                ],
            },
        ],
    },
    {
        slug: "custom-actions",
        navTitle: "Adding Your Own Actions",
        title: "Adding Your Own Actions",
        sections: [
            {
                id: "coming-soon",
                title: "Coming soon",
            },
        ],
    },
    {
        slug: "decision-markets",
        navTitle: "Overview",
        title: "Decision Markets",
        sections: [
            {
                id: "coming-soon",
                title: "Coming soon",
            },
        ],
    },
    ...decisionMarketDocsPages,
];

export const docsBySlug = new Map(docsPages.map((page) => [page.slug, page]));

export const docsNavGroups: DocsNavGroup[] = [
    {
        title: "Multisig",
        slugs: [
            "quick-start",
            "configuration-simple",
            "configuration-advanced",
            "spending-limits",
            "whitelists",
            "custom-actions",
            "security",
        ],
    },
    { title: "Decision Markets", slugs: ["decision-markets", ...decisionMarketDocsPages.map((page) => page.slug)] },
];

export const docsNavigationPages: DocsPage[] = docsNavGroups.flatMap((group) =>
    group.slugs.flatMap((slug) => {
        const page = docsBySlug.get(slug);
        return page ? [page] : [];
    })
);

export function docsPath(slug: string) {
    return slug === docsPages[0].slug ? "/docs" : `/docs/${slug}`;
}
