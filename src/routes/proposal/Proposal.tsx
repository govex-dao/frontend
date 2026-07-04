import { useParams } from "react-router";
import { useState, useEffect, useMemo } from "react";
import { Helmet } from "react-helmet-async";
import { ExplorerLink } from "@/components/ExplorerLink";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { NotFound } from "@/components/navigation/NotFound";
import { useProposal } from "@/hooks/api";
import { toPageProposal, type PageProposal, type PageOutcome } from "@/lib/proposalAdapter";
import { Modal } from "@/components/overlays/Modal";
import { Card } from "@/components/Card";
import { ProposalAdvancedDetails, ProposalDetails } from "@/components/proposal/Details";
import { getTimeRemaining, formatTimeRemaining } from "@/lib/time";
import { Chart } from "@/components/proposal/trade/Chart";
import { RecentTrades } from "@/components/proposal/trade/RecentTrades";
import { TabSelector } from "@/components/TabSelector";
import { TradeForm } from "@/components/proposal/trade/swap/Form";
import { ProposalFinalResults } from "@/components/proposal/FinalResults";
import { PreTradingNotice } from "@/components/proposal/PreTradingNotice";
import { ExecutionNotice } from "@/components/proposal/ExecutionNotice";
import { ProposalStats } from "@/components/proposal/Stats";
import { getOutcomeClass } from "@/lib/outcomes";
import { OutcomeDetailsModal } from "@/components/proposal/OutcomeDetailsModal";
import { ActionCard } from "@/components/proposal/actions/Card";
import { TwapHeader, type OutcomeWithIndex } from "@/components/proposal/TwapHeader";
import { withEffectiveProposalState } from "@/lib/proposalState";
import { isSupportedProtocolProposal } from "@/lib/sdk";

function parseMs(raw: string | null | undefined): number | null {
    if (raw == null) return null;
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : null;
}

function formatBase100kPercent(raw: string | null | undefined, fallback: string): string {
    if (raw == null) return fallback;
    const parsed = Number(raw);
    if (!Number.isFinite(parsed)) return fallback;
    const percent = (parsed / 100_000) * 100; // threshold base is 100,000
    const text = percent.toFixed(2).replace(/\.?0+$/, "");
    return `${text}%`;
}

function formatThresholdPercent(raw: string | null | undefined): string {
    return formatBase100kPercent(raw, "0.1%"); // Onchain default is 100 / 100,000 = 0.1%
}

function formatSponsoredThresholdPercent(raw: string | null | undefined): string {
    return formatBase100kPercent(raw, "0%");
}

function parseSponsorshipTypes(raw: string | null | undefined, outcomeCount: number): number[] {
    const empty = Array.from({ length: outcomeCount }, () => 0);
    if (!raw) return empty;

    try {
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return empty;

        return empty.map((_, index) => {
            const value = Number(parsed[index] ?? 0);
            return Number.isFinite(value) ? value : 0;
        });
    } catch {
        return empty;
    }
}

