import { CheckIcon, ChevronDownIcon, Wallet2 } from "lucide-react";
import { useState, useRef, useEffect } from "react";
import type { Token } from "@/types";
import { formatNumberWithCommas } from "@/lib/formatNumber";
import { CoinAvatar } from "@/components/CoinAvatar";

interface Props {
    value: string | number;
    onChange: (value: string) => void;
    placeholder?: string;
    label?: string;
    balance?: string | number;
    maxBalanceValue?: string;
    tokens?: Token[];
    hideBalance?: boolean;
    required?: boolean;
    error?: boolean;
    className?: string;
}

export function TokenInput(props: Props) {
    const {
        value,
        onChange,
        placeholder = "0.00",
        label,
        tokens = [],
        hideBalance = false,
        className = "",
        balance,
        maxBalanceValue,
    } = props;
    const stringValue = typeof value === "number" ? value.toString() : value;
    const [isOpen, setIsOpen] = useState(false);
    const [selectedToken, setSelectedToken] = useState<Token | null>(tokens.length > 0 ? tokens[0] : null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const displayBalance = balance ?? selectedToken?.balance ?? 0;

    const normalizeNumericString = (input: string): string => input.replace(/,/g, "").trim();
    const hasPositiveBalance = (input: string | number): boolean => {
        if (typeof input === "number") return input > 0;
        const normalized = normalizeNumericString(input);
        if (!normalized || normalized === ".") return false;
        const [intPart = "0", fractionPart = ""] = normalized.split(".");
        const hasInteger = intPart.replace(/^0+/, "").length > 0;
        const hasFraction = fractionPart.replace(/0+$/, "").length > 0;
        return hasInteger || hasFraction;
    };
    const formatBalanceDisplay = (input: string | number): string => {
        if (typeof input === "number") return formatNumberWithCommas(input);
        const normalized = normalizeNumericString(input);
        if (!normalized || normalized === ".") return "0";
        const [intPart = "0", fractionPart = ""] = normalized.split(".");
        const safeInt = intPart.replace(/^0+(?=\d)/, "") || "0";
        const intWithCommas = safeInt.replace(/\B(?=(\d{3})+(?!\d))/g, ",");
        const trimmedFraction = fractionPart.replace(/0+$/, "");
        return trimmedFraction ? `${intWithCommas}.${trimmedFraction}` : intWithCommas;
    };
    const maxFillValue =
        maxBalanceValue ??
        (typeof displayBalance === "number"
            ? displayBalance.toString()
            : normalizeNumericString(displayBalance));

    // Close dropdown on outside click
    useEffect(() => {
        if (!isOpen) return;
        const handleClickOutside = (e: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener("mousedown", handleClickOutside);
        return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [isOpen]);

    const handleTokenSelect = (token: Token) => {
        setSelectedToken(token);
        setIsOpen(false);
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const inputValue = e.target.value;

        // Allow empty string
        if (inputValue === "") {
            onChange("");
            return;
        }

        // Remove commas to get the raw number
        const rawValue = inputValue.replace(/,/g, "");

        // Only allow valid numbers (including decimals)
        // This regex allows: digits, one decimal point, and handles leading zeros
        if (/^\d*\.?\d*$/.test(rawValue)) {
            onChange(rawValue);
        }
    };

    // Format the display value with commas
    const getDisplayValue = () => {
        if (!stringValue) return "";

        // If there's a decimal point, split and format only the integer part
        const parts = stringValue.split(".");
        const integerPart = parts[0];
        const decimalPart = parts[1];

        // Add commas to integer part
        const formattedInteger = integerPart.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

        // Return with decimal if it exists
        return decimalPart !== undefined ? `${formattedInteger}.${decimalPart}` : formattedInteger;
    };

    return (
        <div
            className={`bg-card-elevated rounded-lg px-2.5 py-1.5 border border-border transition-all focus-within:border-border-light focus-within:bg-card-more-elevated ${className}`}
        >
            <div className="flex justify-between mb-0.5">
                <span className="text-text-tertiary text-[10px] font-medium uppercase tracking-wide">
                    {label || "Amount"}
                </span>
                {!hideBalance && (
                    <button
                        type="button"
                        onClick={() => hasPositiveBalance(displayBalance) && onChange(maxFillValue)}
                        className="text-text-tertiary text-xs flex items-center gap-1 hover:text-text-secondary transition-colors"
                    >
                        <Wallet2 className="h-3 w-3 text-text-muted" />
                        <span>{hasPositiveBalance(displayBalance) ? formatBalanceDisplay(displayBalance) : "0"}</span>
                    </button>
                )}
            </div>
            <div className="flex items-center">
                <div className="flex-1">
                    <input
                        type="text"
                        inputMode="decimal"
                        value={getDisplayValue()}
                        onChange={handleInputChange}
                        placeholder={placeholder}
                        className="w-full bg-transparent text-text-primary text-base focus:outline-none font-medium appearance-none [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none [-moz-appearance:textfield]"
                    />
                </div>
                {/* Token selector */}
                {tokens.length > 1 ? (
                    <div className="relative" ref={dropdownRef}>
                        <button
                            type="button"
                            onClick={() => setIsOpen(!isOpen)}
                            className="bg-card-more-elevated px-2 py-1 rounded-md flex items-center gap-1.5 hover:bg-white/10 transition-colors border border-border"
                        >
                            <CoinAvatar
                                coinType={selectedToken?.coinType}
                                symbol={selectedToken?.symbol}
                                iconUrl={selectedToken?.image}
                                size="sm"
                            />
                            <span className="text-text-primary font-medium text-sm">{selectedToken?.symbol}</span>
                            <ChevronDownIcon className="w-3 h-3 text-text-tertiary" />
                        </button>

                        {/* Dropdown menu */}
                        {isOpen && (
                            <div className="absolute right-0 top-full mt-1 bg-card-more-elevated border border-border-light rounded-md shadow-card-elevated overflow-hidden z-10 min-w-[200px]">
                                {tokens.map((token) => (
                                    <button
                                        key={token.symbol}
                                        type="button"
                                        onClick={() => handleTokenSelect(token)}
                                        className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/5 transition-colors ${
                                            selectedToken?.symbol === token.symbol ? "bg-white/5" : ""
                                        }`}
                                    >
                                        <CoinAvatar
                                            coinType={token.coinType}
                                            symbol={token.symbol}
                                            iconUrl={token.image}
                                            size="md"
                                        />
                                        <div className="flex flex-col items-start">
                                            <span className="font-semibold text-text-primary text-sm">
                                                {token.symbol}
                                            </span>
                                            <span className="text-xs text-text-tertiary">{token.name}</span>
                                        </div>
                                        {selectedToken?.symbol === token.symbol && (
                                            <CheckIcon className="w-4 h-4 text-primary ml-auto" />
                                        )}
                                    </button>
                                ))}
                            </div>
                        )}
                    </div>
                ) : (
                    <div className="bg-card-more-elevated px-2 py-1 rounded-md flex items-center gap-1.5 border border-border">
                        <CoinAvatar
                            coinType={tokens[0]?.coinType}
                            symbol={tokens[0]?.symbol}
                            iconUrl={tokens[0]?.image}
                            size="sm"
                        />
                        <span className="text-text-primary font-medium text-sm">{tokens[0]?.symbol}</span>
                    </div>
                )}
            </div>
        </div>
    );
}
