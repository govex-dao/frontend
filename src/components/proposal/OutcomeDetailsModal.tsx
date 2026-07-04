import { Ban, CheckCircle } from "lucide-react";
import { Modal } from "@/components/overlays/Modal";
import { getOutcomeClass, getOutcomeColor } from "@/lib/outcomes";
import { formatNumber } from "@/lib/formatNumber";
import type { ProposalAction } from "@/types/Proposal";
import { isFailureOutcome } from "@/lib/outcomeUtils";
import { formatPlural } from "@/lib/textUtils";
import { BalancesTable } from "./trade/BalancesTable";
import { ActionCard } from "./actions/Card";

interface OutcomeDetailsModalProps {
    isOpen: boolean;
    onClose: () => void;
    outcome: {
        message: string;
        twap: number | null;
        price: number | null;
        usdcBalance?: number;
        tokenBalance?: number;
        actions?: ProposalAction[];
    };
    outcomeIndex: number;
    totalOutcomes: number;
    isWinning?: boolean;
    isEnded?: boolean;
    showTwapMetric?: boolean;
    showActions?: boolean;
}

export function OutcomeDetailsModal(props: OutcomeDetailsModalProps) {
    const {
        isOpen,
        onClose,
        outcome,
        outcomeIndex,
        totalOutcomes,
        isWinning = false,
        isEnded = false,
        showTwapMetric = true,
        showActions = true,
    } = props;
    const color = getOutcomeColor(outcomeIndex, totalOutcomes, "normal");
    const lightColor = getOutcomeColor(outcomeIndex, totalOutcomes, "light");
    const bgClass = getOutcomeClass(outcomeIndex, totalOutcomes, "normal");

    const Title = () => (
        <div className="flex items-center gap-3 -mt-2">
            <div className={`w-3 h-3 rounded-full shrink-0 ${bgClass}`} />
            <h2 className="text-xl sm:text-2xl font-semibold mb-1" style={{ color: lightColor }}>
                {outcome.message}
            </h2>
            {isWinning && (
                <div
                    className="flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-md w-fit"
                    style={{
                        backgroundColor: `${color}15`,
                        color: lightColor,
                    }}
                >
                    <CheckCircle className="w-3.5 h-3.5" />
                    <span>{isEnded ? "Executed outcome" : "Winning outcome"}</span>
                </div>
            )}
        </div>
    );

    return (
        <Modal
            isOpen={isOpen}
            onClose={onClose}
            title={<Title />}
            ariaLabel={`Outcome details: ${outcome.message}`}
            className="sm:max-w-3xl"
        >
            {/* Metrics */}
            <div className="space-y-3">
                <div className={`${showTwapMetric ? "grid-cols-2" : "grid-cols-1"} grid gap-3 sm:gap-4`}>
                    {showTwapMetric && (
                        <div className="glass-flow-panel rounded-lg p-3 sm:p-4">
                            <div className="text-[10px] uppercase tracking-wider font-medium text-text-tertiary mb-1">
                                TWAP
                            </div>
                            <div className="text-xl sm:text-2xl font-semibold font-mono text-text-primary">
                                {outcome.twap != null ? `$${formatNumber(outcome.twap)}` : "--"}
                            </div>
                        </div>
                    )}
                    <div className="glass-flow-panel rounded-lg p-3 sm:p-4">
                        <div className="text-[10px] uppercase tracking-wider font-medium text-text-tertiary mb-1">
                            Current Price
                        </div>
                        <div className="text-xl sm:text-2xl font-semibold font-mono text-text-primary">
                            {outcome.price != null ? `$${formatNumber(outcome.price)}` : "--"}
                        </div>
                    </div>
                </div>

                {((outcome.usdcBalance !== undefined && outcome.usdcBalance > 0) ||
                    (outcome.tokenBalance !== undefined && outcome.tokenBalance > 0)) && (
                    <div className="glass-flow-panel rounded-lg p-3 sm:p-4">
                        <BalancesTable
                            balances={[outcome]}
                            totalOutcomes={totalOutcomes}
                            getOriginalIndex={() => outcomeIndex}
                            className=""
                        />
                    </div>
                )}
            </div>

            {showActions && (
                <div className="space-y-3">
                    <div className="space-y-1">
                        <div className="flex items-center justify-between">
                            <h3 className="text-[11px] font-semibold text-text-primary uppercase tracking-wider">
                                Actions to Execute
                            </h3>
                            {outcome.actions && outcome.actions.length > 0 && (
                                <span className="text-[10px] text-text-tertiary uppercase tracking-wider">
                                    {outcome.actions.length} {formatPlural(outcome.actions.length, "action")}
                                </span>
                            )}
                        </div>
                        {!isFailureOutcome(outcome) && (
                            <p className="text-xs text-text-tertiary">
                                These actions will automatically execute if "{outcome.message}" is the winning outcome
                            </p>
                        )}
                    </div>

                    {outcome.actions && outcome.actions.length > 0 ? (
                        <div className="flex flex-col gap-2 sm:gap-3">
                            {outcome.actions.map((action, index) => (
                                <ActionCard key={action.id} number={index + 1} action={action} />
                            ))}
                        </div>
                    ) : (
                        <div className="glass-flow-panel rounded-lg p-5 sm:p-6 text-center space-y-2.5">
                            <div className="flex items-center justify-center gap-2 text-text-tertiary">
                                <Ban className="w-5 h-5 opacity-50" />
                                <h4 className="font-semibold text-sm">No Actions</h4>
                            </div>
                            <p className="text-sm text-text-tertiary leading-relaxed">
                                {isFailureOutcome(outcome)
                                    ? "Fail outcomes maintain the status quo and execute nothing."
                                    : "This outcome has no associated actions. If it wins, no changes will be executed."}
                            </p>
                        </div>
                    )}
                </div>
            )}
        </Modal>
    );
}
