import { describe, expect, it } from "vitest";

import type { Proposal } from "@/types/Proposal";
import { confirmedTradesFromResult } from "@/lib/trade/confirmedTrades";

describe("confirmed trade projection", () => {
    it("projects every SwapEvent in a smart-swap transaction", () => {
        const proposal = {
            asset_decimals: 9,
            stable_decimals: 6,
            outcome_messages: '["Yes","No"]',
        } as Proposal;
        const events = [0, 1].map((outcome) => ({
            id: { txDigest: "tx-smart", eventSeq: String(outcome) },
            type: "0x1::conditional_amm::SwapEvent",
            parsedJson: {
                is_buy: true,
                price: "1000000000000",
                price_impact: "50",
                outcome,
                timestamp: "1700000000000",
                amount_in: String(100 + outcome),
                sender: "0xabc",
            },
        }));

        const trades = confirmedTradesFromResult({ digest: "tx-smart", events }, proposal);

        expect(trades).toHaveLength(2);
        expect(trades.map((trade) => trade.id)).toEqual(["confirmed:tx-smart:0", "confirmed:tx-smart:1"]);
        expect(trades.map((trade) => trade.outcome)).toEqual(["Yes", "No"]);
    });
});
