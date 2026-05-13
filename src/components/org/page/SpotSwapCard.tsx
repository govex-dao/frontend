import { useCallback, useEffect, useMemo, useState } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID, SUI_TYPE_ARG } from "@mysten/sui/utils";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";

import type { DAO, Token } from "@/types";
import { useCoins } from "@/hooks/api";
import { useSuiTransaction, isNotifiedTransactionError } from "@/hooks/useSuiTransaction";
import { Card } from "@/components/Card";
import { Button } from "@/components/inputs/Button";
import { TokenInput } from "@/components/inputs/TokenInput";
import { TradeDirectionSwapButton, TradeDirectionToggle } from "@/components/proposal/trade/swap/DirectionToggles";
import { SlippageSelector } from "@/components/proposal/trade/swap/SlippageSelector";
import { getProtocolVersionForDAO, getSDKForDAO, isLegacyV2DAO } from "@/lib/sdk";
import { resolveCoinIcon } from "@/lib/coin/icons";
import { parseAmountToBigInt } from "@/lib/parseAmount";
import { selectCoinObjectsForAmount } from "@/lib/sui/selectCoins";

const SUI_COIN_TYPE = SUI_TYPE_ARG;
const DEFAULT_SLIPPAGE_BPS = 30n; // 0.3%
const QUOTE_DEBOUNCE_MS = 700;
const MIN_SUI_GAS_RESERVE = 10_000_000n; // 0.01 SUI

function useDebouncedValue<T>(value: T, delay: number): T {
    const [debounced, setDebounced] = useState(value);
    useEffect(() => {
        const timer = setTimeout(() => setDebounced(value), delay);
        return () => clearTimeout(timer);
    }, [value, delay]);
    return debounced;
}

function formatWithCommas(intPart: string): string {
    return intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
}

function formatUnits(
    amount: bigint,
    decimals: number,
    opts?: { maxFractionDigits?: number; trimTrailingZeros?: boolean; useGrouping?: boolean }
): string {
    if (decimals <= 0) {
        const raw = amount.toString();
        return opts?.useGrouping === false ? raw : formatWithCommas(raw);
    }
    const raw = amount.toString();
    const padded = raw.padStart(decimals + 1, "0");
    const intPart = padded.slice(0, -decimals) || "0";
    let fracPart = padded.slice(-decimals);

    const maxFractionDigits = opts?.maxFractionDigits ?? decimals;
    fracPart = fracPart.slice(0, Math.max(0, maxFractionDigits));

    if (opts?.trimTrailingZeros !== false) {
        fracPart = fracPart.replace(/0+$/, "");
    }

    const intWithCommas = opts?.useGrouping === false ? intPart : formatWithCommas(intPart);
    return fracPart ? `${intWithCommas}.${fracPart}` : intWithCommas;
}

function safeParseAmountToBigInt(amount: string, decimals: number): bigint {
    try {
        return parseAmountToBigInt(amount, decimals);
    } catch {
        return 0n;
    }
}

function leavesInsufficientSuiForGas(amount: bigint, balance: bigint, coinType: string): boolean {
    return coinType === SUI_COIN_TYPE && amount + MIN_SUI_GAS_RESERVE > balance;
}

function formatPriceStablePerAsset(config: {
    stableRaw: bigint;
    stableDecimals: number;
    assetRaw: bigint;
    assetDecimals: number;
    precision?: number;
}): string | null {
    const precision = config.precision ?? 6;
    if (config.assetRaw === 0n) return null;

    // price = (stableRaw / 10^stableDecimals) / (assetRaw / 10^assetDecimals)
    // scaled = price * 10^precision = stableRaw * 10^(assetDecimals + precision) / (assetRaw * 10^stableDecimals)
    const numerator = config.stableRaw * 10n ** BigInt(config.assetDecimals + precision);
    const denominator = config.assetRaw * 10n ** BigInt(config.stableDecimals);
    if (denominator === 0n) return null;

    const scaled = numerator / denominator; // integer scaled by 10^precision
    const raw = scaled.toString();
    const padded = raw.padStart(precision + 1, "0");
    const intPart = padded.slice(0, -precision) || "0";
    let fracPart = padded.slice(-precision);
    fracPart = fracPart.replace(/0+$/, "");
    const intWithCommas = formatWithCommas(intPart);
    return fracPart ? `${intWithCommas}.${fracPart}` : intWithCommas;
}

