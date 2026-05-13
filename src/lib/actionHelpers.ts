import { MessageSquare, Settings, ArrowRight, Clock, Code2 } from "lucide-react";
import type { ActionType, ProposalAction } from "@/types";
import { ACTION_COLORS } from "@/lib/proposalConstants";

export const actionTypes = [
    {
        type: "transfer" as ActionType,
        label: "Transfer",
        description: "Send tokens to wallet",
        icon: ArrowRight,
        color: "text-purple-400",
        bgColor: ACTION_COLORS.transfer.bg,
        bgGradient: "from-purple-400/20 via-violet-400/15 to-indigo-500/20",
        borderColor: ACTION_COLORS.transfer.border,
    },
    {
        type: "config" as ActionType,
        label: "Update Config",
        description: "Update configuration parameters",
        icon: Settings,
        color: "text-blue-400",
        bgColor: ACTION_COLORS.config.bg,
        bgGradient: "from-blue-400/20 via-cyan-400/15 to-sky-500/20",
        borderColor: ACTION_COLORS.config.border,
    },
    {
        type: "createStream" as ActionType,
        label: "Create Payment Stream",
        description: "Create a payment stream",
        icon: Clock,
        color: "text-orange-400",
        bgColor: ACTION_COLORS.createStream.bg,
        bgGradient: "from-orange-400/20 via-amber-400/15 to-yellow-500/20",
        borderColor: ACTION_COLORS.createStream.border,
    },
    {
        type: "memo" as ActionType,
        label: "Memo",
        description: "No on-chain action? Add a binding commitment",
        icon: MessageSquare,
        color: "text-green-400",
        bgColor: ACTION_COLORS.memo.bg,
        bgGradient: "from-green-400/20 via-emerald-400/15 to-teal-500/20",
        borderColor: ACTION_COLORS.memo.border,
    },
    {
        type: "onChain" as ActionType,
        label: "On-chain Action",
        description: "Indexed action staged on-chain",
        icon: Code2,
        color: "text-teal-400",
        bgColor: ACTION_COLORS.onChain.bg,
        bgGradient: "from-teal-400/20 via-cyan-400/15 to-blue-500/20",
        borderColor: ACTION_COLORS.onChain.border,
    },
];

export const getActionTitle = (type: ActionType): string => {
    const actionType = actionTypes.find((a) => a.type === type);
    return actionType?.label || type;
};

export const getActionsSummary = (actions: ProposalAction[]) => {
    const totals: { [token: string]: number } = {};

    actions.forEach((action) => {
        if (action.type === "transfer" && action.data.amount && action.data.token) {
            const token = action.data.token;
            const amount = Number(action.data.amount);
            if (!isNaN(amount)) {
                totals[token] = (totals[token] || 0) + amount;
            }
        }
    });

    return Object.entries(totals).map(([token, amount]) => ({
        token,
        amount,
    }));
};
