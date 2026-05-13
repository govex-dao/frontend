import { Timer, Coins, Shield, ShieldOff, Building2 } from "lucide-react";
import { CopyableAddress } from "@/components/multisig/CopyableAddress";

interface VestingDisplayInfo {
  vestingId: string;
  accountId?: string;
  daoAddress?: string;
  coinType: string;
  balance: bigint;
  amountPerIteration: bigint;
  claimedAmount: bigint;
  startTimeMs: number;
  iterationsTotal: number;
  iterationPeriodMs: number;
  isCancellable: boolean;
}

interface Props {
  vesting: VestingDisplayInfo;
}

function extractCoinSymbol(coinType: string): string {
  // "0x2::sui::SUI" -> "SUI", "0x...::usdc::USDC" -> "USDC"
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

function vestingProgress(vesting: VestingDisplayInfo): {
  percent: number;
  totalAmount: bigint;
  elapsedIterations: number;
  status: "pending" | "active" | "completed";
} {
  const totalAmount = vesting.amountPerIteration * BigInt(vesting.iterationsTotal);
  const firstVestingTimeMs = getFirstVestingTimeMs(vesting);

  if (vesting.iterationPeriodMs <= 0 || vesting.iterationsTotal <= 0) {
    return { percent: 100, totalAmount, elapsedIterations: vesting.iterationsTotal, status: "completed" };
  }

  const now = Date.now();

  if (now < firstVestingTimeMs) {
    return { percent: 0, totalAmount, elapsedIterations: 0, status: "pending" };
  }

  const elapsed = now - vesting.startTimeMs;
  const elapsedIterations = Math.min(
    Math.floor(elapsed / vesting.iterationPeriodMs),
    vesting.iterationsTotal,
  );

  if (elapsedIterations >= vesting.iterationsTotal) {
    return { percent: 100, totalAmount, elapsedIterations, status: "completed" };
  }

  const percent = Math.round((elapsedIterations / vesting.iterationsTotal) * 100);
  return { percent, totalAmount, elapsedIterations, status: "active" };
}

function getFirstVestingTimeMs(vesting: VestingDisplayInfo): number {
  if (vesting.iterationPeriodMs <= 0 || vesting.iterationsTotal <= 0) return vesting.startTimeMs;
  return vesting.startTimeMs + vesting.iterationPeriodMs;
}

export function VestingCard({ vesting }: Props) {
  const coin = extractCoinSymbol(vesting.coinType);
  const { percent, totalAmount, status } = vestingProgress(vesting);
  const accountLabel = vesting.daoAddress ?? vesting.accountId ?? vesting.vestingId;

  const firstVestingTimeMs = getFirstVestingTimeMs(vesting);
  const endTimeMs = vesting.startTimeMs + vesting.iterationPeriodMs * vesting.iterationsTotal;
  const visibleDurationMs = Math.max(endTimeMs - firstVestingTimeMs, 0);

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
            <Coins className="w-4 h-4 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold text-text-primary">{coin} Vesting</p>
            <div className="text-[10px] text-text-muted flex items-center gap-1">
              <Building2 className="w-2.5 h-2.5" />
              <CopyableAddress
                address={accountLabel}
                className="max-w-[160px]"
                copyClassName="p-0.5"
                copyLabel="Copy account address"
                textClassName="text-text-muted"
                toastMessage="Account address copied"
              />
            </div>
          </div>
        </div>
        <div className="flex items-center gap-1.5">
          {vesting.isCancellable ? (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-yellow-500/15 text-yellow-400">
              Revocable
            </span>
          ) : (
            <span className="text-[10px] font-medium px-2 py-0.5 rounded-full bg-green-500/15 text-green-400 flex items-center gap-0.5">
              <Shield className="w-2.5 h-2.5" />
              Guaranteed
            </span>
          )}
          <span className={`text-[10px] font-medium px-2 py-0.5 rounded-full ${statusColors[status]}`}>
            {status === "pending" ? "Pending" : status === "active" ? "Active" : "Completed"}
          </span>
        </div>
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex items-center justify-between text-[10px] text-text-muted mb-1">
          <span>{formatAmount(vesting.claimedAmount, coin)} claimed</span>
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
        <div className="flex items-center gap-1.5 text-text-muted">
          <Coins className="w-3 h-3" />
          <span>Per iteration</span>
        </div>
        <span className="text-text-primary text-right">
          {formatAmount(vesting.amountPerIteration, coin)} {coin}
        </span>

        <div className="flex items-center gap-1.5 text-text-muted">
          <Timer className="w-3 h-3" />
          <span>Period</span>
        </div>
        <span className="text-text-primary text-right">
          {formatDuration(vesting.iterationPeriodMs)} x {vesting.iterationsTotal}
        </span>

        <div className="flex items-center gap-1.5 text-text-muted">
          <Timer className="w-3 h-3" />
          <span>Active span</span>
        </div>
        <span className="text-text-primary text-right">
          {formatDuration(visibleDurationMs)}
        </span>

        <div className="flex items-center gap-1.5 text-text-muted">
          {vesting.isCancellable ? (
            <ShieldOff className="w-3 h-3" />
          ) : (
            <Shield className="w-3 h-3" />
          )}
          <span>Protection</span>
        </div>
        <span className="text-text-primary text-right">
          {vesting.isCancellable ? "Revocable" : "Guaranteed"}
        </span>
      </div>

      {/* Timeline */}
      <div className="flex items-center justify-between gap-3 text-[10px] text-text-muted pt-2 border-t border-border-subtle">
        <span className="flex flex-col">
          <span>First vest</span>
          <span>{new Date(firstVestingTimeMs).toLocaleDateString()}</span>
        </span>
        <span className="text-text-lighter">→</span>
        <span className="flex flex-col text-right">
          <span>Final vest</span>
          <span>{new Date(endTimeMs).toLocaleDateString()}</span>
        </span>
      </div>
    </div>
  );
}
