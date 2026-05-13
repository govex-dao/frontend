import { calculateStreamAvailableWithTracking } from "@govex/futarchy-sdk";
import { Download, Loader2, Timer, User, Coins, WalletCards, Users } from "lucide-react";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";
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
  const n = Number(raw);
  if (n >= 1e12) return `${(n / 1e12).toFixed(2)}T`;
  if (n >= 1e9) return `${(n / 1e9).toFixed(2)}B`;
  if (n >= 1e6) return `${(n / 1e6).toFixed(2)}M`;
  if (n >= 1e3) return `${(n / 1e3).toFixed(1)}K`;
  return raw.toString();
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

function streamProgress(stream: VaultStreamInfo): {
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

  const now = Date.now();

  if (now < firstSpendTimeMs) {
    return { percent: 0, totalAmount, elapsedIterations: 0, status: "pending" };
  }

  const elapsed = now - stream.startTimeMs;
  const elapsedIterations = Math.min(
    Math.floor(elapsed / stream.iterationPeriodMs),
    stream.iterationsTotal,
  );

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

function streamClaimableAmount(stream: VaultStreamInfo): bigint {
  if (stream.isSpendingLimit) return 0n;
  try {
    return calculateStreamAvailableWithTracking({
      amountPerIteration: stream.amountPerIteration,
      firstUnclaimedIteration: stream.firstUnclaimedIteration ?? 0n,
      partialClaimedInIteration: stream.partialClaimedInIteration ?? 0n,
      startTimeMs: BigInt(stream.startTimeMs),
      iterationsTotal: BigInt(stream.iterationsTotal),
      iterationPeriodMs: BigInt(stream.iterationPeriodMs),
      currentTimeMs: BigInt(Date.now()),
      claimWindowMs: stream.claimWindowMs != null ? BigInt(stream.claimWindowMs) : undefined,
    });
  } catch {
    return 0n;
  }
}

export function StreamCard({ stream, onCollect, isCollecting = false }: Props) {
  const coin = extractCoinSymbol(stream.coinType);
  const { percent, totalAmount, status } = streamProgress(stream);
  const isSpendingLimit = Boolean(stream.isSpendingLimit);
  const claimableAmount = streamClaimableAmount(stream);
  const canCollect = Boolean(onCollect && stream.capId && stream.accountId && !isSpendingLimit);

  const firstSpendTimeMs = getFirstSpendTimeMs(stream);
  const endTimeMs = stream.startTimeMs + stream.iterationPeriodMs * stream.iterationsTotal;
  const visibleDurationMs = Math.max(endTimeMs - firstSpendTimeMs, 0);
  const firstDateLabel = isSpendingLimit ? "First spend" : "First claim";
  const finalDateLabel = isSpendingLimit ? "Final spend" : "Final claim";

  const statusColors = {
    pending: "bg-yellow-500/15 text-yellow-400",
    active: "bg-green-500/15 text-green-400",
    completed: "bg-text-muted/15 text-text-muted",
  };

  return (
    <div className="bg-card-elevated border border-border-subtle rounded-xl p-4 space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
            {isSpendingLimit ? (
              <WalletCards className="w-4 h-4 text-primary" />
            ) : (
              <Coins className="w-4 h-4 text-primary" />
            )}
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">
              {coin} {isSpendingLimit ? "Preapproved Spending" : "Payment Stream"}
            </p>
            <p className="text-[10px] text-text-muted">Vault: {stream.vaultName}</p>
          </div>
        </div>
        <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[status]}`}>
          {status === "pending" ? "Pending" : status === "active" ? "Active" : "Completed"}
        </span>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
          <span>{formatAmount(stream.claimedAmount, coin)} {isSpendingLimit ? "spent" : "claimed"}</span>
          <span>{percent}%</span>
        </div>
        <div className="h-1.5 bg-card-more-elevated rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all"
            style={{ width: `${percent}%` }}
          />
        </div>
        <div className="flex items-center justify-between text-[10px] text-text-muted mt-1">
          <span>0</span>
          <span>{formatAmount(totalAmount, coin)} {coin}</span>
        </div>
      </div>

      {/* Details */}
      <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
        {stream.capHolder && (
          <>
            <div className="flex items-center gap-1.5 text-text-muted">
              <User className="w-3 h-3" />
              <span>{isSpendingLimit ? "Delegate" : "Beneficiary"}</span>
            </div>
            <CopyableAddress
              address={stream.capHolder}
              className="justify-end text-text-primary"
              copyClassName="p-0.5"
              copyLabel={`Copy ${isSpendingLimit ? "delegate" : "beneficiary"} address`}
              toastMessage={`${isSpendingLimit ? "Delegate" : "Beneficiary"} address copied`}
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

        <div className="flex items-center gap-1.5 text-text-muted">
          <Timer className="w-3 h-3" />
          <span>Active span</span>
        </div>
        <span className="text-text-primary text-right">
          {formatDuration(visibleDurationMs)}
        </span>

        {isSpendingLimit && (
          <>
            <div className="flex items-center gap-1.5 text-text-muted">
              <Users className="w-3 h-3" />
              <span>Recipients</span>
            </div>
            <span className="text-text-primary text-right">
              {stream.whitelistedRecipients.length}
            </span>

            <div className="flex items-center gap-1.5 text-text-muted">
              <Timer className="w-3 h-3" />
              <span>Expiry</span>
            </div>
            <span className="text-text-primary text-right">
              {stream.expiryMs ? new Date(stream.expiryMs).toLocaleDateString() : "None"}
            </span>
          </>
        )}
      </div>

      {isSpendingLimit && stream.whitelistedRecipients.length > 0 && (
        <div className="flex flex-wrap gap-1 pt-2 border-t border-border-subtle">
          {stream.whitelistedRecipients.slice(0, 4).map((recipient) => (
            <CopyableAddress
              key={recipient}
              address={recipient}
              className="max-w-[140px] rounded-full bg-card-more-elevated px-2 py-0.5 text-[10px] text-text-muted"
              copyClassName="p-0.5"
              copyLabel="Copy recipient address"
              textClassName="text-text-muted"
              toastMessage="Recipient address copied"
            />
          ))}
          {stream.whitelistedRecipients.length > 4 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-card-more-elevated text-text-muted">
              +{stream.whitelistedRecipients.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
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
          {isCollecting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
          {claimableAmount > 0n
            ? `Collect ${formatAmount(claimableAmount, coin)} ${coin}`
            : "Nothing claimable yet"}
        </button>
      )}
    </div>
  );
}
