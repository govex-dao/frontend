/* eslint-disable max-lines */
import { useState, useMemo, useCallback, useEffect, useRef } from "react";
import { useCurrentAccount } from "@mysten/dapp-kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { useCoins, useProposalBalances } from "@/hooks/api";
import { balanceKeys } from "@/hooks/api/useBalances";
import { priceHistoryKeys } from "@/hooks/api/usePriceHistory";
import { proposalKeys } from "@/hooks/api/useProposals";
import { swapKeys } from "@/hooks/api/useSwaps";
import { tradeKeys } from "@/hooks/api/useTrades";
import { twapHistoryKeys } from "@/hooks/api/useTwapHistory";
import { useSuiTransaction, isNotifiedTransactionError } from "@/hooks/useSuiTransaction";
import { getProtocolVersionForProposal, getSDKForProposal, isLegacyV2Proposal } from "@/lib/sdk";
import { parseAmountToBigInt } from "@/lib/parseAmount";
import { formatUnits, formatUnitsForInput } from "@/lib/units";
import { resolveCoinIcon } from "@/lib/coin/icons";
import type { Proposal } from "@/types/Proposal";
import { parseConditionalTypes, parseOutcomeMessages } from "@/types/Proposal";
import type { SwapBreakdown } from "@/lib/trade/types";
import { getOutcomeColor } from "@/lib/outcomes";
import { TradeDirectionSwapButton, TradeDirectionToggle } from "./DirectionToggles";
import { Select } from "../../../inputs/Select";
import { TokenInput } from "../../../inputs/TokenInput";
import { TradeDetails } from "./Details";
import { SlippageSelector } from "./SlippageSelector";
import { Button } from "../../../inputs/Button";
import { Card } from "../../../Card";

interface TradeFormProps {
    proposal?: Proposal;
    selectedOutcome?: number;
    onOutcomeChange?: (outcome: number) => void;
    assetSymbol?: string;
    stableSymbol?: string;
}

interface SourceRow {
    label: string;
    raw: bigint;
    decimals: number;
}

interface OutcomeConditionalRow {
    outcomeIndex: number;
    message: string;
    assetTotalRaw: bigint;
    stableTotalRaw: bigint;
}

const DEFAULT_SLIPPAGE_BPS = 30n; // 0.3%
const QUOTE_DEBOUNCE_MS = 1000; // 1 second — reset on each keystroke

function formatRawAmount(raw: bigint, decimals: number): string {
    return formatUnits(raw, decimals, {
        maxFractionDigits: 4,
        trimTrailingZeros: true,
        useGrouping: true,
    });
}

function safeParseAmountToBigInt(amount: string, decimals: number): bigint {
    try {
        return parseAmountToBigInt(amount, decimals);
    } catch {
        return 0n;
    }
}

function bpsToPercentNumber(bps: bigint | number | string): number {
    const bpsBigInt = typeof bps === "bigint" ? bps : BigInt(bps);
    const asString = formatUnits(bpsBigInt, 2, {
        maxFractionDigits: 6,
        trimTrailingZeros: false,
        useGrouping: false,
    });
    return Number.parseFloat(asString || "0");
}

function priceStablePerAssetNumber(config: {
    stableRaw: bigint;
    stableDecimals: number;
    assetRaw: bigint;
    assetDecimals: number;
    precision?: number;
}): number {
    const precision = config.precision ?? 12;
    if (config.assetRaw === 0n) return 0;

    const numerator = config.stableRaw * 10n ** BigInt(config.assetDecimals + precision);
    const denominator = config.assetRaw * 10n ** BigInt(config.stableDecimals);
    if (denominator === 0n) return 0;

    const scaled = numerator / denominator;
    const asString = formatUnits(scaled, precision, {
        maxFractionDigits: precision,
        trimTrailingZeros: true,
        useGrouping: false,
    });
    return Number.parseFloat(asString || "0");
}

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

