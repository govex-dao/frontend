import { CheckIcon, ChevronDownIcon, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { hexToRgba } from "@/lib/outcomes";
import { Input } from "./Input";

export interface SelectOption {
    value: string;
    label: string;
    disabled?: boolean;
    color?: string;
}

interface Props {
    options: SelectOption[];
    value?: string;
    onChange: (value: string) => void;
    placeholder?: string;
    searchPlaceholder?: string;
    className?: string;
    disabled?: boolean;
    allowSearch?: boolean;
    allowClear?: boolean;
    label?: string;
}

export function Select(props: Props) {
    const {
        options,
        value,
        onChange,
        placeholder = "Select an option...",
        searchPlaceholder = "Search...",
        className = "",
        disabled = false,
        allowSearch = true,
        allowClear = true,
        label,
    } = props;
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState("");
    const [focusedIndex, setFocusedIndex] = useState(-1);
    const containerRef = useRef<HTMLDivElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    // Filter options based on search query
    const filteredOptions = useMemo(
        () =>
            allowSearch
                ? options.filter((option) => option.label.toLowerCase().includes(searchQuery.toLowerCase()))
                : options,
        [allowSearch, options, searchQuery]
    );

    const handleSelectOption = useCallback(
        (selectedValue: string) => {
            if (disabled) return;

            const option = options.find((opt) => opt.value === selectedValue);
            if (option?.disabled) return;

            onChange(selectedValue);
            setIsOpen(false);
            setSearchQuery("");
            setFocusedIndex(-1);
        },
        [disabled, onChange, options]
    );

    // Handle click outside to close dropdown
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchQuery("");
                setFocusedIndex(-1);
            }
        };

        if (isOpen) document.addEventListener("mousedown", handleClickOutside);
        return () => {
            document.removeEventListener("mousedown", handleClickOutside);
        };
    }, [isOpen]);

    // Handle keyboard navigation
    useEffect(() => {
        const handleKeyDown = (event: KeyboardEvent) => {
            if (!isOpen) return;

            switch (event.key) {
                case "ArrowDown":
                    event.preventDefault();
                    setFocusedIndex((prev) => (prev < filteredOptions.length - 1 ? prev + 1 : prev));
                    break;
                case "ArrowUp":
                    event.preventDefault();
                    setFocusedIndex((prev) => (prev > 0 ? prev - 1 : -1));
                    break;
                case "Enter":
                    event.preventDefault();
                    if (focusedIndex >= 0 && focusedIndex < filteredOptions.length) {
                        handleSelectOption(filteredOptions[focusedIndex].value);
                    }
                    break;
                case "Escape":
                    event.preventDefault();
                    setIsOpen(false);
                    setSearchQuery("");
                    setFocusedIndex(-1);
                    break;
            }
        };

        if (isOpen) document.addEventListener("keydown", handleKeyDown);

        return () => {
            document.removeEventListener("keydown", handleKeyDown);
        };
    }, [isOpen, focusedIndex, filteredOptions, handleSelectOption]);

    // Scroll focused item into view
    useEffect(() => {
        if (focusedIndex >= 0 && dropdownRef.current) {
            const focusedElement = dropdownRef.current.children[focusedIndex] as HTMLElement;
            if (focusedElement) {
                focusedElement.scrollIntoView({
                    block: "nearest",
                    behavior: "smooth",
                });
            }
        }
    }, [focusedIndex]);

    const handleClear = (event: ReactMouseEvent) => {
        event.stopPropagation();
        onChange("");
    };

    const selectedOption = options.find((opt) => opt.value === value);

    return (
        <div className={className}>
            {/* Label */}
            {label && <label className="block text-sm font-medium text-text-light mb-2">{label}</label>}

            <div ref={containerRef} className="relative">
                <div
                    className={`
          flex w-full items-center rounded-xl border transition-all duration-200
          ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
          ${!selectedOption?.color && (isOpen ? "bg-card-elevated shadow-lg" : "bg-card hover:border-border-light")}
          ${!selectedOption?.color ? (isOpen ? "border-border-light" : "border-border") : ""}
          flex items-center justify-between gap-2
        `}
                    style={{
                        borderColor: selectedOption?.color ? hexToRgba(selectedOption.color, 0.3) : undefined,
                        backgroundColor: selectedOption?.color ? hexToRgba(selectedOption.color, 0.15) : undefined,
                    }}
                >
                    <button
                        type="button"
                        onClick={() => !disabled && setIsOpen(!isOpen)}
                        disabled={disabled}
                        className="flex min-w-0 flex-1 items-center justify-between gap-2 px-3 py-2 text-left"
                        aria-haspopup="listbox"
                        aria-expanded={isOpen}
                    >
                        <span
                            className={`text-sm flex items-center gap-2 min-w-0 ${selectedOption ? "text-text-primary" : "text-text-muted"}`}
                        >
                            {selectedOption?.color && (
                                <span
                                    className="w-2 h-2 rounded-full shrink-0"
                                    style={{ backgroundColor: selectedOption.color }}
                                />
                            )}
                            <span className="truncate">{selectedOption ? selectedOption.label : placeholder}</span>
                        </span>
                        <ChevronDownIcon
                            className={`w-4 h-4 text-white/40 transition-transform duration-200 ${isOpen ? "rotate-180" : ""}`}
                        />
                    </button>
                    {allowClear && selectedOption && value && !disabled && (
                        <button
                            type="button"
                            onClick={handleClear}
                            className="mr-2 rounded p-1 transition-colors hover:bg-white/5"
                            aria-label="Clear selection"
                        >
                            <X className="w-4 h-4 text-white/40" />
                        </button>
                    )}
                </div>

                {/* Dropdown */}
                {isOpen && (
                    <div
                        ref={dropdownRef}
                        className="absolute z-50 min-w-full max-w-[32rem] mt-2 bg-card-elevated border border-border rounded-xl shadow-card-more-elevated overflow-hidden backdrop-blur-xl"
                    >
                        {/* Search Input */}
                        {allowSearch && (
                            <Input
                                className="m-2"
                                value={searchQuery}
                                onChange={(value) => setSearchQuery(value)}
                                placeholder={searchPlaceholder}
                                autoFocus
                            />
                        )}

                        {/* Options List */}
                        <div className="max-h-64 overflow-y-auto" role="listbox">
                            {filteredOptions.length === 0 ? (
                                <div className="px-4 py-8 text-center text-sm text-text-muted">No options found</div>
                            ) : (
                                filteredOptions.map((option, index) => {
                                    const selected = option.value === value;
                                    const focused = index === focusedIndex;
                                    const isDisabled = option.disabled || disabled;

                                    const selectedBgColor =
                                        selected && option.color ? hexToRgba(option.color, 0.1) : undefined;
                                    const selectedTextColor = selected && option.color ? option.color : undefined;

                                    return (
                                        <button
                                            key={option.value}
                                            type="button"
                                            role="option"
                                            aria-selected={selected}
                                            onClick={() => !isDisabled && handleSelectOption(option.value)}
                                            disabled={isDisabled}
                                            className={`
                      w-full px-4 py-2.5 text-left text-sm transition-colors duration-150
                      flex items-center gap-3
                      ${isDisabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}
                      ${
                          selected && !option.color
                              ? "bg-primary/10 text-primary"
                              : focused
                                ? "bg-white/5 text-text-primary"
                                : "text-text-secondary hover:bg-white/5"
                      }
                    `}
                                            style={{
                                                backgroundColor: selectedBgColor,
                                                color: selectedTextColor,
                                            }}
                                        >
                                            <CheckIcon
                                                className={`w-4 h-4 ${selected ? "opacity-100" : "opacity-0"}`}
                                                style={{ color: option.color || "var(--color-primary)" }}
                                            />
                                            {option.color && (
                                                <span
                                                    className="w-2 h-2 rounded-full"
                                                    style={{ backgroundColor: option.color }}
                                                />
                                            )}
                                            <span className="flex-1 truncate">{option.label}</span>
                                        </button>
                                    );
                                })
                            )}
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
