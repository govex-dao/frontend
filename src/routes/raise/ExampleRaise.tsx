import { useMemo, type ReactNode } from "react";
import { Helmet } from "react-helmet-async";
import { Link } from "react-router";
import {
    ArrowLeft,
    ArrowUpRight,
    CalendarClock,
    CheckCircle2,
    CircleDollarSign,
    Coins,
    Gauge,
    Landmark,
    LockKeyhole,
    ShieldCheck,
    Users,
    type LucideIcon,
} from "lucide-react";
import { Badge } from "@/components/Badge";
import { Card, CardContent } from "@/components/Card";
import { MetricItem } from "@/components/MetricItem";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
import { LiveChip } from "@/components/badges/LiveChip";
import { formatNumber, formatNumberWithCommas } from "@/lib/formatNumber";
import { getTimeRemainingLabel } from "@/lib/getDaysRemaining";
import { getRaiseUiStatus } from "@/lib/raiseStatus";
import {
    EXAMPLE_DAO_ACCOUNT_ID,
    EXAMPLE_RAISE_OBJECT_ID,
    exampleContributors,
    exampleFailureActions,
    exampleSuccessActions,
    exampleTimeline,
    getExampleRaiseView,
    type ExampleAction,
    type ExampleTimelineItem,
} from "./exampleRaiseData";

function formatUsd(amount: number): string {
    return `$${formatNumber(amount)}`;
}

function formatPercent(value: number): string {
    return `${value.toFixed(value >= 100 ? 0 : 1)}%`;
}

function shortAddress(address: string): string {
    return `${address.slice(0, 8)}...${address.slice(-6)}`;
}

function GlassBox({ children, className = "" }: { children: ReactNode; className?: string }) {
    return <div className={`glass-flow-panel home-tier-panel rounded-lg ${className}`}>{children}</div>;
}

function ProgressBar({ value, tone = "primary" }: { value: number; tone?: "primary" | "success" | "warning" }) {
    const color =
        tone === "success"
            ? "from-success to-success-light"
            : tone === "warning"
              ? "from-warning to-warning-light"
              : "from-primary to-primary-light";

    return (
        <div className="h-2.5 overflow-hidden rounded-full bg-white/[0.07]">
            <div
                className={`h-full rounded-full bg-linear-to-r ${color} transition-all duration-700`}
                style={{ width: `${Math.min(Math.max(value, 0), 100)}%` }}
            />
        </div>
    );
}

function MetricTile({
    label,
    value,
    suffix,
    icon,
}: {
    label: string;
    value: string;
    suffix?: string;
    icon: ReactNode;
}) {
    return (
        <GlassBox className="p-3">
            <MetricItem label={label} value={value} suffix={suffix} size="lg" icon={icon} />
        </GlassBox>
    );
}

function TermRow({ label, value }: { label: string; value: ReactNode }) {
    return (
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle py-3 last:border-b-0">
            <p className="text-xs font-medium uppercase tracking-wide text-text-muted">{label}</p>
            <div className="min-w-0 text-right text-sm font-semibold text-text-primary">{value}</div>
        </div>
    );
}

const timelineStyles: Record<ExampleTimelineItem["status"], string> = {
    complete: "border-success/30 bg-success/10 text-success",
    current: "border-primary/35 bg-primary/10 text-primary-light",
    pending: "border-white/[0.08] bg-white/[0.04] text-text-muted",
};

const treasuryPlan: Array<{ label: string; percent: number; tone?: "success" | "warning" }> = [
    { label: "DAO treasury", percent: 68, tone: "success" },
    { label: "Liquidity pool", percent: 22 },
    { label: "Protective bid reserve", percent: 10, tone: "warning" },
];

const controlTiles: Array<{ label: string; value: string; Icon: LucideIcon }> = [
    { label: "Min ticket", value: "$1k", Icon: Coins },
    { label: "Max ticket", value: "$250k", Icon: Coins },
    { label: "Review", value: "24h", Icon: ShieldCheck },
    { label: "Unlock", value: "DAO", Icon: LockKeyhole },
];

function Timeline() {
    return (
        <section className="space-y-3">
            <div className="flex items-center gap-2">
                <CalendarClock className="h-4 w-4 text-primary" />
                <h2 className="text-lg font-semibold">Lifecycle</h2>
            </div>
            <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4">
                {exampleTimeline.map((item, index) => (
                    <GlassBox key={item.label} className="p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <span className="text-xs font-semibold text-text-muted">0{index + 1}</span>
                            <span
                                className={`rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${timelineStyles[item.status]}`}
                            >
                                {item.status}
                            </span>
                        </div>
                        <h3 className="text-sm font-semibold text-text-primary">{item.label}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-text-muted">{item.detail}</p>
                    </GlassBox>
                ))}
            </div>
        </section>
    );
}