export function TradeForm({
    proposal,
    selectedOutcome: controlledOutcome,
    onOutcomeChange,
    assetSymbol = "GOVEX",
    stableSymbol = "USDC",
}: TradeFormProps) {
    const { data: coins } = useCoins();
    const account = useCurrentAccount();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading: txLoading } = useSuiTransaction();
    const isLegacyV2 = isLegacyV2Proposal(proposal);
    const { data: balances } = useProposalBalances(proposal);

    const [isBuy, setIsBuy] = useState(true);
    const [internalSelectedOutcome, setInternalSelectedOutcome] = useState<number>(0);
    const [fromAmountStr, setFromAmountStr] = useState(""); // Raw string for precision
    const [slippageBps, setSlippageBps] = useState<bigint>(DEFAULT_SLIPPAGE_BPS);
    const submittingRef = useRef(false); // Double-submit guard

    const outcomeMessages = useMemo(
        () => (proposal ? parseOutcomeMessages(proposal) : ["Outcome 1", "Outcome 2"]),
        [proposal]
    );

    // Get token info from coins
    const assetCoin = proposal?.asset_type
        ? coins?.find((c) => c.coin_type === proposal.asset_type)
        : coins?.find((c) => c.symbol === assetSymbol);
    const stableCoin = proposal?.stable_type
        ? coins?.find((c) => c.coin_type === proposal.stable_type)
        : coins?.find((c) => c.symbol === stableSymbol);

    const assetToken = assetCoin
        ? {
              name: assetCoin.name,
              symbol: assetCoin.symbol,
              coinType: proposal?.asset_type,
              image: resolveCoinIcon({
                  coinType: proposal?.asset_type,
                  symbol: assetCoin.symbol,
                  iconUrl: assetCoin.icon_url,
              }),
              balance: 0,
          }
        : {
              name: assetSymbol,
              symbol: assetSymbol,
              coinType: proposal?.asset_type,
              image: resolveCoinIcon({ coinType: proposal?.asset_type, symbol: assetSymbol }),
              balance: 0,
          };

    const stableToken = stableCoin
        ? {
              name: stableCoin.name,
              symbol: stableCoin.symbol,
              coinType: proposal?.stable_type,
              image: resolveCoinIcon({
                  coinType: proposal?.stable_type,
                  symbol: stableCoin.symbol,
                  iconUrl: stableCoin.icon_url,
              }),
              balance: 0,
          }
        : {
              name: stableSymbol,
              symbol: stableSymbol,
              coinType: proposal?.stable_type,
              image: resolveCoinIcon({ coinType: proposal?.stable_type, symbol: stableSymbol }),
              balance: 0,
          };

    // Use controlled value if provided, otherwise use internal state
    const selectedOutcome = controlledOutcome ?? internalSelectedOutcome;
    const selectedOutcomeLabel = outcomeMessages[selectedOutcome] || `Outcome ${selectedOutcome}`;
    const assetDecimals = proposal?.asset_decimals || 9;
    const stableDecimals = proposal?.stable_decimals || 9;
    const inputDecimals = isBuy ? stableDecimals : assetDecimals;
    const outputDecimals = isBuy ? assetDecimals : stableDecimals;

    const balanceSnapshot = useMemo(() => {
        const spotAssetRaw: bigint = balances?.spot?.asset?.raw ?? 0n;
        const spotStableRaw: bigint = balances?.spot?.stable?.raw ?? 0n;

        const outcomeBalance = balances?.outcomes?.[selectedOutcome];
        const conditionalAssetRaw: bigint = outcomeBalance?.conditionalAsset?.raw ?? 0n;
        const conditionalStableRaw: bigint = outcomeBalance?.conditionalStable?.raw ?? 0n;

        // Include wrapper balances for the selected outcome (smart swaps can unwrap these).
        const wrapperOutcomes = balances?.balanceWrappers?.flatMap((wrapper) => wrapper.outcomes ?? []) ?? [];
        const wrapperAssetRaw: bigint = wrapperOutcomes
            .filter((outcome) => outcome.outcomeIndex === selectedOutcome)
            .reduce((sum: bigint, outcome) => sum + (outcome.asset.raw ?? 0n), 0n);
        const wrapperStableRaw: bigint = wrapperOutcomes
            .filter((outcome) => outcome.outcomeIndex === selectedOutcome)
            .reduce((sum: bigint, outcome) => sum + (outcome.stable.raw ?? 0n), 0n);

        const assetTotalRaw = spotAssetRaw + conditionalAssetRaw + wrapperAssetRaw;
        const stableTotalRaw = spotStableRaw + conditionalStableRaw + wrapperStableRaw;

        return {
            spotAssetRaw,
            spotStableRaw,
            conditionalAssetRaw,
            conditionalStableRaw,
            wrapperAssetRaw,
            wrapperStableRaw,
            assetTotalRaw,
            stableTotalRaw,
            availableForSellRaw: assetTotalRaw,
            availableForBuyRaw: stableTotalRaw,
        };
    }, [balances, selectedOutcome]);

    const inputSourceRows = useMemo<SourceRow[]>(
        () =>
            isBuy
                ? [
                      {
                          label: `Conditional (${selectedOutcomeLabel})`,
                          raw: balanceSnapshot.conditionalStableRaw + balanceSnapshot.wrapperStableRaw,
                          decimals: stableDecimals,
                      },
                      { label: "Spot", raw: balanceSnapshot.spotStableRaw, decimals: stableDecimals },
                      {
                          label: "Total usable",
                          raw: balanceSnapshot.availableForBuyRaw,
                          decimals: stableDecimals,
                      },
                  ]
                : [
                      {
                          label: `Conditional (${selectedOutcomeLabel})`,
                          raw: balanceSnapshot.conditionalAssetRaw + balanceSnapshot.wrapperAssetRaw,
                          decimals: assetDecimals,
                      },
                      { label: "Spot", raw: balanceSnapshot.spotAssetRaw, decimals: assetDecimals },
                      {
                          label: "Total usable",
                          raw: balanceSnapshot.availableForSellRaw,
                          decimals: assetDecimals,
                      },
                  ],
        [isBuy, selectedOutcomeLabel, balanceSnapshot, stableDecimals, assetDecimals]
    );

    const spotRows = useMemo<SourceRow[]>(
        () => [
            { label: assetSymbol, raw: balanceSnapshot.spotAssetRaw, decimals: assetDecimals },
            { label: stableSymbol, raw: balanceSnapshot.spotStableRaw, decimals: stableDecimals },
        ],
        [
            assetSymbol,
            stableSymbol,
            balanceSnapshot.spotAssetRaw,
            balanceSnapshot.spotStableRaw,
            assetDecimals,
            stableDecimals,
        ]
    );

    const conditionalByOutcomeRows = useMemo<OutcomeConditionalRow[]>(() => {
        const wrapperOutcomes = balances?.balanceWrappers?.flatMap((wrapper) => wrapper.outcomes ?? []) ?? [];
        const outcomeCount = Math.max(outcomeMessages.length, balances?.outcomes?.length ?? 0);

        return Array.from({ length: outcomeCount }, (_, outcomeIndex) => {
            const message = outcomeMessages[outcomeIndex] || `Outcome ${outcomeIndex}`;
            const outcomeBalance = balances?.outcomes?.[outcomeIndex];
            const assetConditionalRaw = outcomeBalance?.conditionalAsset?.raw ?? 0n;
            const stableConditionalRaw = outcomeBalance?.conditionalStable?.raw ?? 0n;
            const assetWrapperRaw = wrapperOutcomes
                .filter((outcome) => outcome.outcomeIndex === outcomeIndex)
                .reduce((sum: bigint, outcome) => sum + outcome.asset.raw, 0n);
            const stableWrapperRaw = wrapperOutcomes
                .filter((outcome) => outcome.outcomeIndex === outcomeIndex)
                .reduce((sum: bigint, outcome) => sum + outcome.stable.raw, 0n);

            return {
                outcomeIndex,
                message,
                assetTotalRaw: assetConditionalRaw + assetWrapperRaw,
                stableTotalRaw: stableConditionalRaw + stableWrapperRaw,
            };
        });
    }, [balances, outcomeMessages]);

    const fromBalanceRaw = isBuy ? balanceSnapshot.availableForBuyRaw : balanceSnapshot.availableForSellRaw;
    const toBalanceRaw = isBuy ? balanceSnapshot.assetTotalRaw : balanceSnapshot.stableTotalRaw;
    const fromBalanceDisplay = formatUnits(fromBalanceRaw, inputDecimals, {
        maxFractionDigits: 4,
        trimTrailingZeros: true,
        useGrouping: true,
    });
    const toBalanceDisplay = formatUnits(toBalanceRaw, outputDecimals, {
        maxFractionDigits: 4,
        trimTrailingZeros: true,
        useGrouping: true,
    });
    const fromBalanceMaxValue = formatUnitsForInput(fromBalanceRaw, inputDecimals);
    const toBalanceMaxValue = formatUnitsForInput(toBalanceRaw, outputDecimals);
    const fromAmountRaw = useMemo(
        () => safeParseAmountToBigInt(fromAmountStr, inputDecimals),
        [fromAmountStr, inputDecimals]
    );

    const fromToken = isBuy ? stableToken : assetToken;
    const toToken = isBuy ? assetToken : stableToken;

    // Debounce the amount string (1s) — direction/outcome changes take effect immediately
    const debouncedAmountStr = useDebouncedValue(fromAmountStr, QUOTE_DEBOUNCE_MS);

    // Quote via React Query — uses devInspect on conditional AMM
    const debouncedAmountRaw = useMemo(
        () => safeParseAmountToBigInt(debouncedAmountStr, inputDecimals),
        [debouncedAmountStr, inputDecimals]
    );
    const quoteEnabled =
        !!proposal?.escrow_id &&
        !!proposal?.spot_pool_id &&
        !!proposal?.lp_type &&
        !isLegacyV2 &&
        (proposal?.state === "active" || proposal?.state === "awaiting_execution") &&
        debouncedAmountRaw > 0n;
    const isQuoteStaleForInput = fromAmountRaw !== debouncedAmountRaw;
    const protocolVersion = getProtocolVersionForProposal(proposal);

    const {
        data: quoteResult,
        isLoading: quoteLoading,
        isError: quoteIsError,
        error: quoteError,
    } = useQuery({
        queryKey: [
            "quote",
            proposal?.id,
            proposal?.escrow_id,
            proposal?.market_state_id,
            proposal?.spot_pool_id,
            proposal?.asset_type,
            proposal?.stable_type,
            proposal?.lp_type,
            proposal?.asset_decimals,
            proposal?.stable_decimals,
            protocolVersion,
            debouncedAmountRaw.toString(),
            isBuy,
            selectedOutcome,
        ],
        queryFn: async () => {
            const sdk = getSDKForProposal(proposal);
            const amountInRaw = debouncedAmountRaw;
            if (amountInRaw === 0n) return null;

            return sdk.proposal.trade.getQuote({
                proposalId: String(proposal!.id),
                escrowId: proposal!.escrow_id!,
                spotPoolId: proposal!.spot_pool_id!,
                assetType: proposal!.asset_type,
                stableType: proposal!.stable_type,
                lpType: proposal!.lp_type!,
                outcomeIndex: selectedOutcome,
                amountIn: amountInRaw,
                direction: isBuy ? "stableToAsset" : "assetToStable",
            });
        },
        enabled: quoteEnabled,
        staleTime: 10_000,
        retry: 1,
    });

    // Derive swap details + output amount from quote
    const { swapDetails, toAmountStr, minAmountOutRaw, minAmountOutDisplay } = useMemo(() => {
        if (!quoteResult) {
            return { swapDetails: null, toAmountStr: "", minAmountOutRaw: 0n, minAmountOutDisplay: "" };
        }

        const amountOutRaw = quoteResult.amountOut;
        const minAmountOutRaw = (amountOutRaw * (10_000n - slippageBps)) / 10_000n;
        const exactAmountOutDisplay = formatUnits(amountOutRaw, outputDecimals, {
            maxFractionDigits: outputDecimals,
            trimTrailingZeros: true,
            useGrouping: false,
        });
        const minAmountOutDisplay = formatUnits(minAmountOutRaw, outputDecimals, {
            maxFractionDigits: outputDecimals,
            trimTrailingZeros: true,
            useGrouping: false,
        });
        const feeAmountDisplay = formatUnits(quoteResult.feeAmountIn, inputDecimals, {
            maxFractionDigits: inputDecimals,
            trimTrailingZeros: true,
            useGrouping: false,
        });
        const exactAmountOut = Number.parseFloat(exactAmountOutDisplay || "0");
        const minAmountOut = Number.parseFloat(minAmountOutDisplay || "0");
        const ammFee = Number.parseFloat(feeAmountDisplay || "0");
        const stableRaw = isBuy ? debouncedAmountRaw : amountOutRaw;
        const assetRaw = isBuy ? amountOutRaw : debouncedAmountRaw;
        const executionPrice = priceStablePerAssetNumber({
            stableRaw,
            stableDecimals,
            assetRaw,
            assetDecimals,
        });

        return {
            toAmountStr: exactAmountOutDisplay,
            minAmountOutRaw,
            minAmountOutDisplay,
            swapDetails: {
                exactAmountOut,
                minAmountOut,
                ammFee,
                priceImpact: bpsToPercentNumber(quoteResult.priceImpactBps),
                averagePrice: executionPrice,
                finalPrice: executionPrice,
                startPrice: executionPrice,
                newReserveIn: 0,
                newReserveOut: 0,
            } as SwapBreakdown,
        };
    }, [quoteResult, outputDecimals, inputDecimals, isBuy, debouncedAmountRaw, stableDecimals, assetDecimals, slippageBps]);

    // Handle trade submission
    const handleTrade = useCallback(async () => {
        if (submittingRef.current) return; // Double-submit guard
        if (
            fromAmountRaw === 0n ||
            debouncedAmountRaw === 0n ||
            isQuoteStaleForInput ||
            !swapDetails ||
            !quoteResult ||
            !proposal?.escrow_id ||
            !proposal?.market_state_id ||
            !proposal?.spot_pool_id ||
            !proposal?.lp_type ||
            isLegacyV2 ||
            !account
        )
            return;

        submittingRef.current = true;
        try {
            const sdk = getSDKForProposal(proposal);
            const amountIn = debouncedAmountRaw;
            const minAmountOut = minAmountOutRaw;
            const direction = isBuy ? "stable_to_asset" : "asset_to_stable";

            // Build outcome coin types from proposal
            const { assetTypes, stableTypes } = parseConditionalTypes(proposal);
            const allOutcomeCoins = assetTypes.map((assetCoinType, i) => ({
                outcomeIndex: i,
                assetCoinType,
                stableCoinType: stableTypes[i],
            }));

            const availableCoins = await sdk.proposal.querySmartSwapAvailableCoins({
                address: account.address,
                outcomeIndex: selectedOutcome,
                direction,
                assetType: proposal.asset_type,
                stableType: proposal.stable_type,
                marketStateId: proposal.market_state_id,
                allOutcomeCoins,
            });

            const { transaction } = sdk.proposal.smartConditionalSwap({
                spotPoolId: proposal.spot_pool_id,
                proposalId: String(proposal.id),
                marketStateId: proposal.market_state_id,
                assetType: proposal.asset_type,
                stableType: proposal.stable_type,
                lpType: proposal.lp_type,
                outcomeIndex: selectedOutcome,
                direction,
                amountIn,
                minAmountOut,
                recipient: account.address,
                allOutcomeCoins,
                availableCoins,
            });

            await executeTransaction(
                transaction,
                {
                    onSuccess: () => {
                        setFromAmountStr("");
                        queryClient.invalidateQueries({ queryKey: balanceKeys.all });
                        queryClient.invalidateQueries({ queryKey: proposalKeys.all });
                        queryClient.invalidateQueries({ queryKey: tradeKeys.all });
                        queryClient.invalidateQueries({ queryKey: priceHistoryKeys.all });
                        queryClient.invalidateQueries({ queryKey: twapHistoryKeys.all });
                        queryClient.invalidateQueries({ queryKey: swapKeys.all });
                        queryClient.invalidateQueries({ queryKey: ["quote"] });
                        queryClient.invalidateQueries({ queryKey: ["spot-price", proposal.spot_pool_id] });
                    },
                },
                {
                    loadingMessage: isBuy ? "Executing buy..." : "Executing sell...",
                    successMessage: isBuy ? "Buy successful!" : "Sell successful!",
                }
            );
        } catch (error) {
            console.error("Trade failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Trade failed");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [
        fromAmountRaw,
        debouncedAmountRaw,
        isQuoteStaleForInput,
        swapDetails,
        quoteResult,
        proposal,
        account,
        isLegacyV2,
        isBuy,
        selectedOutcome,
        executeTransaction,
        queryClient,
        minAmountOutRaw,
    ]);

    // Handle outcome change
    const handleOutcomeChange = useCallback(
        (value: string) => {
            const newOutcome = parseInt(value, 10);
            setInternalSelectedOutcome(newOutcome);
            onOutcomeChange?.(newOutcome);
        },
        [onOutcomeChange]
    );

    // Handle amount change — keep raw string for precision
    const handleAmountChange = useCallback((value: string) => {
        setFromAmountStr(value);
    }, []);

    const isLoading = txLoading || (quoteLoading && quoteEnabled);

    // Determine button state and text
    const { isButtonDisabled, buttonText } = useMemo(() => {
        const availableRaw = isBuy ? balanceSnapshot.availableForBuyRaw : balanceSnapshot.availableForSellRaw;

        if (!account) {
            return { isButtonDisabled: true, buttonText: "Connect Wallet" };
        }
        if (isLegacyV2) {
            return { isButtonDisabled: true, buttonText: "Market Closed" };
        }
        if (fromAmountRaw === 0n) {
            return { isButtonDisabled: true, buttonText: "Enter Amount" };
        }
        if (fromAmountRaw > availableRaw) {
            return { isButtonDisabled: true, buttonText: "Insufficient Balance" };
        }
        if (isQuoteStaleForInput) {
            return { isButtonDisabled: true, buttonText: "Updating Quote..." };
        }
        if (quoteLoading && quoteEnabled) {
            return { isButtonDisabled: true, buttonText: "Getting Quote..." };
        }
        if (quoteIsError) {
            return { isButtonDisabled: true, buttonText: "Quote Failed" };
        }
        if (!swapDetails) {
            return { isButtonDisabled: true, buttonText: "Enter Amount" };
        }
        return {
            isButtonDisabled: txLoading,
            buttonText: isBuy ? "Buy" : "Sell",
        };
    }, [
        account,
        isLegacyV2,
        fromAmountRaw,
        isQuoteStaleForInput,
        isBuy,
        quoteEnabled,
        quoteLoading,
        quoteIsError,
        swapDetails,
        balanceSnapshot.availableForBuyRaw,
        balanceSnapshot.availableForSellRaw,
        txLoading,
    ]);

    const quoteStatusText = useMemo(() => {
        if (fromAmountRaw === 0n) return "Enter amount to simulate";
        if (isQuoteStaleForInput) return "Waiting for updated simulation...";
        if (!quoteEnabled) return "Enter amount to simulate";
        if (quoteLoading) return "Simulating...";
        if (quoteIsError) {
            const errorMessage =
                quoteError instanceof Error && quoteError.message ? quoteError.message : "Simulation failed";
            return `Simulation failed: ${errorMessage}`;
        }
        if (quoteResult) return "Estimated (simulated on-chain)";
        return "No simulation result";
    }, [fromAmountRaw, isQuoteStaleForInput, quoteEnabled, quoteLoading, quoteIsError, quoteError, quoteResult]);

    return (
        <Card className="bg-card-elevated flex flex-col gap-2 transition-all duration-300 ease-in-out">
            {/* Outcome Selection */}
            <Select
                allowSearch={false}
                onChange={handleOutcomeChange}
                options={outcomeMessages.map((message, i) => ({
                    value: i.toString(),
                    label: message,
                    color: getOutcomeColor(i, outcomeMessages.length),
                }))}
                allowClear={false}
                value={selectedOutcome.toString()}
                placeholder="Select Outcome"
            />

            {/* Buy/Sell Toggle */}
            <TradeDirectionToggle isBuy={isBuy} setIsBuy={setIsBuy} />

            {/* Input Amount */}
            <TokenInput
                value={fromAmountStr}
                onChange={handleAmountChange}
                placeholder="0.00"
                balance={fromBalanceDisplay}
                maxBalanceValue={fromBalanceMaxValue}
                tokens={[fromToken]}
                label={"Selling"}
            />

            <TradeDirectionSwapButton isBuy={isBuy} setIsBuy={(p) => setIsBuy(p)} />

            <TokenInput
                value={toAmountStr}
                onChange={() => {}}
                placeholder="0.00"
                balance={toBalanceDisplay}
                maxBalanceValue={toBalanceMaxValue}
                tokens={[toToken]}
                label={"Buying"}
            />
            <div className="flex items-center justify-between text-[10px] text-text-tertiary px-1">
                <span>Output quote</span>
                <span className={quoteIsError ? "text-error-light" : ""}>{quoteStatusText}</span>
            </div>

            <div className="flex items-center justify-between text-[10px] text-text-tertiary px-1">
                <span>Conditional AMM LP Fee</span>
                <span className="text-text-primary tabular-nums">
                    {proposal?.dao_conditional_amm_fee_bps != null
                        ? `${proposal.dao_conditional_amm_fee_bps} bps`
                        : "—"}
                </span>
            </div>

            <div className="rounded-md border border-border/40 bg-card p-2">
                <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Conditional balances</div>
                <div className="mt-1 space-y-1 text-xs">
                    {inputSourceRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                            <span className="text-text-muted">{row.label}</span>
                            <span className="font-mono text-text-primary">
                                {formatRawAmount(row.raw, row.decimals)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-md border border-border/40 bg-card p-2">
                <div className="text-[10px] uppercase tracking-wide text-text-tertiary">Spot balances</div>
                <div className="mt-1 space-y-1 text-xs">
                    {spotRows.map((row) => (
                        <div key={row.label} className="flex items-center justify-between">
                            <span className="text-text-muted">{row.label}</span>
                            <span className="font-mono text-text-primary">
                                {formatRawAmount(row.raw, row.decimals)}
                            </span>
                        </div>
                    ))}
                </div>
            </div>

            <div className="rounded-md border border-border/40 bg-card p-2">
                <div className="mt-2 overflow-x-auto">
                    <table className="w-full text-xs">
                        <thead>
                            <tr className="text-text-tertiary">
                                <th className="text-left font-medium pb-1">Outcome</th>
                                <th className="text-right font-medium pb-1">{assetSymbol}</th>
                                <th className="text-right font-medium pb-1">{stableSymbol}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {conditionalByOutcomeRows.map((row) => (
                                <tr key={row.outcomeIndex} className="border-t border-border/20 align-top">
                                    <td className="py-1.5 pr-2">
                                        <div className="flex items-center gap-1.5">
                                            <span
                                                className="h-1.5 w-1.5 rounded-full"
                                                style={{
                                                    backgroundColor: getOutcomeColor(
                                                        row.outcomeIndex,
                                                        conditionalByOutcomeRows.length || 1
                                                    ),
                                                }}
                                            />
                                            <span className="text-text-primary">{row.message}</span>
                                        </div>
                                    </td>
                                    <td className="py-1.5 text-right">
                                        <div className="font-mono text-text-primary">
                                            {formatRawAmount(row.assetTotalRaw, assetDecimals)}
                                        </div>
                                    </td>
                                    <td className="py-1.5 text-right">
                                        <div className="font-mono text-text-primary">
                                            {formatRawAmount(row.stableTotalRaw, stableDecimals)}
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Swap Details */}
            <div
                className="overflow-hidden transition-all duration-300 ease-in-out"
                style={{
                    maxHeight: swapDetails ? "500px" : "0px",
                    opacity: swapDetails ? 1 : 0,
                }}
            >
                {swapDetails && (
                    <TradeDetails
                        amount={fromAmountStr}
                        swapDetails={swapDetails}
                        minAmountOutDisplay={minAmountOutDisplay}
                        isBuy={isBuy}
                        tolerance={Number(slippageBps) / 100}
                        assetSymbol={assetSymbol}
                        stableSymbol={stableSymbol}
                    />
                )}
            </div>

            <SlippageSelector valueBps={slippageBps} onChange={setSlippageBps} />

            {/* Trade Button */}
            <Button className="w-full mt-1" onClick={handleTrade} disabled={isButtonDisabled} isLoading={isLoading}>
                {buttonText}
            </Button>
        </Card>
    );
}
