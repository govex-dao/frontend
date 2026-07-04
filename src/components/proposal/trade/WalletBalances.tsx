import { Wallet, Package } from "lucide-react";
import type { ProposalBalances, BalanceWrapperData } from "@govex/futarchy-sdk";
import { Card } from "@/components/Card";
import { formatNumber } from "@/lib/formatNumber";
import { getOutcomeClass } from "@/lib/outcomes";

interface Props {
    balances: ProposalBalances | undefined;
    isLoading: boolean;
    isConnected: boolean;
}

export function WalletBalances({ balances, isLoading, isConnected }: Props) {
    if (!isConnected) {
        return (
            <Card variant="glass" className="p-4">
                <div className="flex items-center gap-2 text-text-muted">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">Connect wallet to view balances</span>
                </div>
            </Card>
        );
    }

    if (isLoading) {
        return (
            <Card variant="glass" className="p-4">
                <div className="flex items-center gap-2 text-text-muted">
                    <Wallet className="w-4 h-4 animate-pulse" />
                    <span className="text-sm">Loading balances...</span>
                </div>
            </Card>
        );
    }

    if (!balances) {
        return null;
    }

    const hasSpotBalance = balances.spot.asset.raw > 0n || balances.spot.stable.raw > 0n;
    const hasConditionalBalance = balances.outcomes.some(
        (o) => o.conditionalAsset.raw > 0n || o.conditionalStable.raw > 0n
    );
    const nonEmptyWrappers = balances.balanceWrappers?.filter((w) => !w.isEmpty) || [];

    if (!hasSpotBalance && !hasConditionalBalance && nonEmptyWrappers.length === 0) {
        return (
            <Card variant="glass" className="p-4">
                <div className="flex items-center gap-2 text-text-muted">
                    <Wallet className="w-4 h-4" />
                    <span className="text-sm">No balances for this proposal</span>
                </div>
            </Card>
        );
    }

    return (
        <Card variant="glass" className="p-4 space-y-4">
            <div className="flex items-center gap-2">
                <Wallet className="w-4 h-4 text-primary" />
                <h3 className="font-semibold">Your Balances</h3>
            </div>

            {/* Spot Balances */}
            {hasSpotBalance && (
                <div className="space-y-2">
                    <div className="text-xs text-text-muted uppercase tracking-wide">Spot</div>
                    <div className="grid grid-cols-2 gap-2">
                        {balances.spot.asset.raw > 0n && (
                            <BalanceRow name={balances.spot.asset.name} amount={balances.spot.asset.formatted} />
                        )}
                        {balances.spot.stable.raw > 0n && (
                            <BalanceRow name={balances.spot.stable.name} amount={balances.spot.stable.formatted} />
                        )}
                    </div>
                </div>
            )}

            {/* Conditional Balances */}
            {hasConditionalBalance && (
                <div className="space-y-2">
                    <div className="text-xs text-text-muted uppercase tracking-wide">Conditional</div>
                    <div className="space-y-3">
                        {balances.outcomes.map((outcome, index) => {
                            const hasBalance = outcome.conditionalAsset.raw > 0n || outcome.conditionalStable.raw > 0n;
                            if (!hasBalance) return null;

                            const colorClass = getOutcomeClass(index, balances.outcomes.length, "normal");

                            return (
                                <div key={index} className="space-y-1">
                                    <div className="flex items-center gap-2">
                                        <div className={`w-2 h-2 rounded-full ${colorClass}`} />
                                        <span className="text-xs font-medium">{outcome.outcomeMessage}</span>
                                    </div>
                                    <div className="grid grid-cols-2 gap-2 pl-4">
                                        {outcome.conditionalAsset.raw > 0n && (
                                            <BalanceRow
                                                name={outcome.conditionalAsset.name}
                                                amount={outcome.conditionalAsset.formatted}
                                                small
                                            />
                                        )}
                                        {outcome.conditionalStable.raw > 0n && (
                                            <BalanceRow
                                                name={outcome.conditionalStable.name}
                                                amount={outcome.conditionalStable.formatted}
                                                small
                                            />
                                        )}
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            )}

            {/* Balance Wrappers (Incomplete Sets) */}
            {nonEmptyWrappers.length > 0 && (
                <div className="space-y-2">
                    <div className="text-xs text-text-muted uppercase tracking-wide flex items-center gap-1">
                        <Package className="w-3 h-3" />
                        Incomplete Sets
                    </div>
                    <div className="space-y-3">
                        {nonEmptyWrappers.map((wrapper) => (
                            <BalanceWrapperCard
                                key={wrapper.objectId}
                                wrapper={wrapper}
                                outcomeCount={balances.outcomes.length}
                            />
                        ))}
                    </div>
                </div>
            )}
        </Card>
    );
}

function BalanceRow({ name, amount, small = false }: { name: string; amount: string; small?: boolean }) {
    const parsed = parseFloat(amount);
    return (
        <div className={`flex justify-between items-center ${small ? "text-xs" : "text-sm"}`}>
            <span className="text-text-muted truncate">{name}</span>
            <span className="font-mono font-medium">{formatNumber(parsed)}</span>
        </div>
    );
}

function BalanceWrapperCard({ wrapper, outcomeCount }: { wrapper: BalanceWrapperData; outcomeCount: number }) {
    // Truncate object ID for display
    const shortId = `${wrapper.objectId.slice(0, 6)}...${wrapper.objectId.slice(-4)}`;

    return (
        <div className="rounded border border-border/30 bg-white/[0.035] p-2 space-y-2">
            <div className="flex items-center justify-between">
                <span className="text-xs text-text-muted font-mono">{shortId}</span>
            </div>
            <div className="space-y-1">
                {wrapper.outcomes.map((outcome, index) => {
                    const hasValue = outcome.asset.raw > 0n || outcome.stable.raw > 0n;
                    if (!hasValue) return null;

                    const colorClass = getOutcomeClass(index, outcomeCount, "normal");

                    return (
                        <div key={index} className="flex items-center gap-2 text-xs">
                            <div className={`w-1.5 h-1.5 rounded-full ${colorClass}`} />
                            <span className="text-text-muted">#{index}</span>
                            {outcome.asset.raw > 0n && <span className="font-mono">{outcome.asset.formatted} A</span>}
                            {outcome.stable.raw > 0n && <span className="font-mono">{outcome.stable.formatted} S</span>}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
