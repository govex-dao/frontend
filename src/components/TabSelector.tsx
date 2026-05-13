import { Toggle } from "./inputs/Toggle";

interface Tab {
    id: string;
    label: string;
}

interface TabSelectorProps {
    tabs: Tab[];
    activeTab: string;
    onTabChange: (tabId: string) => void;
    className?: string;
    fullWidth?: boolean;
    variant?: "underline" | "filled";
}

export function TabSelector({
    tabs,
    activeTab,
    onTabChange,
    className = "",
    fullWidth = false,
    variant = "underline",
}: TabSelectorProps) {
    const activeIndex = tabs.findIndex((tab) => tab.id === activeTab);

    if (variant === "filled" && tabs.length === 2) {
        const toggleOptions: [
            { label: string; value: string },
            { label: string; value: string },
        ] = [
            { label: tabs[0].label, value: tabs[0].id },
            { label: tabs[1].label, value: tabs[1].id },
        ];
        return (
            <Toggle
                options={toggleOptions}
                value={activeTab}
                onChange={(value) => onTabChange(value)}
            />
        );
    }

    return (
        <div className={`relative flex bg-card-elevated ${className}`}>
            {tabs.map((tab) => (
                <button
                    key={tab.id}
                    onClick={() => onTabChange(tab.id)}
                    className={`${fullWidth ? "flex-1" : "w-30"} py-3 text-sm font-medium transition-colors relative ${
                        activeTab === tab.id ? "text-text-primary" : "text-text-tertiary hover:text-text-secondary"
                    }`}
                >
                    {tab.label}
                </button>
            ))}
            <div className="absolute bottom-0 left-0 right-0 h-px bg-border-light" />
            <div
                className="absolute bottom-0 h-px bg-white transition-all duration-300 ease-in-out left-0"
                style={
                    fullWidth
                        ? {
                              width: `${100 / tabs.length}%`,
                              left: `${activeIndex * (100 / tabs.length)}%`,
                          }
                        : {
                              width: "120px",
                              transform: `translateX(${activeIndex * 120}px)`,
                          }
                }
            />
        </div>
    );
}
