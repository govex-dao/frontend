import { calculateStreamAvailableWithTracking } from "@govex/futarchy-sdk";
import { formatAddress } from "@mysten/sui/utils";
import { Download, Loader2, Timer, User, Coins, WalletCards, Users } from "lucide-react";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
import { formatCompactBigInt } from "@/lib/units";
import type { VaultStreamInfo } from "@/lib/sui/multisig";

interface Props {
    stream: VaultStreamInfo;
    onCollect?: (stream: VaultStreamInfo) => void;
    isCollecting?: boolean;
}

function extractCoinSymbol(coinType: string): string {
    // "0x2::sui::SUI" → "SUI", "0x...::usdc::USDC" → "USDC"
    const parts = coinType.split("::");
    return parts.length >= 3 ? parts[parts.length - 1] : coinType.slice(0, 8);
}

/** Format a bigint amount for display. Without coin metadata we show compact notation. */
function formatAmount(raw: bigint, symbol: string): string {
    // Common known decimals
    const KNOWN_DECIMALS: Record<string, number> = { SUI: 9, USDC: 6, USDT: 6 };
    const decimals = KNOWN_DECIMALS[symbol];
    if (decimals != null) {
        const divisor = 10n ** BigInt(decimals);
        const whole = raw / divisor;
        const frac = raw % divisor;
        if (frac === 0n) return whole.toLocaleString();
        const fracStr = frac.toString().padStart(decimals, "0").replace(/0+$/, "");
        return `${whole.toLocaleString()}.${fracStr}`;
    }
    // Fallback: show raw with compact suffix
    return formatCompactBigInt(raw);
}

