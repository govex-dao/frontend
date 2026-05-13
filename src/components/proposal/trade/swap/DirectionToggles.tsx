import { type Dispatch, type SetStateAction } from "react";
import { ArrowLeftRight } from "lucide-react";
import { Toggle } from "@/components/inputs/Toggle";

interface Props {
    isBuy: boolean;
    setIsBuy: Dispatch<SetStateAction<boolean>>;
}

export function TradeDirectionToggle(props: Props) {
    const { isBuy, setIsBuy } = props;

    return (
        <Toggle
            options={[
                { value: "buy", label: "Buy", color: "success" },
                { value: "sell", label: "Sell", color: "error" },
            ]}
            value={isBuy ? "buy" : "sell"}
            onChange={(value) => setIsBuy(value === "buy")}
        />
    );
}

export function TradeDirectionSwapButton(props: Props) {
    const { isBuy, setIsBuy } = props;

    return (
        <div className="flex justify-center -my-[24px] z-10">
            <button
                type="button"
                className="bg-primary hover:bg-primary-light border-4 border-card rounded-full p-1.5 w-9 h-9 flex items-center justify-center cursor-pointer transition-all duration-300 shadow-card-elevated transform hover:scale-105 active:scale-95"
                onClick={() => setIsBuy((p) => !p)}
                title={`Switch to ${isBuy ? "Sell" : "Buy"}`}
                aria-label={`Switch to ${isBuy ? "Sell" : "Buy"}`}
            >
                <ArrowLeftRight
                    className={`w-4 h-4 text-white transition-transform duration-300 ${isBuy ? "rotate-90" : "-rotate-90"}`}
                />
            </button>
        </div>
    );
}
