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
                paragraphs: ["Choose member addresses, weights, a vote threshold, and an intent expiry."],
            },
            {
                id: "open-vaults",
                title: "2. Open vaults",
                paragraphs: [
                    "Vaults are named and isolated coin balances inside the account. New vaults approve Sui deposits by default. Additional coin types must be approved by the multisig before deposits of that coin type are accepted.",
                ],
            },
            {
                id: "stage-actions",
                title: "3. Create intents",
                paragraphs: [
                    "Create an intent for the transaction your team wants to approve. Common examples are transferring vault funds, creating a spending limit, locking an upgrade cap, or recording a memo.",
                ],
            },
            {
                id: "approve-execute",
                title: "4. Approve and execute",
                paragraphs: [
                    "Members approve or reject intents. Votes can be changed until the intent is executed or canceled. Once enough approval weight is reached, an executor can run it.",
                    "If the account configuration changes, older pending intents become stale. Stale intents cannot be executed; they can only be canceled.",
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
        navTitle: "Account Setup",
        title: "Account Setup",
        sections: [
            {
                id: "shape",
                title: "Members",
                paragraphs: [
                    "A Govex account has members, each with their own weight. Approval and cancellation thresholds define the weight needed to approve, execute, or cancel pending work.",
                ],
            },
            {
                id: "fields",
                title: "Definitions",
                bullets: [
                    "**Members** are the Sui addresses that can participate in account voting.",
                    "**Weights** let some members count more than others. A member with weight 2 contributes twice as much voting weight as a member with weight 1.",
                    "**Vote thresholds** define the member weight needed to approve or reject an intent.",
                    "**Execute thresholds** define the member weight needed to execute an approved intent or to cancel an intent.",
                    "**Intent expiry** is how long an intent can collect approvals before it expires.",
                ],
            },
        ],
    },
    {
        slug: "spending-limits",
        navTitle: "Spending Limits",
        title: "Spending Limits",
        sections: [
            {
                id: "streams",
                title: "Spending limits",
                paragraphs: [
                    "Spending limits release vault funds over time to a delegate. Add whitelisted recipients when funds should only be spent to specific addresses. Funds are not isolated and can still be spent by other actions. To isolate them, move them to a separate vault.",
                ],
            },
            {
                id: "vesting",
                title: "Vesting coins",
                paragraphs: ["Vesting coins isolate funds and release them to a recipient over time."],
            },
        ],
    },
    {
        slug: "custom-actions",
        navTitle: "Adding Your Own Actions",
        title: "Adding Your Own Actions",
        sections: [
            {
                id: "custom-action-flow",
                title: "Custom action flow",
                paragraphs: [
                    "Custom actions can wrap any public or entry Move function, including third-party Move functions, as a typed Govex intent. Use the [action wrapper generator script](https://github.com/govex-dao/smart-account-v3/blob/main/scripts/generate-action-wrapper.sh) to scan the function signature and produce the schema, Move wrapper, and TypeScript snippets. This allows the multisig to interact with any custom packages you deploy.",
                ],
            },
        ],
    },
];

export const docsBySlug = new Map(docsPages.map((page) => [page.slug, page]));

export const docsNavGroups: DocsNavGroup[] = [
    {
        title: "Multisig",
        slugs: ["quick-start", "configuration-simple", "spending-limits", "custom-actions", "security"],
    },
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
