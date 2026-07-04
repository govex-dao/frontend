import { useState, useCallback, useRef } from "react";
import { useCurrentAccount, useSuiClient } from "@mysten/dapp-kit";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import toast from "react-hot-toast";
import { Button } from "@/components/inputs/Button";
import { TokenInput } from "@/components/inputs/TokenInput";
import { Modal } from "@/components/overlays/Modal";
import { formatNumber } from "@/lib/formatNumber";
import { resolveCoinIcon } from "@/lib/coin/icons";
import { parseAmountToBigInt } from "@/lib/parseAmount";
import { formatUnitsForInput } from "@/lib/units";
import { useCoins } from "@/hooks/api";
import { useSuiTransaction, isNotifiedTransactionError } from "@/hooks/useSuiTransaction";
import { getSDK } from "@/lib/sdk";
import { selectCoinObjectsForAmount } from "@/lib/sui/selectCoins";
import type { RaiseUiStatus } from "@/lib/raiseStatus";
import type { RaiseView } from "@/types/RaiseView";

interface UserInvestment {
    hasInvested: boolean;
    amount: number;
    amountDisplay?: string;
    percentage: number;
    rank: number;
}

interface Props {
    isOpen: boolean;
    onClose: () => void;
    raise: RaiseView;
    userInvestment: UserInvestment;
    progress: number;
    status: RaiseUiStatus;
    /** Unaccepted reservation amount (display units, 0 if none) */
    pendingReservation?: number;
}

const DEFAULT_PROTOCOL_FEE = 100_000_000n; // 0.1 SUI in MIST

