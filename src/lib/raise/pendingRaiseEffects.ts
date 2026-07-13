import type { QueryClient } from "@tanstack/react-query";
import type { SuiEvent } from "@govex/futarchy-sdk/types";
import type { Raise } from "@/types";
import type { UserContribution, UserReservation } from "@/lib/api/raises";

const PENDING_RAISE_KEY = ["confirmed-raise-effects"] as const;

interface PendingContribution {
    kind: "contribution";
    digest: string;
    raiseId: string;
    address: string;
    amount: string;
    minimumRaised: string;
    minimumUserContribution: string;
}

interface PendingReservationAcceptance {
    kind: "reservation-accepted";
    digest: string;
    raiseId: string;
    address: string;
}

type PendingRaiseEffect = PendingContribution | PendingReservationAcceptance;

export interface RaiseProjectionBaseline {
    raiseId: string;
    address: string;
    raised: string;
    userContribution: string;
}

function normalize(value: string): string {
    return value.trim().toLowerCase();
}

function parsedEvent(event: SuiEvent): Record<string, unknown> | null {
    return event.parsedJson && typeof event.parsedJson === "object"
        ? (event.parsedJson as Record<string, unknown>)
        : null;
}

function liveEffects(queryClient: QueryClient): PendingRaiseEffect[] {
    return queryClient.getQueryData<PendingRaiseEffect[]>(PENDING_RAISE_KEY) ?? [];
}

function removePendingEffects(queryClient: QueryClient, predicate: (effect: PendingRaiseEffect) => boolean): void {
    queueMicrotask(() => {
        queryClient.setQueryData<PendingRaiseEffect[]>(PENDING_RAISE_KEY, (previous = []) =>
            previous.filter((effect) => !predicate(effect))
        );
    });
}

function currentRaised(queryClient: QueryClient, raiseId: string): bigint {
    const detail = queryClient.getQueryData<Raise>(["raises", "detail", raiseId]);
    if (detail) return BigInt(detail.raised || "0");
    for (const [, raises] of queryClient.getQueriesData<Raise[]>({ queryKey: ["raises", "list"] })) {
        const raise = raises?.find((candidate) => candidate.id === raiseId);
        if (raise) return BigInt(raise.raised || "0");
    }
    return 0n;
}

function currentContribution(queryClient: QueryClient, raiseId: string, address: string): bigint {
    for (const [key, contribution] of queryClient.getQueriesData<UserContribution>({
        queryKey: ["raises", "contribution", raiseId],
    })) {
        if (normalize(String(key[3] ?? "")) === normalize(address)) {
            return BigInt(contribution?.amount ?? "0");
        }
    }
    return 0n;
}

/** Capture backend values before submission, when they cannot include the new transaction. */
export function captureRaiseProjectionBaseline(
    queryClient: QueryClient,
    raiseId: string,
    address: string
): RaiseProjectionBaseline {
    return {
        raiseId,
        address,
        raised: currentRaised(queryClient, raiseId).toString(),
        userContribution: currentContribution(queryClient, raiseId, address).toString(),
    };
}

function projectedPercentage(amount: bigint, total: bigint): string {
    if (total <= 0n) return "0";
    const hundredths = (amount * 10_000n) / total;
    return `${hundredths / 100n}.${(hundredths % 100n).toString().padStart(2, "0")}`;
}

function projectedContributorRank(queryClient: QueryClient, effect: PendingContribution): number | undefined {
    const contributors = queryClient.getQueryData<Raise>(["raises", "detail", effect.raiseId])?.contributors;
    if (!contributors) return undefined;
    const ranked = [...contributors].sort((left, right) => {
        const leftAmount = BigInt(left.amount);
        const rightAmount = BigInt(right.amount);
        return leftAmount === rightAmount ? 0 : leftAmount > rightAmount ? -1 : 1;
    });
    const index = ranked.findIndex((contributor) => normalize(contributor.address) === normalize(effect.address));
    return index >= 0 ? index + 1 : undefined;
}

