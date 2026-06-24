import { useState, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link, Navigate, useNavigate, useParams } from "react-router";
import { ArrowRight, ChevronDown, ExternalLink, Menu, X } from "lucide-react";
import { Drawer } from "@/components/overlays/Drawer";
import { docsBySlug, docsNavGroups, docsNavigationPages, docsPath } from "./docsContent";
import type { DocsNavGroup, DocsPage, DocsSection } from "./docsContent";

interface DocsSidebarProps {
    activePage: DocsPage;
    onNavigate?: () => void;
    variant?: "page" | "drawer";
}

interface DocsArticleProps {
    activePage: DocsPage;
}

interface DocsSectionContentProps {
    section: DocsSection;
}

function renderInlineText(text: string): ReactNode[] {
    const nodes: ReactNode[] = [];
    const inlinePattern = /\[([^\]]+)\]\((https?:\/\/[^)]+)\)|\*\*([^*]+)\*\*/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = inlinePattern.exec(text)) !== null) {
        const [raw, label, href, boldText] = match;
        if (match.index > lastIndex) {
            nodes.push(text.slice(lastIndex, match.index));
        }
        if (href) {
            nodes.push(
                <a
                    key={`${href}-${match.index}`}
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-medium text-primary underline-offset-2 hover:underline"
                >
                    {label}
                </a>
            );
        } else {
            nodes.push(
                <strong key={`${boldText}-${match.index}`} className="font-semibold text-text-primary">
                    {boldText}
                </strong>
            );
        }
        lastIndex = match.index + raw.length;
    }

    if (lastIndex < text.length) {
        nodes.push(text.slice(lastIndex));
    }

    return nodes.length > 0 ? nodes : [text];
}

function DocsSidebar({ activePage, onNavigate, variant = "page" }: DocsSidebarProps) {
    const [closedGroups, setClosedGroups] = useState<Record<string, boolean>>({});
    const isDrawer = variant === "drawer";
    const visibleGroups = docsNavGroups
        .map((group) => ({
            ...group,
            pages: group.slugs.flatMap((slug) => {
                const page = docsBySlug.get(slug);
                return page ? [page] : [];
            }),
        }))
        .filter((group) => group.pages.length > 0);
    const toggleGroup = (title: string) => setClosedGroups((prev) => ({ ...prev, [title]: !prev[title] }));

    return (
        <aside className={isDrawer ? "flex min-h-0 flex-1" : "lg:sticky lg:top-20 lg:self-start"}>
            <div
                className={
                    isDrawer
                        ? "flex min-h-0 flex-1 overflow-hidden"
                        : "overflow-hidden rounded-lg border border-border-light bg-card/40"
                }
            >
                <nav
                    className={
                        isDrawer
                            ? "flex-1 overflow-y-auto p-2"
                            : "max-h-[52vh] overflow-y-auto p-2 lg:max-h-[calc(100vh-11rem)]"
                    }
                >
                    <div className="space-y-1">
                        {visibleGroups.map((group) => (
                            <DocsSidebarGroup
                                key={group.title}
                                group={group}
                                activePage={activePage}
                                isOpen={!closedGroups[group.title]}
                                onToggle={() => toggleGroup(group.title)}
                                onNavigate={onNavigate}
                            />
                        ))}
                    </div>
                </nav>
            </div>
        </aside>
    );
}

