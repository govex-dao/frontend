import { buildBalanceWrapperType, type FutarchySDK } from "@govex/futarchy-sdk";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import type { Proposal } from "@/types/Proposal";

interface CoinObjectRef {
    objectId: string;
    balance: bigint;
}

interface BalanceWrapperOutcomeRaw {
    outcomeIndex: number;
    asset: { raw: bigint };
    stable: { raw: bigint };
}

interface BalanceWrapperRaw {
    objectId: string;
    outcomeCount: number;
    outcomes: BalanceWrapperOutcomeRaw[];
    isEmpty: boolean;
}

export interface WrapperSettlementPlan {
    objectId: string;
    recombineAssetAmount: bigint;
    recombineStableAmount: bigint;
    redeemWinningAssetAmount: bigint;
    redeemWinningStableAmount: bigint;
    destroyAfterSettlement: boolean;
    remainingNonWinningAsset: bigint;
    remainingNonWinningStable: bigint;
}

export interface ProposalSettlementPlan {
    proposal: Proposal;
    useWrappedEscrow: boolean;
    winningOutcome: number;
    winningAssetCoinType: string;
    winningStableCoinType: string;
    winningAssetCoins: CoinObjectRef[];
    winningStableCoins: CoinObjectRef[];
    wrappers: WrapperSettlementPlan[];
}

export interface WalletSettlementSummary {
    proposalsTouched: number;
    wrappersTouched: number;
    directWinningCoinObjects: number;
    assetToSpotRaw: bigint;
    stableToSpotRaw: bigint;
    residualWrapperAssetRaw: bigint;
    residualWrapperStableRaw: bigint;
}

export interface WalletSettlementPlan {
    proposals: ProposalSettlementPlan[];
    summary: WalletSettlementSummary;
}

function parseCoinTypeList(value: string | null): string[] {
    if (!value) return [];
    try {
        const parsed = JSON.parse(value);
        if (!Array.isArray(parsed)) return [];
        return parsed.filter((entry): entry is string => typeof entry === "string");
    } catch {
        return [];
    }
}

function minBigInt(values: bigint[]): bigint {
    if (values.length === 0) return 0n;
    let min = values[0];
    for (let i = 1; i < values.length; i++) {
        if (values[i] < min) min = values[i];
    }
    return min;
}

function sumBigInt(values: bigint[]): bigint {
    return values.reduce((sum, value) => sum + value, 0n);
}

function isSettledProposal(proposal: Proposal): boolean {
    const settledState = proposal.state === "finalized" || proposal.state === "executed";
    return (
        settledState &&
        proposal.winning_outcome !== null &&
        proposal.winning_outcome >= 0 &&
        !!proposal.escrow_id &&
        !!proposal.market_state_id
    );
}

async function getAllCoinsByType(sdk: FutarchySDK, owner: string, coinType: string): Promise<CoinObjectRef[]> {
    const coins: CoinObjectRef[] = [];
    let cursor: string | null | undefined = undefined;

    for (;;) {
        const page = await sdk.client.getCoins({ owner, coinType, cursor });
        for (const coin of page.data) {
            const balance = BigInt(coin.balance);
            if (balance > 0n) {
                coins.push({
                    objectId: coin.coinObjectId,
                    balance,
                });
            }
        }
        if (!page.hasNextPage || !page.nextCursor) break;
        cursor = page.nextCursor;
    }

    return coins;
}

