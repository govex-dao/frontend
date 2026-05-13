import { Link } from "react-router";
import { GitCommit, Github, Send } from "lucide-react";

import { buildInfo } from "@/lib/buildInfo";

const productLinks = [
    { label: "Multisigs", to: "/multisig" },
    { label: "Orgs", to: "/orgs" },
    { label: "Decision Markets", to: "/proposals" },
];

const resourceLinks = [{ label: "Docs", to: "/docs" }];

const socialLinks = [
    { label: "X", href: "https://x.com/govex_ai" },
    { label: "Telegram", href: "https://t.me/govex_ai", icon: Send },
    { label: "GitHub", href: "https://github.com/govex-dao", icon: Github },
];

function FooterLink({ to, children }: { to: string; children: React.ReactNode }) {
    return (
        <Link to={to} className="text-sm text-text-secondary transition-colors hover:text-primary">
            {children}
        </Link>
    );
}

function SocialLink({ link }: { link: (typeof socialLinks)[number] }) {
    const Icon = "icon" in link ? link.icon : undefined;

    return (
        <a
            href={link.href}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={link.label}
            title={link.label}
            className="inline-flex size-9 items-center justify-center rounded-lg border border-border-light bg-card/40 text-text-secondary transition-colors hover:border-primary/30 hover:bg-primary/10 hover:text-primary"
        >
            {Icon ? <Icon className="size-4" /> : <span className="text-sm font-semibold leading-none">X</span>}
        </a>
    );
}

function BuildCommitLink() {
    if (!buildInfo.commit || !buildInfo.commitShort) return null;

    const label = `Version ${buildInfo.commitShort}${buildInfo.sourceDirty ? " +dirty" : ""}`;
    const titleParts = [
        `Version ${buildInfo.commit}`,
        buildInfo.commitTime ? `Committed ${buildInfo.commitTime}` : null,
        buildInfo.branch ? `Branch ${buildInfo.branch}` : null,
        buildInfo.sourceDirty ? "Built from a dirty working tree" : null,
    ].filter(Boolean);
    const commitUrl = buildInfo.repo ? `${buildInfo.repo}/commit/${buildInfo.commit}` : null;
    const className =
        "inline-flex items-center gap-1.5 text-xs text-text-muted transition-colors hover:text-primary";

    if (!commitUrl) {
        return (
            <span className={className} title={titleParts.join("\n")}>
                <GitCommit className="size-3.5" />
                {label}
            </span>
        );
    }

    return (
        <a
            href={commitUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={className}
            title={titleParts.join("\n")}
        >
            <GitCommit className="size-3.5" />
            {label}
        </a>
    );
}

export function SiteFooter() {
    const year = new Date().getFullYear();

    return (
        <footer className="route-container mt-8 shrink-0 pb-6 sm:pb-8">
            <div className="mx-auto grid w-full max-w-7xl gap-8 border-t border-border-light py-6 sm:grid-cols-[minmax(0,1fr)_auto] sm:py-8">
                <div className="max-w-md">
                    <p className="text-sm leading-relaxed text-text-muted">
                        Multisig and decision-market infrastructure on Sui.
                    </p>
                    <div className="mt-4 flex flex-col items-start gap-2">
                        <BuildCommitLink />
                        <p className="text-xs text-text-muted">© {year} Govex.</p>
                    </div>
                </div>

                <div className="grid grid-cols-2 gap-8 sm:grid-cols-[auto_auto_auto] sm:gap-10">
                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Product</p>
                        {productLinks.map((link) => (
                            <FooterLink key={link.to} to={link.to}>
                                {link.label}
                            </FooterLink>
                        ))}
                    </div>

                    <div className="flex flex-col gap-2">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Resources</p>
                        {resourceLinks.map((link) => (
                            <FooterLink key={link.to} to={link.to}>
                                {link.label}
                            </FooterLink>
                        ))}
                    </div>

                    <div className="col-span-2 flex flex-col gap-3 sm:col-span-1">
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">Connect</p>
                        <div className="flex items-center gap-2">
                            {socialLinks.map((link) => (
                                <SocialLink key={link.href} link={link} />
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        </footer>
    );
}
