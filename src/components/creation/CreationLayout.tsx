import { type ReactNode, useRef, useState, useEffect } from "react";

import { Card } from "@/components/Card";
import type { ProposalFeeSummary } from "@/lib/feeUtils";
import { CreationTabs } from "./CreationTabs";
import { CreationFooter } from "./CreationFooter";

interface CreationLayoutProps {
    // Header
    headerLabel: string;
    title: string;
    untitledPlaceholder: string;

    // Tabs
    tabs: string[];
    currentStep: number;
    setStep: (step: number) => void;
    tabCompletionState: boolean[];
    tabErrors?: Record<number, boolean>;

    // Right section in header
    rightSection?: ReactNode;

    // Content
    children: ReactNode;

    // Footer
    onCancel: () => void;
    onSubmit: () => void;
    feeSummary?: ProposalFeeSummary;
}

export function CreationLayout(props: CreationLayoutProps) {
    const {
        headerLabel,
        title,
        untitledPlaceholder,
        tabs,
        currentStep,
        setStep,
        tabCompletionState,
        tabErrors = {},
        rightSection,
        children,
        onCancel,
        onSubmit,
        feeSummary,
    } = props;

    const titleRef = useRef<HTMLHeadingElement>(null);
    const [isTitleTruncated, setIsTitleTruncated] = useState(false);
    const [isTitleHovered, setIsTitleHovered] = useState(false);
    const [scrollAmount, setScrollAmount] = useState(0);

    // Check if title is truncated and calculate scroll amount
    useEffect(() => {
        if (titleRef.current) {
            const isOverflowing = titleRef.current.scrollWidth > titleRef.current.clientWidth;
            setIsTitleTruncated(isOverflowing);
            if (isOverflowing) {
                setScrollAmount(titleRef.current.scrollWidth - titleRef.current.clientWidth);
            }
        }
    }, [title]);

    return (
        <div className="flex flex-col bg-card/60 border border-border/50 rounded-xl overflow-hidden h-full relative sm:mb-4">
            <Card className="p-0! bg-card-elevated flex flex-row justify-between z-10">
                {/* Title Section */}
                <div className="flex-1 p-3 min-w-0 overflow-hidden w-full sm:w-auto">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs text-text-tertiary uppercase tracking-wide">{headerLabel}</span>
                        {title ? (
                            <div className="relative overflow-hidden">
                                <h1
                                    ref={titleRef}
                                    className="text-base sm:text-lg font-semibold text-text-primary whitespace-nowrap"
                                    onMouseEnter={() => setIsTitleHovered(true)}
                                    onMouseLeave={() => setIsTitleHovered(false)}
                                    style={{
                                        cursor: isTitleTruncated ? "pointer" : "default",
                                        display: "inline-block",
                                        transform:
                                            isTitleHovered && isTitleTruncated
                                                ? `translateX(-${scrollAmount}px)`
                                                : "translateX(0)",
                                        transition:
                                            isTitleHovered && isTitleTruncated
                                                ? `transform ${Math.max(2, scrollAmount / 50)}s ease-out`
                                                : "transform 0.3s ease-in-out",
                                    }}
                                >
                                    {title}
                                </h1>
                            </div>
                        ) : (
                            <h1 className="text-base sm:text-lg font-semibold text-text-tertiary italic whitespace-nowrap">
                                {untitledPlaceholder}
                            </h1>
                        )}
                    </div>
                </div>

                {/* Step Indicator - hidden on mobile, shown on desktop */}
                <div className="hidden md:flex">
                    <CreationTabs
                        tabs={tabs}
                        step={currentStep}
                        onTabChange={setStep}
                        tabCompletionState={tabCompletionState}
                        tabErrors={tabErrors}
                    />
                </div>

                {/* Right Section */}
                <div className="flex-1 flex justify-end items-center gap-2 p-1 w-full sm:w-auto">{rightSection}</div>
            </Card>

            {/* Mobile Step Indicator - Visible only on mobile */}
            <div className="md:hidden border-b border-border/50 bg-card-elevated/50 px-4 py-2 -mt-4 pt-6 z-40">
                <div className="flex items-center justify-between">
                    <p className="text-base font-medium text-text-primary">{tabs[currentStep]}</p>
                    <p className="text-xs text-text-tertiary uppercase tracking-wide">
                        Step {currentStep + 1} of {tabs.length}
                    </p>
                </div>
            </div>

            {/* Form Content */}
            <div className="flex-1 overflow-y-scroll -mt-4 mb-20 sm:mb-16">
                <div className="h-full flex flex-col">{children}</div>
            </div>

            {/* Footer */}
            <CreationFooter
                step={currentStep}
                totalSteps={tabs.length}
                onCancel={onCancel}
                onPrevious={() => setStep(currentStep - 1)}
                onNext={() => setStep(currentStep + 1)}
                onSubmit={onSubmit}
                feeSummary={feeSummary}
            />
        </div>
    );
}