function buildWrapperSettlementPlan(
    wrapper: BalanceWrapperRaw,
    winningOutcome: number,
    outcomeCount: number
): WrapperSettlementPlan | null {
    if (outcomeCount <= 0 || winningOutcome < 0 || winningOutcome >= outcomeCount) {
        return null;
    }

    const assetByOutcome = Array.from({ length: outcomeCount }, () => 0n);
    const stableByOutcome = Array.from({ length: outcomeCount }, () => 0n);

    for (const outcome of wrapper.outcomes) {
        if (outcome.outcomeIndex < 0 || outcome.outcomeIndex >= outcomeCount) continue;
        assetByOutcome[outcome.outcomeIndex] = outcome.asset.raw ?? 0n;
        stableByOutcome[outcome.outcomeIndex] = outcome.stable.raw ?? 0n;
    }

    const recombineAssetAmount = minBigInt(assetByOutcome);
    const recombineStableAmount = minBigInt(stableByOutcome);

    const winningAssetRaw = assetByOutcome[winningOutcome] ?? 0n;
    const winningStableRaw = stableByOutcome[winningOutcome] ?? 0n;
    const redeemWinningAssetAmount = winningAssetRaw - recombineAssetAmount;
    const redeemWinningStableAmount = winningStableRaw - recombineStableAmount;

    let remainingNonWinningAsset = 0n;
    let remainingNonWinningStable = 0n;
    for (let i = 0; i < outcomeCount; i++) {
        if (i === winningOutcome) continue;
        remainingNonWinningAsset += assetByOutcome[i] - recombineAssetAmount;
        remainingNonWinningStable += stableByOutcome[i] - recombineStableAmount;
    }

    const destroyAfterSettlement =
        remainingNonWinningAsset === 0n &&
        remainingNonWinningStable === 0n &&
        redeemWinningAssetAmount === 0n &&
        redeemWinningStableAmount === 0n;

    const hasAction =
        wrapper.isEmpty ||
        recombineAssetAmount > 0n ||
        recombineStableAmount > 0n ||
        redeemWinningAssetAmount > 0n ||
        redeemWinningStableAmount > 0n ||
        destroyAfterSettlement;

    if (!hasAction) return null;

    return {
        objectId: wrapper.objectId,
        recombineAssetAmount,
        recombineStableAmount,
        redeemWinningAssetAmount,
        redeemWinningStableAmount,
        destroyAfterSettlement,
        remainingNonWinningAsset,
        remainingNonWinningStable,
    };
}

export async function buildWalletSettlementPlan(params: {
    sdk: FutarchySDK;
    owner: string;
    proposals: Proposal[];
}): Promise<WalletSettlementPlan> {
    const { sdk, owner, proposals } = params;
    const settledProposals = proposals.filter(isSettledProposal);

    const proposalPlansRaw = await Promise.all(
        settledProposals.map(async (proposal): Promise<ProposalSettlementPlan | null> => {
            const winningOutcome = proposal.winning_outcome as number;
            const conditionalAssetTypes = parseCoinTypeList(proposal.conditional_asset_types);
            const conditionalStableTypes = parseCoinTypeList(proposal.conditional_stable_types);

            const winningAssetCoinType = conditionalAssetTypes[winningOutcome];
            const winningStableCoinType = conditionalStableTypes[winningOutcome];

            if (!winningAssetCoinType || !winningStableCoinType) {
                return null;
            }

            const balanceWrapperType = buildBalanceWrapperType(
                sdk.packages.futarchyMarketsPrimitives,
                proposal.asset_type,
                proposal.stable_type
            );

            const [winningAssetCoins, winningStableCoins, wrappersRaw] = await Promise.all([
                getAllCoinsByType(sdk, owner, winningAssetCoinType),
                getAllCoinsByType(sdk, owner, winningStableCoinType),
                sdk.utils.queryHelper.getBalanceWrappers(
                    owner,
                    balanceWrapperType,
                    proposal.market_state_id as string,
                    proposal.asset_decimals,
                    proposal.stable_decimals
                ) as Promise<BalanceWrapperRaw[]>,
            ]);

            const wrappers = wrappersRaw
                .map((wrapper) => buildWrapperSettlementPlan(wrapper, winningOutcome, proposal.outcome_count))
                .filter((wrapper): wrapper is WrapperSettlementPlan => wrapper !== null);

            const hasActions = winningAssetCoins.length > 0 || winningStableCoins.length > 0 || wrappers.length > 0;
            if (!hasActions) return null;

            return {
                proposal,
                useWrappedEscrow: !!proposal.spot_pool_id && !!proposal.lp_type,
                winningOutcome,
                winningAssetCoinType,
                winningStableCoinType,
                winningAssetCoins,
                winningStableCoins,
                wrappers,
            };
        })
    );

    const proposalPlans = proposalPlansRaw.filter((plan): plan is ProposalSettlementPlan => plan !== null);

    const summary: WalletSettlementSummary = {
        proposalsTouched: proposalPlans.length,
        wrappersTouched: 0,
        directWinningCoinObjects: 0,
        assetToSpotRaw: 0n,
        stableToSpotRaw: 0n,
        residualWrapperAssetRaw: 0n,
        residualWrapperStableRaw: 0n,
    };

    for (const proposalPlan of proposalPlans) {
        const directWinningAssetRaw = sumBigInt(proposalPlan.winningAssetCoins.map((coin) => coin.balance));
        const directWinningStableRaw = sumBigInt(proposalPlan.winningStableCoins.map((coin) => coin.balance));
        const wrapperRecombinedAssetRaw = sumBigInt(
            proposalPlan.wrappers.map((wrapper) => wrapper.recombineAssetAmount)
        );
        const wrapperRecombinedStableRaw = sumBigInt(
            proposalPlan.wrappers.map((wrapper) => wrapper.recombineStableAmount)
        );
        const wrapperWinningAssetRaw = sumBigInt(
            proposalPlan.wrappers.map((wrapper) => wrapper.redeemWinningAssetAmount)
        );
        const wrapperWinningStableRaw = sumBigInt(
            proposalPlan.wrappers.map((wrapper) => wrapper.redeemWinningStableAmount)
        );

        summary.wrappersTouched += proposalPlan.wrappers.length;
        summary.directWinningCoinObjects +=
            proposalPlan.winningAssetCoins.length + proposalPlan.winningStableCoins.length;
        summary.assetToSpotRaw += directWinningAssetRaw + wrapperRecombinedAssetRaw + wrapperWinningAssetRaw;
        summary.stableToSpotRaw += directWinningStableRaw + wrapperRecombinedStableRaw + wrapperWinningStableRaw;
        summary.residualWrapperAssetRaw += sumBigInt(
            proposalPlan.wrappers.map((wrapper) => wrapper.remainingNonWinningAsset)
        );
        summary.residualWrapperStableRaw += sumBigInt(
            proposalPlan.wrappers.map((wrapper) => wrapper.remainingNonWinningStable)
        );
    }

    return { proposals: proposalPlans, summary };
}

