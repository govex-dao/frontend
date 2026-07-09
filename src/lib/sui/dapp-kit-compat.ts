import { useCallback, useState } from "react";
import { useCurrentAccount, useCurrentClient, useCurrentNetwork, useDAppKit, useWallets } from "@mysten/dapp-kit-react";
import type { Transaction } from "@mysten/sui/transactions";
import { dAppKit } from "./dapp-kit";

export { useCurrentAccount, useWallets };

interface MutationCallbacks<TResult = unknown> {
    onSuccess?: (result: TResult) => void;
    onError?: (error: Error) => void;
    onSettled?: () => void;
}

export function useSuiClient() {
    return useCurrentClient({ dAppKit });
}

export function useSuiClientContext() {
    return {
        client: useCurrentClient({ dAppKit }),
        network: useCurrentNetwork({ dAppKit }),
    };
}

export function useConnectWallet() {
    const kit = useDAppKit(dAppKit);
    const [isPending, setIsPending] = useState(false);

    const mutate = useCallback(
        (args: Parameters<typeof dAppKit.connectWallet>[0], callbacks?: MutationCallbacks) => {
            setIsPending(true);
            kit.connectWallet(args)
                .then((result) => callbacks?.onSuccess?.(result))
                .catch((error: unknown) =>
                    callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)))
                )
                .finally(() => {
                    setIsPending(false);
                    callbacks?.onSettled?.();
                });
        },
        [kit]
    );

    return { mutate, isPending };
}

export function useDisconnectWallet() {
    const kit = useDAppKit(dAppKit);
    const [isPending, setIsPending] = useState(false);

    const mutate = useCallback(
        (_args?: void, callbacks?: MutationCallbacks) => {
            setIsPending(true);
            kit.disconnectWallet()
                .then((result) => callbacks?.onSuccess?.(result))
                .catch((error: unknown) =>
                    callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)))
                )
                .finally(() => {
                    setIsPending(false);
                    callbacks?.onSettled?.();
                });
        },
        [kit]
    );

    return { mutate, isPending };
}

export function useSignAndExecuteTransaction<TResult = unknown>(options?: {
    execute?: (input: { bytes: string; signature: string }) => Promise<TResult>;
}) {
    const kit = useDAppKit(dAppKit);
    const [isPending, setIsPending] = useState(false);

    const mutate = useCallback(
        (args: { transaction: Transaction | string }, callbacks?: MutationCallbacks<TResult>) => {
            setIsPending(true);
            const executePromise = options?.execute
                ? kit.signTransaction(args).then(({ bytes, signature }) => options.execute!({ bytes, signature }))
                : (kit.signAndExecuteTransaction(args) as Promise<TResult>);

            executePromise
                .then((result) => callbacks?.onSuccess?.(result))
                .catch((error: unknown) =>
                    callbacks?.onError?.(error instanceof Error ? error : new Error(String(error)))
                )
                .finally(() => {
                    setIsPending(false);
                    callbacks?.onSettled?.();
                });
        },
        [kit, options]
    );

    return { mutate, isPending };
}