function formatDigitalCountdown(totalMs: number): string {
    const totalSeconds = Math.max(0, Math.floor(totalMs / 1000));
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;
    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

// Get sorted outcomes by TWAP (highest first)
function getSortedOutcomes(outcomes: PageOutcome[]): OutcomeWithIndex[] {
    return outcomes
        .map((o, i) => ({ ...o, originalIndex: i }))
        .sort((a, b) => {
            if (a.twap == null && b.twap == null) return a.originalIndex - b.originalIndex;
            if (a.twap == null) return 1;
            if (b.twap == null) return -1;
            return b.twap - a.twap;
        });
}

interface DescriptionTabProps {
    proposal: PageProposal;
    showActions?: boolean;
}

function DescriptionTab({ proposal, showActions = true }: DescriptionTabProps) {
    return (
        <div className="glass-flow-panel rounded-lg">
            <div className="space-y-5 p-3 sm:p-4">
                <div className="space-y-3">
                    <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Description</h3>
                    {proposal.description && (
                        <p className="text-sm leading-relaxed text-text-secondary whitespace-pre-line">
                            {proposal.description}
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                        <h3 className="text-sm font-semibold text-text-primary uppercase tracking-wide">Outcomes</h3>
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
                                className="rounded-lg border border-border/50 bg-white/[0.035] p-4 space-y-4"
                            >
                                <div className="space-y-2">
                                    <div className="flex items-center gap-2">
                                        <div
                                            className={`w-2 h-2 rounded-full ${getOutcomeClass(index, proposal.outcomes?.length || 0, "normal")}`}
                                        />
                                        <span className="text-sm font-semibold text-text-primary">
                                            {outcome.message}
                                        </span>
                                    </div>
                                    {outcome.description && (
                                        <p className="text-sm text-text-muted pl-4">{outcome.description}</p>
                                    )}
                                </div>
                                {showActions && outcome.actions && outcome.actions.length > 0 && (
                                    <div className="space-y-2">
                                        <div className="text-xs font-semibold text-text-tertiary uppercase tracking-wide">
                                            Actions ({outcome.actions.length})
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            {outcome.actions.map((action, actionIndex) => (
                                                <ActionCard key={action.id} number={actionIndex + 1} action={action} />
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            </div>
        </div>
    );
}

export function Proposal() {
    const { proposalId, id } = useParams<{ proposalId?: string; id?: string }>();
    const resolvedId = proposalId || id; // Support both route param names
    const [showDetailsDrawer, setShowDetailsDrawer] = useState(false);
    const [showTradeModal, setShowTradeModal] = useState(false);
    const [showOutcomeModal, setShowOutcomeModal] = useState(false);
    const [selectedOutcomeForModal, setSelectedOutcomeForModal] = useState<number>(0);
    const [activeTab, setActiveTab] = useState<"chart" | "description" | "advanced">("chart");
    const [selectedOutcome, setSelectedOutcome] = useState<number>(0);
    const [nowMs, setNowMs] = useState<number>(Date.now());

    // Reset local state when navigating between proposals
    useEffect(() => {
        setSelectedOutcome(0);
        setActiveTab("chart");
        setShowDetailsDrawer(false);
        setShowTradeModal(false);
        setShowOutcomeModal(false);
        setSelectedOutcomeForModal(0);
    }, [resolvedId]);

    // Fetch proposal from API
    const { data: apiProposal, isLoading, error } = useProposal(resolvedId);

    const effectiveApiProposal = useMemo(() => {
        return apiProposal ? withEffectiveProposalState(apiProposal) : undefined;
    }, [apiProposal]);

    // Transform API proposal to page format
    const proposal = useMemo(() => {
        if (!effectiveApiProposal) return null;
        return toPageProposal(effectiveApiProposal);
    }, [effectiveApiProposal]);

    // Gate trading UI off the indexed proposal state (matches onchain TradingStarted/Finalized events).
    const state = effectiveApiProposal?.state;
    const isSupportedProtocol = isSupportedProtocolProposal(effectiveApiProposal);
    const isActive = isSupportedProtocol && state === "active";
    const isAwaitingExecution = isSupportedProtocol && state === "awaiting_execution";
    const isExecuted = state === "executed";
    const isTradingOpen = isActive || isAwaitingExecution;
    const isEnded = state === "finalized" || state === "executed";
    const isPreTrading = isSupportedProtocol && !!state && !isTradingOpen && !isEnded;
    const timeUntilReviewEnd = proposal ? getTimeRemaining(proposal.start) : undefined;
    const timeUntilEnd = proposal ? getTimeRemaining(proposal.end) : undefined;
    const proposalEndMs = proposal?.end.getTime() ?? null;
    const chartEndTimestampMs = useMemo(() => {
        const actualTradingEndMs = parseMs(effectiveApiProposal?.trading_ended_at ?? null);
        if (actualTradingEndMs != null) return actualTradingEndMs;
        if (proposalEndMs == null) return null;
        if (isAwaitingExecution || isEnded) return proposalEndMs;
        return null;
    }, [effectiveApiProposal?.trading_ended_at, isAwaitingExecution, isEnded, proposalEndMs]);
    // Execution window is 30 minutes after trading ends (fixed by protocol)
    const EXECUTION_WINDOW_MS = 30 * 60 * 1000;
    const executionEndMs = proposal ? proposal.end.getTime() + EXECUTION_WINDOW_MS : null;
    const executionRemainingMs = executionEndMs != null ? executionEndMs - nowMs : null;
    const executionCountdown = useMemo(() => {
        if (executionRemainingMs == null) return "00:00:00";
        return formatDigitalCountdown(executionRemainingMs);
    }, [executionRemainingMs]);
    const executionExpired = executionRemainingMs != null && executionRemainingMs <= 0;
    const sortedOutcomes = useMemo(() => (proposal ? getSortedOutcomes(proposal.outcomes) : []), [proposal]);
    const hasAnyTwap = useMemo(
        () => (proposal ? proposal.outcomes.some((outcome) => outcome.twap != null) : false),
        [proposal]
    );
    const twapThresholdLabel = useMemo(
        () => formatThresholdPercent(effectiveApiProposal?.dao_twap_threshold ?? null),
        [effectiveApiProposal?.dao_twap_threshold]
    );
    const sponsoredThresholdLabel = useMemo(
        () => formatSponsoredThresholdPercent(effectiveApiProposal?.dao_sponsored_threshold ?? null),
        [effectiveApiProposal?.dao_sponsored_threshold]
    );
    const sponsorshipTypes = useMemo(
        () => parseSponsorshipTypes(effectiveApiProposal?.sponsorship_types, proposal?.outcomes.length ?? 0),
        [effectiveApiProposal?.sponsorship_types, proposal?.outcomes.length]
    );
    const twapDelayEndMs = useMemo(() => {
        const tradingStartedAtMs = parseMs(effectiveApiProposal?.trading_started_at ?? null);
        if (tradingStartedAtMs == null) return null;
        const delayMs = parseMs(effectiveApiProposal?.dao_twap_start_delay ?? null);
        if (delayMs == null) return null;
        return tradingStartedAtMs + delayMs;
    }, [effectiveApiProposal?.dao_twap_start_delay, effectiveApiProposal?.trading_started_at]);
    const twapDelayRemainingMs = twapDelayEndMs != null ? twapDelayEndMs - nowMs : null;
    const twapDelayLabel = useMemo(() => {
        if (twapDelayRemainingMs == null) return "N/A";
        return formatDigitalCountdown(twapDelayRemainingMs);
    }, [twapDelayRemainingMs]);
    const twapDelayLive = twapDelayRemainingMs != null && twapDelayRemainingMs <= 0;
    const twapDelayCaption =
        twapDelayRemainingMs == null ? "TWAP Delay" : twapDelayLive ? "TWAP Delay Ended" : "TWAP Delay Ends In";

    // Update selected outcome when proposal ends
    const leadingOutcomeIndex = useMemo(() => {
        if (!proposal) return null;
        if (isEnded && proposal.winningOutcome != null) {
            return proposal.winningOutcome;
        }
        if (!hasAnyTwap) {
            return null;
        }
        return sortedOutcomes[0]?.originalIndex ?? null;
    }, [proposal, isEnded, hasAnyTwap, sortedOutcomes]);
    useEffect(() => {
        if (isEnded && leadingOutcomeIndex != null) {
            setSelectedOutcome(leadingOutcomeIndex);
        }
    }, [isEnded, leadingOutcomeIndex]);

    useEffect(() => {
        if (!isTradingOpen && !isAwaitingExecution) return;
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, [isTradingOpen, isAwaitingExecution]);

    useEffect(() => {
        if (!isSupportedProtocol) setShowTradeModal(false);
    }, [isSupportedProtocol]);

    // Loading state
    if (isLoading) {
        return (
            <div className="route-container mx-2 sm:mx-4 flex items-center justify-center min-h-[50vh]">
                <span className="text-text-tertiary">Loading proposal...</span>
            </div>
        );
    }

    // Not found or error
    if (!resolvedId || error || !proposal) return <NotFound name="Proposal" />;

    const breadcrumbItems = [
        { label: "Home", href: "/" },
        { label: "Decision Markets", href: "/proposals" },
        { label: proposal.title },
    ];

    return (
        <div className="route-container mx-2 sm:mx-4 gap-2 sm:gap-4">
            <Helmet>
                <title>{proposal.title}</title>
                <meta property="og:title" content={proposal.title} />
                <meta property="og:type" content="website" />
            </Helmet>
            <Breadcrumbs items={breadcrumbItems} />
            {/* Main Content Grid */}
            <div className="gap-2 sm:gap-4 lg:min-h-[calc(100vh-7rem)] relative flex flex-col lg:flex-row w-full">
                {/* Trading/status column - below main content on mobile, right side on desktop */}
                <div className="flex flex-col gap-2 sm:gap-3 w-full lg:w-[330px] scrollbar-gutter-stable lg:sticky lg:top-20 lg:self-start lg:max-h-[calc(100vh-8rem)] lg:overflow-y-auto order-2 lg:order-2">
                    {isPreTrading && timeUntilReviewEnd !== undefined && (
                        <PreTradingNotice timeUntilReviewEnd={timeUntilReviewEnd} reviewEndDate={proposal.start} />
                    )}
                    {isAwaitingExecution && (
                        <ExecutionNotice countdown={executionCountdown} expired={executionExpired} />
                    )}
                    {(isTradingOpen || isEnded) && (
                        <ProposalStats
                            volume={proposal.volume || 0}
                            traderCount={proposal.traderCount || 0}
                            timeRemaining={
                                isActive && timeUntilEnd
                                    ? formatTimeRemaining(timeUntilEnd)
                                    : isAwaitingExecution
                                      ? executionCountdown
                                      : undefined
                            }
                            timeLabel={isActive ? "Trading Ends" : isAwaitingExecution ? "Exec Ends" : undefined}
                            ended={
                                isEnded
                                    ? proposal.end.toLocaleDateString("en-US", {
                                          month: "short",
                                          day: "numeric",
                                      })
                                    : undefined
                            }
                            statusText={isAwaitingExecution || isEnded ? "Trading Period Ended" : undefined}
                        />
                    )}
                    {isTradingOpen && (
                        <>
                            <TradeForm
                                proposal={effectiveApiProposal}
                                selectedOutcome={selectedOutcome}
                                onOutcomeChange={setSelectedOutcome}
                                assetSymbol={proposal.assetSymbol}
                                stableSymbol={proposal.stableSymbol}
                            />
                        </>
                    )}
                </div>

                {/* Main proposal content - first on mobile and desktop */}
                {isPreTrading ? (
                    <div className="flex flex-col gap-2 flex-1 min-w-0 scrollbar-gutter-stable order-1 lg:order-1">
                        <Card variant="glass" className="flex-1">
                            <ProposalDetails proposal={proposal} apiProposal={effectiveApiProposal} />
                        </Card>
                    </div>
                ) : (
                    <div className="flex flex-col flex-1 min-w-0 scrollbar-gutter-stable lg:border-r border-border/30 order-1 lg:order-1 pb-4">
                        {(isAwaitingExecution || isEnded) && effectiveApiProposal && (
                            <div className="mb-2 sm:mb-3 shrink-0">
                                <ProposalFinalResults proposal={proposal} apiProposal={effectiveApiProposal} />
                            </div>
                        )}

                        {/* Tab Selector at the top */}
                        <div className="glass-flow-panel rounded-lg flex flex-col shrink-0 sticky top-0 z-20">
                            <TabSelector
                                tabs={[
                                    { id: "chart", label: "Chart" },
                                    { id: "description", label: "Description" },
                                    { id: "advanced", label: "Advanced" },
                                ]}
                                activeTab={activeTab}
                                onTabChange={(tabId) => setActiveTab(tabId as "chart" | "description" | "advanced")}
                            />
                        </div>
                        {/* Tab Content */}
                        {activeTab === "chart" && (
                            <>
                                {isSupportedProtocol && (
                                    <TwapHeader
                                        sortedOutcomes={sortedOutcomes}
                                        totalOutcomes={proposal.outcomes?.length || 0}
                                        isEnded={isEnded}
                                        isExecuted={isExecuted}
                                        winningOutcomeIndex={leadingOutcomeIndex}
                                        twapThresholdLabel={twapThresholdLabel}
                                        twapDelayLabel={twapDelayLabel}
                                        twapDelayCaption={twapDelayCaption}
                                        twapDelayLive={twapDelayLive}
                                        sponsorshipTypes={sponsorshipTypes}
                                        sponsoredThresholdLabel={sponsoredThresholdLabel}
                                        phaseCountdown={
                                            isActive && timeUntilEnd
                                                ? formatDigitalCountdown(timeUntilEnd.totalMs)
                                                : isAwaitingExecution
                                                  ? executionCountdown
                                                  : undefined
                                        }
                                        phaseCountdownCaption={
                                            isActive
                                                ? "Trading Ends In"
                                                : isAwaitingExecution
                                                  ? executionExpired
                                                      ? "Exec Window Ended"
                                                      : "Exec Ends In"
                                                  : undefined
                                        }
                                        phaseCountdownDone={isAwaitingExecution ? executionExpired : false}
                                        onOutcomeClick={(index) => {
                                            setSelectedOutcomeForModal(index);
                                            setShowOutcomeModal(true);
                                        }}
                                    />
                                )}
                                <Card variant="glass" className="flex flex-col gap-4">
                                    <Chart
                                        proposalId={proposal.id}
                                        outcomeCount={proposal.outcomes.length}
                                        outcomeMessages={proposal.outcomes.map((o) => o.message)}
                                        twaps={Object.fromEntries(
                                            proposal.outcomes.flatMap((outcome, index) =>
                                                outcome.twap != null ? [[index, String(outcome.twap)]] : []
                                            )
                                        )}
                                        prices={Object.fromEntries(
                                            proposal.outcomes.flatMap((outcome, index) =>
                                                outcome.price != null ? [[index, String(outcome.price)]] : []
                                            )
                                        )}
                                        selectedOutcome={selectedOutcome}
                                        enableTwap={isSupportedProtocol}
                                        extendToNow={isActive}
                                        endTimestampMs={chartEndTimestampMs}
                                        className="bg-black/10 border border-border/50 rounded-lg overflow-hidden flex flex-col shrink-0 min-h-[280px] h-[280px] sm:h-[350px] md:h-[400px] lg:h-[500px]"
                                    />
                                    <RecentTrades
                                        proposalId={resolvedId}
                                        proposer={effectiveApiProposal?.proposer}
                                        outcomeCount={proposal.outcomes.length}
                                    />
                                </Card>
                            </>
                        )}

                        {activeTab === "description" && (
                            <DescriptionTab proposal={proposal} showActions={isSupportedProtocol} />
                        )}

                        {activeTab === "advanced" && (
                            <ProposalAdvancedDetails proposal={proposal} apiProposal={effectiveApiProposal} />
                        )}
                    </div>
                )}
            </div>

            {/* Details Modal */}
            <Modal isOpen={showDetailsDrawer} onClose={() => setShowDetailsDrawer(false)} title={proposal.title}>
                <div className="flex h-[60vh] w-full max-w-[900px] min-w-full sm:min-w-[60vw]">
                    <ProposalDetails proposal={proposal} apiProposal={effectiveApiProposal} />
                </div>
            </Modal>

            {/* Trade Modal */}
            {isSupportedProtocol && (
                <Modal isOpen={showTradeModal} onClose={() => setShowTradeModal(false)} title="Trade">
                    <div className="w-full max-w-[500px]">
                        <TradeForm
                            proposal={effectiveApiProposal}
                            selectedOutcome={selectedOutcome}
                            onOutcomeChange={setSelectedOutcome}
                            assetSymbol={proposal.assetSymbol}
                            stableSymbol={proposal.stableSymbol}
                        />
                    </div>
                </Modal>
            )}

            {/* Outcome Details Modal */}
            {proposal.outcomes && proposal.outcomes[selectedOutcomeForModal] && (
                <OutcomeDetailsModal
                    isOpen={showOutcomeModal}
                    onClose={() => setShowOutcomeModal(false)}
                    outcome={proposal.outcomes[selectedOutcomeForModal]}
                    outcomeIndex={selectedOutcomeForModal}
                    totalOutcomes={proposal.outcomes.length}
                    isWinning={leadingOutcomeIndex === selectedOutcomeForModal}
                    isEnded={isExecuted}
                    showTwapMetric={isSupportedProtocol}
                    showActions={isSupportedProtocol}
                />
            )}
        </div>
    );
}
