import { Check, AlertCircle } from "lucide-react";

interface Props {
    tabs: string[];
    step: number;
    onTabChange: (activeTabIndex: number) => void;
    tabErrors?: Record<number, boolean>;
    tabCompletionState?: boolean[];
}

const containerStyles = {
    active: "border-primary text-text-primary bg-linear-to-t from-primary/10 to-transparent",
    default: "border-transparent text-text-muted hover:text-text-secondary",
};

const iconStyles = {
    error: "bg-error/20 text-error-light",
    activeCompleted: "bg-primary text-white",
    active: "bg-primary/20 text-primary",
    completed: "bg-primary/10 text-primary",
    default: "bg-border/50 text-text-muted",
};

function getIconStyle(isActive: boolean, isCompleted: boolean, hasError: boolean): string {
    if (hasError) return iconStyles.error;
    if (isActive && isCompleted) return iconStyles.activeCompleted;
    if (isActive) return iconStyles.active;
    if (isCompleted) return iconStyles.completed;
    return iconStyles.default;
}

function TabIcon({ index, isCompleted, hasError }: { index: number; isCompleted: boolean; hasError: boolean }) {
    const iconClassName = "w-3 h-3 sm:w-3.5 sm:h-3.5";

    if (hasError) return <AlertCircle className={`${iconClassName} stroke-[2.5]`} />;
    if (isCompleted) return <Check className={`${iconClassName} stroke-3`} />;
    return <p className="text-xs font-bold">{index + 1}</p>;
}

export function CreationTabs(props: Props) {
    const { tabs, step, onTabChange, tabCompletionState = [], tabErrors = {} } = props;

    return (
        <div className="flex border-border-lighter h-full">
            {tabs.map((tab, i) => {
                const isActive = step === i;
                const isCompleted = tabCompletionState[i] === true;
                const hasError = tabErrors[i] === true;

                return (
                    <button
                        key={tab}
                        onClick={() => onTabChange(i)}
                        className={`
                            relative flex items-center gap-2 px-3 sm:px-4 md:px-6 py-2 sm:py-3
                            transition-all duration-200 ease-in-out
                            text-xs sm:text-sm font-medium -mb-[2px] whitespace-nowrap
                            ${containerStyles[isActive ? "active" : "default"]}
                        `}
                    >
                        <div
                            className={`flex items-center justify-center size-5 sm:size-6 rounded-full shrink-0
                                transition-all duration-200 ${getIconStyle(isActive, isCompleted, hasError)}
                            `}
                        >
                            <TabIcon index={i} isCompleted={isCompleted} hasError={hasError} />
                        </div>

                        <p className="hidden sm:inline">{tab}</p>
                    </button>
                );
            })}
        </div>
    );
}
