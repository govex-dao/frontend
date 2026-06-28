import { Link } from "react-router";
import { Helmet } from "react-helmet-async";
import { ArrowRight, CheckCircle2, CircleX, ExternalLink } from "lucide-react";
import { useEffect, useState } from "react";

const ENTERPRISE_CONTACT_URL = "https://t.me/ggccggccc";
const CONTROL_TARGETS = ["treasury", "package upgrades", "payroll", "admin functions", "minting", "members"];
const CTA_BASE_CLASS =
    "inline-flex items-center justify-center gap-1.5 rounded-md border px-3 py-1.5 text-sm font-semibold text-primary-light backdrop-blur-md transition-all";
const CTA_PRIMARY_CLASS =
    "border-primary/55 bg-primary/[0.095] shadow-[0_0_18px_rgba(59,130,246,0.14)] hover:border-primary/75 hover:bg-primary/[0.14] hover:shadow-[0_0_26px_rgba(59,130,246,0.22)]";
const CTA_SECONDARY_CLASS =
    "border-primary/45 bg-primary/[0.04] shadow-[0_0_16px_rgba(59,130,246,0.1)] hover:border-primary/70 hover:bg-primary/[0.09] hover:shadow-[0_0_24px_rgba(59,130,246,0.18)]";

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
};

const multisigTiers: MultisigTier[] = [
    {
        name: "Govex teams multisig",
        price: "Free",
        action: "Create your multisig",
        actionHref: "/multisig",
        items: [
            { label: "Trustless and immutable" },
            { label: "Approve any Sui transaction" },
            { label: "Spending limits" },
            { label: "Whitelisted transfer recipients" },
            { label: "Role-based permissions" },
            { label: "Up to 200 members" },
            { label: "Change members, weights, and thresholds onchain" },
            { label: "Virtual vaults to isolate funds" },
        ],
    },
    {
        name: "Govex custom setup",
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
            { label: "Nested approval groups" },
        ],
    },
];

export function Home() {
    const [controlTargetIndex, setControlTargetIndex] = useState(0);

    useEffect(() => {
        const intervalId = window.setInterval(() => {
            setControlTargetIndex((current) => (current + 1) % CONTROL_TARGETS.length);
        }, 2200);

        return () => window.clearInterval(intervalId);
    }, []);

    return (
        <div className="route-container gap-8">
            <Helmet>
                <title>Govex</title>
            </Helmet>

            <section className="max-w-7xl h-fit w-full mx-auto pt-6 sm:pt-8 md:pt-10">
                <div className="flex flex-col gap-5 sm:gap-7">
                    <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
                        <div className="text-left">
                            <h2 className="text-xl sm:text-2xl md:text-3xl">
                                Fine-grained control over your team's{" "}
                                <span
                                    key={CONTROL_TARGETS[controlTargetIndex]}
                                    className="inline-block min-w-[11ch] text-primary animate-word-rise"
                                >
                                    {CONTROL_TARGETS[controlTargetIndex]}
                                </span>
                            </h2>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                        {multisigTiers.map((tier) => (
                            <div
                                key={tier.name}
                                className="glass-flow-panel rounded-lg p-4 sm:p-5"
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
                                                className={`${CTA_BASE_CLASS} ${CTA_SECONDARY_CLASS}`}
                                            >
                                                {tier.action}
                                                <ExternalLink className="w-3.5 h-3.5" />
                                            </a>
                                        ) : (
                                            <Link
                                                to={tier.actionHref}
                                                className={`${CTA_BASE_CLASS} ${CTA_PRIMARY_CLASS}`}
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
        </div>
    );
}