function DocsSidebarGroup({
    group,
    activePage,
    isOpen,
    onToggle,
    onNavigate,
}: {
    group: DocsNavGroup & { pages: DocsPage[] };
    activePage: DocsPage;
    isOpen: boolean;
    onToggle: () => void;
    onNavigate?: () => void;
}) {
    const navigate = useNavigate();
    const isActiveGroup = group.pages.some((page) => page.slug === activePage.slug);
    const handleToggle = () => {
        if (isOpen || group.pages.length !== 1) {
            onToggle();
            return;
        }

        const [onlyPage] = group.pages;
        onToggle();
        navigate(docsPath(onlyPage.slug));
        onNavigate?.();
    };

    return (
        <div>
            <button
                type="button"
                onClick={handleToggle}
                className={`flex w-full items-center justify-between rounded-md px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide transition-colors ${
                    isActiveGroup ? "text-primary" : "text-text-muted hover:bg-white/5 hover:text-text-secondary"
                }`}
            >
                <span>{group.title}</span>
                <ChevronDown className={`h-3.5 w-3.5 transition-transform ${isOpen ? "" : "-rotate-90"}`} />
            </button>
            {isOpen && (
                <div className="mt-1 space-y-1 border-l border-border-subtle pl-2">
                    {group.pages.map((page) => (
                        <DocsSidebarLink
                            key={page.slug}
                            page={page}
                            activePage={activePage}
                            nested
                            onNavigate={onNavigate}
                        />
                    ))}
                </div>
            )}
        </div>
    );
}

function DocsSidebarLink({
    page,
    activePage,
    nested = false,
    onNavigate,
}: {
    page: DocsPage;
    activePage: DocsPage;
    nested?: boolean;
    onNavigate?: () => void;
}) {
    const isActive = page.slug === activePage.slug;

    return (
        <Link
            to={docsPath(page.slug)}
            onClick={onNavigate}
            className={`flex items-start rounded-md px-3 py-2.5 transition-colors ${
                isActive
                    ? "bg-primary/10 text-text-primary"
                    : "text-text-secondary hover:bg-white/5 hover:text-text-primary"
            } ${nested ? "py-2" : ""}`}
        >
            <span className="min-w-0">
                <span className="block truncate text-sm font-semibold leading-5">{page.navTitle}</span>
            </span>
        </Link>
    );
}

function DocsArticle({ activePage }: DocsArticleProps) {
    return (
        <div className="min-w-0">
            <article className="border border-border-light bg-card/30 rounded-lg">
                <header className="border-b border-border-light p-5">
                    <h2 className="text-3xl font-semibold">{activePage.title}</h2>
                </header>

                <div className="p-5">
                    {activePage.sections.map((section) => (
                        <DocsSectionContent key={section.id} section={section} />
                    ))}
                </div>
            </article>

            <DocsPager activePage={activePage} />
        </div>
    );
}

function DocsSectionContent({ section }: DocsSectionContentProps) {
    return (
        <section id={section.id} className="scroll-mt-24 border-t border-border-light py-7 first:border-t-0 first:pt-0">
            <h3 className="text-xl font-semibold">{section.title}</h3>
            {section.paragraphs && (
                <div className="mt-3 flex flex-col gap-3">
                    {section.paragraphs.map((paragraph) => (
                        <p key={paragraph} className="max-w-3xl text-sm leading-relaxed text-text-secondary">
                            {renderInlineText(paragraph)}
                        </p>
                    ))}
                </div>
            )}
            {section.bullets && (
                <ul className="mt-4 list-disc space-y-2 pl-5">
                    {section.bullets.map((bullet) => (
                        <li key={bullet} className="text-sm leading-relaxed text-text-secondary">
                            {renderInlineText(bullet)}
                        </li>
                    ))}
                </ul>
            )}
            {section.links && (
                <div className="mt-4 grid gap-2">
                    {section.links.map((link) => (
                        <a
                            key={link.href}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="group rounded-md border border-border-light bg-card/40 p-3 transition-colors hover:border-primary/30 hover:bg-card-elevated"
                        >
                            <span className="flex items-center gap-2 text-sm font-semibold text-text-primary transition-colors group-hover:text-primary">
                                {link.label}
                                <ExternalLink className="h-3.5 w-3.5" />
                            </span>
                        </a>
                    ))}
                </div>
            )}
            {section.callout && (
                <div className="mt-5 border-l-2 border-primary/60 bg-primary/[0.04] px-4 py-3">
                    <p className="text-sm leading-relaxed text-text-secondary">{section.callout}</p>
                </div>
            )}
            {section.code && (
                <pre className="mt-5 overflow-x-auto rounded-md border border-border-light bg-card-elevated/40 p-4 text-xs leading-relaxed text-text-secondary">
                    <code className="font-mono">{section.code}</code>
                </pre>
            )}
        </section>
    );
}

