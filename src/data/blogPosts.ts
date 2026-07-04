export type BlogTag = "multisig" | "org" | "markets" | "governance";

export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    tags: BlogTag[];
    date: string;
    image?: {
        src: string;
        alt: string;
    };
    content: string;
}

export const BLOG_TAGS: { value: BlogTag; label: string }[] = [
    { value: "multisig", label: "Multisig" },
    { value: "markets", label: "Markets" },
    { value: "governance", label: "Governance" },
    { value: "org", label: "Org" },
];

export const blogPosts: BlogPost[] = [
    {
        slug: "govex-multisig-vs-built-in-sui-multisig",
        title: "Govex Multisig vs. Built-In Sui Multisig",
        description:
            "Sui native multisig coordinates signatures. Govex is for the work that comes after custody: roles, vaults, limits, proposals, approvals, execution, and team operations.",
        tags: ["multisig", "governance"],
        date: "2026-07-02",
        image: {
            src: "/images/blog/govex-multisig-vs-sui-multisig.png",
            alt: "Abstract comparison between simple threshold signing and a programmable Govex account control surface",
        },
        content: `
## The Short Version

[Sui's built-in multisig](https://docs.sui.io/develop/transactions/transaction-auth/multisig) is a good primitive. It coordinates signatures: public keys, weights, a threshold, and a transaction.

That is not the same thing as running an account.

Govex is a programmable multisig for ongoing team operations. It gives the account rules, memory, and workflow.

## What Govex Adds

Govex provides more granular security than the default Sui multisig:

- Role-based permissions for who can propose, vote, execute, and finalize cancellation.
- Virtual vaults to isolate treasury funds.
- Spending limits and whitelisted transfer recipients.
- Onchain changes to members, weights, thresholds, and policies.
- Immutable contracts with no Govex-controlled admin backdoor.
- Proposal tracking for creation, approvals, rejection, cancellation, and execution.
- Alerting and SSO support for teams that need an operational security layer.

The default Sui multisig cannot express this because it only answers one question:

**Did enough signer weight authorize this transaction?**

Govex asks better questions:

**Who proposed it? Who approved it? Who is allowed to execute it? Which vault does it touch? Is the recipient whitelisted? Is this within a spending limit? Has cancellation been unlocked?**

## Time Bands

Govex also supports time bands: delayed approval weight for a group.

Example: two team members are not enough immediately, but after a review window their approval path can mature. During that window, reject votes can unlock cancellation. Time bands count for approval, not cancellation, so they create a review window instead of silently giving anyone a veto.

## The Difference

Sui multisig is custody infrastructure.

Govex is account infrastructure.

If all you need is threshold signatures, use the default Sui multisig. If your team needs to manage assets, roles, vaults, policies, approvals, and execution over time, use Govex.
`,
    },
    {
        slug: "multisig-security-after-drift",
        title: "Multisig Security in a Post-Drift World",
        description:
            "Drift showed what happens when high-authority approvals move faster than review. Bybit, Radiant, WazirX, BadgerDAO, and bridge failures point to the missing layer: decoded, delayed, cancellable intent execution.",
        tags: ["multisig"],
        date: "2026-04-03",
        image: {
            src: "/images/blog/multisig-security-after-drift.png",
            alt: "Shadowy laptop screen showing a glowing question mark for multisig transaction security review",
        },
        content: `
## $280M and a Wake-Up Call

On April 1, 2026, Drift's treasury was drained. Public reporting put the loss around $280 million and described a sophisticated operation involving durable nonces, misrepresented transaction approvals, social engineering, and a rapid takeover of Security Council powers. The exact incident details matter for Drift, but the design lesson is simpler: high-authority execution moved faster than independent review.

This is not only a Drift problem. It is the same broad failure class behind several major incidents:

- [Bybit](https://www.businessinsider.com/what-we-know-bybit-crypto-ethereum-hack-2025-2) lost about $1.5 billion on February 21, 2025 when a cold-wallet transfer was manipulated so signers saw a routine move while the underlying smart-contract logic let the attacker take over the wallet. The [FBI attributed](https://www.ic3.gov/PSA/2025/PSA250226) the theft to North Korea. Bybit is a centralized exchange, not DeFi, but the signing failure is directly relevant.
- [Radiant Capital](https://rekt.news/radiant-capital-rekt2) lost more than $53 million in October 2024 after attackers gained enough control over a 3-of-11 multisig path to transfer ownership, upgrade pool implementations, and drain funds. That is the closest DeFi example.
- [WazirX](https://www.theverge.com/2025/1/14/24343762/north-korea-crypto-stolen-wazirx-lazarus-group) lost roughly $230-$235 million from a multisig custody wallet in July 2024. Public reporting and later analysis described a disputed but familiar custody-workflow failure involving signer/UI mismatch and contract-control changes.
- [BadgerDAO](https://rekt.news/badger-rekt) was a user-level version of the same problem: a compromised frontend induced approvals that looked attached to normal app flows, then drained wallets.
- [Ronin](https://www.wired.com/story/blockchain-network-bridge-hacks) and [Harmony Horizon](https://www.fbi.gov/news/press-releases/fbi-confirms-lazarus-group-cyber-actors-responsible-for-harmonys-horizon-bridge-currency-theft) were not blind-signing UI failures, but they are related threshold-control failures: enough validators or bridge authority was compromised to move enormous value.

The signers may not be "hacked" in the narrow private-key sense. Their security stack can still fail if they approve a transaction whose decoded meaning, timing, and execution path are not independently constrained.

The lesson is clear: **every high-value transaction needs an independent reviewer who actually reads it.** Not more of the same signers. An external check, auditors, a security council, someone whose only job is to verify what's being signed before it executes.

This is correct. But it creates a new problem.

## The Auditor Trap

The moment you require an external auditor on every transaction, you've handed them a veto over your treasury. They go on vacation; you're frozen. They get acquired; renegotiate your contract while your payroll sits in limbo. They disagree with a strategic decision; your funds don't move.

You traded one vulnerability (social engineering) for another (organizational paralysis). The auditor was supposed to be a safety net, but they've become a single point of failure in the other direction.

The industry hasn't had a good answer for this. You either make auditors mandatory and accept the chokepoint, or you leave them out and accept the risk.

## Time as a Co-Signer

We built a multisig where time itself contributes approval weight.

Members belong to **groups**. Your team is one group, your auditors are another. Each member has a weight, and each group can have **time bands**: weight bonuses that unlock after elapsed time. A transaction is approved when any single **policy path** is satisfied, where each path specifies which groups need to reach what threshold.

This means you can configure paths like:

- A **fast path** requiring both team and auditors that executes immediately
- A **team-only path** with a higher threshold so the full team can act without auditors
- A **degraded path** where fewer team members can proceed, but only after a time band kicks in
- An **auditor-only path** that requires a long delay, giving the team time to react

**Cancel has its own quorum policy.** A vote-against satisfies the configured cancel paths, while cancel groups control who can finalize once cancellation is unlocked.

Govex does not rely on a native multisig timelock. The delay lives in the policy and action layer: time bands control when a path can become satisfied, and action handlers such as package upgrades can enforce their own minimum delay. During those windows, cancel can intervene.

When auditors are engaged, things move fast. When they're not, time shifts the approval threshold until the team can act on its own. The auditor requirement is real, but it isn't absolute. Given enough time, the organization routes around the bottleneck.

## What This Changes

Go back to the Drift scenario. Same treasury, but with this model:

- **The attacker tricks enough signers to make progress**, but the config requires either more team members or an auditor for instant approval. No path is satisfied. The transaction sits pending.
- **The attacker waits for a time band**, but that's a detection window. The remaining team members can vote against, and a whitelisted canceller can finalize once the cancel policy is met.
- **Cancel can't be blocked by execution roles.** Compromising the keys needed to execute does not bypass a pending vote-against path or the cancel finalizer whitelist.
- **This works in reverse too.** Auditor-only paths can be configured to require a time band delay before the threshold is met. If auditors go rogue, the team has days or weeks to cancel before execution is possible. Neither side holds unilateral power.

The $280M doesn't walk out the door because the system forces a review window and gives a separate set of people the power to stop it.

## Checkpoints, Not Chokepoints

The core insight is simple: **your auditors should be a checkpoint, not a chokepoint.**

They speed things up when they're engaged. They slow things down when they're not. But they can never permanently block your organization from operating. Time is the escape valve that makes independent oversight practical instead of paralyzing.

This is what treasury security looks like after Drift: not just more signers, but a trust model where urgency determines how many approvals you need, and where no single group can hold the organization hostage.

---

*Govex multisig is live on Sui. [Try it](/)*
`,
    },
];

export function getBlogPost(slug: string): BlogPost | undefined {
    return blogPosts.find((post) => post.slug === slug);
}

export function getBlogTagLabel(tag: BlogTag): string {
    return BLOG_TAGS.find((item) => item.value === tag)?.label ?? tag;
}

function parseBlogDate(date: string): Date {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
        return new Date(date);
    }

    const [, year, month, day] = match;
    return new Date(Number(year), Number(month) - 1, Number(day));
}

function getBlogDateTime(date: string): number {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

    if (!match) {
        return new Date(date).getTime();
    }

    const [, year, month, day] = match;
    return Date.UTC(Number(year), Number(month) - 1, Number(day));
}

export function formatBlogDate(date: string, options: Intl.DateTimeFormatOptions): string {
    return parseBlogDate(date).toLocaleDateString("en-US", options);
}

export function filterByTag(tag: BlogTag | null): BlogPost[] {
    const posts = tag ? blogPosts.filter((post) => post.tags.includes(tag)) : blogPosts;
    return [...posts].sort((a, b) => getBlogDateTime(b.date) - getBlogDateTime(a.date));
}
