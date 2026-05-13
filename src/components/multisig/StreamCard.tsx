import { formatAddress } from "@mysten/sui/utils";
import { Timer, User, Coins, WalletCards, Users } from "lucide-react";
import type { VaultStreamInfo } from "@/lib/sui/multisig";

interface Props {
  stream: VaultStreamInfo;
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

  if (stream.iterationPeriodMs <= 0 || stream.iterationsTotal <= 0) {
    return { percent: 100, totalAmount, elapsedIterations: stream.iterationsTotal, status: "completed" };
  }

  const now = Date.now();

  if (now < stream.startTimeMs) {
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

export function StreamCard({ stream }: Props) {
  const coin = extractCoinSymbol(stream.coinType);
  const { percent, totalAmount, status } = streamProgress(stream);
  const isSpendingLimit = Boolean(stream.isSpendingLimit);

  const totalDurationMs = stream.iterationPeriodMs * stream.iterationsTotal;
  const endTimeMs = stream.startTimeMs + totalDurationMs;

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
            <span className="text-text-primary font-mono text-right">
              {formatAddress(stream.capHolder)}
            </span>
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
          <span>Duration</span>
        </div>
        <span className="text-text-primary text-right">
          {formatDuration(totalDurationMs)}
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
            <span
              key={recipient}
              className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-card-more-elevated text-text-muted"
            >
              {formatAddress(recipient)}
            </span>
          ))}
          {stream.whitelistedRecipients.length > 4 && (
            <span className="text-[10px] px-2 py-0.5 rounded-full bg-card-more-elevated text-text-muted">
              +{stream.whitelistedRecipients.length - 4}
            </span>
          )}
        </div>
      )}

      {/* Timeline */}
      <div className="flex items-center justify-between text-[10px] text-text-muted pt-2 border-t border-border-subtle">
        <span>{new Date(stream.startTimeMs).toLocaleDateString()}</span>
        <span className="text-text-lighter">→</span>
        <span>{new Date(endTimeMs).toLocaleDateString()}</span>
      </div>
    </div>
  );
}