function patchRaiseContribution(queryClient: QueryClient, effect: PendingContribution): void {
    const add = (raise: Raise): Raise => {
        if (raise.id !== effect.raiseId) return raise;
        let contributors = raise.contributors;
        if (contributors) {
            contributors = [...contributors];
            const index = contributors.findIndex((item) => normalize(item.address) === normalize(effect.address));
            if (index >= 0) {
                const current = BigInt(contributors[index].amount);
                const minimum = BigInt(effect.minimumUserContribution);
                contributors[index] = {
                    ...contributors[index],
                    amount: (current > minimum ? current : minimum).toString(),
                };
            } else {
                contributors.push({
                    address: effect.address,
                    amount: effect.minimumUserContribution,
                    percentage: "0",
                });
            }
            const total = BigInt(effect.minimumRaised);
            contributors = contributors.map((contributor) => ({
                ...contributor,
                percentage: projectedPercentage(BigInt(contributor.amount), total),
            }));
        }
        return { ...raise, raised: effect.minimumRaised, contributors };
    };
    queryClient.setQueriesData<Raise[]>({ queryKey: ["raises", "list"] }, (previous) => previous?.map(add));
    queryClient.setQueryData<Raise>(["raises", "detail", effect.raiseId], (previous) =>
        previous ? add(previous) : previous
    );
    const projectedRank = projectedContributorRank(queryClient, effect);
    const percentage = projectedPercentage(BigInt(effect.minimumUserContribution), BigInt(effect.minimumRaised));
    let patchedContribution = false;
    for (const [key] of queryClient.getQueriesData<UserContribution>({
        queryKey: ["raises", "contribution", effect.raiseId],
    })) {
        if (normalize(String(key[3] ?? "")) !== normalize(effect.address)) continue;
        patchedContribution = true;
        queryClient.setQueryData<UserContribution>(key, (previous) => ({
            hasInvested: true,
            amount: effect.minimumUserContribution,
            percentage,
            rank: projectedRank ?? previous?.rank ?? 0,
        }));
    }
    if (!patchedContribution) {
        queryClient.setQueryData<UserContribution>(["raises", "contribution", effect.raiseId, effect.address], {
            hasInvested: true,
            amount: effect.minimumUserContribution,
            percentage,
            rank: projectedRank ?? 0,
        });
    }
}

function patchReservationAcceptance(queryClient: QueryClient, effect: PendingReservationAcceptance): void {
    const patch = (raise: Raise): Raise => ({
        ...raise,
        reservations: raise.reservations?.map((reservation) =>
            normalize(reservation.wallet) === normalize(effect.address)
                ? { ...reservation, accepted: true }
                : reservation
        ),
    });
    queryClient.setQueriesData<Raise[]>({ queryKey: ["raises", "list"] }, (previous) =>
        previous?.map((raise) => (raise.id === effect.raiseId ? patch(raise) : raise))
    );
    queryClient.setQueryData<Raise>(["raises", "detail", effect.raiseId], (previous) =>
        previous ? patch(previous) : previous
    );
    let patchedReservation = false;
    for (const [key] of queryClient.getQueriesData<UserReservation>({
        queryKey: ["raises", "reservation", effect.raiseId],
    })) {
        if (normalize(String(key[3] ?? "")) !== normalize(effect.address)) continue;
        patchedReservation = true;
        queryClient.setQueryData<UserReservation>(key, (previous) => ({
            hasReservation: true,
            amount: previous?.amount ?? "0",
            accepted: true,
        }));
    }
    if (!patchedReservation) {
        queryClient.setQueryData<UserReservation>(["raises", "reservation", effect.raiseId, effect.address], {
            hasReservation: true,
            amount: "0",
            accepted: true,
        });
    }
}

