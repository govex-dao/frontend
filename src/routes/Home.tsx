import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { ArrowRight, CheckCircle2, ChevronLeft, ChevronRight, CircleX, ExternalLink, Loader2 } from "lucide-react";
import { useState, useEffect, useMemo } from "react";
import type { CSSProperties } from "react";
import { ProposalCard } from "@components/proposal/Card";
import { useIsMobile } from "@/hooks/useIsMobile";
import { useProposalsDisplay } from "@/hooks/api";
import type { ProposalDisplay } from "@/types";

const ENTERPRISE_CONTACT_URL = "https://t.me/ggccggccc";
const CONTROL_TARGETS = ["treasury", "package upgrades", "payroll", "admin functions", "minting", "members"];

function joinedCardStyle(index: number, total: number): CSSProperties {
    if (total <= 1) {
        return { borderRadius: "0.75rem" };
    }

    if (index === 0) {
        return { borderRadius: "0.75rem 0.75rem 0 0" };
    }

    if (index === total - 1) {
        return { borderRadius: "0 0 0.75rem 0.75rem", marginTop: -1 };
    }

    return { borderRadius: 0, marginTop: -1 };
}

type FeatureItem = {
    label: string;
    marker?: "check" | "cross";
};

type MultisigTier = {
    name: string;
    price: string;
    description?: string;
    items: FeatureItem[];
    action?: string;
    actionHref?: string;
    external?: boolean;
    highlight?: boolean;
};

const multisigTiers: MultisigTier[] = [
    {
        name: "Native protocol multisig",
        price: "Free",
        items: [
            { label: "Trustless and immutable" },
            { label: "Arbitrary signed Sui transactions" },
            { label: "Payment streams and preapproved spending", marker: "cross" },
            { label: "Whitelisted transfer recipients", marker: "cross" },
            { label: "Timelocks", marker: "cross" },
            { label: "Onchain roles", marker: "cross" },
            { label: "11+ multisig signers", marker: "cross" },
            { label: "Onchain changes to members and threshold", marker: "cross" },
        ],
    },
    {
        name: "Govex teams multisig",
        price: "20 SUI creation fee",
        action: "Create your multisig today",
        actionHref: "/multisig",
        highlight: true,
        items: [
            { label: "Trustless and immutable" },
            { label: "Arbitrary approved actions" },
            { label: "Payment streams and preapproved spending" },
            { label: "Whitelisted transfer recipients" },
            { label: "Role-based permissions" },
            { label: "Up to 200 group members" },
            { label: "Nested approval groups" },
            { label: "Time weighted recovery" },
            { label: "Change members, weights, and thresholds onchain" },
            { label: "Virtual vaults to isolate funds" },
        ],
    },
    {
        name: "Govex enterprise multisig",
        price: "Custom",
        action: "Contact us",
        actionHref: ENTERPRISE_CONTACT_URL,
        external: true,
        items: [
            { label: "Everything in Govex teams" },
            { label: "Policy design and onboarding support" },
            { label: "Custom multisig actions" },
            { label: "Real-time threat monitoring, alerting, and escalation" },
            { label: "Custom SLAs" },
            { label: "Full audit trail for proposal lifecycles" },
            { label: "Observability across teams and accounts" },
        ],
    },
];

