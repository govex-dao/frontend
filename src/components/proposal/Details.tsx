import { useMemo, useState, type ReactNode } from "react";
import { FileText, Info } from "lucide-react";
import type { Proposal as ApiProposal, ProposalState } from "@/types/Proposal";
import { formatUnits } from "@/lib/units";
import type { PageProposal } from "@/lib/proposalAdapter";
import { getOutcomeClass } from "@/lib/outcomes";
import { formatDateTime } from "@/lib/time";
import { formatNumber } from "@/lib/formatNumber";
import { ExplorerLink } from "../ExplorerLink";
import { SidebarNav, type SidebarNavItem } from "../navigation/SidebarNav";
import { Card } from "../Card";
import { ActionCard } from "./actions/Card";

interface Props {
    proposal: PageProposal;
    apiProposal?: ApiProposal;
}

type TabType = "description" | "advanced";
type DisplayProposalState = Exclude<ProposalState, "initialized">;

const TABS: SidebarNavItem[] = [
    {
        id: "description",
        label: "Description",
        icon: <FileText className="w-4 h-4" />,
    },
    {
        id: "advanced",
        label: "Advanced",
        icon: <Info className="w-4 h-4" />,
    },
];

const LIFECYCLE_STAGE_ORDER: Exclude<DisplayProposalState, "awaiting_execution">[] = [
    "created",
    "active",
    "finalized",
    "executed",
];

const STAGE_TITLES: Record<DisplayProposalState, string> = {
    created: "Created",
    active: "Trading Started",
    awaiting_execution: "Awaiting Execution",
    finalized: "Finalized",
    executed: "Executed",
};

function toDisplayProposalState(state: ProposalState | undefined): DisplayProposalState | undefined {
    if (!state) return undefined;
    if (state === "initialized") return "created";
    return state;
}

