import { useMemo, useRef, useState } from "react";
import { useCurrentAccount } from "@/lib/sui/dapp-kit-compat";
import { useQueryClient } from "@tanstack/react-query";
import { CheckIcon, XIcon, ClockIcon } from "lucide-react";
import toast from "react-hot-toast";
import { isNotifiedTransactionError } from "@/hooks/useSuiTransaction";
import { getOutcomeColor } from "@/lib/outcomes";
import type { PageProposal } from "@/lib/proposalAdapter";
import type { Proposal } from "@/types/Proposal";
import { Button } from "@/components/inputs/Button";
import { CoinAvatar } from "@/components/CoinAvatar";
import { getSortedOutcomes } from "@/lib/outcomeUtils";
import { formatNumber } from "@/lib/formatNumber";
import { useProposalBalances } from "@/hooks/api";
import { balanceKeys } from "@/hooks/api/useBalances";
import { proposalKeys } from "@/hooks/api/useProposals";
import { useSuiTransaction } from "@/hooks/useSuiTransaction";
import { getSDKForProposal, isSupportedProtocolProposal } from "@/lib/sdk";
import {
    buildWalletSettlementPlan,
    buildWalletSettlementTransaction,
    hasSettlementActions,
} from "@/lib/proposalSettlement";

interface ProposalFinalResultsProps {
    proposal: PageProposal;
    apiProposal: Proposal;
}

function rawToDisplay(raw: bigint, decimals: number): string {
    if (decimals <= 0) return formatNumber(Number(raw));
    const rawStr = raw.toString().padStart(decimals + 1, "0");
    const value = parseFloat(rawStr.slice(0, -decimals) + "." + rawStr.slice(-decimals));
    return formatNumber(value);
}