export function hasSettlementActions(plan: WalletSettlementPlan): boolean {
    return plan.proposals.length > 0;
}

export function buildWalletSettlementTransaction(params: {
    sdk: FutarchySDK;
    plan: WalletSettlementPlan;
    recipient: string;
    clockId?: string;
}): Transaction {
    const { sdk, plan, recipient, clockId = SUI_CLOCK_OBJECT_ID } = params;
    const tx = new Transaction();
    const primitivesPackageId = sdk.packages.futarchyMarketsPrimitives;
    const operationsPackageId = sdk.packages.futarchyMarketsOperations;
    const spotPoolMutationRegistryRef = tx.sharedObjectRef({
        objectId: sdk.sharedObjects.spotPoolMutationRegistry.id,
        initialSharedVersion: sdk.sharedObjects.spotPoolMutationRegistry.version,
        mutable: false,
    });

    for (const proposalPlan of plan.proposals) {
        const proposalId = String(proposalPlan.proposal.id);
        const escrowId = proposalPlan.proposal.escrow_id as string;
        const { asset_type: assetType, stable_type: stableType } = proposalPlan.proposal;
        const useWrappedEscrow = proposalPlan.useWrappedEscrow;
        const spotPoolId = proposalPlan.proposal.spot_pool_id;
        const lpType = proposalPlan.proposal.lp_type;

        if (useWrappedEscrow && (!spotPoolId || !lpType)) {
            throw new Error(
                `Settlement requires wrapped escrow path but spot pool metadata is missing for proposal ${proposalId}`
            );
        }

        const winningAssetCoins = proposalPlan.winningAssetCoins.map((coin) => tx.object(coin.objectId));
        if (winningAssetCoins.length > 0) {
            const [firstAssetCoin, ...restAssetCoins] = winningAssetCoins;
            if (restAssetCoins.length > 0) {
                tx.mergeCoins(firstAssetCoin, restAssetCoins);
            }
            const redeemedAssetCoin = useWrappedEscrow
                ? tx.moveCall({
                      target: `${operationsPackageId}::liquidity_interact::redeem_conditional_asset_with_wrapped_escrow`,
                      typeArguments: [assetType, stableType, lpType!, proposalPlan.winningAssetCoinType],
                      arguments: [
                          tx.object(proposalId),
                          tx.object(spotPoolId!),
                          firstAssetCoin,
                          tx.pure.u64(proposalPlan.winningOutcome),
                          spotPoolMutationRegistryRef,
                          tx.object(clockId),
                      ],
                  })
                : tx.moveCall({
                      target: `${operationsPackageId}::liquidity_interact::redeem_conditional_asset`,
                      typeArguments: [assetType, stableType, proposalPlan.winningAssetCoinType],
                      arguments: [
                          tx.object(proposalId),
                          tx.object(escrowId),
                          firstAssetCoin,
                          tx.pure.u64(proposalPlan.winningOutcome),
                          tx.object(clockId),
                      ],
                  });
            tx.transferObjects([redeemedAssetCoin], tx.pure.address(recipient));
        }

        const winningStableCoins = proposalPlan.winningStableCoins.map((coin) => tx.object(coin.objectId));
        if (winningStableCoins.length > 0) {
            const [firstStableCoin, ...restStableCoins] = winningStableCoins;
            if (restStableCoins.length > 0) {
                tx.mergeCoins(firstStableCoin, restStableCoins);
            }
            const redeemedStableCoin = useWrappedEscrow
                ? tx.moveCall({
                      target: `${operationsPackageId}::liquidity_interact::redeem_conditional_stable_with_wrapped_escrow`,
                      typeArguments: [assetType, stableType, lpType!, proposalPlan.winningStableCoinType],
                      arguments: [
                          tx.object(proposalId),
                          tx.object(spotPoolId!),
                          firstStableCoin,
                          tx.pure.u64(proposalPlan.winningOutcome),
                          spotPoolMutationRegistryRef,
                          tx.object(clockId),
                      ],
                  })
                : tx.moveCall({
                      target: `${operationsPackageId}::liquidity_interact::redeem_conditional_stable`,
                      typeArguments: [assetType, stableType, proposalPlan.winningStableCoinType],
                      arguments: [
                          tx.object(proposalId),
                          tx.object(escrowId),
                          firstStableCoin,
                          tx.pure.u64(proposalPlan.winningOutcome),
                          tx.object(clockId),
                      ],
                  });
            tx.transferObjects([redeemedStableCoin], tx.pure.address(recipient));
        }

        for (const wrapperPlan of proposalPlan.wrappers) {
            const wrapperObject = tx.object(wrapperPlan.objectId);

            if (wrapperPlan.recombineAssetAmount > 0n) {
                const recombinedAsset = useWrappedEscrow
                    ? tx.moveCall({
                          target: `${operationsPackageId}::liquidity_interact::recombine_balance_to_asset_with_wrapped_escrow`,
                          typeArguments: [assetType, stableType, lpType!],
                          arguments: [
                              tx.object(proposalId),
                              tx.object(spotPoolId!),
                              wrapperObject,
                              tx.pure.u64(wrapperPlan.recombineAssetAmount),
                              spotPoolMutationRegistryRef,
                          ],
                      })
                    : tx.moveCall({
                          target: `${primitivesPackageId}::conditional_balance::recombine_balance_to_asset`,
                          typeArguments: [assetType, stableType],
                          arguments: [tx.object(escrowId), wrapperObject, tx.pure.u64(wrapperPlan.recombineAssetAmount)],
                      });
                tx.transferObjects([recombinedAsset], tx.pure.address(recipient));
            }

            if (wrapperPlan.recombineStableAmount > 0n) {
                const recombinedStable = useWrappedEscrow
                    ? tx.moveCall({
                          target: `${operationsPackageId}::liquidity_interact::recombine_balance_to_stable_with_wrapped_escrow`,
                          typeArguments: [assetType, stableType, lpType!],
                          arguments: [
                              tx.object(proposalId),
                              tx.object(spotPoolId!),
                              wrapperObject,
                              tx.pure.u64(wrapperPlan.recombineStableAmount),
                              spotPoolMutationRegistryRef,
                          ],
                      })
                    : tx.moveCall({
                          target: `${primitivesPackageId}::conditional_balance::recombine_balance_to_stable`,
                          typeArguments: [assetType, stableType],
                          arguments: [tx.object(escrowId), wrapperObject, tx.pure.u64(wrapperPlan.recombineStableAmount)],
                      });
                tx.transferObjects([recombinedStable], tx.pure.address(recipient));
            }

            if (wrapperPlan.redeemWinningAssetAmount > 0n) {
                const redeemedWinningAsset = useWrappedEscrow
                    ? tx.moveCall({
                          target: `${operationsPackageId}::liquidity_interact::redeem_conditional_asset_from_balance_with_wrapped_escrow`,
                          typeArguments: [assetType, stableType, lpType!, proposalPlan.winningAssetCoinType],
                          arguments: [
                              tx.object(proposalId),
                              tx.object(spotPoolId!),
                              wrapperObject,
                              tx.pure.u8(proposalPlan.winningOutcome),
                              tx.pure.u64(wrapperPlan.redeemWinningAssetAmount),
                              spotPoolMutationRegistryRef,
                              tx.object(clockId),
                          ],
                      })
                    : (() => {
                          const winningAssetCoin = tx.moveCall({
                              target: `${primitivesPackageId}::conditional_balance::unwrap_to_coin`,
                              typeArguments: [assetType, stableType, proposalPlan.winningAssetCoinType],
                              arguments: [
                                  wrapperObject,
                                  tx.object(escrowId),
                                  tx.pure.u8(proposalPlan.winningOutcome),
                                  tx.pure.bool(true),
                                  tx.pure.u64(wrapperPlan.redeemWinningAssetAmount),
                              ],
                          });
                          return tx.moveCall({
                              target: `${operationsPackageId}::liquidity_interact::redeem_conditional_asset`,
                              typeArguments: [assetType, stableType, proposalPlan.winningAssetCoinType],
                              arguments: [
                                  tx.object(proposalId),
                                  tx.object(escrowId),
                                  winningAssetCoin,
                                  tx.pure.u64(proposalPlan.winningOutcome),
                                  tx.object(clockId),
                              ],
                          });
                      })();
                tx.transferObjects([redeemedWinningAsset], tx.pure.address(recipient));
            }

            if (wrapperPlan.redeemWinningStableAmount > 0n) {
                const redeemedWinningStable = useWrappedEscrow
                    ? tx.moveCall({
                          target: `${operationsPackageId}::liquidity_interact::redeem_conditional_stable_from_balance_with_wrapped_escrow`,
                          typeArguments: [assetType, stableType, lpType!, proposalPlan.winningStableCoinType],
                          arguments: [
                              tx.object(proposalId),
                              tx.object(spotPoolId!),
                              wrapperObject,
                              tx.pure.u8(proposalPlan.winningOutcome),
                              tx.pure.u64(wrapperPlan.redeemWinningStableAmount),
                              spotPoolMutationRegistryRef,
                              tx.object(clockId),
                          ],
                      })
                    : (() => {
                          const winningStableCoin = tx.moveCall({
                              target: `${primitivesPackageId}::conditional_balance::unwrap_to_coin`,
                              typeArguments: [assetType, stableType, proposalPlan.winningStableCoinType],
                              arguments: [
                                  wrapperObject,
                                  tx.object(escrowId),
                                  tx.pure.u8(proposalPlan.winningOutcome),
                                  tx.pure.bool(false),
                                  tx.pure.u64(wrapperPlan.redeemWinningStableAmount),
                              ],
                          });
                          return tx.moveCall({
                              target: `${operationsPackageId}::liquidity_interact::redeem_conditional_stable`,
                              typeArguments: [assetType, stableType, proposalPlan.winningStableCoinType],
                              arguments: [
                                  tx.object(proposalId),
                                  tx.object(escrowId),
                                  winningStableCoin,
                                  tx.pure.u64(proposalPlan.winningOutcome),
                                  tx.object(clockId),
                              ],
                          });
                      })();
                tx.transferObjects([redeemedWinningStable], tx.pure.address(recipient));
            }

            if (wrapperPlan.destroyAfterSettlement) {
                tx.moveCall({
                    target: `${primitivesPackageId}::conditional_balance::destroy_empty`,
                    typeArguments: [assetType, stableType],
                    arguments: [wrapperObject],
                });
            } else {
                tx.transferObjects([wrapperObject], tx.pure.address(recipient));
            }
        }
    }

    return tx;
}
