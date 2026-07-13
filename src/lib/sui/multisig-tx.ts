/**
 * Multisig PTB builder for browser — mirrors e2e/scripts/utils/multisig-helpers.ts patterns.
 *
 * All functions append move-calls onto an existing Transaction. Package IDs are
 * resolved lazily from getSDK().
 */

import { type TransactionResult, Transaction } from "@mysten/sui/transactions";
import { MAX_ACTION_SPECS_PER_INTENT } from "@govex/futarchy-sdk";
import { getSDK } from "@/lib/sdk";

type MoveCallResult = TransactionResult;
export type ActionSpecBuilder = TransactionResult;

export { MAX_ACTION_SPECS_PER_INTENT };

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function multisigService() {
    const multisig = getSDK().multisig;
    if (!multisig) throw new Error("multisig service not configured");
    return multisig;
}

// ---------------------------------------------------------------------------
// Core staging
// ---------------------------------------------------------------------------

/**
 * Stage a generic actions intent using the action_spec_builder.
 *
 * `builderSetup` receives the Transaction and the builder result so the caller
 * can add action specs via addXxxSpec helpers. Return value is ignored — the
 * builder is consumed automatically.
 */
export function stageActionsIntent(
    tx: Transaction,
    accountId: string,
    key: string,
    description: string,
    executionTimeMs: bigint | number,
    builderSetup: (tx: Transaction, builder: ActionSpecBuilder) => void
) {
    multisigService().proposeActionsIntent(tx, {
        accountId,
        key,
        description,
        executionTimeMs,
        builderSetup,
    });
}

// ---------------------------------------------------------------------------
// Cancel helpers — actions intents
// ---------------------------------------------------------------------------

export function cancelExpiredActions(tx: Transaction, accountId: string, key: string) {
    multisigService().cancelExpiredActions(tx, accountId, key);
}

export function cancelStaleActions(tx: Transaction, accountId: string, key: string) {
    multisigService().cancelStaleActions(tx, accountId, key);
}

export function cancelRejectedActions(tx: Transaction, accountId: string, key: string) {
    multisigService().cancelRejectedActions(tx, accountId, key);
}

// ---------------------------------------------------------------------------
// Cancel helpers — config intents
// ---------------------------------------------------------------------------

export function cancelExpiredConfigChange(tx: Transaction, accountId: string, key: string) {
    multisigService().cancelExpiredConfigChange(tx, accountId, key);
}

export function cancelStaleConfigChange(tx: Transaction, accountId: string, key: string) {
    multisigService().cancelStaleConfigChange(tx, accountId, key);
}

export function cancelRejectedConfigChange(tx: Transaction, accountId: string, key: string) {
    multisigService().cancelRejectedConfigChange(tx, accountId, key);
}

// ---------------------------------------------------------------------------
// Execute actions intent
// ---------------------------------------------------------------------------

/**
 * Execute an approved actions intent.
 *
 * `executionSetup` receives the transaction, executable, and witness so the
 * caller can add do_*() calls per action.
 */
export function executeActionsIntent(
    tx: Transaction,
    accountId: string,
    key: string,
    executionSetup: (tx: Transaction, executable: MoveCallResult, witness: MoveCallResult) => void
) {
    const service = multisigService();
    const { executable, witness } = service.beginActionsExecution(tx, accountId, key);
    executionSetup(tx, executable, witness);
    service.confirmExecution(tx, accountId, executable);
}

// ---------------------------------------------------------------------------
// Action spec helpers (one per Move add_*_spec)
// ---------------------------------------------------------------------------

export function addMintSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    amount: bigint | number,
    resourceName: string
) {
    getSDK().actions.currency.addMint(tx, builder, coinType, BigInt(amount), resourceName);
}

export function addTransferCoinSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    recipient: string,
    resourceName: string
) {
    getSDK().actions.transfer.addTransferCoin(tx, builder, coinType, recipient, resourceName);
}