function parseMs(value: string | number | bigint | null | undefined): number | null {
    if (value == null) return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatDurationFromMs(msRaw: string | null | undefined): string {
    const ms = parseMs(msRaw);
    if (ms == null) return "N/A";

    const totalSeconds = Math.max(0, Math.floor(ms / 1000));
    const days = Math.floor(totalSeconds / 86400);
    const hours = Math.floor((totalSeconds % 86400) / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const parts: string[] = [];
    if (days > 0) parts.push(`${days}d`);
    if (hours > 0) parts.push(`${hours}h`);
    if (minutes > 0) parts.push(`${minutes}m`);
    if (parts.length === 0 || (days === 0 && hours === 0 && minutes === 0)) {
        parts.push(`${seconds}s`);
    }
    return parts.join(" ");
}

function formatBpsWithPercent(bpsRaw: string | null | undefined): string {
    if (bpsRaw == null) return "N/A";
    const bps = Number(bpsRaw);
    if (!Number.isFinite(bps)) return "N/A";
    const percent = bps / 100;
    const percentText = Number.isInteger(percent) ? percent.toFixed(0) : percent.toFixed(2);
    return `${bps} bps (${percentText}%)`;
}

function formatThreshold(raw: string | null | undefined): string {
    if (raw == null) return "N/A";
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return "N/A";
    const percent = (parsed / 100_000) * 100; // threshold base is 100,000
    return `${percent.toFixed(2)}%`;
}

function formatStageDate(ms: number | null): string {
    if (ms == null) return "N/A";
    return formatDateTime(new Date(ms));
}

function formatTokenFee(raw: string | null | undefined, decimals: number, symbol: string): string {
    if (raw == null) return "N/A";
    try {
        return `${formatUnits(BigInt(raw), decimals, { maxFractionDigits: Math.min(decimals, 4) })} ${symbol}`;
    } catch {
        return "N/A";
    }
}

export const DetailRow = ({ label, value }: { label: string; value: string | ReactNode }) => (
    <div className="flex justify-between items-center gap-3">
        <span className="text-sm text-text-tertiary">{label}</span>
        {typeof value === "string" ? (
            <span className="text-sm font-mono text-text-primary font-semibold text-right">{value}</span>
        ) : (
            value
        )}
    </div>
);

function StateHistoryItem({ title, value }: { title: string; value: string }) {
    return (
        <div>
            <div className="text-sm font-semibold text-text-primary mb-1">{title}</div>
            <div className="text-xs font-mono text-text-tertiary">{value}</div>
        </div>
    );
}

function ProposalAdvancedPanel({ proposal, apiProposal }: Props) {
    const createdAtMs = parseMs(apiProposal?.timestamp);
    const tradingStartMs = parseMs(apiProposal?.trading_started_at);
    const executedAtMs = parseMs(apiProposal?.execution_at);

    const currentState = toDisplayProposalState(apiProposal?.state);

    const stateRows = useMemo(() => {
        const rowValues: Record<(typeof LIFECYCLE_STAGE_ORDER)[number], string> = {
            created: formatStageDate(createdAtMs),
            active: formatStageDate(tradingStartMs),
            finalized: "N/A",
            executed: formatStageDate(executedAtMs),
        };
        return LIFECYCLE_STAGE_ORDER.map((state) => ({
            title: STAGE_TITLES[state],
            value: rowValues[state],
        }));
    }, [createdAtMs, executedAtMs, tradingStartMs]);

    const currentStage = currentState ? STAGE_TITLES[currentState] : "N/A";

    const protocolFeeBps = apiProposal?.protocol_fee_bps ?? null;
    const conditionalAmmFeeBps = apiProposal?.dao_conditional_amm_fee_bps ?? null;
    const twapDelay = apiProposal?.dao_twap_start_delay ?? null;
    const twapThreshold = apiProposal?.dao_twap_threshold ?? null;
    const proposalFeeSymbol = apiProposal?.dao_fee_in_asset_token
        ? apiProposal?.asset_symbol || "ASSET"
        : apiProposal?.stable_symbol || "STABLE";
    const proposalFeeDecimals = apiProposal?.dao_fee_in_asset_token
        ? apiProposal?.asset_decimals || 9
        : apiProposal?.stable_decimals || 6;
    const showTwapMetrics = apiProposal?.version?.trim().toLowerCase() !== "v1";

    // Total trading fee = protocol fee + conditional AMM fee (if both known)
    const totalTradingFeeBps = useMemo(() => {
        if (protocolFeeBps == null && conditionalAmmFeeBps == null) return null;
        const protocol = protocolFeeBps != null ? Number(protocolFeeBps) : 0;
        const conditional = conditionalAmmFeeBps != null ? Number(conditionalAmmFeeBps) : 0;
        if (!Number.isFinite(protocol) || !Number.isFinite(conditional)) return null;
        return String(protocol + conditional);
    }, [protocolFeeBps, conditionalAmmFeeBps]);

    return (
        <div className="space-y-6">
            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Proposal Details</h3>
                <div className="space-y-2 bg-card-elevated border border-border/50 rounded-lg p-4">
                    <DetailRow label="Current Stage" value={currentStage} />
                    <DetailRow label="Conditional Trading Fee" value={formatBpsWithPercent(totalTradingFeeBps)} />
                    {showTwapMetrics && <DetailRow label="TWAP Threshold" value={formatThreshold(twapThreshold)} />}
                    <DetailRow
                        label="Proposal Creation Fee"
                        value={formatTokenFee(
                            apiProposal?.dao_proposal_creation_fee,
                            proposalFeeDecimals,
                            proposalFeeSymbol
                        )}
                    />
                    <DetailRow label="Org ID" value={<ExplorerLink id={proposal.orgId} type="address" />} />
                    <DetailRow
                        label="Proposer"
                        value={
                            apiProposal?.proposer ? (
                                <ExplorerLink id={apiProposal.proposer} type="address" />
                            ) : (
                                <span className="text-xs text-text-secondary">N/A</span>
                            )
                        }
                    />
                    {showTwapMetrics && (
                        <DetailRow
                            label="TWAP Start Delay"
                            value={
                                <span className="text-xs text-text-secondary">{formatDurationFromMs(twapDelay)}</span>
                            }
                        />
                    )}
                </div>
            </div>

            <div className="space-y-3">
                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Lifecycle</h3>
                <div className="space-y-2 bg-card-elevated border border-border/50 rounded-lg p-4">
                    {stateRows.map((row) => (
                        <StateHistoryItem key={row.title} title={row.title} value={row.value} />
                    ))}
                </div>
            </div>
        </div>
    );
}

export function ProposalDetails(props: Props) {
    const { proposal, apiProposal } = props;
    const [drawerTab, setDrawerTab] = useState<TabType>("description");
    const showTwapMetrics = apiProposal?.version?.trim().toLowerCase() !== "v1";

    const OutcomeMetric = ({ label, value }: { label: string; value: number | null }) => (
        <div className="flex justify-between">
            <span className="text-text-tertiary">{label}</span>
            <span className="font-mono text-text-secondary">{value != null ? `$${formatNumber(value)}` : "--"}</span>
        </div>
    );

    return (
        <div className="flex flex-col lg:flex-row h-full w-full">
            <div className="-ml-4 -mt-4 -mb-4">
                <SidebarNav
                    className="w-48!"
                    items={TABS}
                    activeItem={drawerTab}
                    onItemClick={(id: string) => setDrawerTab(id as TabType)}
                />
            </div>

            <div className="flex-1 overflow-y-auto scrollbar-gutter-stable pl-4 sm:pl-6 sm:p-2">
                {drawerTab === "description" ? (
                    <div className="space-y-5">
                        <div className="space-y-3">
                            <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                                Description
                            </h3>
                            {proposal.description && (
                                <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-line">
                                    {proposal.description}
                                </p>
                            )}
                        </div>

                        <div className="space-y-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                                <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">
                                    Outcomes
                                </h3>
                                {proposal.txDigest && (
                                    <div className="flex items-center gap-1.5 text-xs text-text-tertiary">
                                        <span>Creation tx</span>
                                        <ExplorerLink
                                            id={proposal.txDigest}
                                            type="transaction"
                                            className="text-text-secondary"
                                        />
                                    </div>
                                )}
                            </div>
                            <div className="space-y-2">
                                {proposal.outcomes?.map((outcome, index) => (
                                    <div
                                        key={index}
                                        className="bg-card-elevated border border-border/50 rounded-lg p-4 space-y-4"
                                    >
                                        <div>
                                            <div className="flex items-center gap-2 mb-2">
                                                <div
                                                    className={`w-2 h-2 rounded-full ${getOutcomeClass(index, proposal.outcomes?.length || 0, "normal")}`}
                                                />
                                                <span className="text-sm font-semibold text-text-primary">
                                                    {outcome.message}
                                                </span>
                                            </div>
                                            {proposal.volume > 0 && (
                                                <div className="space-y-1.5 text-xs">
                                                    <OutcomeMetric label="Current Price" value={outcome.price} />
                                                    {showTwapMetrics && (
                                                        <OutcomeMetric label="TWAP" value={outcome.twap} />
                                                    )}
                                                    <OutcomeMetric label="Volume" value={outcome.volume || 0} />
                                                </div>
                                            )}
                                        </div>

                                        {outcome.actions && outcome.actions.length > 0 && (
                                            <div className="space-y-2">
                                                <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                                                    Actions ({outcome.actions.length})
                                                </div>
                                                <div className="flex flex-col gap-2">
                                                    {outcome.actions.map((action, actionIndex) => (
                                                        <ActionCard
                                                            key={action.id}
                                                            number={actionIndex + 1}
                                                            action={action}
                                                        />
                                                    ))}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                ) : (
                    <ProposalAdvancedPanel {...props} />
                )}
            </div>
        </div>
    );
}

export function ProposalAdvancedDetails(props: Props) {
    return (
        <Card className="space-y-6">
            <ProposalAdvancedPanel {...props} />
        </Card>
    );
}
