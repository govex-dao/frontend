import type { SuiJsonRpcClient as SuiClient } from "@mysten/sui/jsonRpc";

export interface PaymentCoin {
    coinObjectId: string;
    balance: string;
}

interface SelectCoinObjectsForAmountConfig {
    client: SuiClient;
    owner: string;
    coinType: string;
    amount: bigint;
    maxCoins?: number;
}

interface SelectedCoinObjects {
    coins: PaymentCoin[];
    total: bigint;
    isSufficient: boolean;
    exceedsMaxCoins: boolean;
}

const DEFAULT_MAX_PAYMENT_COINS = 64;

function selectLargestCoins(coins: PaymentCoin[], amount: bigint): { coins: PaymentCoin[]; total: bigint } {
    const sorted = [...coins].sort((a, b) => {
        const aBalance = BigInt(a.balance);
        const bBalance = BigInt(b.balance);
        if (aBalance === bBalance) return a.coinObjectId.localeCompare(b.coinObjectId);
        return aBalance > bBalance ? -1 : 1;
    });

    const selected: PaymentCoin[] = [];
    let total = 0n;
    for (const coin of sorted) {
        selected.push(coin);
        total += BigInt(coin.balance);
        if (total >= amount) break;
    }

    return { coins: selected, total };
}

export async function selectCoinObjectsForAmount({
    client,
    owner,
    coinType,
    amount,
    maxCoins = DEFAULT_MAX_PAYMENT_COINS,
}: SelectCoinObjectsForAmountConfig): Promise<SelectedCoinObjects> {
    const candidates: PaymentCoin[] = [];
    let cursor: string | null | undefined = undefined;
    let best = selectLargestCoins(candidates, amount);

    for (;;) {
        const page = await client.getCoins({
            owner,
            coinType,
            cursor: cursor ?? undefined,
        });

        for (const coin of page.data) {
            if (BigInt(coin.balance) > 0n) {
                candidates.push({
                    coinObjectId: coin.coinObjectId,
                    balance: coin.balance,
                });
            }
        }

        best = selectLargestCoins(candidates, amount);
        if (best.total >= amount && best.coins.length <= maxCoins) {
            break;
        }

        if (!page.hasNextPage || !page.nextCursor) {
            break;
        }
        cursor = page.nextCursor;
    }

    const isSufficient = best.total >= amount;
    return {
        coins: best.coins,
        total: best.total,
        isSufficient,
        exceedsMaxCoins: isSufficient && best.coins.length > maxCoins,
    };
}
