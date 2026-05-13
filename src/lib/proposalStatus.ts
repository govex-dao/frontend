export type ProposalStatus = "pre-trading" | "active" | "ended";

export interface ProposalStatusResult {
    status: ProposalStatus;
    isPreTrading: boolean;
    isActive: boolean;
    isEnded: boolean;
}

export function getProposalStatus(start: Date, end: Date): ProposalStatusResult {
    const now = new Date();
    const isPreTrading = now < start;
    const isActive = now >= start && now <= end;
    const isEnded = now > end;

    let status: ProposalStatus = "active";
    if (isPreTrading) status = "pre-trading";
    else if (isEnded) status = "ended";

    return {
        status,
        isPreTrading,
        isActive,
        isEnded,
    };
}
