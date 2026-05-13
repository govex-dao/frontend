import type { ActionType } from "@/types";
import { actionTypes, getActionTitle } from "@/lib/actionHelpers";

export const ActionIcon = (props: { type: ActionType }) => {
    const { type } = props;
    const Icon = actionTypes.find((t) => t.type === type)?.icon;

    return (
        <div className="relative w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center">
            {Icon && <Icon className="w-5 h-5 text-text-secondary" />}
        </div>
    );
};

export function ActionHeader(props: { actionType: ActionType; number: number; className?: string; title?: string }) {
    const { actionType, number, className = "", title: titleOverride } = props;
    if (!actionType) return null;
    const title = titleOverride || getActionTitle(actionType);

    return (
        <div className={`flex items-center gap-2 min-w-0 ${className}`}>
            <div className="shrink-0">
                <ActionIcon type={actionType} />
            </div>
            <div className="min-w-0">
                <div className="text-text-light text-xs">#{number}</div>
                <div className="text-text-primary font-medium text-sm truncate">{title}</div>
            </div>
        </div>
    );
}
