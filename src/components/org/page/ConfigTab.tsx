import { useState, useMemo } from "react";
import { Search } from "lucide-react";
import type { Org } from "@/types/Org";
import { Card, CardContent } from "@/components/Card";
import { Select } from "@/components/inputs/Select";
import { SidebarNav, type SidebarNavItem } from "@/components/navigation/SidebarNav";
import {
    configParameters,
    allConfigCategories,
    formatParamLabel,
    type ConfigCategoryKey,
    type ParamConfig,
} from "@/constants/configParameters";

const ParamRow = ({ label, value, unit }: { label: string; value: string; unit?: string }) => (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between py-3.5 gap-2 sm:gap-3 border-b border-border-light/20 last:border-0 hover:bg-primary/5 transition-colors px-4 -mx-4 rounded-lg group">
        <span className="text-sm text-text-muted font-semibold group-hover:text-text-light transition-colors">
            {label}
        </span>
        <div className="flex items-center gap-2.5">
            <span className="text-base font-medium break-all">{value}</span>
            {unit && (
                <span className="text-xs text-text-muted bg-linear-to-r from-background to-background/50 border border-border-light px-2.5 py-1 rounded-lg whitespace-nowrap font-semibold">
                    {unit}
                </span>
            )}
        </div>
    </div>
);

interface ConfigTabProps {
    org: Org;
}

export function ConfigTab({ org }: ConfigTabProps) {
    const [configSection, setConfigSection] = useState<ConfigCategoryKey>("trading");
    const [configSearchQuery, setConfigSearchQuery] = useState("");

    const configSections = useMemo(() => {
        if (!org) return [];

        return allConfigCategories.map((cat) => {
            const Icon = cat.icon;
            return {
                id: cat.value,
                name: cat.label,
                icon: <Icon className="w-4 h-4" />,
                data: configParameters[cat.value as ConfigCategoryKey],
            };
        });
    }, [org]);

    const filteredConfigSections = useMemo(() => {
        if (!configSearchQuery.trim()) return configSections;
        const query = configSearchQuery.toLowerCase();
        return configSections.filter((section) => {
            if (section.name.toLowerCase().includes(query)) return true;
            return Object.entries(section.data || {}).some(([key, config]) => {
                const label = formatParamLabel(key).toLowerCase();
                const paramValue = (config as ParamConfig).currentValue?.toLowerCase() || "";
                return label.includes(query) || paramValue.includes(query);
            });
        });
    }, [configSections, configSearchQuery]);

    const configSidebarItems: SidebarNavItem[] = useMemo(() => {
        return filteredConfigSections.map((section) => ({ id: section.id, label: section.name, icon: section.icon }));
    }, [filteredConfigSections]);

    const getFilteredParams = (sectionData: Record<string, ParamConfig> | undefined) => {
        if (!sectionData) return [];
        if (!configSearchQuery.trim()) return Object.entries(sectionData);
        const query = configSearchQuery.toLowerCase();
        return Object.entries(sectionData).filter(([key, config]) => {
            const label = formatParamLabel(key).toLowerCase();
            const paramValue = config.currentValue?.toLowerCase() || "";
            return label.includes(query) || paramValue.includes(query);
        });
    };

    return (
        <div className="flex flex-col gap-2 sm:gap-6 h-full">
            <h4>Configuration</h4>

            <Select
                allowClear={false}
                allowSearch={false}
                value={configSection}
                onChange={(value) => setConfigSection(value as ConfigCategoryKey)}
                className="w-full sm:w-64 lg:hidden"
                options={configSections.map((section) => ({ label: section.name, value: section.id }))}
            />

            <div className="flex flex-col lg:grid lg:grid-cols-[200px_1fr] xl:grid-cols-[280px_1fr] gap-4 h-full w-full">
                <SidebarNav
                    className="hidden lg:block h-full bg-transparent p-0!"
                    items={configSidebarItems}
                    activeItem={configSection}
                    onItemClick={(id) => setConfigSection(id as ConfigCategoryKey)}
                    searchable
                    searchQuery={configSearchQuery}
                    onSearchChange={setConfigSearchQuery}
                    searchPlaceholder="Search parameters"
                    emptyMessage="No results found"
                />

                <div className="flex-1 min-w-0">
                    {configSections.map((section) => {
                        if (configSection !== section.id) return null;
                        const filteredParams = getFilteredParams(section.data);

                        return (
                            <Card key={section.id} className="h-full">
                                <CardContent className="p-0 h-full flex flex-col">
                                    <div className="px-5 py-4 border-b border-border-light/30 rounded-t-xl bg-linear-to-r from-primary/5 to-transparent shrink-0">
                                        <div className="flex items-center gap-3">
                                            <div className="p-2 rounded-lg bg-primary/10 text-primary">
                                                {section.icon}
                                            </div>
                                            <h3 className="text-lg font-bold flex-1">{section.name}</h3>
                                        </div>
                                    </div>
                                    <div className="px-5 py-4 overflow-y-auto flex-1">
                                        {filteredParams.length === 0 ? (
                                            <div className="flex items-center justify-center h-full min-h-[300px]">
                                                <div className="text-center">
                                                    <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-white/5 flex items-center justify-center">
                                                        <Search className="w-8 h-8 text-text-muted" />
                                                    </div>
                                                    <p className="text-sm text-text-muted font-medium">
                                                        No parameters found
                                                    </p>
                                                    <p className="text-xs text-text-muted/70 mt-1">
                                                        Try adjusting your search query
                                                    </p>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="space-y-0">
                                                {filteredParams.map(([key, config]) => (
                                                    <ParamRow
                                                        key={key}
                                                        label={formatParamLabel(key)}
                                                        value={config.currentValue}
                                                        unit={config.unit || undefined}
                                                    />
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </CardContent>
                            </Card>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
