import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, CircleDollarSign, Clock3, Loader2, RefreshCw } from "lucide-react";
import { DissolutionActions } from "@govex/futarchy-sdk";
import { Transaction } from "@mysten/sui/transactions";
import toast from "react-hot-toast";

import type { DAO } from "@/types";
import { Button } from "@/components/inputs/Button";
import { SuiWalletButton } from "@/components/sui/WalletButton";
import { useCurrentAccount, useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { isNotifiedTransactionError, useSuiTransaction } from "@/hooks/useSuiTransaction";
import { network } from "@/lib/config";
import { getSDKForDAO } from "@/lib/sdk";
import { selectCoinObjectsForAmount } from "@/lib/sui/selectCoins";
import { formatUnits } from "@/lib/units";
import { calculateGovexRedemptionAmount, GOVEX_REDEMPTION, isGovexRedemptionDAO } from "@/lib/govexRedemption";

interface RedemptionState {
    poolBalance: bigint;
    currentSupply: bigint;
    walletBalance: bigint;
    estimatedWithdrawal: bigint;
    unlockAtMs: number;
}

type MoveFields = Record<string, unknown>;

function asRecord(value: unknown): MoveFields | null {
    return typeof value === "object" && value !== null ? (value as MoveFields) : null;
}

function readBigInt(value: unknown, label: string): bigint {
    if (typeof value === "string" || typeof value === "number" || typeof value === "bigint") {
        return BigInt(value);
    }
    const record = asRecord(value);
    if (record?.fields !== undefined) return readBigInt(record.fields, label);
    if (record?.value !== undefined) return readBigInt(record.value, label);
    throw new Error(`Missing ${label} in the redemption pool`);
}

function readId(value: unknown): string {
    if (typeof value === "string") return value;
    const record = asRecord(value);
    if (record?.id !== undefined) return readId(record.id);
    if (record?.fields !== undefined) return readId(record.fields);
    return "";
}

function getPoolFields(content: unknown): MoveFields {
    const contentRecord = asRecord(content);
    const fields = asRecord(contentRecord?.fields);
    if (!fields) throw new Error("Redemption pool data is unavailable");
    return fields;
}

function formatCountdown(unlockAtMs: number, now: number): string {
    const remainingMs = Math.max(0, unlockAtMs - now);
    if (remainingMs === 0) return "Available now";
    const totalMinutes = Math.ceil(remainingMs / 60_000);
    const days = Math.floor(totalMinutes / (24 * 60));
    const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
    const minutes = totalMinutes % 60;
    if (days > 0) return `${days}d ${hours}h`;
    if (hours > 0) return `${hours}h ${minutes}m`;
    return `${minutes}m`;
}

function Stat({ label, value, detail }: { label: string; value: string; detail?: string }) {
    return (
        <div className="rounded-xl border border-white/10 bg-black/15 px-4 py-3">
            <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-white/55">{label}</p>
            <p className="mt-1 text-lg font-semibold tabular-nums text-white">{value}</p>
            {detail && <p className="mt-0.5 text-xs text-white/50">{detail}</p>}
        </div>
    );
}

function useGovexRedemption(dao: DAO, isGovex: boolean) {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading: transactionLoading, isReconciling } = useSuiTransaction();
    const [now, setNow] = useState(() => Date.now());
    const submittingRef = useRef(false);

    useEffect(() => {
        if (!isGovex) return;
        const timer = window.setInterval(() => setNow(Date.now()), 30_000);
        return () => window.clearInterval(timer);
    }, [isGovex]);

    const redemptionQuery = useQuery<RedemptionState>({
        queryKey: ["govex-redemption", account?.address ?? "disconnected"],
        queryFn: async () => {
            const [poolResponse, supplyResponse, walletResponse] = await Promise.all([
                suiClient.getObject({
                    id: GOVEX_REDEMPTION.poolId,
                    options: { showContent: true, showType: true },
                }),
                suiClient.getTotalSupply({ coinType: GOVEX_REDEMPTION.assetType }),
                account
                    ? suiClient.getBalance({ owner: account.address, coinType: GOVEX_REDEMPTION.assetType })
                    : Promise.resolve({ totalBalance: "0" }),
            ]);

            if (poolResponse.error || !poolResponse.data) {
                throw new Error("Unable to load the Govex redemption pool");
            }
            const fields = getPoolFields(poolResponse.data.content);
            const poolDao = readId(fields.dao_address).toLowerCase();
            const capabilityId = readId(fields.capability_id).toLowerCase();
            if (poolDao !== GOVEX_REDEMPTION.daoId || capabilityId !== GOVEX_REDEMPTION.capabilityId) {
                throw new Error("Redemption pool identity check failed");
            }

            const poolBalance = readBigInt(fields.balance, "pool balance");
            const currentSupply = BigInt(supplyResponse.value);
            const walletBalance = BigInt(walletResponse.totalBalance);
            const unlockAtMs = Number(readBigInt(fields.unlock_at_ms, "unlock timestamp"));

            return {
                poolBalance,
                currentSupply,
                walletBalance,
                estimatedWithdrawal: calculateGovexRedemptionAmount(poolBalance, walletBalance, currentSupply),
                unlockAtMs,
            };
        },
        enabled: isGovex,
        staleTime: 5_000,
        refetchInterval: 15_000,
        retry: 1,
    });

    const state = redemptionQuery.data;
    const isUnlocked = !!state && now >= state.unlockAtMs;
    const walletBalance = state?.walletBalance ?? 0n;
    const estimatedWithdrawal = state?.estimatedWithdrawal ?? 0n;

    const walletBalanceDisplay = formatUnits(walletBalance, GOVEX_REDEMPTION.assetDecimals, {
        maxFractionDigits: 4,
        trimTrailingZeros: true,
    });
    const estimatedWithdrawalDisplay = formatUnits(estimatedWithdrawal, GOVEX_REDEMPTION.redeemCoinDecimals, {
        maxFractionDigits: GOVEX_REDEMPTION.redeemCoinDecimals,
        trimTrailingZeros: true,
    });
    const poolBalanceDisplay = formatUnits(state?.poolBalance ?? 0n, GOVEX_REDEMPTION.redeemCoinDecimals, {
        maxFractionDigits: 2,
        trimTrailingZeros: true,
    });
    const navDisplay = useMemo(() => {
        if (!state || state.currentSupply === 0n) return "—";
        const navScaled = (state.poolBalance * 10n ** BigInt(GOVEX_REDEMPTION.assetDecimals)) / state.currentSupply;
        return `$${formatUnits(navScaled, GOVEX_REDEMPTION.redeemCoinDecimals, {
            maxFractionDigits: GOVEX_REDEMPTION.redeemCoinDecimals,
            trimTrailingZeros: false,
        })}`;
    }, [state]);

    const refresh = useCallback(async () => {
        await redemptionQuery.refetch();
        setNow(Date.now());
    }, [redemptionQuery]);

    const redeem = useCallback(async () => {
        if (
            submittingRef.current ||
            !account ||
            !state ||
            !isUnlocked ||
            state.walletBalance <= 0n ||
            state.estimatedWithdrawal <= 0n
        ) {
            return;
        }
        submittingRef.current = true;
        try {
            const freshBalanceResponse = await suiClient.getBalance({
                owner: account.address,
                coinType: GOVEX_REDEMPTION.assetType,
            });
            const freshBalance = BigInt(freshBalanceResponse.totalBalance);
            if (freshBalance <= 0n) throw new Error("This wallet has no GOVEX to redeem");
            if (calculateGovexRedemptionAmount(state.poolBalance, freshBalance, state.currentSupply) <= 0n) {
                throw new Error("This GOVEX balance is too small to redeem");
            }

            const selected = await selectCoinObjectsForAmount({
                client: suiClient,
                owner: account.address,
                coinType: GOVEX_REDEMPTION.assetType,
                amount: freshBalance,
            });
            if (!selected.isSufficient || selected.coins.length === 0) {
                throw new Error("Unable to select the wallet's GOVEX coins");
            }
            if (selected.exceedsMaxCoins) {
                throw new Error("GOVEX is split across too many coin objects. Merge the coins and retry.");
            }

            const tx = new Transaction();
            const primary = tx.object(selected.coins[0].coinObjectId);
            const remainingCoins = selected.coins.slice(1).map((coin) => tx.object(coin.coinObjectId));
            if (remainingCoins.length > 0) tx.mergeCoins(primary, remainingCoins);
            const sdk = getSDKForDAO(dao);
            const redeemedCoins = DissolutionActions.claim(tx, {
                futarchyActionsPackageId: GOVEX_REDEMPTION.futarchyActionsPackageId,
                assetType: GOVEX_REDEMPTION.assetType,
                redeemCoinType: GOVEX_REDEMPTION.redeemCoinType,
                poolId: GOVEX_REDEMPTION.poolId,
                accountId: GOVEX_REDEMPTION.daoId,
                packageRegistryId: sdk.sharedObjects.packageRegistry.id,
                // The Move call accepts any Coin<GOVEX>; the SDK's current type is
                // narrower and only describes a coin returned by another Move call.
                assetCoins: primary as unknown as ReturnType<Transaction["moveCall"]>,
            });
            tx.transferObjects([redeemedCoins], tx.pure.address(account.address));

            await executeTransaction(
                tx,
                {
                    onSuccess: () => {
                        void queryClient.invalidateQueries({ queryKey: ["govex-redemption"] });
                        void queryClient.invalidateQueries({ queryKey: ["coin-balance", account.address] });
                    },
                    onReconciled: async (_result, reconciliation) => {
                        if (reconciliation.status === "deferred") return;
                        await queryClient.refetchQueries({ queryKey: ["govex-redemption"], type: "active" });
                    },
                },
                {
                    loadingMessage: "Redeeming GOVEX...",
                    successMessage: "GOVEX redeemed for USDC",
                }
            );
        } catch (error) {
            console.error("GOVEX redemption failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Redemption failed");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [account, dao, executeTransaction, isUnlocked, queryClient, state, suiClient]);

    return {
        account,
        busy: transactionLoading || isReconciling,
        estimatedWithdrawal,
        estimatedWithdrawalDisplay,
        error: redemptionQuery.error,
        isUnlocked,
        loading: redemptionQuery.isLoading,
        navDisplay,
        now,
        poolBalanceDisplay,
        redeem,
        refresh,
        state,
        walletBalance,
        walletBalanceDisplay,
    };
}

export function GovexRedemptionBanner({ dao }: { dao: DAO }) {
    const isGovex = isGovexRedemptionDAO(dao, network);
    const {
        account,
        busy,
        estimatedWithdrawal,
        estimatedWithdrawalDisplay,
        error,
        isUnlocked,
        loading,
        navDisplay,
        now,
        poolBalanceDisplay,
        redeem,
        refresh,
        state,
        walletBalance,
        walletBalanceDisplay,
    } = useGovexRedemption(dao, isGovex);

    if (!isGovex) return null;

    const buttonDisabled = !isUnlocked || walletBalance <= 0n || estimatedWithdrawal <= 0n || loading || !!error;
    const buttonLabel = !isUnlocked
        ? "Redemption not open yet"
        : walletBalance <= 0n
          ? "No GOVEX to redeem"
          : estimatedWithdrawal <= 0n
            ? "Amount too small to redeem"
            : `Redeem ${walletBalanceDisplay} GOVEX`;

    return (
        <section className="relative overflow-hidden rounded-2xl border border-emerald-300/25 bg-linear-to-br from-emerald-500/20 via-cyan-500/10 to-card p-5 shadow-[0_20px_60px_rgba(16,185,129,0.10)] md:p-6">
            <div className="pointer-events-none absolute -right-16 -top-24 size-64 rounded-full bg-emerald-300/10 blur-3xl" />
            <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(420px,0.8fr)] xl:items-center">
                <div>
                    <div className="mb-3 flex flex-wrap items-center gap-2">
                        <span className="rounded-full border border-emerald-300/25 bg-emerald-300/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.16em] text-emerald-200">
                            DAO wind-down
                        </span>
                        {state && (
                            <span className="flex items-center gap-1.5 text-xs font-medium text-white/65">
                                <Clock3 className="size-3.5" />
                                {isUnlocked
                                    ? "Redemption is open"
                                    : `Opens in ${formatCountdown(state.unlockAtMs, now)}`}
                            </span>
                        )}
                    </div>
                    <h2 className="text-2xl font-bold tracking-tight text-white md:text-3xl">Redeem GOVEX for USDC</h2>
                    <p className="mt-2 max-w-2xl text-sm leading-relaxed text-white/65 md:text-base">
                        Burn the GOVEX in your connected wallet and withdraw its proportional share of the DAO
                        redemption pool. The estimate refreshes from live on-chain balances.
                    </p>

                    {state && !isUnlocked && (
                        <p className="mt-3 text-xs text-white/50">
                            Opens{" "}
                            {new Date(state.unlockAtMs).toLocaleString(undefined, {
                                dateStyle: "medium",
                                timeStyle: "short",
                            })}
                        </p>
                    )}
                </div>

                <div className="space-y-3">
                    {error ? (
                        <div className="rounded-xl border border-red-400/25 bg-red-500/10 p-4 text-sm text-red-100">
                            <p>Could not load the live redemption estimate.</p>
                            <button
                                type="button"
                                onClick={() => void refresh()}
                                className="mt-2 inline-flex items-center gap-1.5 font-medium text-white hover:underline"
                            >
                                <RefreshCw className="size-3.5" /> Retry
                            </button>
                        </div>
                    ) : loading ? (
                        <div className="flex min-h-24 items-center justify-center rounded-xl border border-white/10 bg-black/15">
                            <Loader2 className="size-5 animate-spin text-emerald-200" />
                        </div>
                    ) : (
                        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                            <Stat label="Your GOVEX" value={account ? walletBalanceDisplay : "—"} />
                            <Stat
                                label="Estimated withdrawal"
                                value={account ? `${estimatedWithdrawalDisplay} USDC` : "Connect wallet"}
                                detail="Live pro-rata estimate"
                            />
                            <Stat label="Current NAV" value={navDisplay} detail={`${poolBalanceDisplay} USDC pool`} />
                        </div>
                    )}

                    {!account ? (
                        <SuiWalletButton buttonClassName="w-full !border-emerald-300/25 !bg-emerald-300/10 !text-white hover:!bg-emerald-300/20" />
                    ) : (
                        <Button
                            size="lg"
                            className="w-full !bg-emerald-300 !text-emerald-950 hover:!bg-emerald-200"
                            onClick={() => void redeem()}
                            disabled={buttonDisabled}
                            isLoading={busy}
                            leftIcon={<CircleDollarSign className="size-5" />}
                            rightIcon={<ArrowRight className="size-5" />}
                        >
                            {buttonLabel}
                        </Button>
                    )}
                    <p className="text-center text-[11px] text-white/45">
                        Estimate may change if the pool balance or GOVEX supply changes before execution.
                    </p>
                </div>
            </div>
        </section>
    );
}