export function InvestModal(props: Props) {
    const { isOpen, onClose, raise, userInvestment, progress, status, pendingReservation = 0 } = props;
    const { data: coins } = useCoins();
    const account = useCurrentAccount();
    const suiClient = useSuiClient();
    const queryClient = useQueryClient();
    const { executeTransaction, isLoading } = useSuiTransaction();
    const [amountStr, setAmountStr] = useState(""); // Raw string for precision
    const submittingRef = useRef(false); // Double-submit guard

    const amount = amountStr ? parseFloat(amountStr) : 0;
    const rawRaise = raise._raw;
    const decimals = rawRaise.stable_decimals || 9;
    const amountRaw = amountStr ? parseAmountToBigInt(amountStr, decimals) : 0n;

    const maxRaise = raise.maxRaise;
    // Public remaining = max - pending_reserved - already_raised
    const remainingCapacity = maxRaise !== null ? Math.max(maxRaise - raise.pendingReserved - raise.raised, 0) : null;

    // Query user's stable coin balance — uses same key namespace as balanceKeys
    const { data: stableBalance } = useQuery({
        queryKey: ["balances", "wallet", account?.address, rawRaise.stable_type],
        queryFn: async () => {
            const balance = await suiClient.getBalance({
                owner: account!.address,
                coinType: rawRaise.stable_type,
            });
            const raw = BigInt(balance.totalBalance);
            return {
                raw,
                display: formatUnitsForInput(raw, decimals),
            };
        },
        enabled: !!account?.address && isOpen,
        refetchInterval: 15000,
    });

    const stableSymbol = rawRaise.stable_symbol || "USDC";
    const stableCoin = coins?.find((c) => c.symbol === stableSymbol);

    const tokenForInput = stableCoin
        ? {
              name: stableCoin.name,
              symbol: stableCoin.symbol,
              coinType: rawRaise.stable_type,
              image: resolveCoinIcon({
                  coinType: rawRaise.stable_type,
                  symbol: stableCoin.symbol,
                  iconUrl: stableCoin.icon_url,
              }),
              balance: 0,
          }
        : {
              name: stableSymbol,
              symbol: stableSymbol,
              coinType: rawRaise.stable_type,
              image: resolveCoinIcon({ coinType: rawRaise.stable_type, symbol: stableSymbol }),
              balance: 0,
          };

    const handleAmountChange = useCallback((value: string) => {
        setAmountStr(value);
    }, []);

    // Calculate how the amount is split between reservation and public bid
    const reservationRaw = pendingReservation > 0 ? parseAmountToBigInt(String(pendingReservation), decimals) : 0n;
    const reservationPortion = Math.min(amount, pendingReservation);
    const publicPortion = Math.max(amount - pendingReservation, 0);

    const handleInvest = useCallback(async () => {
        if (submittingRef.current) return;
        if (!account || amount <= 0) return;

        submittingRef.current = true;
        try {
            const sdk = getSDK();
            const amountRaw = parseAmountToBigInt(amountStr, decimals);

            const selectedCoins = await selectCoinObjectsForAmount({
                client: suiClient,
                owner: account.address,
                coinType: rawRaise.stable_type,
                amount: amountRaw,
            });

            if (selectedCoins.coins.length === 0) {
                toast.error(`No ${stableSymbol} coins found in wallet`);
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

            // Auto-route: reservation first, then public bid — single PTB
            const { transaction } = sdk.launchpad.contributeWithReservation({
                raiseId: rawRaise.id,
                assetType: rawRaise.asset_type,
                stableType: rawRaise.stable_type,
                amount: amountRaw,
                reservationAmount: amountRaw > reservationRaw ? reservationRaw : amountRaw,
                protocolFee: DEFAULT_PROTOCOL_FEE,
                feeManagerId: sdk.sharedObjects.feeManager.id,
                stableCoins: selectedCoins.coins.map((c) => c.coinObjectId),
            });

            const hasReservation = reservationRaw > 0n && amountRaw >= reservationRaw;
            await executeTransaction(
                transaction,
                {
                    onSuccess: () => {
                        setAmountStr("");
                        queryClient.invalidateQueries({ queryKey: ["raises"] });
                        queryClient.invalidateQueries({ queryKey: ["balances"] });
                        onClose();
                    },
                },
                {
                    loadingMessage: hasReservation
                        ? "Accepting reservation + contributing..."
                        : "Contributing to raise...",
                    successMessage: hasReservation
                        ? "Reservation accepted & contribution successful!"
                        : "Contribution successful!",
                }
            );
        } catch (error) {
            console.error("Contribution failed:", error);
            if (!isNotifiedTransactionError(error)) {
                toast.error(error instanceof Error ? error.message : "Contribution failed");
            }
        } finally {
            submittingRef.current = false;
        }
    }, [
        account,
        amount,
        amountStr,
        decimals,
        rawRaise,
        reservationRaw,
        stableSymbol,
        suiClient,
        executeTransaction,
        queryClient,
        onClose,
    ]);

    const exceedsStableBalance = stableBalance !== undefined && amountRaw > stableBalance.raw;
    const isButtonDisabled =
        submittingRef.current ||
        !account ||
        amount <= 0 ||
        exceedsStableBalance ||
        (remainingCapacity !== null && amount > remainingCapacity) ||
        status !== "active";

    const buttonText = !account
        ? "Connect Wallet"
        : status !== "active"
          ? status === "upcoming"
              ? "Coming Soon"
              : status === "finalizing"
                ? "Finalizing"
                : status === "funded"
                  ? "Raise Funded"
                  : "Raise Ended"
          : amount <= 0
            ? "Enter Amount"
            : exceedsStableBalance
              ? "Insufficient Balance"
              : remainingCapacity !== null && amount > remainingCapacity
                ? "Exceeds Remaining Capacity"
                : userInvestment.hasInvested
                  ? "Add Investment"
                  : "Confirm Investment";

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="Invest" subTitle={`Invest in ${raise.name}`}>
            <div className="space-y-6 flex flex-col items-center justify-between gap-4 w-full h-full">
                {/* User's Current Investment */}
                {userInvestment.hasInvested && (
                    <div className="w-full p-4 bg-primary/10 rounded-lg border border-primary/30">
                        <div className="flex items-center justify-between mb-3">
                            <h4 className="text-sm font-semibold text-primary">Your Investment</h4>
                            <span className="text-xs text-white/60">Rank #{userInvestment.rank}</span>
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <p className="text-white/40 text-xs">Amount Invested</p>
                                <p className="text-lg font-bold">
                                    ${userInvestment.amountDisplay ?? formatNumber(userInvestment.amount ?? 0)}
                                </p>
                            </div>
                            <div>
                                <p className="text-white/40 text-xs">Share of Raise</p>
                                <p className="text-lg font-bold">{userInvestment.percentage}%</p>
                            </div>
                        </div>
                    </div>
                )}

                {/* Reservation routing breakdown */}
                {pendingReservation > 0 && amount > 0 && (
                    <div className="w-full p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 space-y-2">
                        <p className="text-xs font-medium text-amber-300">Auto-routing through your reservation</p>
                        <div className="flex justify-between text-xs">
                            <span className="text-white/50">Reserved allocation</span>
                            <span className="text-amber-300 font-medium">
                                ${formatNumber(reservationPortion)}{" "}
                                {reservationPortion >= pendingReservation ? "(full)" : "(partial)"}
                            </span>
                        </div>
                        {publicPortion > 0 && (
                            <div className="flex justify-between text-xs">
                                <span className="text-white/50">Public contribution</span>
                                <span className="text-white/70 font-medium">${formatNumber(publicPortion)}</span>
                            </div>
                        )}
                    </div>
                )}

                {/* Raise Stats */}
                <div className="w-full grid grid-cols-3 gap-4 text-sm p-4 bg-card-elevated rounded-lg border border-border-light">
                    <div>
                        <p className="text-white/40">Progress</p>
                        <p className="text-lg font-semibold">{progress.toFixed(0)}%</p>
                    </div>
                    <div>
                        <p className="text-white/40">Raised</p>
                        <p className="text-lg font-semibold">${formatNumber(raise.raised)}</p>
                    </div>
                    <div>
                        <p className="text-white/40">{raise.pendingReserved > 0 ? "Open" : "Remaining"}</p>
                        <p className="text-lg font-semibold">
                            {remainingCapacity !== null ? `$${formatNumber(remainingCapacity)}` : "No cap"}
                        </p>
                        {raise.pendingReserved > 0 && (
                            <p className="text-xs text-amber-400/70">${formatNumber(raise.pendingReserved)} reserved</p>
                        )}
                    </div>
                </div>

                {/* Investment Input */}
                <div className="w-full space-y-2">
                    <TokenInput
                        label={userInvestment.hasInvested ? "Add More" : "Amount to Invest"}
                        value={amountStr}
                        onChange={handleAmountChange}
                        placeholder="Enter amount"
                        tokens={[tokenForInput]}
                        balance={stableBalance?.display ?? "0"}
                        maxBalanceValue={stableBalance?.display ?? "0"}
                    />
                </div>

                {/* Invest Button */}
                <Button
                    className="w-full h-11 font-medium"
                    disabled={isButtonDisabled}
                    isLoading={isLoading}
                    onClick={handleInvest}
                >
                    {buttonText}
                </Button>
            </div>
        </Modal>
    );
}
