import { useState, useCallback, useRef } from "react";
import { useCurrentAccount, useSuiClient } from "@/lib/sui/dapp-kit-compat";
import { useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Card, CardContent } from "@/components/Card";
import { Button } from "@/components/inputs/Button";
import { formatNumber } from "@/lib/formatNumber";
import { parseAmountToBigInt } from "@/lib/parseAmount";
import { useSuiTransaction, isNotifiedTransactionError } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import { selectCoinObjectsForAmount } from "@/lib/sui/selectCoins";
import type { RaiseView } from "@/types/RaiseView";
import type { RaiseUiStatus } from "@/lib/raiseStatus";
import { captureRaiseProjectionBaseline } from "@/lib/raise/pendingRaiseEffects";

const DEFAULT_PROTOCOL_FEE = 100_000_000n; // 0.1 SUI in MIST

interface Props {
    raise: RaiseView;
    reservationAmount: number;
    accepted: boolean;
    status: RaiseUiStatus;
}

export function ReservationCard({ raise, reservationAmount, accepted, status }: Props) {
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading } = useSuiTransaction();
    const submittingRef = useRef(false);
    const [justAccepted, setJustAccepted] = useState(false);

    const rawRaise = raise._raw;

    const handleAccept = useCallback(async () => {
        if (submittingRef.current || !account) return;
        submittingRef.current = true;

        try {
            const sdk = getSDK();
            const decimals = rawRaise.stable_decimals || 9;
            const amountRaw = parseAmountToBigInt(String(reservationAmount), decimals);

            const selectedCoins = await selectCoinObjectsForAmount({
                client: suiClient,
                owner: account.address,
                coinType: rawRaise.stable_type,
                amount: amountRaw,
            });

            if (selectedCoins.coins.length === 0) {
                toast.error(`No ${rawRaise.stable_symbol || "USDC"} coins found in wallet`);
                return;
            }
            if (!selectedCoins.isSufficient) {
                toast.error("Insufficient balance");
                return;
            }
            if (selectedCoins.exceedsMaxCoins) {
                toast.error("Payment is split across too many coin objects. Merge coins and retry.");
                return;
            }

            const { transaction } = sdk.launchpad.acceptReservation({
                raiseId: rawRaise.id,
                assetType: rawRaise.asset_type,
                stableType: rawRaise.stable_type,
                stableAmount: amountRaw,
                protocolFee: DEFAULT_PROTOCOL_FEE,
                feeManagerId: sdk.sharedObjects.feeManager.id,
                stableCoins: selectedCoins.coins.map((c) => c.coinObjectId),
            });

            const raiseBaseline = captureRaiseProjectionBaseline(queryClient, rawRaise.id, account.address);
            await executeTransaction(
                transaction,
                {
                    projections: { raiseBaselines: [raiseBaseline] },
                    onSuccess: () => {
                        setJustAccepted(true);
                    },
                    onReconciled: () => {
                        queryClient.invalidateQueries({ queryKey: ["raises"] });
                        queryClient.invalidateQueries({ queryKey: ["balances"] });
                    },
                },
                {
                    loadingMessage: "Accepting reservation...",
                    successMessage: "Reservation accepted!",
                }
            );
        } catch (error) {
            console.error("Accept reservation failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Accept reservation failed");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [account, rawRaise, reservationAmount, suiClient, executeTransaction, queryClient]);

    const isAccepted = accepted || justAccepted;
    const canAccept = status === "active" && !isAccepted && !!account;

    if (isAccepted) {
        return (
            <Card className="border-success/30 bg-success/5">
                <CardContent>
                    <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-success/20 flex items-center justify-center shrink-0">
                            <svg className="w-4 h-4 text-success" fill="currentColor" viewBox="0 0 20 20">
                                <path
                                    fillRule="evenodd"
                                    d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                                    clipRule="evenodd"
                                />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-success">Reservation Accepted</p>
                            <p className="text-xs text-white/50">
                                ${formatNumber(reservationAmount)} reserved allocation claimed
                            </p>
                        </div>
                    </div>
                </CardContent>
            </Card>
        );
    }

    return (
        <Card className="border-amber-500/30 bg-amber-500/5">
            <CardContent>
                <div className="space-y-3">
                    <div className="flex items-start gap-3">
                        <div className="w-8 h-8 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0 mt-0.5">
                            <svg
                                className="w-4 h-4 text-amber-400"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                            >
                                <path
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeWidth={2}
                                    d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                                />
                            </svg>
                        </div>
                        <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium text-amber-300">Reserved Allocation</p>
                            <p className="text-2xl font-bold mt-1">${formatNumber(reservationAmount)}</p>
                            <p className="text-xs text-white/40 mt-1">
                                A guaranteed allocation has been reserved for your wallet
                            </p>
                        </div>
                    </div>

                    {canAccept && (
                        <Button
                            className="w-full font-medium bg-amber-500/10 border-amber-500/30 text-amber-300 hover:bg-amber-500/20"
                            onClick={handleAccept}
                            isLoading={isLoading}
                            disabled={submittingRef.current}
                        >
                            Accept Reservation — ${formatNumber(reservationAmount)}
                        </Button>
                    )}

                    {status === "upcoming" && (
                        <p className="text-xs text-white/40 text-center">You can accept once the raise is live</p>
                    )}
                </div>
            </CardContent>
        </Card>
    );
}