export function SpotSwapCard({ dao }: { dao: DAO }) {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading: txLoading } = useSuiTransaction();
    const { data: coinMetadata } = useCoins();

    const [isBuy, setIsBuy] = useState(true); // true = stable -> asset, false = asset -> stable
    const [fromAmountStr, setFromAmountStr] = useState("");
    const [slippageBps, setSlippageBps] = useState<bigint>(DEFAULT_SLIPPAGE_BPS);
    const debouncedAmountStr = useDebouncedValue(fromAmountStr, QUOTE_DEBOUNCE_MS);
    const isDebouncing = fromAmountStr !== debouncedAmountStr;
    const isLegacyV2 = isLegacyV2DAO(dao);

    const poolId = dao.spot_pool_id;
    const lpType = dao.lp_type;
    const poolReady = !!poolId && !!lpType && !isLegacyV2;
    const protocolVersion = getProtocolVersionForDAO(dao);

    const assetMeta = coinMetadata?.find((c) => c.coin_type === dao.asset_type);
    const stableMeta = coinMetadata?.find((c) => c.coin_type === dao.stable_type);

    const assetSymbol = assetMeta?.symbol || dao.asset_symbol || "ASSET";
    const stableSymbol = stableMeta?.symbol || dao.stable_symbol || "STABLE";
    const inputDecimals = isBuy ? dao.stable_decimals : dao.asset_decimals;
    const outputDecimals = isBuy ? dao.asset_decimals : dao.stable_decimals;
    const inputType = isBuy ? dao.stable_type : dao.asset_type;

    // Fetch wallet balances for asset and stable
    const { data: assetBalance } = useQuery({
        queryKey: ["coin-balance", account?.address, dao.asset_type],
        queryFn: async () => {
            if (!account) return 0n;
            const result = await suiClient.getBalance({ owner: account.address, coinType: dao.asset_type });
            return BigInt(result.totalBalance);
        },
        enabled: !!account,
        refetchInterval: 10_000,
    });

    const { data: stableBalance } = useQuery({
        queryKey: ["coin-balance", account?.address, dao.stable_type],
        queryFn: async () => {
            if (!account) return 0n;
            const result = await suiClient.getBalance({ owner: account.address, coinType: dao.stable_type });
            return BigInt(result.totalBalance);
        },
        enabled: !!account,
        refetchInterval: 10_000,
    });

    const inputBalanceRaw = isBuy ? (stableBalance ?? 0n) : (assetBalance ?? 0n);
    const outputBalanceRaw = isBuy ? (assetBalance ?? 0n) : (stableBalance ?? 0n);
    const fromAmountRaw = useMemo(
        () => safeParseAmountToBigInt(fromAmountStr, inputDecimals),
        [fromAmountStr, inputDecimals]
    );
    const debouncedAmountRaw = useMemo(
        () => safeParseAmountToBigInt(debouncedAmountStr, inputDecimals),
        [debouncedAmountStr, inputDecimals]
    );
    const fromBalanceDisplay = formatUnits(inputBalanceRaw, inputDecimals, {
        maxFractionDigits: 4,
        trimTrailingZeros: true,
    });
    const toBalanceDisplay = formatUnits(outputBalanceRaw, outputDecimals, {
        maxFractionDigits: 4,
        trimTrailingZeros: true,
    });
    const fromBalanceMaxValue = formatUnits(inputBalanceRaw, inputDecimals, {
        maxFractionDigits: inputDecimals,
        trimTrailingZeros: true,
        useGrouping: false,
    });
    const toBalanceMaxValue = formatUnits(outputBalanceRaw, outputDecimals, {
        maxFractionDigits: outputDecimals,
        trimTrailingZeros: true,
        useGrouping: false,
    });

    const assetToken: Token = useMemo(
        () => ({
            name: assetMeta?.name || assetSymbol,
            symbol: assetSymbol,
            coinType: dao.asset_type,
            image: resolveCoinIcon({ coinType: dao.asset_type, symbol: assetSymbol, iconUrl: assetMeta?.icon_url }),
            balance: assetBalance
                ? Number(formatUnits(assetBalance, dao.asset_decimals, { maxFractionDigits: 4, useGrouping: false }))
                : 0,
        }),
        [assetMeta?.icon_url, assetMeta?.name, assetSymbol, assetBalance, dao.asset_decimals, dao.asset_type]
    );

    const stableToken: Token = useMemo(
        () => ({
            name: stableMeta?.name || stableSymbol,
            symbol: stableSymbol,
            coinType: dao.stable_type,
            image: resolveCoinIcon({ coinType: dao.stable_type, symbol: stableSymbol, iconUrl: stableMeta?.icon_url }),
            balance: stableBalance
                ? Number(formatUnits(stableBalance, dao.stable_decimals, { maxFractionDigits: 4, useGrouping: false }))
                : 0,
        }),
        [stableMeta?.icon_url, stableMeta?.name, stableSymbol, stableBalance, dao.stable_decimals, dao.stable_type]
    );

    const fromToken = isBuy ? stableToken : assetToken;
    const toToken = isBuy ? assetToken : stableToken;

    const quoteEnabled = poolReady && debouncedAmountRaw > 0n;

    const {
        data: quote,
        isLoading: quoteLoading,
        error: quoteError,
    } = useQuery({
        queryKey: [
            "spot-quote",
            dao.id,
            poolId,
            lpType,
            dao.asset_type,
            dao.stable_type,
            dao.asset_decimals,
            dao.stable_decimals,
            protocolVersion,
            isBuy,
            debouncedAmountRaw.toString(),
        ],
        queryFn: async () => {
            const sdk = getSDKForDAO(dao);
            if (debouncedAmountRaw === 0n) return null;

            const result = await sdk.market.getQuote({
                poolId: poolId!,
                assetType: dao.asset_type,
                stableType: dao.stable_type,
                lpType: lpType!,
                amountIn: debouncedAmountRaw,
                isAssetToStable: !isBuy,
            });

            return { amountIn: debouncedAmountRaw, amountOut: result.amountOut, feeBps: result.feeBps };
        },
        enabled: quoteEnabled,
        staleTime: 10_000,
        retry: 1,
    });
    const spotAmmFeeDisplay = quote?.feeBps != null ? `${quote.feeBps} bps` : "—";

    const { toAmountDisplay, priceDisplay } = useMemo(() => {
        if (!quote) return { toAmountDisplay: "", priceDisplay: null as string | null };

        const toAmountDisplay = formatUnits(quote.amountOut, outputDecimals, {
            maxFractionDigits: 6,
            trimTrailingZeros: true,
        });

        const stableRaw = isBuy ? quote.amountIn : quote.amountOut;
        const assetRaw = isBuy ? quote.amountOut : quote.amountIn;
        const priceDisplay = formatPriceStablePerAsset({
            stableRaw,
            stableDecimals: dao.stable_decimals,
            assetRaw,
            assetDecimals: dao.asset_decimals,
            precision: 6,
        });

        return { toAmountDisplay, priceDisplay };
    }, [quote, isBuy, dao.asset_decimals, dao.stable_decimals, outputDecimals]);

    const isLoading = txLoading || (quoteLoading && quoteEnabled);

    const { isButtonDisabled, buttonText } = useMemo(() => {
        if (!poolReady) {
            return { isButtonDisabled: true, buttonText: "Pool Not Available" };
        }
        if (!account) {
            return { isButtonDisabled: true, buttonText: "Connect Wallet" };
        }
        if (fromAmountRaw === 0n) {
            return { isButtonDisabled: true, buttonText: "Enter Amount" };
        }
        if (fromAmountRaw > inputBalanceRaw) {
            return { isButtonDisabled: true, buttonText: "Insufficient Balance" };
        }
        if (leavesInsufficientSuiForGas(fromAmountRaw, inputBalanceRaw, inputType)) {
            return { isButtonDisabled: true, buttonText: "Leave SUI For Gas" };
        }
        if (isDebouncing || (quoteLoading && quoteEnabled)) {
            return { isButtonDisabled: true, buttonText: "Getting Quote..." };
        }
        if (quoteError) {
            return { isButtonDisabled: true, buttonText: "Quote Failed" };
        }
        if (!quote || quote.amountOut === 0n) {
            return { isButtonDisabled: true, buttonText: "No Quote" };
        }
        return { isButtonDisabled: false, buttonText: isBuy ? `Buy ${assetSymbol}` : `Sell ${assetSymbol}` };
    }, [
        account,
        assetSymbol,
        fromAmountRaw,
        inputBalanceRaw,
        inputType,
        isBuy,
        isDebouncing,
        poolReady,
        quote,
        quoteEnabled,
        quoteError,
        quoteLoading,
    ]);

    const handleSwap = useCallback(async () => {
        if (!account) return;
        if (!poolReady || isLegacyV2) return;
        if (fromAmountStr !== debouncedAmountStr) return;

        try {
            const sdk = getSDKForDAO(dao);
            const inType = isBuy ? dao.stable_type : dao.asset_type;
            const amountIn = fromAmountRaw;

            if (amountIn === 0n) return;
            if (amountIn > inputBalanceRaw) {
                toast.error("Insufficient balance");
                return;
            }
            if (leavesInsufficientSuiForGas(amountIn, inputBalanceRaw, inType)) {
                toast.error("Leave some SUI for gas");
                return;
            }

            // Use the last computed quote as long as it's for the current amount (debounce guard).
            const amountOut = quote?.amountOut;
            if (!amountOut || amountOut === 0n) {
                toast.error("No quote available");
                return;
            }

            const minOut = (amountOut * (10_000n - slippageBps)) / 10_000n;

            const tx = new Transaction();

            let coinIn: ReturnType<Transaction["splitCoins"]>[0];
            if (inType === SUI_COIN_TYPE) {
                [coinIn] = tx.splitCoins(tx.gas, [tx.pure.u64(amountIn)]);
            } else {
                const selected = await selectCoinObjectsForAmount({
                    client: suiClient,
                    owner: account.address,
                    coinType: inType,
                    amount: amountIn,
                });

                if (selected.coins.length === 0) {
                    toast.error(`No ${fromToken.symbol} coins found in wallet`);
                    return;
                }

                if (!selected.isSufficient) {
                    toast.error("Insufficient balance");
                    return;
                }

                if (selected.exceedsMaxCoins) {
                    toast.error("Payment is split across too many coin objects. Merge coins and retry.");
                    return;
                }

                const primary = tx.object(selected.coins[0].coinObjectId);
                const rest = selected.coins.slice(1).map((c) => tx.object(c.coinObjectId));
                if (rest.length > 0) {
                    tx.mergeCoins(primary, rest);
                }
                [coinIn] = tx.splitCoins(primary, [tx.pure.u64(amountIn)]);
            }

            const target = isBuy
                ? `${sdk.packages.futarchyMarketsOperations}::swap_entry::swap_spot_stable_to_asset`
                : `${sdk.packages.futarchyMarketsOperations}::swap_entry::swap_spot_asset_to_stable`;
            const noneBalance = tx.moveCall({
                target: "0x1::option::none",
                typeArguments: [
                    `${sdk.packages.futarchyMarketsPrimitives}::conditional_balance::ConditionalMarketBalance<${dao.asset_type}, ${dao.stable_type}>`,
                ],
                arguments: [],
            });

            // swap_entry handles both paths:
            // - with active wrapped escrow: spot swap + auto-arb
            // - without active wrapped escrow: pure spot swap
            const [outputOpt, balanceOpt] = tx.moveCall({
                target,
                typeArguments: [dao.asset_type, dao.stable_type, lpType!],
                arguments: [
                    tx.object(poolId!),
                    coinIn,
                    tx.pure.u64(minOut),
                    tx.pure.address(account.address),
                    noneBalance,
                    tx.pure.bool(false), // return_balance = false
                    tx.sharedObjectRef({
                        objectId: sdk.sharedObjects.spotPoolMutationRegistry.id,
                        initialSharedVersion: sdk.sharedObjects.spotPoolMutationRegistry.version,
                        mutable: false,
                    }),
                    tx.sharedObjectRef({
                        objectId: sdk.sharedObjects.escrowMutationRegistry.id,
                        initialSharedVersion: sdk.sharedObjects.escrowMutationRegistry.version,
                        mutable: false,
                    }),
                    tx.sharedObjectRef({
                        objectId: sdk.sharedObjects.marketStateMutationRegistry.id,
                        initialSharedVersion: sdk.sharedObjects.marketStateMutationRegistry.version,
                        mutable: false,
                    }),
                    tx.sharedObjectRef({
                        objectId: SUI_CLOCK_OBJECT_ID,
                        initialSharedVersion: 1,
                        mutable: false,
                    }),
                ],
            });
            tx.moveCall({
                target: "0x1::option::destroy_none",
                typeArguments: [`0x2::coin::Coin<${isBuy ? dao.asset_type : dao.stable_type}>`],
                arguments: [outputOpt],
            });
            tx.moveCall({
                target: "0x1::option::destroy_none",
                typeArguments: [
                    `${sdk.packages.futarchyMarketsPrimitives}::conditional_balance::ConditionalMarketBalance<${dao.asset_type}, ${dao.stable_type}>`,
                ],
                arguments: [balanceOpt],
            });

            await executeTransaction(
                tx,
                {
                    onSuccess: () => {
                        setFromAmountStr("");
                        queryClient.invalidateQueries({ queryKey: ["spot-quote"] });
                        queryClient.invalidateQueries({ queryKey: ["coin-balance", account.address] });
                        queryClient.invalidateQueries({ queryKey: ["spot-price", poolId] });
                    },
                },
                {
                    loadingMessage: "Swapping...",
                    successMessage: "Swap successful!",
                }
            );
        } catch (err) {
            console.error("Spot swap failed:", err);
            if (!isNotifiedTransactionError(err)) {
                toast.error(err instanceof Error ? err.message : "Swap failed");
            }
        }
    }, [
        account,
        dao.asset_type,
        dao.id,
        dao.stable_type,
        dao.version,
        isLegacyV2,
        protocolVersion,
        debouncedAmountStr,
        executeTransaction,
        fromAmountRaw,
        fromAmountStr,
        fromToken.symbol,
        inputBalanceRaw,
        isBuy,
        lpType,
        poolId,
        poolReady,
        queryClient,
        quote?.amountOut,
        slippageBps,
        suiClient,
    ]);

    return (
        <Card variant="elevated" className="bg-card-elevated">
            <div className="flex items-start justify-between gap-3 mb-3">
                <div className="min-w-0">
                    <h3 className="text-lg font-semibold">Swap</h3>
                </div>
            </div>

            {!poolReady ? (
                <div className="rounded-lg border border-border-light bg-card-more-elevated p-3 text-sm text-text-muted">
                    This organization does not have a spot pool yet.
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    <TradeDirectionToggle isBuy={isBuy} setIsBuy={setIsBuy} />

                    <TokenInput
                        value={fromAmountStr}
                        onChange={setFromAmountStr}
                        placeholder="0.00"
                        balance={fromBalanceDisplay}
                        maxBalanceValue={fromBalanceMaxValue}
                        tokens={[fromToken]}
                        label="Pay"
                    />

                    <TradeDirectionSwapButton isBuy={isBuy} setIsBuy={setIsBuy} />

                    <TokenInput
                        value={toAmountDisplay}
                        onChange={() => {}}
                        placeholder="0.00"
                        balance={toBalanceDisplay}
                        maxBalanceValue={toBalanceMaxValue}
                        tokens={[toToken]}
                        label="Receive"
                    />

                    <div className="mt-1 rounded-lg border border-border-light bg-card-more-elevated p-3">
                        <div className="flex items-center justify-between gap-3 text-xs">
                            <span className="text-text-muted">Price</span>
                            <span className="text-text-primary tabular-nums">
                                {priceDisplay ? `1 ${assetSymbol} = ${priceDisplay} ${stableSymbol}` : "—"}
                            </span>
                        </div>
                        <div className="mt-2 pt-2 border-t border-border-light/40 flex items-center justify-between gap-3 text-xs">
                            <span className="text-text-muted">Spot AMM Fee</span>
                            <span className="text-text-primary tabular-nums">{spotAmmFeeDisplay}</span>
                        </div>
                    </div>

                    {quoteError && (
                        <div className="text-xs text-error mt-1">
                            Quote failed: {quoteError instanceof Error ? quoteError.message : "Unknown error"}
                        </div>
                    )}

                    <SlippageSelector valueBps={slippageBps} onChange={setSlippageBps} />

                    <Button
                        className="w-full mt-1"
                        onClick={handleSwap}
                        disabled={isButtonDisabled}
                        isLoading={isLoading}
                    >
                        {buttonText}
                    </Button>
                </div>
            )}
        </Card>
    );
}