function formatDuration(ms: number): string {
    if (ms <= 0) return "0m";
    const days = Math.floor(ms / 86_400_000);
    const hours = Math.floor((ms % 86_400_000) / 3_600_000);
    if (days > 0) return `${days}d ${hours}h`;
    const minutes = Math.floor((ms % 3_600_000) / 60_000);
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function percentOf(amount: bigint, total: bigint): number {
    if (total <= 0n || amount <= 0n) return 0;
    const basisPoints = (amount * 10_000n) / total;
    return Math.min(100, Number(basisPoints) / 100);
}

function clampBigInt(value: bigint, min: bigint, max: bigint): bigint {
    if (value < min) return min;
    if (value > max) return max;
    return value;
}

function streamProgress(
    stream: VaultStreamInfo,
    nowMs = Date.now()
): {
    percent: number;
    totalAmount: bigint;
    elapsedIterations: number;
    status: "pending" | "active" | "completed";
} {
    const totalAmount = stream.amountPerIteration * BigInt(stream.iterationsTotal);
    const firstSpendTimeMs = getFirstSpendTimeMs(stream);

    if (stream.iterationPeriodMs <= 0 || stream.iterationsTotal <= 0) {
        return { percent: 100, totalAmount, elapsedIterations: stream.iterationsTotal, status: "completed" };
    }

    if (nowMs < firstSpendTimeMs) {
        return { percent: 0, totalAmount, elapsedIterations: 0, status: "pending" };
    }

    const elapsed = nowMs - stream.startTimeMs;
    const elapsedIterations = Math.min(Math.floor(elapsed / stream.iterationPeriodMs), stream.iterationsTotal);

    if (elapsedIterations >= stream.iterationsTotal) {
        return { percent: 100, totalAmount, elapsedIterations, status: "completed" };
    }

    const percent = Math.round((elapsedIterations / stream.iterationsTotal) * 100);
    return { percent, totalAmount, elapsedIterations, status: "active" };
}

function getFirstSpendTimeMs(stream: VaultStreamInfo): number {
    if (stream.iterationPeriodMs <= 0 || stream.iterationsTotal <= 0) return stream.startTimeMs;
    return stream.startTimeMs + stream.iterationPeriodMs;
}

function streamAvailableAmount(stream: VaultStreamInfo, nowMs = Date.now()): bigint {
    if (stream.isSpendingLimit && stream.expiryMs != null && nowMs >= stream.expiryMs) return 0n;
    try {
        return calculateStreamAvailableWithTracking({
            amountPerIteration: stream.amountPerIteration,
            firstUnclaimedIteration: stream.firstUnclaimedIteration ?? 0n,
            partialClaimedInIteration: stream.partialClaimedInIteration ?? 0n,
            startTimeMs: BigInt(stream.startTimeMs),
            iterationsTotal: BigInt(stream.iterationsTotal),
            iterationPeriodMs: BigInt(stream.iterationPeriodMs),
            currentTimeMs: BigInt(nowMs),
            claimWindowMs: stream.claimWindowMs != null ? BigInt(stream.claimWindowMs) : undefined,
        });
    } catch {
        return 0n;
    }
}

function streamAmountBreakdown(stream: VaultStreamInfo, nowMs = Date.now()) {
    const totalAmount = stream.amountPerIteration * BigInt(stream.iterationsTotal);
    const { elapsedIterations } = streamProgress(stream, nowMs);
    const completedAmount = stream.amountPerIteration * BigInt(elapsedIterations);
    const claimedAmount = clampBigInt(stream.claimedAmount, 0n, totalAmount);
    const availableAmount = clampBigInt(streamAvailableAmount(stream, nowMs), 0n, totalAmount - claimedAmount);
    const expiredSpendingLimit = Boolean(stream.isSpendingLimit && stream.expiryMs != null && nowMs >= stream.expiryMs);
    const rawForfeitedAmount =
        stream.claimWindowMs != null || expiredSpendingLimit
            ? (expiredSpendingLimit ? totalAmount : completedAmount) - claimedAmount - availableAmount
            : 0n;
    const forfeitedAmount = clampBigInt(rawForfeitedAmount, 0n, totalAmount - claimedAmount);
    const lockedAmount = clampBigInt(totalAmount - claimedAmount - forfeitedAmount - availableAmount, 0n, totalAmount);

    return {
        availableAmount,
        claimedAmount,
        forfeitedAmount,
        lockedAmount,
        claimedPercent: percentOf(claimedAmount, totalAmount),
        forfeitedPercent: percentOf(forfeitedAmount, totalAmount),
        availablePercent: percentOf(availableAmount, totalAmount),
        lockedPercent: percentOf(lockedAmount, totalAmount),
    };
}

export function StreamCard({ stream, onCollect, isCollecting = false }: Props) {
    const coin = extractCoinSymbol(stream.coinType);
    const nowMs = Date.now();
    const { totalAmount, status } = streamProgress(stream, nowMs);
    const isSpendingLimit = Boolean(stream.isSpendingLimit);
    const {
        availableAmount,
        claimedAmount,
        forfeitedAmount,
        lockedAmount,
        claimedPercent,
        forfeitedPercent,
        availablePercent,
        lockedPercent,
    } = streamAmountBreakdown(stream, nowMs);
    const leftAmount = clampBigInt(availableAmount + lockedAmount, 0n, totalAmount);
    const claimableAmount = isSpendingLimit ? 0n : availableAmount;
    const canCollect = Boolean(onCollect && stream.capId && stream.accountId && !isSpendingLimit);
    const hasWhitelistedRecipients = stream.whitelistedRecipients.length > 0;

    const firstSpendTimeMs = getFirstSpendTimeMs(stream);
    const endTimeMs = stream.startTimeMs + stream.iterationPeriodMs * stream.iterationsTotal;
    const visibleDurationMs = Math.max(endTimeMs - firstSpendTimeMs, 0);
    const firstDateLabel = "First spend";
    const finalDateLabel = "Final spend";

    const statusColors = {
        pending: "bg-yellow-500/15 text-yellow-400",
        active: "bg-green-500/15 text-green-400",
        completed: "bg-text-muted/15 text-text-muted",
    };

    return (
        <div className="bg-card-elevated border border-border-subtle rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                        <WalletCards className="w-4 h-4 text-primary" />
                    </div>
                    <div>
                        <p className="text-sm font-semibold text-text-primary">{coin} Spending Limit</p>
                        <p className="text-[10px] text-text-muted">Vault: {stream.vaultName}</p>
                    </div>
                </div>
                <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[status]}`}>
                    {status === "pending" ? "Pending" : status === "active" ? "Active" : "Completed"}
                </span>
            </div>

            <StreamBudgetBar
                coin={coin}
                claimedAmount={claimedAmount}
                availableAmount={availableAmount}
                forfeitedAmount={forfeitedAmount}
                lockedAmount={lockedAmount}
                leftAmount={leftAmount}
                totalAmount={totalAmount}
                claimedPercent={claimedPercent}
                forfeitedPercent={forfeitedPercent}
                availablePercent={availablePercent}
                lockedPercent={lockedPercent}
            />

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                {stream.capHolder && (
                    <>
                        <div className="flex items-center gap-1.5 text-text-muted">
                            <User className="w-3 h-3" />
                            <span>Delegate</span>
                        </div>
                        <CopyableAddress
                            address={stream.capHolder}
                            className="justify-end text-text-primary"
                            copyClassName="p-0.5"
                            copyLabel="Copy delegate address"
                            toastMessage="Delegate address copied"
                        />
                    </>
                )}

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Coins className="w-3 h-3" />
                    <span>Per iteration</span>
                </div>
                <span className="text-text-primary text-right">
                    {formatAmount(stream.amountPerIteration, coin)} {coin}
                </span>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>Period</span>
                </div>
                <span className="text-text-primary text-right">
                    {formatDuration(stream.iterationPeriodMs)} x {stream.iterationsTotal}
                </span>

                {stream.claimWindowMs != null && (
                    <>
                        <div className="flex items-center gap-1.5 text-text-muted">
                            <Timer className="w-3 h-3" />
                            <span>Spend window</span>
                        </div>
                        <span className="text-text-primary text-right">{formatDuration(stream.claimWindowMs)}</span>
                    </>
                )}

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>Active span</span>
                </div>
                <span className="text-text-primary text-right">{formatDuration(visibleDurationMs)}</span>

                <div className="flex items-center gap-1.5 text-text-muted">
                    <Timer className="w-3 h-3" />
                    <span>Expiry</span>
                </div>
                <span className="text-text-primary text-right">
                    {stream.expiryMs ? new Date(stream.expiryMs).toLocaleDateString() : "No expiry"}
                </span>
            </div>

            <div className="space-y-1.5 pt-2 border-t border-border-subtle">
                <div className="flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wider text-text-muted">
                    <Users className="w-3 h-3" />
                    <span>Whitelisted recipients</span>
                </div>
                {hasWhitelistedRecipients ? (
                    <div className="flex flex-wrap gap-1">
                        {stream.whitelistedRecipients.map((recipient) => (
                            <CopyableAddress
                                key={recipient}
                                address={recipient}
                                displayText={formatAddress(recipient)}
                                className="max-w-[180px] rounded-full bg-card-more-elevated px-2 py-0.5 text-[10px] text-text-muted"
                                copyClassName="p-0.5"
                                copyLabel="Copy whitelisted recipient address"
                                textClassName="text-text-muted"
                                toastMessage="Whitelisted recipient address copied"
                            />
                        ))}
                    </div>
                ) : (
                    <span className="inline-flex rounded-full bg-card-more-elevated px-2 py-0.5 text-[10px] text-text-muted">
                        Open
                    </span>
                )}
            </div>

            <div className="flex items-center justify-between gap-3 text-[10px] text-text-muted pt-2 border-t border-border-subtle">
                <span className="flex flex-col">
                    <span>{firstDateLabel}</span>
                    <span>{new Date(firstSpendTimeMs).toLocaleDateString()}</span>
                </span>
                <span className="text-text-lighter">→</span>
                <span className="flex flex-col text-right">
                    <span>{finalDateLabel}</span>
                    <span>{new Date(endTimeMs).toLocaleDateString()}</span>
                </span>
            </div>

            {canCollect && (
                <button
                    type="button"
                    onClick={() => onCollect?.(stream)}
                    disabled={isCollecting || claimableAmount <= 0n}
                    className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-primary/15 px-3 py-2 text-xs font-medium text-primary transition-colors hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-40"
                >
                    {isCollecting ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                        <Download className="h-3.5 w-3.5" />
                    )}
                    {claimableAmount > 0n
                        ? `Collect ${formatAmount(claimableAmount, coin)} ${coin}`
                        : "Nothing available yet"}
                </button>
            )}
        </div>
    );
}

function StreamBudgetBar({
    coin,
    claimedAmount,
    availableAmount,
    forfeitedAmount,
    lockedAmount,
    leftAmount,
    totalAmount,
    claimedPercent,
    forfeitedPercent,
    availablePercent,
    lockedPercent,
}: {
    coin: string;
    claimedAmount: bigint;
    availableAmount: bigint;
    forfeitedAmount: bigint;
    lockedAmount: bigint;
    leftAmount: bigint;
    totalAmount: bigint;
    claimedPercent: number;
    forfeitedPercent: number;
    availablePercent: number;
    lockedPercent: number;
}) {
    return (
        <div>
            <div className="mb-1 flex items-center justify-between gap-2 text-[10px] text-text-muted">
                <span className="min-w-0">
                    {formatAmount(claimedAmount, coin)} spent
                    {availableAmount > 0n && (
                        <span className="text-green-300"> · {formatAmount(availableAmount, coin)} available</span>
                    )}
                    {forfeitedAmount > 0n && (
                        <span className="text-red-300"> · {formatAmount(forfeitedAmount, coin)} forfeited</span>
                    )}
                </span>
                <span className="shrink-0">{formatAmount(leftAmount, coin)} left</span>
            </div>
            <div className="flex h-1.5 overflow-hidden rounded-full bg-card-more-elevated">
                <BudgetSegment
                    amount={claimedAmount}
                    coin={coin}
                    label="spent"
                    percent={claimedPercent}
                    className="bg-primary"
                />
                <BudgetSegment
                    amount={forfeitedAmount}
                    coin={coin}
                    label="forfeited"
                    percent={forfeitedPercent}
                    className="bg-red-500/70"
                />
                <BudgetSegment
                    amount={availableAmount}
                    coin={coin}
                    label="available now"
                    percent={availablePercent}
                    className="bg-green-400/80"
                />
                <BudgetSegment
                    amount={lockedAmount}
                    coin={coin}
                    label="not yet available"
                    percent={lockedPercent}
                    className="bg-white/10"
                />
            </div>
            <div className="flex items-center justify-between text-[10px] text-text-muted mt-1">
                <span>0</span>
                <span>
                    {formatAmount(totalAmount, coin)} {coin}
                </span>
            </div>
        </div>
    );
}

function BudgetSegment({
    amount,
    coin,
    label,
    percent,
    className,
}: {
    amount: bigint;
    coin: string;
    label: string;
    percent: number;
    className: string;
}) {
    if (percent <= 0) return null;
    return (
        <div
            className={`h-full transition-all ${className}`}
            title={`${formatAmount(amount, coin)} ${coin} ${label}`}
            style={{ width: `${percent}%` }}
        />
    );
}
