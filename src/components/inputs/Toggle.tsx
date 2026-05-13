import React from "react";

interface ToggleOption {
    value: string;
    label: string;
    color?: "success" | "error" | "neutral";
}

interface ToggleProps {
    options: [ToggleOption, ToggleOption];
    value: string;
    onChange: (value: string) => void;
}

export const Toggle: React.FC<ToggleProps> = ({ options, value, onChange }) => {
    const isFirstSelected = value === options[0].value;
    const selectedOption = isFirstSelected ? options[0] : options[1];

    const getBackgroundColor = (color?: "success" | "error" | "neutral") => {
        switch (color) {
            case "success":
                return "bg-success";
            case "error":
                return "bg-error";
            case "neutral":
            default:
                return "bg-border";
        }
    };

    return (
        <div className="flex bg-card-more-elevated p-1 rounded-lg relative">
            <div
                className={`absolute top-1 bottom-1 w-1/2 rounded-md transition-all duration-300 shadow-md ${
                    isFirstSelected ? "left-1" : "left-[calc(50%-1px)]"
                } ${getBackgroundColor(selectedOption.color)}`}
            ></div>
            <button
                type="button"
                onClick={() => onChange(options[0].value)}
                className={`flex-1 py-1.5 rounded-md font-medium transition-all cursor-pointer duration-200 flex items-center justify-center z-10 ${
                    isFirstSelected
                        ? "text-text-primary hover:opacity-80"
                        : "text-text-tertiary hover:text-text-primary"
                }`}
            >
                {options[0].label}
            </button>
            <button
                type="button"
                onClick={() => onChange(options[1].value)}
                className={`flex-1 py-1.5 rounded-md font-medium transition-all cursor-pointer duration-200 flex items-center justify-center z-10 ${
                    isFirstSelected
                        ? "text-text-tertiary hover:text-text-primary"
                        : "text-text-primary hover:opacity-80"
                }`}
            >
                {options[1].label}
            </button>
        </div>
    );
};
