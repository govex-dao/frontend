import { Coins } from "lucide-react";
import type { ProposalFeeSummary } from "@/lib/feeUtils";
import { Button } from "../inputs/Button";

interface Props {
    step: number;
    totalSteps: number;
    onCancel: () => void;
    onPrevious: () => void;
    onNext: () => void;
    onSubmit: () => void;
    feeSummary?: ProposalFeeSummary;
}

export function CreationFooter(props: Props) {
    const { step, totalSteps, onCancel, onPrevious, onNext, onSubmit, feeSummary } = props;

    const isLastStep = step === totalSteps - 1;

    return (
        <div
            className="absolute bottom-0 left-0 right-0 bg-card/5 backdrop-blur-sm border-t border-border
           flex flex-col sm:flex-row items-stretch sm:items-center justify-between py-2 px-3 sm:px-6 md:px-12 lg:px-20 gap-2 sm:gap-4 w-full
        "
        >
            {/* Creation Fee */}
            <div className="flex items-center justify-center sm:justify-start gap-4">
                {feeSummary && (
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-card/50 border border-border/20">
                        <Coins className="w-3.5 h-3.5 text-primary" />
                        <div className="flex items-baseline gap-1.5">
                            {feeSummary.totalFeeRaw === 0n ? (
                                <span className="text-sm font-semibold text-text-primary">No proposal fee</span>
                            ) : (
                                <>
                                    <span className="text-xs font-medium text-text-muted">Fee:</span>
                                    <span className="text-sm font-semibold text-text-primary">
                                        {feeSummary.totalFeeFormatted} {feeSummary.symbol}
                                    </span>
                                    {feeSummary.perAdditionalOutcomeFeeRaw > 0n && (
                                        <span className="text-xs text-text-secondary">
                                            + {feeSummary.perAdditionalOutcomeFeeFormatted} per extra outcome
                                        </span>
                                    )}
                                </>
                            )}
                        </div>
                    </div>
                )}
            </div>

            {/* Action Buttons */}
            <div className="flex gap-2 sm:gap-3">
                {step === 0 && (
                    <Button
                        variant="secondary"
                        onClick={onCancel}
                        title="Cancel and go back to the organization"
                        className="flex-1 sm:flex-none"
                    >
                        Cancel
                    </Button>
                )}
                {step > 0 && (
                    <Button
                        variant="secondary"
                        onClick={onPrevious}
                        title="Go to previous step"
                        className="flex-1 sm:flex-none"
                    >
                        Previous
                    </Button>
                )}
                <Button
                    variant="primary"
                    onClick={isLastStep ? onSubmit : onNext}
                    title={isLastStep ? "Submit Proposal" : "Continue or go to next step"}
                    className="flex-1 sm:flex-none"
                >
                    {isLastStep ? "Submit" : "Continue"}
                </Button>
            </div>
        </div>
    );
}
