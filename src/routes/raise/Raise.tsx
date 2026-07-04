import { useParams } from "react-router";
import { useState, useCallback, useEffect } from "react";
import { Helmet } from "react-helmet-async";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/Card";
import { useRaise, useUserContribution, useUserReservation } from "@/hooks/api/useRaises";
import { NotFound } from "@/components/navigation/NotFound";
import { Breadcrumbs } from "@/components/navigation/Breadcrumbs";
import { Button } from "@/components/inputs/Button";
import { formatNumber } from "@/lib/formatNumber";
import { MarkdownRenderer } from "@/components/MarkdownRenderer";
import { TeamSection } from "@/components/raise/page/TeamSection";
import { ProgressCard } from "@/components/raise/page/ProgressCard";
import { HeroSection } from "@/components/raise/page/HeroSection";
import { InvestModal } from "@/components/raise/page/InvestModal";
import { InvestorsModal } from "@/components/raise/page/InvestorsModal";
import { StatsCards } from "@/components/raise/page/StatsCard";
import { ReservationCard } from "@/components/raise/page/ReservationCard";
import { RaiseActionSections } from "@/components/raise/ActionSections";
import { MetricItem } from "@/components/MetricItem";
import { useDAO } from "@/hooks/api";
import { useSuiTransaction, isNotifiedTransactionError } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import { formatUnits } from "@/lib/units";
import { toRaiseView, type RaiseView } from "@/types/RaiseView";
import { getRaiseUiStatus, type RaiseUiStatus } from "@/lib/raiseStatus";

interface UserInvestment {
    hasInvested: boolean;
    amount: number;
    amountDisplay: string;
    percentage: number;
    rank: number;
}

function useRaiseClock() {
    const [nowMs, setNowMs] = useState(Date.now());

    useEffect(() => {
        const timer = window.setInterval(() => setNowMs(Date.now()), 1000);
        return () => window.clearInterval(timer);
    }, []);

    return nowMs;
}

function AboutSection({ raise }: { raise: RaiseView }) {
    return (
        <div className="space-y-5">
            <h3 className="text-xl font-semibold">About {raise.name}</h3>
            {raise.about ? (
                <MarkdownRenderer content={raise.about} />
            ) : (
                <div className="space-y-4 text-white/70 leading-relaxed">
                    <p>{raise.description}</p>
                </div>
            )}
        </div>
    );
}

