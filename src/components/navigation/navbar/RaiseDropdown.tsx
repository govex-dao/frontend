import { useMemo } from "react";
import { useNavigate } from "react-router";
import { useRaises } from "@/hooks/api";
import { getRaiseName } from "@/types/Raise";
import { formatNumber } from "@/lib/formatNumber";
import { DropdownWrapper } from "./DropdownWrapper";

/** Hook used by LiveDropdown to count active fundraises */
export function useActiveFundraises() {
    const { data: raises, ...rest } = useRaises();
    const data = useMemo(
        () => raises?.filter((r) => !r.deadline || Number(r.deadline) > Date.now()) ?? [],
        [raises]
    );
    return { data, ...rest };
}

interface FundraisesDropdownContentProps {
    onItemClick: () => void;
    onMouseLeave?: () => void;
}

export function FundraisesDropdownContent({ onItemClick, onMouseLeave }: FundraisesDropdownContentProps) {
    const navigate = useNavigate();
    const { data: raises, isLoading } = useRaises();

    // Filter for active raises (deadline in the future or no deadline set)
    const activeRaises = raises?.filter((r) => {
        if (!r.deadline) return true;
        return Number(r.deadline) > Date.now();
    }) ?? [];

    return (
        <DropdownWrapper
            title="Active Raises"
            subtitle="Live investment opportunities"
            onViewAll={() => navigate("/raises")}
            onMouseLeave={onMouseLeave}
        >
            {isLoading && (
                <p className="text-text-muted text-sm py-4 text-center">Loading...</p>
            )}
            {!isLoading && activeRaises.length === 0 && (
                <p className="text-text-muted text-sm py-4 text-center">No active raises</p>
            )}
            {activeRaises.map((raise) => {
                const name = getRaiseName(raise);
                const stableDecimals = raise.stable_decimals || 9;
                const divisor = Math.pow(10, stableDecimals);
                const raised = Number(raise.raised) / divisor;
                const target = raise.target_amount ? Number(raise.target_amount) / divisor : 0;
                const progress = target > 0 ? Math.min((raised / target) * 100, 100) : 0;

                return (
                    <button
                        key={raise.id}
                        className="w-full text-left p-3 rounded-lg hover:bg-white/5 transition-colors"
                        onClick={() => {
                            navigate(`/raises/${raise.id}`);
                            onItemClick();
                        }}
                    >
                        <div className="flex items-center justify-between mb-1">
                            <span className="text-sm font-medium text-text-primary">{name}</span>
                            <span className="text-xs text-text-muted">{progress.toFixed(0)}%</span>
                        </div>
                        <div className="w-full h-1.5 bg-border rounded-full overflow-hidden">
                            <div
                                className="h-full bg-primary rounded-full transition-all"
                                style={{ width: `${progress}%` }}
                            />
                        </div>
                        <p className="text-xs text-text-muted mt-1">
                            ${formatNumber(raised)} / ${formatNumber(target)} {raise.stable_symbol || "USDC"}
                        </p>
                    </button>
                );
            })}
        </DropdownWrapper>
    );
}