export function Home() {
    const [currentProposalPage, setCurrentProposalPage] = useState(0);
    const [controlTargetIndex, setControlTargetIndex] = useState(0);
    const isMobile = useIsMobile();

    const { data: proposals, isLoading: proposalsLoading } = useProposalsDisplay();

    // Sort proposals by timestamp descending (most recent first)
    const sortedProposals = useMemo(() => {
        if (!proposals) return [];
        return [...proposals].sort((a: ProposalDisplay, b: ProposalDisplay) => {
            return b.timestamp.getTime() - a.timestamp.getTime();
        });
    }, [proposals]);

    // Pagination for proposals - 2 on mobile, 4 on desktop
    const proposalsPerPage = isMobile ? 2 : 4;
    const totalProposalPages = Math.ceil(sortedProposals.length / proposalsPerPage);
    const startIdx = currentProposalPage * proposalsPerPage;
    const currentProposals = sortedProposals.slice(startIdx, startIdx + proposalsPerPage);

    // Reset to page 0 when switching between mobile/desktop to avoid out-of-bounds
    useEffect(() => {
        setCurrentProposalPage(0);
    }, [isMobile]);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setControlTargetIndex((current) => (current + 1) % CONTROL_TARGETS.length);
        }, 2200);

        return () => window.clearInterval(intervalId);
    }, []);

    const isLoading = proposalsLoading;

    return (
        <div className="route-container gap-8">
            <Helmet>
                <title>Govex</title>
            </Helmet>

            <section className="max-w-7xl h-fit w-full mx-auto pt-14 sm:pt-16 md:pt-24">
                <div className="flex flex-col gap-5 sm:gap-7">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div className="text-left">
                            <h2>
                                Fine-grained control over your team's{" "}
                                <span
                                    key={CONTROL_TARGETS[controlTargetIndex]}
                                    className="inline-block min-w-[11ch] text-primary animate-word-rise"
                                >
                                    {CONTROL_TARGETS[controlTargetIndex]}
                                </span>
                            </h2>
                            <p className="mt-4 text-sm sm:text-base text-text-light">Choose your security level</p>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
                        {multisigTiers.map((tier) => (
                            <div
                                key={tier.name}
                                className={`border rounded-lg p-4 sm:p-5 ${
                                    tier.highlight
                                        ? "border-primary/30 bg-primary/[0.03]"
                                        : "border-border-light bg-card/30"
                                }`}
                            >
                                <div className="flex items-start justify-between gap-4">
                                    <div>
                                        <p className="text-base font-semibold text-text-primary">{tier.name}</p>
                                        {tier.description && (
                                            <p className="text-sm text-text-secondary mt-2 leading-relaxed">
                                                {tier.description}
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="mt-4 pt-4 border-t border-border-light flex items-center justify-between gap-3">
                                    <p className="text-xs uppercase tracking-wide text-text-muted">Price</p>
                                    <p className="text-sm font-semibold text-text-primary">{tier.price}</p>
                                </div>

                                {tier.action && tier.actionHref && (
                                    <div className="mt-3">
                                        {tier.external ? (
                                            <a
                                                href={tier.actionHref}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/15 hover:text-primary-light transition-colors"
                                            >
                                                {tier.action}
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        ) : (
                                            <Link
                                                to={tier.actionHref}
                                                className="inline-flex items-center justify-center gap-1.5 rounded-md border border-primary/30 bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary hover:bg-primary/15 hover:text-primary-light transition-colors"
                                            >
                                                {tier.action}
                                                <ArrowRight className="w-3.5 h-3.5" />
                                            </Link>
                                        )}
                                    </div>
                                )}

                                <div className="mt-4 flex flex-col gap-2.5">
                                    {tier.items.map((item) => (
                                        <div key={item.label} className="flex items-start gap-2.5">
                                            {item.marker === "cross" ? (
                                                <CircleX className="w-4 h-4 mt-0.5 text-text-muted shrink-0" />
                                            ) : (
                                                <CheckCircle2 className="w-4 h-4 mt-0.5 text-primary/80 shrink-0" />
                                            )}
                                            <p className="text-sm leading-relaxed text-text-secondary">{item.label}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            </section>

            <section className="max-w-7xl h-fit w-full mx-auto py-12 sm:py-16 md:py-24">
                <div className="flex flex-col">
                    <div className="mb-4 flex flex-col sm:flex-row sm:items-baseline gap-2 sm:gap-3 justify-between">
                        <div className="flex flex-col gap-1">
                            <h2>Decision Markets</h2>
                            <p className="text-text-light">Market-based decisions for tokenized orgs</p>
                        </div>
                        <Link
                            to="/proposals"
                            className="text-sm text-primary hover:text-primary-light transition-colors flex items-center gap-1 group w-fit"
                        >
                            View all
                            <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition-transform" />
                        </Link>
                    </div>
                    <div className="flex flex-col">
                        {isLoading ? (
                            <div className="flex items-center justify-center py-12">
                                <Loader2 className="w-8 h-8 animate-spin text-primary" />
                            </div>
                        ) : currentProposals.length === 0 ? (
                            <div className="flex items-center justify-center py-12 text-text-light">
                                No decisions yet.
                            </div>
                        ) : (
                            currentProposals.map((proposal: ProposalDisplay, index) => (
                                <ProposalCard
                                    key={proposal.id}
                                    proposal={proposal}
                                    joined
                                    style={joinedCardStyle(index, currentProposals.length)}
                                />
                            ))
                        )}
                    </div>
                    {/* Navigation buttons */}
                    {!isLoading && totalProposalPages > 1 && (
                        <div className="flex items-center justify-between mt-4 pt-4 border-t border-border">
                            <button
                                onClick={() => setCurrentProposalPage((prev) => Math.max(0, prev - 1))}
                                disabled={currentProposalPage === 0}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card-elevated hover:bg-card-more-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                aria-label="Previous proposals"
                            >
                                <ChevronLeft className="w-4 h-4" />
                                <span className="text-sm">Previous</span>
                            </button>
                            <div className="flex items-center gap-2">
                                {Array.from({ length: totalProposalPages }).map((_, idx) => (
                                    <button
                                        key={idx}
                                        onClick={() => setCurrentProposalPage(idx)}
                                        className={`w-2 h-2 rounded-full transition-all ${
                                            idx === currentProposalPage
                                                ? "bg-primary-dark w-8"
                                                : "bg-white/20 hover:bg-white/40"
                                        }`}
                                        aria-label={`Go to page ${idx + 1}`}
                                    />
                                ))}
                            </div>
                            <button
                                onClick={() =>
                                    setCurrentProposalPage((prev) => Math.min(totalProposalPages - 1, prev + 1))
                                }
                                disabled={currentProposalPage === totalProposalPages - 1}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-card-elevated hover:bg-card-more-elevated disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                                aria-label="Next proposals"
                            >
                                <span className="text-sm">Next</span>
                                <ChevronRight className="w-4 h-4" />
                            </button>
                        </div>
                    )}
                </div>
            </section>
        </div>
    );
}