function UserInvestmentCard(props: {
    userInvestment: UserInvestment;
    isEnded: boolean;
    isFunded: boolean;
    raise: RaiseView;
    status: RaiseUiStatus;
}) {
    const { userInvestment, isEnded, isFunded, raise, status } = props;
    const account = useCurrentAccount();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading } = useSuiTransaction();

    const rawRaise = raise._raw;

    const handleClaimTokens = useCallback(async () => {
        if (!account) return;
        try {
            const sdk = getSDK();
            const { transaction } = sdk.launchpad.claimTokens(rawRaise.id, rawRaise.asset_type, rawRaise.stable_type);
            await executeTransaction(
                transaction,
                {
                    onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ["raises"] });
                        queryClient.invalidateQueries({ queryKey: ["balances"] });
                    },
                },
                {
                    loadingMessage: "Claiming tokens...",
                    successMessage: "Tokens claimed!",
                }
            );
        } catch (error) {
            console.error("Claim tokens failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Claim failed");
            }
        }
    }, [account, rawRaise, executeTransaction, queryClient]);

    const handleClaimRefund = useCallback(async () => {
        if (!account) return;
        try {
            const sdk = getSDK();
            const { transaction } = sdk.launchpad.claimRefund(rawRaise.id, rawRaise.asset_type, rawRaise.stable_type);
            await executeTransaction(
                transaction,
                {
                    onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ["raises"] });
                        queryClient.invalidateQueries({ queryKey: ["balances"] });
                    },
                },
                {
                    loadingMessage: "Claiming refund...",
                    successMessage: "Refund claimed!",
                }
            );
        } catch (error) {
            console.error("Claim refund failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Refund claim failed");
            }
        }
    }, [account, rawRaise, executeTransaction, queryClient]);

    return (
        <Card className={isEnded && !isFunded ? "border-error/30 bg-error/5" : "border-primary/30 bg-primary/5"}>
            <CardContent>
                <div className="space-y-3">
                    <div className="flex items-center justify-between">
                        <MetricItem label="Your Investment" value={`$${userInvestment.amountDisplay}`} size="lg" />
                        <div className="text-right">
                            <MetricItem label="Rank" value={`#${userInvestment.rank}`} size="lg" />
                        </div>
                    </div>
                    {status === "funded" && raise.tokensForSale > 0 && raise.raised > 0 && (
                        <div className="flex items-baseline justify-between p-2 rounded-lg bg-white/5">
                            <span className="text-xs text-white/40">Your tokens</span>
                            <span className="text-sm font-semibold">
                                {formatNumber((userInvestment.amount / raise.raised) * raise.tokensForSale)}{" "}
                                {raise.assetSymbol}
                            </span>
                        </div>
                    )}
                    {status === "funded" && (
                        <Button className="w-full font-medium" onClick={handleClaimTokens} isLoading={isLoading}>
                            Claim Tokens
                        </Button>
                    )}
                    {status === "failed" && (
                        <Button
                            className="w-full font-medium bg-error/10 border-error/30 text-error hover:bg-error/20"
                            onClick={handleClaimRefund}
                            isLoading={isLoading}
                        >
                            Claim Refund
                        </Button>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function TopContributors({
    contributors,
    connectedAddress,
    userInvestment,
}: {
    contributors: { address: string; amount: number; amountDisplay: string; percentage: number }[];
    connectedAddress?: string;
    userInvestment: UserInvestment;
}) {
    const top10 = contributors.slice(0, 10);
    const truncate = (addr: string) => `${addr.slice(0, 6)}...${addr.slice(-4)}`;
    const isConnected = (addr: string) => connectedAddress && addr === connectedAddress;

    return (
        <Card className="border-border-light bg-card-elevated">
            <CardContent>
                <div className="space-y-3">
                    <h4 className="text-sm font-semibold text-white/70">Top Contributors</h4>
                    {connectedAddress && userInvestment.hasInvested && (
                        <div className="rounded-lg bg-primary/10 border border-primary/20 p-3">
                            <div className="flex justify-between items-baseline">
                                <span className="text-xs text-primary/70">Your Contribution</span>
                                <span className="text-sm font-semibold text-primary">
                                    ${userInvestment.amountDisplay}
                                </span>
                            </div>
                            <div className="flex justify-between items-baseline mt-1">
                                <span className="text-xs text-primary/50">Rank #{userInvestment.rank}</span>
                                <span className="text-xs text-primary/50">{userInvestment.percentage.toFixed(2)}%</span>
                            </div>
                        </div>
                    )}
                    {top10.length > 0 ? (
                        <div className="space-y-1">
                            {top10.map((c, i) => (
                                <div
                                    key={c.address}
                                    className={`flex items-center justify-between py-1.5 px-2 rounded-lg text-xs ${
                                        isConnected(c.address) ? "bg-primary/10" : i % 2 === 0 ? "bg-white/[0.02]" : ""
                                    }`}
                                >
                                    <div className="flex items-center gap-2">
                                        <span className="text-white/30 w-4 text-right">{i + 1}</span>
                                        <span
                                            className={`font-mono ${isConnected(c.address) ? "text-primary" : "text-white/70"}`}
                                        >
                                            {truncate(c.address)}
                                        </span>
                                    </div>
                                    <span className="font-semibold text-white/90">${c.amountDisplay}</span>
                                </div>
                            ))}
                        </div>
                    ) : (
                        <p className="text-xs text-white/40 text-center py-2">No contributions yet</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}

function RaiseStatusBanner({
    status,
    userInvestment,
    raise,
}: {
    status: RaiseUiStatus;
    userInvestment: UserInvestment;
    raise: RaiseView;
}) {
    if (status === "funded") {
        return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-success/10 border border-success/20">
                <div className="w-10 h-10 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-success" fill="currentColor" viewBox="0 0 20 20">
                        <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                            clipRule="evenodd"
                        />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-success">Raise Successful</p>
                    <p className="text-xs text-white/50">
                        {userInvestment.hasInvested
                            ? "Your tokens are ready to claim"
                            : `Raised $${formatNumber(raise.raised)} — DAO created`}
                    </p>
                </div>
            </div>
        );
    }

    if (status === "failed") {
        return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-error/10 border border-error/20">
                <div className="w-10 h-10 rounded-full bg-error/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-error" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-error">Raise Failed</p>
                    <p className="text-xs text-white/50">
                        {userInvestment.hasInvested
                            ? "Your contribution is available for refund"
                            : `Did not reach $${formatNumber(raise.raising)} goal`}
                    </p>
                </div>
            </div>
        );
    }

    if (status === "finalizing") {
        return (
            <div className="flex items-center gap-3 px-4 py-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="w-10 h-10 rounded-full bg-blue-500/20 flex items-center justify-center shrink-0">
                    <svg className="w-5 h-5 text-blue-400 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path
                            className="opacity-75"
                            fill="currentColor"
                            d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                        />
                    </svg>
                </div>
                <div>
                    <p className="text-sm font-semibold text-blue-300">Finalizing Raise</p>
                    <p className="text-xs text-white/50">Onchain completion intents are being processed</p>
                </div>
            </div>
        );
    }

    return null;
}

export function Raise() {
    const { orgId, raiseId } = useParams<{ orgId?: string; raiseId: string }>();
    const [isInvestorsModalOpen, setIsInvestorsModalOpen] = useState(false);
    const [isInvestModalOpen, setIsInvestModalOpen] = useState(false);
    const nowMs = useRaiseClock();
    const account = useCurrentAccount();

    const { data: apiRaise, isLoading, error } = useRaise(raiseId);
    const { data: orgRaw } = useDAO(orgId);
    const { data: contributionData } = useUserContribution(raiseId, account?.address);
    const { data: reservationData } = useUserReservation(raiseId, account?.address);

    // Convert API data to view model
    const raise = apiRaise ? toRaiseView(apiRaise) : null;

    // Convert raw contribution data from API to UserInvestment format
    const stableDecimals = apiRaise?.stable_decimals ?? 9;
    const divisor = Math.pow(10, stableDecimals);
    const formatStableDisplay = (rawAmount: string | number | bigint | undefined) =>
        rawAmount !== undefined
            ? formatUnits(BigInt(rawAmount), stableDecimals, { maxFractionDigits: Math.min(stableDecimals, 6) })
            : "0";
    const userInvestment: UserInvestment = contributionData
        ? {
              hasInvested: contributionData.hasInvested,
              amount: Number(contributionData.amount) / divisor,
              amountDisplay: formatStableDisplay(contributionData.amount),
              percentage: Number(contributionData.percentage),
              rank: contributionData.rank,
          }
        : {
              hasInvested: false,
              amount: 0,
              amountDisplay: "0",
              percentage: 0,
              rank: 0,
          };

    // Get contributors from API response
    const contributors =
        apiRaise?.contributors?.map((c) => ({
            address: c.address,
            amount: Number(c.amount) / Math.pow(10, apiRaise.stable_decimals ?? 9),
            amountDisplay: formatStableDisplay(c.amount),
            percentage: Number(c.percentage),
        })) || [];

    if (isLoading) {
        return (
            <div className="route-container flex items-center justify-center h-96">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
            </div>
        );
    }

    if (error || !raise) return <NotFound name="Raise" />;

    const status: RaiseUiStatus = getRaiseUiStatus(raise._raw, nowMs);
    const isUpcoming = status === "upcoming";
    const isEnded = status === "funded" || status === "failed" || status === "finalizing";
    const goalAmount = raise.maxRaise ?? raise.raising;
    const progress = goalAmount > 0 ? (raise.raised / goalAmount) * 100 : 0;
    const isFunded = status === "funded" || status === "finalizing";
    const contributorCount = apiRaise?.contributor_count ?? contributors.length;
    const orgName = orgRaw?.config?.dao_name || orgRaw?.dao_name || "Org";
    const breadcrumbItems = orgId
        ? [
              { label: "Home", href: "/" },
              { label: "Orgs", href: "/orgs" },
              { label: orgName, href: `/orgs/${orgId}` },
              { label: "Raises", href: `/orgs/${orgId}/raises` },
              { label: raise.name },
          ]
        : [{ label: "Home", href: "/" }, { label: "Raises", href: "/raises" }, { label: raise.name }];
    const actionContext = {
        assetType: apiRaise?.asset_type,
        stableType: apiRaise?.stable_type,
        assetSymbol: apiRaise?.asset_symbol,
        stableSymbol: apiRaise?.stable_symbol,
        assetDecimals: apiRaise?.asset_decimals,
        stableDecimals: apiRaise?.stable_decimals,
    };

    // Reservation state
    const hasReservation = reservationData?.hasReservation ?? false;
    const reservationAmount = hasReservation ? Number(reservationData!.amount) / divisor : 0;
    const reservationAccepted = reservationData?.accepted ?? false;

    const statsContent = (className?: string) => (
        <div className={`space-y-4 lg:overflow-y-auto mb-3 ${className}`}>
            {hasReservation && (
                <ReservationCard
                    raise={raise}
                    reservationAmount={reservationAmount}
                    accepted={reservationAccepted}
                    status={status}
                />
            )}

            <StatsCards
                raise={raise}
                isEnded={isEnded}
                status={status}
                contributorCount={contributorCount}
                setIsInvestorsModalOpen={setIsInvestorsModalOpen}
            />

            <ProgressCard
                raise={raise}
                progress={progress}
                isFunded={isFunded}
                isEnded={isEnded}
                status={status}
                userInvestment={userInvestment}
                setIsInvestModalOpen={setIsInvestModalOpen}
            />

            {userInvestment.hasInvested && !isUpcoming && (
                <UserInvestmentCard
                    userInvestment={userInvestment}
                    isEnded={isEnded}
                    isFunded={isFunded}
                    raise={raise}
                    status={status}
                />
            )}

            <TopContributors
                contributors={contributors}
                connectedAddress={account?.address}
                userInvestment={userInvestment}
            />
        </div>
    );

    return (
        <div className="route-container space-y-6">
            <Helmet>
                <title>{raise.name} - Raise</title>
            </Helmet>
            <Breadcrumbs items={breadcrumbItems} />

            {/* Status Banner — prominent heading for terminal states */}
            <RaiseStatusBanner status={status} userInvestment={userInvestment} raise={raise} />

            {/* Two-Column Layout with Fixed Right Sidebar */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 lg:h-[calc(100vh-7rem)] lg:overflow-hidden">
                {/* Main Content - Left Side */}
                <div className="lg:col-span-2 lg:overflow-y-auto lg:pr-2 pb-4">
                    <HeroSection raise={raise} status={status} isFunded={isFunded} />
                    {statsContent("lg:hidden pt-4 lg:pt-0")}
                    <Card className="bg-card-elevated border-border-light mt-0 pt-4 lg:-mt-4 lg:pt-8">
                        <CardContent className="space-y-6">
                            <TeamSection team={raise.team} />
                            <AboutSection raise={raise} />
                            <RaiseActionSections
                                sections={[
                                    {
                                        title: "Success actions",
                                        caption: "Execute if the raise funds",
                                        actions: apiRaise?.success_actions,
                                    },
                                    {
                                        title: "Failure actions",
                                        caption: "Execute if the raise fails",
                                        actions: apiRaise?.failure_actions,
                                    },
                                ]}
                                context={actionContext}
                            />
                        </CardContent>
                    </Card>
                </div>
                {/* Right side - Stats */}
                {statsContent("hidden lg:block")}
            </div>

            <InvestModal
                isOpen={isInvestModalOpen}
                onClose={() => setIsInvestModalOpen(false)}
                raise={raise}
                userInvestment={userInvestment}
                progress={progress}
                status={status}
                pendingReservation={hasReservation && !reservationAccepted ? reservationAmount : 0}
            />

            <InvestorsModal
                isOpen={isInvestorsModalOpen}
                setIsOpen={setIsInvestorsModalOpen}
                contributors={contributors}
            />
        </div>
    );
}