function ActionPath({
    title,
    caption,
    actions,
    tone,
}: {
    title: string;
    caption: string;
    actions: ExampleAction[];
    tone: "success" | "warning";
}) {
    const iconClass = tone === "success" ? "text-success" : "text-warning";
    const badgeVariant = tone === "success" ? "green" : "yellow";

    return (
        <section className="space-y-3">
            <div>
                <h2 className="text-lg font-semibold">{title}</h2>
                <p className="mt-1 text-sm text-text-muted">{caption}</p>
            </div>
            <div className="grid grid-cols-1 gap-3 xl:grid-cols-3">
                {actions.map((action, index) => (
                    <GlassBox key={action.title} className="p-4">
                        <div className="mb-3 flex items-center justify-between gap-3">
                            <div
                                className={`flex h-8 w-8 items-center justify-center rounded-lg bg-white/[0.055] ${iconClass}`}
                            >
                                <CheckCircle2 className="h-4 w-4" />
                            </div>
                            <Badge variant={badgeVariant}>{action.status === "ready" ? "Ready" : "Queued"}</Badge>
                        </div>
                        <p className="text-xs font-semibold uppercase tracking-wide text-text-muted">
                            Action {index + 1}
                        </p>
                        <h3 className="mt-1 text-sm font-semibold text-text-primary">{action.title}</h3>
                        <p className="mt-2 text-sm leading-relaxed text-text-muted">{action.detail}</p>
                        <p className="mt-3 break-all rounded-md border border-border-subtle bg-black/20 px-2 py-1.5 font-mono text-[11px] text-text-tertiary">
                            {action.packageLabel}
                        </p>
                    </GlassBox>
                ))}
            </div>
        </section>
    );
}

