import type { Raise } from "@/types";

export type RaiseUiStatus = "upcoming" | "active" | "finalizing" | "funded" | "failed";

function parseMs(raw: string | null | undefined): number | null {
    if (!raw) return null;
    const value = Number(raw);
    return Number.isFinite(value) ? value : null;
}

export function getRaiseUiStatus(
    raise: Pick<Raise, "state" | "start_time" | "deadline">,
    now = Date.now()
): RaiseUiStatus {
    if (raise.state === "successful") return "funded";
    if (raise.state === "failed") return "failed";
    if (raise.state === "ended_early" || raise.state === "completion_pending") return "finalizing";

    const startMs = parseMs(raise.start_time);
    if (startMs !== null && now < startMs) return "upcoming";

    const deadlineMs = parseMs(raise.deadline);
    if (deadlineMs !== null && now >= deadlineMs) {
        // Funding window ended; awaiting settlement/finalization.
        return "finalizing";
    }

    return "active";
}