export function addSpendSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    amount: bigint | number,
    spendAll: boolean,
    resourceName: string
) {
    getSDK().actions.vault.addSpend(tx, builder, coinType, vaultName, BigInt(amount), spendAll, resourceName);
}

export function addDepositExternalSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    expectedAmount: bigint | number
) {
    getSDK().actions.vault.addDepositExternal(tx, builder, coinType, vaultName, expectedAmount);
}

export function addApproveCoinTypeSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string
) {
    getSDK().actions.vault.addApproveCoinType(tx, builder, coinType, vaultName);
}

export function addDepositFromResourcesSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    resourceName: string
) {
    getSDK().actions.vault.addDepositFromResources(tx, builder, coinType, vaultName, resourceName);
}

export function addDepositObjectFromResourcesSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    resourceName: string
) {
    getSDK().actions.vault.addDepositObjectFromResources(tx, builder, coinType, vaultName, resourceName);
}

export function addOpenVaultSpec(tx: Transaction, builder: ActionSpecBuilder, vaultName: string) {
    getSDK().actions.vault.addOpenVault(tx, builder, vaultName);
}

export function addCloseVaultSpec(tx: Transaction, builder: ActionSpecBuilder, vaultName: string) {
    getSDK().actions.vault.addCloseVault(tx, builder, vaultName);
}

export function addCreateStreamSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    capRecipient: string,
    amountPerIteration: bigint | number,
    startTimeMs: bigint | number | null | undefined,
    iterationsTotal: bigint | number,
    iterationPeriodMs: bigint | number,
    claimWindowMs: bigint | number | null,
    expiryMs: bigint | number | null = null,
    whitelistedRecipients: string[] = []
) {
    getSDK().actions.stream.addCreateStream(tx, builder, coinType, {
        vaultName,
        beneficiary: capRecipient,
        amountPerIteration: BigInt(amountPerIteration),
        startTime: startTimeMs,
        iterationsTotal: BigInt(iterationsTotal),
        iterationPeriodMs: BigInt(iterationPeriodMs),
        claimWindowMs: claimWindowMs == null ? undefined : BigInt(claimWindowMs),
        expiryMs: expiryMs == null ? undefined : BigInt(expiryMs),
        whitelistedRecipients,
    });
}

export function addCreateVestingSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    beneficiary: string,
    amountPerIteration: bigint | number,
    startTimeMs: bigint | number | null | undefined,
    iterationsTotal: bigint | number,
    iterationPeriodMs: bigint | number,
    isCancellable: boolean,
    resourceName: string
) {
    getSDK().actions.vesting.addCreateVesting(tx, builder, coinType, {
        beneficiary,
        amountPerIteration,
        startTime: startTimeMs,
        iterationsTotal,
        iterationPeriodMs,
        isCancellable,
        resourceName,
    });
}

export function addUpgradeAndCommitSpecs(
    tx: Transaction,
    builder: ActionSpecBuilder,
    packageName: string,
    digest: number[],
    expectedCapId: string
) {
    getSDK().actions.packageUpgrade.addUpgradeAndCommit(tx, builder, {
        name: packageName,
        digest,
        expectedCapId,
    });
}

export function addRestrictSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    packageName: string,
    policy: number,
    expectedCapId: string
) {
    getSDK().actions.packageUpgrade.addRestrict(tx, builder, { name: packageName, policy, expectedCapId });
}

export function addLockTreasuryCapSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    maxSupply: number | null = null,
    canMint = true,
    canBurn = true,
    canUpdateName = true,
    canUpdateDescription = true,
    canUpdateIcon = true,
    resourceName = "treasury_cap"
) {
    getSDK().actions.currency.addLockTreasuryCap(tx, builder, coinType, {
        maxSupply,
        canMint,
        canBurn,
        canUpdateName,
        canUpdateDescription,
        canUpdateIcon,
        resourceName,
    });
}

export function addLockMetadataCapSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    canUpdateName = true,
    canUpdateDescription = true,
    canUpdateIcon = true,
    resourceName = "metadata_cap"
) {
    getSDK().actions.currency.addLockMetadataCap(tx, builder, coinType, {
        canUpdateName,
        canUpdateDescription,
        canUpdateIcon,
        resourceName,
    });
}

