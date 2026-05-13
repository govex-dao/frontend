import { useState, useMemo, useEffect } from "react";
import { X, Check, Pencil } from "lucide-react";
import { Select } from "@/components/inputs/Select";
import { Input } from "@/components/inputs/Input";
import { Button } from "@/components/inputs/Button";
import { editableConfigCategories, getParamsForCategory, type ConfigCategoryKey } from "@/constants/configParameters";

export interface ConfigUpdate {
    category: string;
    parameter: string;
    value: string;
    unit: string;
    currentValue?: string;
}

interface Props {
    updates: ConfigUpdate[];
    onUpdatesChange: (updates: ConfigUpdate[]) => void;
    existingActions?: Array<{ id: string; type: string; data: { configUpdates?: ConfigUpdate[] } }>;
    currentActionId?: string;
}

export function ConfigForm(props: Props) {
    const { updates, onUpdatesChange, existingActions = [], currentActionId } = props;

    // Get categories used by other config actions (excluding current action)
    const usedCategories = useMemo(() => {
        const categories = new Set<string>();
        existingActions.forEach((action) => {
            // Skip the current action being edited
            if (action.id === currentActionId) return;

            if (action.type === "config" && action.data.configUpdates) {
                action.data.configUpdates.forEach((update) => {
                    categories.add(update.category);
                });
            }
        });
        return categories;
    }, [existingActions, currentActionId]);

    // Get the category from existing updates, or default to governance
    const lockedCategory = updates.length > 0 ? updates[0].category : null;
    const [selectedCategory, setSelectedCategory] = useState(lockedCategory || "governance");
    const [editingParam, setEditingParam] = useState<string | null>(null);
    const [editingValue, setEditingValue] = useState("");

    // Mark categories as disabled if:
    // 1. They're locked in current action (category is selected and has updates)
    // 2. They're used by other config actions
    const categories = useMemo(() => {
        return editableConfigCategories.map((cat) => ({
            ...cat,
            disabled:
                (lockedCategory !== null && cat.value !== lockedCategory) ||
                (usedCategories.has(cat.value) && cat.value !== lockedCategory),
        }));
    }, [lockedCategory, usedCategories]);

    // Update selected category when it gets locked
    useEffect(() => {
        if (lockedCategory && selectedCategory !== lockedCategory) {
            setSelectedCategory(lockedCategory);
        }
    }, [lockedCategory, selectedCategory]);

    // Get parameters for selected category
    const categoryParams = useMemo(() => {
        return getParamsForCategory(selectedCategory as ConfigCategoryKey);
    }, [selectedCategory]);

    // Check if a parameter is already in updates
    const getUpdateForParam = (paramKey: string) => {
        return updates.find((u) => u.category === selectedCategory && u.parameter === paramKey);
    };

    // Calculate diff (for numeric values)
    const calculateDiff = (current: string, newVal: string): { diff: string; isIncrease: boolean } | null => {
        const currentNum = parseFloat(current.replace(/,/g, ""));
        const newNum = parseFloat(newVal.replace(/,/g, ""));

        if (isNaN(currentNum) || isNaN(newNum)) return null;

        const diff = newNum - currentNum;
        const percentChange = ((diff / currentNum) * 100).toFixed(1);

        if (diff === 0) return null;

        const isIncrease = diff > 0;
        const sign = isIncrease ? "+" : "";
        return {
            diff: `${sign}${diff.toLocaleString()} (${sign}${percentChange}%)`,
            isIncrease,
        };
    };

    const handleStartEdit = (paramKey: string, currentValue: string) => {
        const existingUpdate = getUpdateForParam(paramKey);
        setEditingParam(paramKey);
        setEditingValue(existingUpdate?.value || currentValue);
    };

    const handleSaveEdit = (paramKey: string, unit: string, currentValue: string) => {
        if (!editingValue || editingValue === currentValue) {
            setEditingParam(null);
            setEditingValue("");
            return;
        }

        const newUpdate: ConfigUpdate = {
            category: selectedCategory,
            parameter: paramKey,
            value: editingValue,
            unit: unit,
            currentValue: currentValue,
        };

        // Remove existing update for this param if any, then add new one
        const filteredUpdates = updates.filter((u) => !(u.category === selectedCategory && u.parameter === paramKey));
        onUpdatesChange([...filteredUpdates, newUpdate]);

        setEditingParam(null);
        setEditingValue("");
    };

    const handleCancelEdit = () => {
        setEditingParam(null);
        setEditingValue("");
    };

    const handleRemoveUpdate = (paramKey: string) => {
        onUpdatesChange(updates.filter((u) => !(u.category === selectedCategory && u.parameter === paramKey)));
    };

    const selectedCategoryData = categories.find((c) => c.value === selectedCategory);
    const CategoryIcon = selectedCategoryData?.icon;

    return (
        <div className="space-y-2 sm:space-y-3 w-full">
            {/* Category selector */}
            <Select
                label="Category"
                options={categories}
                value={selectedCategory}
                onChange={setSelectedCategory}
                placeholder="Select category"
                allowClear={false}
                disabled={lockedCategory !== null}
            />
            {lockedCategory && (
                <p className="text-xs text-text-muted -mt-2">
                    Category locked to {selectedCategoryData?.label}. Remove all updates to change category.
                </p>
            )}

            {/* Parameters list - styled like ConfigTab */}
            <div className="border border-border rounded-lg overflow-hidden">
                {/* Header */}
                <div className="px-3 sm:px-4 py-2 sm:py-3 border-b border-border/30 bg-linear-to-r from-primary/5 to-transparent">
                    <div className="flex items-center gap-2 sm:gap-3">
                        <div className="p-1.5 sm:p-2 rounded-lg bg-primary/10 text-primary">
                            {CategoryIcon && <CategoryIcon className="w-3.5 h-3.5 sm:w-4 sm:h-4" />}
                        </div>
                        <h3 className="text-xs sm:text-sm font-bold flex-1">{selectedCategoryData?.label}</h3>
                        <p className="text-xs text-text-tertiary">
                            {updates.filter((u) => u.category === selectedCategory).length} update(s)
                        </p>
                    </div>
                </div>

                {/* Parameters */}
                <div className="max-h-[300px] sm:max-h-[400px] overflow-y-auto">
                    {categoryParams.map((param) => {
                        const existingUpdate = getUpdateForParam(param.key);
                        const isEditing = editingParam === param.key;
                        const hasUpdate = !!existingUpdate;
                        const displayValue = existingUpdate?.value || param.currentValue;
                        const diffData = existingUpdate?.currentValue
                            ? calculateDiff(existingUpdate.currentValue, existingUpdate.value)
                            : null;

                        return (
                            <div
                                key={param.key}
                                className={`px-3 sm:px-4 py-2 sm:py-3 border-b border-border-light/10 last:border-0 transition-colors ${
                                    hasUpdate ? "bg-purple-500/5" : "hover:bg-primary/5"
                                } ${isEditing ? "bg-primary/10" : ""}`}
                            >
                                {!isEditing ? (
                                    // Display mode
                                    <div>
                                        {/* First line: Label, Value, and Edit icon */}
                                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 sm:gap-3">
                                            {/* Left: Label */}
                                            <div className="flex items-center gap-2 min-w-0">
                                                {hasUpdate && (
                                                    <div className="shrink-0 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-purple-500/20 flex items-center justify-center">
                                                        <Check className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-purple-400" />
                                                    </div>
                                                )}
                                                <span
                                                    className={`text-xs sm:text-sm font-semibold transition-colors ${
                                                        hasUpdate ? "text-text-light" : "text-text-muted"
                                                    }`}
                                                >
                                                    {param.label}
                                                </span>
                                            </div>

                                            {/* Right: Value + Unit + Edit */}
                                            <div className="flex items-center gap-1.5 sm:gap-2">
                                                <div className="flex items-center gap-1 sm:gap-1.5">
                                                    {hasUpdate && (
                                                        <span className="text-[10px] sm:text-xs text-text-muted line-through opacity-60">
                                                            {param.currentValue}
                                                        </span>
                                                    )}
                                                    <span
                                                        className={`text-xs sm:text-sm font-medium font-mono ${hasUpdate ? "text-text-light" : ""}`}
                                                    >
                                                        {displayValue}
                                                    </span>
                                                </div>
                                                {param.unit && (
                                                    <span className="text-[10px] sm:text-xs text-text-muted bg-background/50 border border-border-light px-1.5 sm:px-2 py-0.5 rounded font-semibold">
                                                        {param.unit}
                                                    </span>
                                                )}
                                                <button
                                                    onClick={() => handleStartEdit(param.key, param.currentValue)}
                                                    className="p-1 sm:p-1.5 text-text-muted hover:text-primary hover:bg-primary/10 rounded transition-colors"
                                                    title={hasUpdate ? "Edit" : "Update"}
                                                >
                                                    <Pencil className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                </button>
                                            </div>
                                        </div>

                                        {/* Second line: Only show if there's a diff or remove button needed */}
                                        {(diffData || hasUpdate) && (
                                            <div className="flex items-center justify-end gap-2 ml-0 sm:ml-7 mt-2">
                                                {diffData && (
                                                    <span
                                                        className={`text-[10px] sm:text-xs font-semibold px-1.5 py-0.5 rounded ${
                                                            diffData.isIncrease
                                                                ? "bg-green-500/10 text-green-400"
                                                                : "bg-red-500/10 text-red-400"
                                                        }`}
                                                    >
                                                        {diffData.diff}
                                                    </span>
                                                )}
                                                {hasUpdate && (
                                                    <button
                                                        onClick={() => handleRemoveUpdate(param.key)}
                                                        className="p-1 text-text-muted hover:text-red-400 hover:bg-red-400/10 rounded transition-colors"
                                                    >
                                                        <X className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                                                    </button>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                ) : (
                                    // Editing mode
                                    <div className="space-y-2">
                                        {/* Parameter label */}
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs sm:text-sm font-semibold text-text-light">
                                                {param.label}
                                            </span>
                                        </div>
                                        {/* Input row */}
                                        <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
                                            <div className="flex-1 flex items-center gap-2">
                                                <Input
                                                    value={editingValue}
                                                    onChange={setEditingValue}
                                                    placeholder="Enter new value"
                                                    autoFocus
                                                    size="sm"
                                                    className="flex-1"
                                                />
                                                {param.unit && (
                                                    <span className="text-[10px] sm:text-xs text-text-muted bg-background/50 border border-border-light px-1.5 sm:px-2 py-1 rounded font-semibold shrink-0">
                                                        {param.unit}
                                                    </span>
                                                )}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Button
                                                    onClick={() =>
                                                        handleSaveEdit(param.key, param.unit, param.currentValue)
                                                    }
                                                    variant="primary"
                                                    className="py-1! px-2! sm:px-3! text-xs flex-1 sm:flex-none"
                                                >
                                                    Save
                                                </Button>
                                                <button
                                                    onClick={handleCancelEdit}
                                                    className="px-2 sm:px-3 py-1 text-xs text-text-muted hover:text-text-primary transition-colors flex-1 sm:flex-none"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>
        </div>
    );
}
