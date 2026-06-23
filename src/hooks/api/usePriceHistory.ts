import { useQuery } from "@tanstack/react-query";
import { fetchProposalPriceHistory } from "../../lib/api";
import { REFRESH_INTERVALS } from "./refresh";

export const priceHistoryKeys = {
    all: ["price-history"] as const,
    proposal: (proposalId: string) => [...priceHistoryKeys.all, "proposal", proposalId] as const,
};

export function useProposalPriceHistory(proposalId: string | undefined) {
    return useQuery({
        queryKey: priceHistoryKeys.proposal(proposalId!),
        queryFn: ({ signal }) => fetchProposalPriceHistory(proposalId!, { signal }),
        enabled: !!proposalId,
        refetchInterval: REFRESH_INTERVALS.LIVE,
    });
}
