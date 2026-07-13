import { normalizeStructTag } from "@mysten/sui/utils";
import type { QueryClient } from "@tanstack/react-query";
import type { SuiEvent } from "@govex/futarchy-sdk/types";

function normalizeCoinType(value: string): string {
    try {
        return normalizeStructTag(value);
    } catch {
        return value.trim();
    }
}

function parsedEvent(event: SuiEvent): Record<string, unknown> | null {
    return event.parsedJson && typeof event.parsedJson === "object"
        ? (event.parsedJson as Record<string, unknown>)
        : null;
}

function typeNameValue(value: unknown): string {
    if (typeof value === "string") return value;
    if (!value || typeof value !== "object") return "";
    const fields = (value as { fields?: Record<string, unknown> }).fields ?? (value as Record<string, unknown>);
    return typeof fields.name === "string" ? fields.name : "";
}

export function patchMultisigEventCaches(queryClient: QueryClient, events: SuiEvent[]): void {
    for (const event of events) {
        const data = parsedEvent(event);
        const type = event.type ?? "";
        if (!data) continue;

        if (type.endsWith("::vault::VaultDeposited") || type.endsWith("::vault::VaultSpent")) {
            const accountId = String(data.account_id ?? "");
            const vaultName = String(data.vault_name ?? "");
            const coinType = normalizeCoinType(typeNameValue(data.coin_type));
            const amount = BigInt(String(data.amount ?? "0")) * (type.endsWith("::VaultSpent") ? -1n : 1n);
            if (!accountId || !vaultName || !coinType) continue;
            queryClient.setQueryData<Array<{ vaultName: string; coinType: string; amount: bigint }>>(
                ["multisig-rpc", "vault-balances", accountId],
                (previous) => {
                    // A vault event is only a delta. Do not manufacture a partial
                    // cache and mark it fresh when the complete list was never read.
                    if (!previous) return previous;
                    let found = false;
                    const next = previous.flatMap((balance) => {
                        if (balance.vaultName !== vaultName || normalizeCoinType(balance.coinType) !== coinType) {
                            return [balance];
                        }
                        found = true;
                        const nextAmount = balance.amount + amount;
                        return nextAmount > 0n ? [{ ...balance, amount: nextAmount }] : [];
                    });
                    if (!found && amount > 0n) next.push({ vaultName, coinType, amount });
                    return next;
                }
            );
            continue;
        }

        if (type.endsWith("::multisig::IntentExecutedEvent")) {
            const accountId = String(data.account_addr ?? "");
            const intentKey = String(data.key ?? "");
            queryClient.setQueryData<Array<{ key: string; approvals: { status: number } }>>(
                ["multisig-rpc", "intents", accountId],
                (previous) =>
                    previous?.map((intent) =>
                        intent.key === intentKey ? { ...intent, approvals: { ...intent.approvals, status: 4 } } : intent
                    )
            );
            continue;
        }

        if (type.endsWith("::multisig::IntentCancelledEvent")) {
            const accountId = String(data.account_addr ?? "");
            const intentKey = String(data.key ?? "");
            queryClient.setQueryData<Array<{ key: string }>>(["multisig-rpc", "intents", accountId], (previous) =>
                previous?.filter((intent) => intent.key !== intentKey)
            );
        }
    }
}
