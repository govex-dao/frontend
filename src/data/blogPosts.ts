export type BlogTag = "multisig" | "org" | "markets";

export interface BlogPost {
    slug: string;
    title: string;
    description: string;
    tags: BlogTag[];
    date: string;
    content: string;
}

export const BLOG_TAGS: { value: BlogTag; label: string }[] = [
    { value: "multisig", label: "Multisig" },
    { value: "org", label: "Org" },
    { value: "markets", label: "Markets" },
];

export const blogPosts: BlogPost[] = [
    {
        slug: "multisig-security-after-drift",
        title: "Multisig Security in a Post-Drift World",
        description:
            "Drift lost $280M because signers approved what they didn't read and the multisig had zero delay. Auditors fix this, but they shouldn't hold your org hostage. Time bands solve both problems.",
        tags: ["multisig"],
        date: "2026-04-03",
        content: `
## $280M and a Wake-Up Call

On April 1, 2026, Drift's treasury was drained. An attacker socially engineered two of five Security Council signers into pre-signing transactions they believed were routine protocol updates. The multisig had a 2-of-5 threshold with zero timelock; once two signatures existed, execution was instant. $280 million gone in twelve minutes.

The signers weren't hacked. Their keys weren't stolen. They were tricked into approving something they didn't read. And the multisig had no mechanism to force a review window between approval and execution.

That failure mode is bigger than Drift: WazirX and Radiant showed the same blind-signing class, where signers saw one thing while malicious wallet or ownership-change payloads handed control to attacker contracts. Queued, decoded intents plus a cancellation window are designed for exactly that gap.

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

- **The attacker tricks 2 signers**, but the config requires either more team members or an auditor for instant approval. No path is satisfied. The transaction sits pending.
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

export function filterByTag(tag: BlogTag | null): BlogPost[] {
    const posts = tag ? blogPosts.filter((post) => post.tags.includes(tag)) : blogPosts;
    return [...posts].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