export function ProposalFinalResults({ proposal, apiProposal }: ProposalFinalResultsProps) {
    const account = useCurrentAccount();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading: txLoading } = useSuiTransaction();
    const isSupportedProtocol = isSupportedProtocolProposal(apiProposal);
    const { data: proposalBalances } = useProposalBalances(isSupportedProtocol ? apiProposal : undefined);
    const [isRedeeming, setIsRedeeming] = useState(false);
    const submittingRef = useRef(false);

    const rawOutcomes = proposal.outcomes || [];
    const sortedOutcomes = getSortedOutcomes(rawOutcomes);

    const currentProposalInventory = useMemo(() => {
        const outcomeCount = apiProposal.outcome_count || 0;
        const winningOutcomeIndex = apiProposal.winning_outcome ?? -1;
        if (outcomeCount <= 0 || winningOutcomeIndex < 0) {
            return {
                winningAssetRaw: 0n,
                winningStableRaw: 0n,
            };
        }

        const wrappers = proposalBalances?.balanceWrappers ?? [];
        const wrapperByOutcome = Array.from({ length: outcomeCount }, (_, outcomeIndex) => {
            return wrappers.reduce(
                (sum, wrapper) => {
                    const wrapperOutcome = wrapper.outcomes.find((row) => row.outcomeIndex === outcomeIndex);
                    if (!wrapperOutcome) return sum;
                    return {
                        asset: sum.asset + (wrapperOutcome.asset.raw ?? 0n),
                        stable: sum.stable + (wrapperOutcome.stable.raw ?? 0n),
                    };
                },
                { asset: 0n, stable: 0n }
            );
        });

        const winningConditional = proposalBalances?.outcomes?.[winningOutcomeIndex];
        const winningAssetRaw =
            (winningConditional?.conditionalAsset?.raw ?? 0n) + (wrapperByOutcome[winningOutcomeIndex]?.asset ?? 0n);
        const winningStableRaw =
            (winningConditional?.conditionalStable?.raw ?? 0n) + (wrapperByOutcome[winningOutcomeIndex]?.stable ?? 0n);

        return {
            winningAssetRaw,
            winningStableRaw,
        };
    }, [apiProposal, proposalBalances]);

    const hasWinningCoins =
        currentProposalInventory.winningAssetRaw > 0n || currentProposalInventory.winningStableRaw > 0n;

    const isAwaitingExecution = apiProposal.state === "awaiting_execution";

    // If no winning outcome yet, show pending TWAP/execution state.
    if (proposal.winningOutcome == null) {
        return (
            <div className="flex flex-col gap-3">
                <div className="glass-flow-panel relative p-2 rounded-xl flex items-center gap-4 px-4 z-20">
                    <div className="flex items-center justify-center w-12 h-12 rounded-xl border shrink-0 border-border/50 bg-white/5">
                        <ClockIcon className="w-7 h-7 text-text-tertiary" strokeWidth={2} />
                    </div>
                    <div className="flex-1 min-w-0 flex flex-col">
                        <p className="text-[9px] opacity-40 uppercase tracking-widest">
                            Trading Ended{" "}
                            {proposal.end.toLocaleDateString("en-US", {
                                month: "short",
                                day: "numeric",
                            })}
                        </p>
                        <p className="font-bold text-xl tracking-tight text-text-secondary">
                            {isAwaitingExecution ? "Awaiting Execution" : "TWAP not fixed yet"}
                        </p>
                        <p className="text-xs opacity-60">
                            {isAwaitingExecution ? "Awaiting execution..." : "TWAP not fixed yet"}
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Use the actual winning_outcome index from the backend
    const winningIndex = proposal.winningOutcome;
    const winningOutcome = sortedOutcomes.find((o) => o.originalIndex === winningIndex) || sortedOutcomes[0];
    if (!winningOutcome) return null;

    const winningColor = getOutcomeColor(winningOutcome.originalIndex, rawOutcomes.length, "normal");

    const handleRedeem = async () => {
        if (!isSupportedProtocol) return;
        if (!account?.address) {
            toast.error("Connect wallet to withdraw");
            return;
        }
        if (submittingRef.current) return;
        submittingRef.current = true;

        setIsRedeeming(true);
        try {
            const sdk = getSDKForProposal(apiProposal);
            const settlementPlan = await buildWalletSettlementPlan({
                sdk,
                owner: account.address,
                proposals: [apiProposal],
            });

            if (!hasSettlementActions(settlementPlan)) {
                toast("No winning coins found for this proposal.");
                return;
            }

            const transaction = buildWalletSettlementTransaction({
                sdk,
                plan: settlementPlan,
                recipient: account.address,
            });

            await executeTransaction(
                transaction,
                {
                    onReconciled: () => {
                        queryClient.invalidateQueries({ queryKey: balanceKeys.all });
                        queryClient.invalidateQueries({ queryKey: proposalKeys.all });
                    },
                },
                {
                    loadingMessage: "Redeeming winning coins...",
                    successMessage: "Redeemed winning coins",
                }
            );

            if (
                settlementPlan.summary.residualWrapperAssetRaw > 0n ||
                settlementPlan.summary.residualWrapperStableRaw > 0n
            ) {
                toast("Some non-winning wrapper balances remain because they are not complete sets yet.");
            }
        } catch (error) {
            console.error("Settlement failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Settlement failed");
            }
        } finally {
            setIsRedeeming(false);
            submittingRef.current = false;
        }
    };

    const isRejectOutcome = winningOutcome.message.toLowerCase().includes("reject");
    const resultSubtitle =
        !isSupportedProtocol || isRejectOutcome
            ? "Final result"
            : isAwaitingExecution
              ? "Outcome will be executed"
              : "Outcome executed";
    const isButtonLoading = isRedeeming || txLoading;
    const buttonDisabled = !account || isButtonLoading;

    return (
        <div className="flex flex-col gap-3">
            {/* Header - Trading Ended */}
            <div
                className="glass-flow-panel relative p-2 rounded-xl flex items-center gap-4 px-4 z-20"
                style={{
                    borderColor: winningColor + "30",
                    background: `linear-gradient(135deg, ${winningColor}15 0%, ${winningColor}25 50%, ${winningColor}08 100%), var(--color-card-elevated)`,
                    boxShadow: `inset 0 2px 8px 0 ${winningColor}10, ${winningColor}1a 0px 6px 32px 0px`,
                }}
            >
                <div
                    className="flex items-center justify-center w-12 h-12 rounded-xl border shrink-0 shadow-md transition-transform hover:scale-105"
                    style={{
                        borderColor: winningColor + "60",
                        backgroundColor: winningColor + "25",
                        boxShadow: `0 2px 6px ${winningColor}30`,
                    }}
                >
                    {isRejectOutcome ? (
                        <XIcon className="w-7 h-7" style={{ color: winningColor }} strokeWidth={2.5} />
                    ) : (
                        <CheckIcon className="w-7 h-7" style={{ color: winningColor }} strokeWidth={2.5} />
                    )}
                </div>
                <div className="flex-1 min-w-0 flex flex-col">
                    <p className="text-[9px] opacity-40 uppercase tracking-widest">
                        Trading Ended{" "}
                        {proposal.end.toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                        })}
                    </p>
                    <p
                        className="font-bold text-xl tracking-tight"
                        style={{ color: getOutcomeColor(winningOutcome.originalIndex, rawOutcomes.length, "light") }}
                    >
                        {winningOutcome.message}
                    </p>
                    <p className="text-xs opacity-60">{resultSubtitle}</p>
                </div>
            </div>

            {isSupportedProtocol && hasWinningCoins && (
                <div className="flex flex-col -mt-10 rounded-lg overflow-hidden">
                    <div
                        className="p-px rounded-lg relative bg-linear-to-br from-border-light via-border to-border-light"
                        style={{
                            backgroundImage: `linear-gradient(135deg, ${winningColor}20 0%, ${winningColor}10 50%,  ${winningColor}23 100%)`,
                        }}
                    >
                        <div className="relative z-10 space-y-3 px-6 py-4 pt-12 bg-white/[0.035] rounded-lg flex flex-col">
                            <span className="font-bold text-sm uppercase tracking-wider text-text-primary w-full text-center opacity-20">
                                Settlement Preview
                            </span>

                            <div className="rounded-lg border border-green-400/50 bg-green-500/10 p-3 space-y-2 shadow-[0_0_26px_rgba(34,197,94,0.18)] animate-pulse">
                                <div className="text-[10px] uppercase tracking-wider text-text-tertiary">
                                    Winning Coins
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex min-w-0 items-center gap-2 text-text-muted">
                                        <CoinAvatar
                                            coinType={apiProposal.asset_type}
                                            symbol={proposal.assetSymbol}
                                            size="md"
                                        />
                                        <span className="truncate">${proposal.assetSymbol}</span>
                                    </span>
                                    <span className="font-mono text-text-primary">
                                        {rawToDisplay(currentProposalInventory.winningAssetRaw, proposal.assetDecimals)}
                                    </span>
                                </div>
                                <div className="flex items-center justify-between text-xs">
                                    <span className="flex min-w-0 items-center gap-2 text-text-muted">
                                        <CoinAvatar
                                            coinType={apiProposal.stable_type}
                                            symbol={proposal.stableSymbol}
                                            size="md"
                                        />
                                        <span className="truncate">${proposal.stableSymbol}</span>
                                    </span>
                                    <span className="font-mono text-text-primary">
                                        {rawToDisplay(
                                            currentProposalInventory.winningStableRaw,
                                            proposal.stableDecimals
                                        )}
                                    </span>
                                </div>
                            </div>

                            <Button
                                variant="secondary"
                                onClick={handleRedeem}
                                isLoading={isButtonLoading}
                                disabled={buttonDisabled}
                                className="w-full border-green-400/60 bg-green-500/15 text-green-100 shadow-[0_0_22px_rgba(34,197,94,0.2)] hover:border-green-300 hover:bg-green-500/20"
                            >
                                <p className="w-full">{account ? "Redeem Winning Coins" : "Connect Wallet"}</p>
                            </Button>
                            <p className="text-[10px] text-text-tertiary text-center">
                                Only redeems winning coins from this proposal.
                            </p>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
