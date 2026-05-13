import { useState, useCallback, useRef, useEffect } from "react";
import { useSignAndExecuteTransaction, useSuiClient } from "@mysten/dapp-kit";
import { Transaction } from "@mysten/sui/transactions";
import toast from "react-hot-toast";
import { NETWORK } from "@/constants/network";

const NOTIFIED_TRANSACTION_ERROR = "__govexNotifiedTransactionError";

export interface TransactionCallbacks {
    onSuccess?: (result: TransactionResult) => void;
    onError?: (error: Error) => void;
    onSettled?: () => void;
}

export interface TransactionOptions {
    loadingMessage?: string;
    successMessage?: string | ((result: TransactionResult) => React.ReactNode);
    errorMessage?: string | ((error: Error) => string);
    showExplorerLink?: boolean;
    showSuccessToast?: boolean;
    toastDuration?: number;
}

export interface TransactionResult {
    digest: string;
    effects?: {
        status: {
            status: string;
            error?: string;
        };
    };
    objectChanges?: Array<{
        type: string;
        objectType?: string;
        objectId?: string;
        owner?: { AddressOwner?: string };
    }>;
}

const defaultOptions: TransactionOptions = {
    loadingMessage: "Preparing transaction...",
    successMessage: "Transaction successful!",
    showExplorerLink: true,
    showSuccessToast: true,
    toastDuration: 5000,
};

function markNotifiedTransactionError(error: Error): Error {
    Object.defineProperty(error, NOTIFIED_TRANSACTION_ERROR, {
        value: true,
        configurable: true,
    });
    return error;
}

export function isNotifiedTransactionError(error: unknown): error is Error {
    return error instanceof Error && NOTIFIED_TRANSACTION_ERROR in error;
}

export function useSuiTransaction() {
    const [isLoading, setIsLoading] = useState(false);
    const isMountedRef = useRef(true);
    const client = useSuiClient();

    useEffect(() => {
        return () => {
            isMountedRef.current = false;
        };
    }, []);

    const { mutate: signAndExecute } = useSignAndExecuteTransaction({
        execute: async ({ bytes, signature }) =>
            await client.executeTransactionBlock({
                transactionBlock: bytes,
                signature,
                options: {
                    showRawEffects: true,
                    showEffects: true,
                    showObjectChanges: true,
                },
            }),
    });

    const executeTransaction = useCallback(
        async (
            transaction: Transaction,
            callbacks?: TransactionCallbacks,
            options?: TransactionOptions
        ): Promise<TransactionResult> => {
            const opts = { ...defaultOptions, ...options };
            const loadingToast = toast.loading(opts.loadingMessage!);

            if (isMountedRef.current) {
                setIsLoading(true);
            }

            // Wrap mutation in a Promise to make it awaitable
            return new Promise<TransactionResult>((resolve, reject) => {
                let handled = false;
                let settledCallbackRan = false;

                const runSettledCallback = () => {
                    if (settledCallbackRan) return;
                    settledCallbackRan = true;
                    try {
                        callbacks?.onSettled?.();
                    } catch (error) {
                        console.error("Error in onSettled callback:", error);
                    }
                };

                const claimResult = () => {
                    if (handled) return false;
                    handled = true;
                    return true;
                };

                const finish = () => {
                    toast.dismiss(loadingToast);
                    if (isMountedRef.current) {
                        setIsLoading(false);
                    }
                    runSettledCallback();
                };

                signAndExecute(
                    { transaction },
                    {
                        onSuccess: (result) => {
                            if (!claimResult()) return;
                            try {
                                const txResult = result as TransactionResult;

                                if (txResult.effects?.status.status === "success") {
                                    const successContent =
                                        typeof opts.successMessage === "function"
                                            ? opts.successMessage(txResult)
                                            : opts.successMessage;

                                    if (opts.showSuccessToast) {
                                        if (opts.showExplorerLink) {
                                            toast.success(
                                                <div>
                                                    {successContent}
                                                    <a
                                                        href={`https://suiscan.xyz/${NETWORK}/tx/${txResult.digest}`}
                                                        target="_blank"
                                                        rel="noopener noreferrer"
                                                        className="underline ml-2"
                                                    >
                                                        View transaction
                                                    </a>
                                                </div>,
                                                { duration: opts.toastDuration }
                                            );
                                        } else {
                                            toast.success(successContent as string, {
                                                duration: opts.toastDuration,
                                            });
                                        }
                                    }

                                    callbacks?.onSuccess?.(txResult);
                                    resolve(txResult);
                                } else {
                                    // Transaction was submitted but failed during execution
                                    const errorMessage =
                                        txResult.effects?.status.error || "Transaction failed during execution";

                                    let displayError = errorMessage;

                                    // Parse Move abort errors
                                    if (errorMessage.includes("Move abort") || errorMessage.includes("MOVE_ABORT")) {
                                        const abortCodeMatch = errorMessage.match(/abort code (\d+)/);
                                        const locationMatch = errorMessage.match(/in ([^(]+)/);

                                        if (abortCodeMatch) {
                                            displayError = `Transaction aborted with code ${abortCodeMatch[1]}`;
                                            if (locationMatch) {
                                                displayError += ` in ${locationMatch[1].trim()}`;
                                            }
                                        }
                                    }

                                    if (opts.showExplorerLink) {
                                        toast.error(
                                            <div>
                                                {displayError}
                                                <a
                                                    href={`https://suiscan.xyz/${NETWORK}/tx/${txResult.digest}`}
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                    className="underline ml-2"
                                                >
                                                    View details
                                                </a>
                                            </div>,
                                            { duration: opts.toastDuration }
                                        );
                                    } else {
                                        toast.error(displayError, { duration: opts.toastDuration });
                                    }

                                    const error = markNotifiedTransactionError(new Error(displayError));
                                    callbacks?.onError?.(error);
                                    reject(error);
                                }
                            } catch (callbackError) {
                                console.error("Error in transaction success callback:", callbackError);
                                reject(
                                    callbackError instanceof Error
                                        ? callbackError
                                        : new Error("Transaction success handling failed")
                                );
                            } finally {
                                finish();
                            }
                        },
                        onError: (error) => {
                            if (!claimResult()) return;
                            try {
                                let errorMsg = "Transaction failed";

                                // Handle common error scenarios
                                if (error.message?.includes("Rejected from user")) {
                                    errorMsg = "Transaction cancelled";
                                } else if (error.message?.includes("Insufficient gas")) {
                                    errorMsg = "Insufficient SUI for gas fees";
                                } else if (error.message?.includes("InsufficientBalance")) {
                                    errorMsg = "Insufficient balance";
                                } else if (error.message) {
                                    errorMsg = error.message;
                                }

                                const displayError =
                                    typeof opts.errorMessage === "function"
                                        ? opts.errorMessage(error)
                                        : opts.errorMessage || errorMsg;

                                toast.error(displayError, { duration: opts.toastDuration });
                                const notifiedError = markNotifiedTransactionError(error);
                                callbacks?.onError?.(notifiedError);
                                reject(notifiedError);
                            } catch (callbackError) {
                                console.error("Error in transaction error callback:", callbackError);
                                reject(
                                    callbackError instanceof Error
                                        ? callbackError
                                        : new Error("Transaction error handling failed")
                                );
                            } finally {
                                finish();
                            }
                        },
                    }
                );
            });
        },
        [signAndExecute]
    );

    return {
        executeTransaction,
        isLoading,
    };
}