export function registerPendingRaiseEffects(
    queryClient: QueryClient,
    digest: string,
    events: SuiEvent[],
    baselines: RaiseProjectionBaseline[] = []
): void {
    const additions: PendingRaiseEffect[] = [];
    const running = new Map(
        baselines.map((baseline) => [
            `${normalize(baseline.raiseId)}:${normalize(baseline.address)}`,
            { raised: BigInt(baseline.raised), contribution: BigInt(baseline.userContribution) },
        ])
    );
    for (const event of events) {
        const data = parsedEvent(event);
        if (!data) continue;
        if (event.type?.endsWith("::launchpad::ContributionAdded")) {
            const raiseId = String(data.raise_id ?? "");
            const address = String(data.contributor ?? "");
            const amount = BigInt(String(data.amount ?? "0"));
            if (!raiseId || !address || amount <= 0n) continue;
            const key = `${normalize(raiseId)}:${normalize(address)}`;
            const baseline = running.get(key);
            // A post-submit cache may already include this event. Without the
            // captured baseline, projecting the delta could double-count it.
            if (!baseline) continue;
            baseline.raised += amount;
            baseline.contribution += amount;
            const effect: PendingContribution = {
                kind: "contribution",
                digest,
                raiseId,
                address,
                amount: amount.toString(),
                minimumRaised: baseline.raised.toString(),
                minimumUserContribution: baseline.contribution.toString(),
            };
            additions.push(effect);
            patchRaiseContribution(queryClient, effect);
        } else if (event.type?.endsWith("::launchpad::ReservationAccepted")) {
            const raiseId = String(data.raise_id ?? "");
            const address = String(data.wallet ?? "");
            if (!raiseId || !address) continue;
            const effect: PendingReservationAcceptance = {
                kind: "reservation-accepted",
                digest,
                raiseId,
                address,
            };
            additions.push(effect);
            patchReservationAcceptance(queryClient, effect);
        }
    }
    if (additions.length === 0) return;
    queryClient.setQueryData<PendingRaiseEffect[]>(PENDING_RAISE_KEY, (previous = []) => [
        ...additions,
        ...previous.filter(
            (effect) => !additions.some((added) => added.digest === effect.digest && added.kind === effect.kind)
        ),
    ]);
}

export function mergePendingRaise(queryClient: QueryClient, raise: Raise): Raise {
    let next = raise;
    for (const effect of liveEffects(queryClient)) {
        if (effect.raiseId !== raise.id) continue;
        if (effect.kind === "contribution" && BigInt(next.raised || "0") < BigInt(effect.minimumRaised)) {
            next = { ...next, raised: effect.minimumRaised };
        } else if (effect.kind === "reservation-accepted") {
            next = {
                ...next,
                reservations: next.reservations?.map((reservation) =>
                    normalize(reservation.wallet) === normalize(effect.address)
                        ? { ...reservation, accepted: true }
                        : reservation
                ),
            };
        }
    }
    return next;
}

export function mergePendingRaises(queryClient: QueryClient, raises: Raise[]): Raise[] {
    return raises.map((raise) => mergePendingRaise(queryClient, raise));
}

export function mergePendingContribution(
    queryClient: QueryClient,
    raiseId: string,
    address: string,
    contribution: UserContribution
): UserContribution {
    const relevant = liveEffects(queryClient).filter(
        (effect): effect is PendingContribution =>
            effect.kind === "contribution" &&
            effect.raiseId === raiseId &&
            normalize(effect.address) === normalize(address)
    );
    const minimum = relevant.reduce((max, effect) => {
        const amount = BigInt(effect.minimumUserContribution);
        return amount > max ? amount : max;
    }, 0n);
    if (BigInt(contribution.amount || "0") >= minimum) {
        if (relevant.length > 0) {
            removePendingEffects(
                queryClient,
                (effect) =>
                    effect.kind === "contribution" &&
                    effect.raiseId === raiseId &&
                    normalize(effect.address) === normalize(address) &&
                    BigInt(effect.minimumUserContribution) <= BigInt(contribution.amount || "0")
            );
        }
        return contribution;
    }
    return { ...contribution, hasInvested: true, amount: minimum.toString() };
}

export function mergePendingReservation(
    queryClient: QueryClient,
    raiseId: string,
    address: string,
    reservation: UserReservation
): UserReservation {
    const accepted = liveEffects(queryClient).some(
        (effect) =>
            effect.kind === "reservation-accepted" &&
            effect.raiseId === raiseId &&
            normalize(effect.address) === normalize(address)
    );
    if (accepted && reservation.accepted) {
        removePendingEffects(
            queryClient,
            (effect) =>
                effect.kind === "reservation-accepted" &&
                effect.raiseId === raiseId &&
                normalize(effect.address) === normalize(address)
        );
    }
    return accepted ? { ...reservation, hasReservation: true, accepted: true } : reservation;
}