function DocsPager({ activePage }: DocsArticleProps) {
    const activeIndex = docsNavigationPages.findIndex((page) => page.slug === activePage.slug);
    const previousPage = activeIndex > 0 ? docsNavigationPages[activeIndex - 1] : undefined;
    const nextPage = activeIndex < docsNavigationPages.length - 1 ? docsNavigationPages[activeIndex + 1] : undefined;
    const pagerButtonClass =
        "group flex min-w-0 flex-1 flex-col rounded-md border border-border-light bg-card/40 px-4 py-3 transition-colors hover:border-primary/30 hover:bg-card-elevated";

    return (
        <nav className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2" aria-label="Docs pagination">
            {previousPage ? (
                <Link to={docsPath(previousPage.slug)} className={pagerButtonClass}>
                    <span className="text-xs text-text-muted">Previous</span>
                    <span className="truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-primary">
                        {previousPage.navTitle}
                    </span>
                </Link>
            ) : (
                <div className="hidden sm:block" />
            )}
            {nextPage && (
                <Link to={docsPath(nextPage.slug)} className={`${pagerButtonClass} text-left sm:text-right`}>
                    <span className="text-xs text-text-muted">Next</span>
                    <span className="inline-flex items-center gap-1 truncate text-sm font-semibold text-text-primary transition-colors group-hover:text-primary sm:justify-end">
                        {nextPage.navTitle}
                        <ArrowRight className="h-3.5 w-3.5 shrink-0 transition-transform group-hover:translate-x-0.5" />
                    </span>
                </Link>
            )}
        </nav>
    );
}

export function Docs() {
    const { slug } = useParams();
    const [mobileNavOpen, setMobileNavOpen] = useState(false);
    const activeSlug = slug ?? docsNavigationPages[0].slug;
    const activePage = docsBySlug.get(activeSlug);

    if (!activePage) {
        return <Navigate to="/docs" replace />;
    }

    return (
        <div className="min-h-full">
            <Helmet>
                <title>{activePage.title} | Govex Docs</title>
                <meta
                    name="description"
                    content="Govex docs for Sui multisigs, proposal workflows, vault controls, and team operations."
                />
            </Helmet>

            <Drawer
                isOpen={mobileNavOpen}
                onClose={() => setMobileNavOpen(false)}
                position="left"
                className="lg:hidden !top-[52px] !z-[60] !w-[min(20rem,calc(100vw-3rem))] overflow-hidden rounded-r-lg"
                zIndexAboveHeader={false}
            >
                <div className="flex h-full flex-col">
                    <div className="flex shrink-0 items-center justify-between border-b border-border-light px-4 py-3">
                        <div className="text-sm font-semibold text-text-primary">Docs</div>
                        <button
                            type="button"
                            onClick={() => setMobileNavOpen(false)}
                            className="flex h-8 w-8 items-center justify-center rounded-md text-text-muted transition-colors hover:bg-white/5 hover:text-text-primary"
                            aria-label="Close docs navigation"
                            title="Close docs navigation"
                        >
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <DocsSidebar activePage={activePage} onNavigate={() => setMobileNavOpen(false)} variant="drawer" />
                </div>
            </Drawer>

            <div className="route-container pt-5 pb-14">
                <div className="mb-4 flex w-full justify-start lg:hidden">
                    <button
                        type="button"
                        onClick={() => setMobileNavOpen(true)}
                        className="flex h-11 w-11 items-center justify-center text-primary transition-colors hover:text-primary-light focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary-light"
                        aria-label="Open docs navigation"
                        title="Open docs navigation"
                    >
                        <Menu className="h-6 w-6" />
                    </button>
                </div>
                <div className="grid w-full max-w-7xl mx-auto gap-5 lg:grid-cols-[260px_minmax(0,1fr)]">
                    <div className="hidden lg:block">
                        <DocsSidebar activePage={activePage} />
                    </div>
                    <DocsArticle activePage={activePage} />
                </div>
            </div>
        </div>
    );
}
