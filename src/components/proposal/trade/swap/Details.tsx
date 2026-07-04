import { Tooltip } from "@/components/overlays/Tooltip";
import type { SwapBreakdown } from "@/lib/trade/types";

interface TradeDetailsProps {
    amount: string;
    swapDetails: SwapBreakdown | null;
    minAmountOutDisplay?: string;
    isBuy: boolean;
    tolerance: number;
    assetSymbol?: string;
    stableSymbol?: string;
}

function formatDisplayNumber(value: number, maxFractionDigits = 6): string {
    if (!Number.isFinite(value)) return "0";
    return value.toLocaleString(undefined, {
        minimumFractionDigits: 0,
        maximumFractionDigits: maxFractionDigits,
    });
}

export function TradeDetails(props: TradeDetailsProps) {
    const {
        amount,
        swapDetails,
        minAmountOutDisplay,
        isBuy,
        tolerance,
        assetSymbol = "GOVEX",
        stableSymbol = "USDC",
    } = props;

    if (!amount || !swapDetails) return null;
    return (
        <div className="space-y-2">
            <div className="grid grid-cols-2 gap-2 w-full text-xs">
                <div className="rounded-md border border-border-light bg-white/[0.035] px-3 py-1.5 flex justify-between items-center">
                    <p className="text-text-tertiary font-medium text-xs">Price Impact</p>
                    <span
                        className={`font-semibold ${
                            swapDetails.priceImpact > 5 || swapDetails.priceImpact < -5
                                ? "text-error-light"
                                : swapDetails.priceImpact > 2 || swapDetails.priceImpact < -2
                                  ? "text-amber-400"
                                  : "text-success-light"
                        }`}
                    >
                        {formatDisplayNumber(swapDetails.priceImpact, 4)}%
                    </span>
                </div>
                <div className="rounded-md border border-border-light bg-white/[0.035] px-3 py-1 flex justify-between items-center">
                    <p className="text-text-tertiary font-medium text-xs">Slippage</p>
                    <p className="text-primary-light font-semibold text-xs">{formatDisplayNumber(tolerance, 4)}%</p>
                </div>
            </div>

            <div className="space-y-1 p-2 text-xs">
                <div className="flex justify-between items-center">
                    <p className="text-text-tertiary text-xs">Price</p>
                    <Tooltip
                        content={
                            <div className="flex flex-col gap-1">
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-tertiary">Start:</span>
                                    <span className="text-text-primary font-medium">
                                        {formatDisplayNumber(swapDetails.startPrice)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-tertiary">Average:</span>
                                    <span className="text-text-primary font-medium">
                                        {formatDisplayNumber(swapDetails.averagePrice)}
                                    </span>
                                </div>
                                <div className="flex justify-between gap-3">
                                    <span className="text-text-tertiary">Final:</span>
                                    <span className="text-text-primary font-medium">
                                        {formatDisplayNumber(swapDetails.finalPrice)}
                                    </span>
                                </div>
                            </div>
                        }
                        position="top"
                    >
                        <p className="text-primary-light font-medium cursor-pointer underline decoration-dotted text-xs">
                            {formatDisplayNumber(swapDetails.finalPrice)}
                        </p>
                    </Tooltip>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-text-tertiary text-xs">Fee</p>
                    <p className="text-text-primary font-medium text-xs">
                        {formatDisplayNumber(swapDetails.ammFee)} {isBuy ? stableSymbol : assetSymbol}
                    </p>
                </div>
                <div className="flex justify-between items-center">
                    <p className="text-text-tertiary text-xs">Min Received</p>
                    <p className="text-text-primary font-medium text-xs">
                        {minAmountOutDisplay || formatDisplayNumber(swapDetails.minAmountOut)}{" "}
                        {isBuy ? assetSymbol : stableSymbol}
                    </p>
                </div>
            </div>
        </div>
    );
}