function ContributorTable() {
    return (
        <Card variant="glass" className="home-tier-panel">
            <CardContent>
                <div className="mb-4 flex items-center justify-between gap-3">
                    <div>
                        <h2 className="text-lg font-semibold">Top Contributors</h2>
                        <p className="mt-1 text-sm text-text-muted">
                            Largest accepted commitments in the example raise.
                        </p>
                    </div>
                    <Badge emphasize={exampleContributors.length} label="shown" />
                </div>
                <div className="overflow-x-auto">
                    <table className="w-full table-fixed">
                        <thead>
                            <tr className="border-b border-border-subtle">
                                <th className="w-[38%] py-2 pr-3 text-left text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Contributor
                                </th>
                                <th className="w-[34%] py-2 px-3 text-left text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Address
                                </th>
                                <th className="w-[18%] py-2 px-3 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    Amount
                                </th>
                                <th className="w-[10%] py-2 pl-3 text-right text-[10px] font-semibold uppercase tracking-wide text-text-muted">
                                    %
                                </th>
                            </tr>
                        </thead>
                        <tbody>
                            {exampleContributors.map((contributor) => (
                                <tr key={contributor.address} className="border-b border-border-subtle last:border-b-0">
                                    <td className="py-3 pr-3">
                                        <p className="truncate text-sm font-semibold text-text-primary">
                                            {contributor.name}
                                        </p>
                                    </td>
                                    <td className="py-3 px-3">
                                        <CopyableAddress
                                            address={contributor.address}
                                            displayText={shortAddress(contributor.address)}
                                            textClassName="text-xs text-text-muted"
                                            copyLabel="Copy contributor address"
                                            toastMessage="Contributor address copied"
                                        />
                                    </td>
                                    <td className="py-3 px-3 text-right font-mono text-sm text-text-primary">
                                        ${formatNumberWithCommas(contributor.amount)}
                                    </td>
                                    <td className="py-3 pl-3 text-right text-sm text-text-muted">
                                        {contributor.allocation}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </CardContent>
        </Card>
    );
}

function ObjectIdsCard() {
    return (
        <Card variant="glass" className="home-tier-panel">
            <CardContent>
                <h2 className="mb-3 text-lg font-semibold">Objects</h2>
                <div className="space-y-1">
                    <TermRow
                        label="Raise"
                        value={
                            <CopyableAddress
                                address={EXAMPLE_RAISE_OBJECT_ID}
                                displayText={shortAddress(EXAMPLE_RAISE_OBJECT_ID)}
                                textClassName="text-xs"
                                copyLabel="Copy raise object ID"
                                toastMessage="Raise object ID copied"
                            />
                        }
                    />
                    <TermRow
                        label="DAO account"
                        value={
                            <CopyableAddress
                                address={EXAMPLE_DAO_ACCOUNT_ID}
                                displayText={shortAddress(EXAMPLE_DAO_ACCOUNT_ID)}
                                textClassName="text-xs"
                                copyLabel="Copy DAO account ID"
                                toastMessage="DAO account ID copied"
                            />
                        }
                    />
                    <TermRow label="Network" value="Sui mainnet" />
                </div>
            </CardContent>
        </Card>
    );
}

export function ExampleRaise() {
    const raise = useMemo(() => getExampleRaiseView(), []);
    const status = getRaiseUiStatus(raise._raw);
    const goalAmount = raise.maxRaise ?? raise.raising;
    const progress = goalAmount > 0 ? (raise.raised / goalAmount) * 100 : 0;
    const minProgress = raise.raising > 0 ? (raise.raised / raise.raising) * 100 : 0;
    const openCapacity = Math.max(goalAmount - raise.pendingReserved - raise.raised, 0);
    const tokenPrice = raise.tokensForSale > 0 ? goalAmount / raise.tokensForSale : 0;

    return (
        <div className="route-container min-h-full gap-6 pb-16">
            <Helmet>
                <title>Example Raise</title>
            </Helmet>
            <Breadcrumbs
                items={[{ label: "Home", href: "/" }, { label: "Raises", href: "/raises" }, { label: "Example" }]}
            />

            <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                        <LiveChip color="green" animated />
                        <Badge variant="blue">Example raise</Badge>
                    </div>
                    <h1 className="mt-2 text-2xl font-semibold tracking-tight sm:text-3xl">{raise.name}</h1>
                    <p className="mt-2 max-w-2xl text-sm text-text-muted">Example raise for product demonstration.</p>
                </div>
                <Link
                    to="/raises"
                    className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/[0.085] bg-white/[0.045] px-3 py-2 text-xs font-medium text-text-secondary backdrop-blur-md transition-colors hover:bg-white/[0.075] hover:text-text-primary"
                >
                    <ArrowLeft className="h-3.5 w-3.5" />
                    Back
                </Link>
            </div>

            <section className="glass-flow-panel relative min-h-[420px] overflow-hidden rounded-xl">
                <img src={raise.headerImage} alt="" className="absolute inset-0 z-0 h-full w-full object-cover" />
                <div className="absolute inset-0 z-0 bg-linear-to-r from-black/85 via-black/50 to-black/10" />
                <div className="absolute inset-0 z-0 bg-linear-to-t from-black/65 via-transparent to-black/20" />
                <div className="relative z-10 flex min-h-[420px] flex-col justify-between gap-8 p-4 sm:p-6 lg:p-8">
                    <div className="flex flex-wrap items-center gap-2">
                        {raise.website && (
                            <a
                                href={raise.website}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 rounded-md border border-white/15 bg-black/30 px-2.5 py-1.5 text-xs font-medium text-white/75 backdrop-blur-md transition-colors hover:bg-white/10 hover:text-white"
                            >
                                Example site
                                <ArrowUpRight className="h-3 w-3" />
                            </a>
                        )}
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-xs font-semibold text-primary-light backdrop-blur-md">
                            Example raise
                        </span>
                    </div>

                    <div className="max-w-3xl">
                        <div className="mb-4 flex items-end gap-4">
                            {raise.image && (
                                <img
                                    src={raise.image}
                                    alt={`${raise.name} mark`}
                                    className="h-16 w-16 rounded-xl border border-white/15 object-cover shadow-2xl sm:h-20 sm:w-20"
                                />
                            )}
                            <div>
                                <p className="text-sm font-semibold uppercase tracking-wide text-primary-light">
                                    Launchpad raise
                                </p>
                                <h2 className="mt-1 text-3xl font-semibold tracking-tight text-white sm:text-4xl">
                                    {raise.assetSymbol} treasury launch
                                </h2>
                            </div>
                        </div>
                        <p className="max-w-2xl text-base leading-relaxed text-white/75 sm:text-lg">
                            {raise.description}
                        </p>
                    </div>

                    <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
                        <MetricTile
                            label="Raised"
                            value={formatUsd(raise.raised)}
                            icon={<CircleDollarSign className="h-4 w-4" />}
                        />
                        <MetricTile label="Cap" value={formatUsd(goalAmount)} icon={<Gauge className="h-4 w-4" />} />
                        <MetricTile
                            label="Contributors"
                            value={formatNumberWithCommas(raise._raw.contributor_count ?? 0)}
                            icon={<Users className="h-4 w-4" />}
                        />
                        <MetricTile
                            label="Time left"
                            value={getTimeRemainingLabel(raise.raiseEnd).replace(" left", "")}
                            icon={<CalendarClock className="h-4 w-4" />}
                        />
                    </div>
                </div>
            </section>

            <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_380px]">
                <main className="space-y-6">
                    <Card variant="glass" className="home-tier-panel">
                        <CardContent>
                            <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
                                <div>
                                    <h2 className="text-lg font-semibold">Funding Progress</h2>
                                    <p className="mt-1 text-sm text-text-muted">
                                        {formatPercent(progress)} of cap, {formatPercent(minProgress)} of minimum.
                                    </p>
                                </div>
                                <Badge variant={status === "active" ? "green" : "blue"}>
                                    {status === "active" ? "Funding" : status}
                                </Badge>
                            </div>
                            <ProgressBar value={progress} />
                            <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
                                <GlassBox className="p-3">
                                    <MetricItem label="Minimum" value={formatUsd(raise.raising)} size="base" />
                                </GlassBox>
                                <GlassBox className="p-3">
                                    <MetricItem label="Open capacity" value={formatUsd(openCapacity)} size="base" />
                                </GlassBox>
                                <GlassBox className="p-3">
                                    <MetricItem label="Reserved" value={formatUsd(raise.pendingReserved)} size="base" />
                                </GlassBox>
                                <GlassBox className="p-3">
                                    <MetricItem label="Token price" value={`$${tokenPrice.toFixed(3)}`} size="base" />
                                </GlassBox>
                            </div>
                        </CardContent>
                    </Card>

                    <Timeline />

                    <ActionPath
                        title="Success Actions"
                        caption="Queued after the raise settles successfully."
                        actions={exampleSuccessActions}
                        tone="success"
                    />

                    <ActionPath
                        title="Failure Actions"
                        caption="Queued if the raise closes below the minimum."
                        actions={exampleFailureActions}
                        tone="warning"
                    />

                    <ContributorTable />
                </main>

                <aside className="space-y-5">
                    <Card variant="glass" className="home-tier-panel">
                        <CardContent>
                            <h2 className="mb-3 text-lg font-semibold">Raise Terms</h2>
                            <div className="space-y-1">
                                <TermRow label="Asset" value={raise.assetSymbol} />
                                <TermRow label="Stable coin" value={raise._raw.stable_symbol ?? "USDC"} />
                                <TermRow label="Tokens for sale" value={formatNumberWithCommas(raise.tokensForSale)} />
                                <TermRow label="Minimum raise" value={formatUsd(raise.raising)} />
                                <TermRow label="Maximum raise" value={formatUsd(goalAmount)} />
                                <TermRow label="Starts" value={raise.raiseStart.toLocaleDateString()} />
                                <TermRow label="Ends" value={raise.raiseEnd.toLocaleDateString()} />
                            </div>
                        </CardContent>
                    </Card>

                    <Card variant="glass" className="home-tier-panel">
                        <CardContent>
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-success/10 text-success">
                                    <Landmark className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Treasury Plan</h2>
                                    <p className="text-sm text-text-muted">Accepted funds after settlement.</p>
                                </div>
                            </div>
                            <div className="space-y-3">
                                {treasuryPlan.map((item) => (
                                    <div key={item.label}>
                                        <div className="mb-1 flex justify-between text-xs text-text-muted">
                                            <span>{item.label}</span>
                                            <span>{item.percent}%</span>
                                        </div>
                                        <ProgressBar value={item.percent} tone={item.tone} />
                                    </div>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <Card variant="glass" className="home-tier-panel">
                        <CardContent>
                            <div className="mb-4 flex items-center gap-3">
                                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary">
                                    <LockKeyhole className="h-5 w-5" />
                                </div>
                                <div>
                                    <h2 className="text-lg font-semibold">Controls</h2>
                                    <p className="text-sm text-text-muted">Contribution and review settings.</p>
                                </div>
                            </div>
                            <div className="grid grid-cols-2 gap-3">
                                {controlTiles.map(({ label, value, Icon }) => (
                                    <GlassBox key={label} className="p-3">
                                        <MetricItem
                                            label={label}
                                            value={value}
                                            size="base"
                                            icon={<Icon className="h-4 w-4" />}
                                        />
                                    </GlassBox>
                                ))}
                            </div>
                        </CardContent>
                    </Card>

                    <ObjectIdsCard />
                </aside>
            </div>

            <p className="text-xs text-text-muted">Example raise preview.</p>
        </div>
    );
}