export function addProvideObjectSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    objectType: string,
    objectId: string,
    resourceName: string
) {
    getSDK().actions.owned.addProvideObject(tx, builder, objectType, objectId, resourceName);
}

export function addWithdrawObjectSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    objectType: string,
    objectId: string,
    resourceName: string
) {
    getSDK().actions.owned.addWithdrawObject(tx, builder, objectType, objectId, resourceName);
}

export function addTransferObjectSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    objectType: string,
    recipient: string,
    resourceName: string
) {
    getSDK().actions.transfer.addTransfer(tx, builder, recipient, resourceName, objectType);
}

export function addBurnSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    amount: bigint | number,
    resourceName: string
) {
    getSDK().actions.currency.addBurn(tx, builder, coinType, BigInt(amount), resourceName);
}

export function addCancelStreamSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    streamId: string
) {
    getSDK().actions.vault.addCancelStream(tx, builder, coinType, vaultName, streamId);
}

export function addCancelVestingSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vestingId: string,
    resourceName: string
) {
    getSDK().actions.vesting.addCancelVesting(tx, builder, coinType, vestingId, resourceName);
}

export function addMemoSpec(tx: Transaction, builder: ActionSpecBuilder, memo: string) {
    getSDK().actions.memo.addMemo(tx, builder, memo);
}

export function addUnlockTreasuryCapToAddressSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    expectedCapId: string,
    recipient: string
) {
    const resourceName = `treasury_cap_out_${Date.now()}`;
    const objectType = `0x2::coin::TreasuryCap<${coinType}>`;
    getSDK().actions.accessControl.addUnlockToResources(tx, builder, objectType, expectedCapId, resourceName);
    getSDK().actions.transfer.addTransfer(tx, builder, recipient, resourceName, objectType);
}

export function addUnlockMetadataCapToAddressSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    expectedCapId: string,
    recipient: string
) {
    const resourceName = `metadata_cap_out_${Date.now()}`;
    const objectType = `0x2::coin_registry::MetadataCap<${coinType}>`;
    getSDK().actions.accessControl.addUnlockToResources(tx, builder, objectType, expectedCapId, resourceName);
    getSDK().actions.transfer.addTransfer(tx, builder, recipient, resourceName, objectType);
}

export function addLockUpgradeCapSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    name: string,
    delayMs: bigint | number,
    resourceName: string,
    expectedCapId: string
) {
    getSDK().actions.packageUpgrade.addLockUpgradeCap(tx, builder, {
        name,
        delayMs,
        resourceName,
        expectedCapId,
    });
}

export function addUnlockUpgradeCapSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    name: string,
    resourceName: string,
    expectedCapId: string
) {
    getSDK().actions.packageUpgrade.addUnlockUpgradeCap(tx, builder, { name, resourceName, expectedCapId });
}

// ---------------------------------------------------------------------------
// Action execution dispatch (implemented canonically by the SDK)

export type {
    ActionExecutionInfo,
    ActionExecutionRequirement,
    BuildActionsExecutionOptions,
    UpgradeExecutionInput,
} from "@govex/futarchy-sdk";

export function getActionExecutionRequirements(actionTypes: string[]) {
    return multisigService().getActionExecutionRequirements(actionTypes);
}

export function getActionExecInfo(actionType: string) {
    return multisigService().getActionExecInfo(actionType);
}

export function actionTypesNeedCoinType(actionTypes: string[]): boolean {
    return multisigService().actionTypesNeedCoinType(actionTypes);
}

export function getUnsupportedActions(actionTypes: string[]): string[] {
    return multisigService().getUnsupportedActions(actionTypes);
}

export function buildActionsExecution(
    tx: Transaction,
    accountId: string,
    key: string,
    actionTypes: string[],
    options: import("@govex/futarchy-sdk").BuildActionsExecutionOptions = {}
) {
    return multisigService().buildActionsExecution(tx, accountId, key, actionTypes, options);
}
