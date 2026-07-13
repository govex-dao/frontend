import { QueryClient } from "@tanstack/react-query";
import { describe, expect, it } from "vitest";

import type { Raise } from "@/types";
import {
    captureRaiseProjectionBaseline,
    mergePendingRaise,
    registerPendingRaiseEffects,
} from "@/lib/raise/pendingRaiseEffects";

describe("raise confirmation projections", () => {
    it("uses a pre-submit baseline and cannot double-count an already indexed event", () => {
        const queryClient = new QueryClient();
        const detailKey = ["raises", "detail", "raise-1"] as const;
        const before = {
            id: "raise-1",
            raised: "100",
            contributors: [{ address: "0xabc", amount: "20", percentage: "20" }],
        } as Raise;
        queryClient.setQueryData(detailKey, before);
        queryClient.setQueryData(["raises", "contribution", "raise-1", "0xabc"], {
            hasInvested: true,
            amount: "20",
            percentage: "20",
            rank: 1,
        });
        const baseline = captureRaiseProjectionBaseline(queryClient, "raise-1", "0xabc");

        const alreadyIndexed = {
            ...before,
            raised: "110",
            contributors: [{ address: "0xabc", amount: "30", percentage: "27" }],
        };
        queryClient.setQueryData(detailKey, alreadyIndexed);
        registerPendingRaiseEffects(
            queryClient,
            "tx-raise",
            [
                {
                    id: { txDigest: "tx-raise", eventSeq: "0" },
                    type: "0x1::launchpad::ContributionAdded",
                    parsedJson: { raise_id: "raise-1", contributor: "0xabc", amount: "10" },
                },
            ],
            [baseline]
        );

        expect(queryClient.getQueryData<Raise>(detailKey)?.raised).toBe("110");
        expect(queryClient.getQueryData<Raise>(detailKey)?.contributors?.[0]?.amount).toBe("30");
        expect(queryClient.getQueryData<Raise>(detailKey)?.contributors?.[0]?.percentage).toBe("27.27");
        expect(mergePendingRaise(queryClient, before).raised).toBe("110");
    });
});
