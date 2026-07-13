import type { TransactionResult } from "@/hooks/useSuiTransaction";
import type { Trade } from "@/lib/api/trades";
import type { Proposal } from "@/types/Proposal";
import { parseOutcomeMessages } from "@/types/Proposal";

const PRICE_SCALE = 1_000_000_000_000n;

/** Convert every swap event in a PTB into a distinct optimistic trade row. */
export function confirmedTradesFromResult(result: TransactionResult, proposal: Proposal): Trade[] {
    const outcomes = parseOutcomeMessages(proposal);
    return (result.events ?? []).flatMap((event, index) => {
        if (!event.type?.endsWith("::conditional_amm::SwapEvent")) return [];
        const data = event.parsedJson;
        if (!data || typeof data !== "object") return [];
        const fields = data as Record<string, unknown>;
        const isBuy = Boolean(fields.is_buy);
        const rawPrice = BigInt(String(fields.price ?? "0"));
        const scaledPrice = Number(rawPrice / PRICE_SCALE) + Number(rawPrice % PRICE_SCALE) / Number(PRICE_SCALE);
        const price = scaledPrice * Math.pow(10, proposal.asset_decimals - proposal.stable_decimals);
        const impact = Number(fields.price_impact ?? 0) / 100;
        const outcomeIndex = Number(fields.outcome ?? 0);
        const timestamp = Number(fields.timestamp ?? Date.now());
        return [
            {
                id: `confirmed:${result.digest}:${event.id?.eventSeq ?? index}`,
                time: new Date(timestamp).toISOString(),
                type: isBuy ? "Buy" : "Sell",
                outcome: outcomes[outcomeIndex] || `Outcome ${outcomeIndex}`,
                outcome_index: outcomeIndex,
                price,
                volume: String(isBuy ? (fields.amount_in ?? "0") : (fields.amount_out ?? "0")),
                priceImpact: isBuy ? impact : -impact,
                trader: String(fields.sender ?? ""),
                tx_digest: result.digest,
            },
        ];
    });
}
