/* eslint-disable max-lines */
/**
 * Multisig PTB builder for browser — mirrors e2e/scripts/utils/multisig-helpers.ts patterns.
 *
 * All functions append move-calls onto an existing Transaction. Package IDs are
 * resolved lazily from getSDK().
 */

import { bcs } from "@mysten/sui/bcs";
import { type TransactionResult, Transaction } from "@mysten/sui/transactions";
import { parseStructTag, SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import { getSDK } from "@/lib/sdk";

const CLOCK = SUI_CLOCK_OBJECT_ID;
type MoveCallResult = TransactionResult;
export type ActionSpecBuilder = TransactionResult;
type MoveCallArgs = NonNullable<Parameters<Transaction["moveCall"]>[0]["arguments"]>;
const CONFIG_CHANGE_ACTION_TYPE = "config::ConfigChange";

/** Maximum action specs per multisig intent (matches on-chain constant) */
export const MAX_ACTION_SPECS_PER_INTENT = 10;

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

function pkgs() {
    const sdk = getSDK();
    const multisig = sdk.packages.accountMultisig;
    const actions = sdk.packages.accountActions;
    const protocol = sdk.packages.accountProtocol;
    const registryId = sdk.sharedObjects.packageRegistry.id;
    if (!multisig) throw new Error("accountMultisig package not configured");
    if (!actions) throw new Error("accountActions package not configured");
    if (!protocol) throw new Error("accountProtocol package not configured");
    return { multisig, actions, protocol, registryId };
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
    const p = pkgs();
    const account = tx.object(accountId);

    const auth = tx.moveCall({
        target: `${p.multisig}::multisig::authenticate`,
        arguments: [account],
    });
    const params = tx.moveCall({
        target: `${p.multisig}::multisig::new_params_from_config`,
        arguments: [
            account,
            tx.pure.string(key),
            tx.pure.string(description),
            tx.pure.u64(executionTimeMs),
            tx.object(CLOCK),
        ],
    });

    const builder = tx.moveCall({
        target: `${p.actions}::action_spec_builder::new`,
        arguments: [tx.pure.u8(0), tx.pure.id(accountId), tx.pure.u64(0)],
    });

    builderSetup(tx, builder);

    const specs = tx.moveCall({
        target: `${p.actions}::action_spec_builder::into_vector`,
        arguments: [builder],
    });

    tx.moveCall({
        target: `${p.multisig}::actions_staging::request_actions`,
        arguments: [auth, account, tx.object(p.registryId), params, specs],
    });
}

// ---------------------------------------------------------------------------
// Cancel helpers — actions intents
// ---------------------------------------------------------------------------

export function cancelExpiredActions(tx: Transaction, accountId: string, key: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.multisig}::actions_staging::cancel_expired_actions`,
        arguments: [tx.object(accountId), tx.pure.string(key), tx.object(CLOCK)],
    });
}

export function cancelStaleActions(tx: Transaction, accountId: string, key: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.multisig}::actions_staging::cancel_stale_actions`,
        arguments: [tx.object(accountId), tx.pure.string(key)],
    });
}

export function cancelRejectedActions(tx: Transaction, accountId: string, key: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.multisig}::actions_staging::cancel_rejected_actions`,
        arguments: [tx.object(accountId), tx.pure.string(key)],
    });
}

// ---------------------------------------------------------------------------
// Cancel helpers — config intents
// ---------------------------------------------------------------------------

export function cancelExpiredConfigChange(tx: Transaction, accountId: string, key: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.multisig}::config::cancel_expired_config_change`,
        arguments: [tx.object(accountId), tx.object(p.registryId), tx.pure.string(key), tx.object(CLOCK)],
    });
}

export function cancelStaleConfigChange(tx: Transaction, accountId: string, key: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.multisig}::config::cancel_stale_config_change`,
        arguments: [tx.object(accountId), tx.object(p.registryId), tx.pure.string(key)],
    });
}

export function cancelRejectedConfigChange(tx: Transaction, accountId: string, key: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.multisig}::config::cancel_rejected_config_change`,
        arguments: [tx.object(accountId), tx.object(p.registryId), tx.pure.string(key)],
    });
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
    const p = pkgs();

    const executable = tx.moveCall({
        target: `${p.multisig}::multisig::execute_intent`,
        arguments: [tx.object(accountId), tx.object(p.registryId), tx.pure.string(key), tx.object(CLOCK)],
    });

    const witness = tx.moveCall({
        target: `${p.multisig}::actions_staging::witness`,
    });

    executionSetup(tx, executable, witness);

    tx.moveCall({
        target: `${p.protocol}::account::confirm_execution`,
        typeArguments: [`${p.multisig}::multisig::Approvals`],
        arguments: [tx.object(accountId), executable],
    });
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
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::currency_init_actions::add_mint_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.u64(amount), tx.pure.string(resourceName)],
    });
}

export function addTransferCoinSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    recipient: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::transfer_init_actions::add_transfer_coin_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.address(recipient), tx.pure.string(resourceName)],
    });
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
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_spend_spec`,
        typeArguments: [coinType],
        arguments: [
            builder,
            tx.pure.string(vaultName),
            tx.pure.u64(amount),
            tx.pure.bool(spendAll),
            tx.pure.string(resourceName),
        ],
    });
}

export function addDepositExternalSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    expectedAmount: bigint | number
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_deposit_external_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.string(vaultName), tx.pure.u64(expectedAmount)],
    });
}

export function addApproveCoinTypeSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_approve_coin_type_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.string(vaultName)],
    });
}

export function addDepositFromResourcesSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_deposit_from_resources_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.string(vaultName), tx.pure.string(resourceName)],
    });
}

export function addDepositObjectFromResourcesSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_deposit_object_from_resources_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.string(vaultName), tx.pure.string(resourceName)],
    });
}

export function addOpenVaultSpec(tx: Transaction, builder: ActionSpecBuilder, vaultName: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_open_vault_spec`,
        arguments: [builder, tx.pure.string(vaultName)],
    });
}

export function addCloseVaultSpec(tx: Transaction, builder: ActionSpecBuilder, vaultName: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_close_vault_spec`,
        arguments: [builder, tx.pure.string(vaultName)],
    });
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
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::stream_init_actions::add_create_stream_spec`,
        typeArguments: [coinType],
        arguments: [
            builder,
            tx.pure.string(vaultName),
            tx.pure.address(capRecipient),
            tx.pure.u64(amountPerIteration),
            tx.pure.option("u64", startTimeMs != null ? Number(startTimeMs) : null),
            tx.pure.u64(iterationsTotal),
            tx.pure.u64(iterationPeriodMs),
            tx.pure.option("u64", claimWindowMs != null ? Number(claimWindowMs) : null),
            tx.pure.option("u64", expiryMs != null ? Number(expiryMs) : null),
            tx.pure.vector("address", whitelistedRecipients),
        ],
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
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vesting_init_actions::add_create_vesting_spec`,
        typeArguments: [coinType],
        arguments: [
            builder,
            tx.pure.address(beneficiary),
            tx.pure.u64(amountPerIteration),
            tx.pure.option("u64", startTimeMs != null ? Number(startTimeMs) : null),
            tx.pure.u64(iterationsTotal),
            tx.pure.u64(iterationPeriodMs),
            tx.pure.bool(isCancellable),
            tx.pure.string(resourceName),
        ],
    });
}

export function addUpgradeAndCommitSpecs(
    tx: Transaction,
    builder: ActionSpecBuilder,
    packageName: string,
    digest: number[],
    expectedCapId: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::package_upgrade_init_actions::add_upgrade_and_commit_specs`,
        arguments: [
            builder,
            tx.pure.string(packageName),
            tx.pure(bcs.vector(bcs.u8()).serialize(digest).toBytes()),
            tx.pure.id(expectedCapId),
        ],
    });
}

export function addRestrictSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    packageName: string,
    policy: number,
    expectedCapId: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::package_upgrade_init_actions::add_restrict_spec`,
        arguments: [builder, tx.pure.string(packageName), tx.pure.u8(policy), tx.pure.id(expectedCapId)],
    });
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
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::currency_init_actions::add_lock_treasury_cap_spec`,
        typeArguments: [coinType],
        arguments: [
            builder,
            tx.pure.option("u64", maxSupply),
            tx.pure.bool(canMint),
            tx.pure.bool(canBurn),
            tx.pure.bool(canUpdateName),
            tx.pure.bool(canUpdateDescription),
            tx.pure.bool(canUpdateIcon),
            tx.pure.string(resourceName),
        ],
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
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::currency_init_actions::add_lock_metadata_cap_spec`,
        typeArguments: [coinType],
        arguments: [
            builder,
            tx.pure.bool(canUpdateName),
            tx.pure.bool(canUpdateDescription),
            tx.pure.bool(canUpdateIcon),
            tx.pure.string(resourceName),
        ],
    });
}

export function addProvideObjectSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    objectType: string,
    objectId: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::owned_init_actions::add_provide_object_spec`,
        typeArguments: [objectType],
        arguments: [builder, tx.pure.id(objectId), tx.pure.string(resourceName)],
    });
}

export function addWithdrawObjectSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    objectType: string,
    objectId: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::owned_init_actions::add_withdraw_object_spec`,
        typeArguments: [objectType],
        arguments: [builder, tx.pure.id(objectId), tx.pure.string(resourceName)],
    });
}

export function addTransferObjectSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    objectType: string,
    recipient: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::transfer_init_actions::add_transfer_object_spec`,
        typeArguments: [objectType],
        arguments: [builder, tx.pure.address(recipient), tx.pure.string(resourceName)],
    });
}

export function addBurnSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    amount: bigint | number,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::currency_init_actions::add_burn_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.u64(amount), tx.pure.string(resourceName)],
    });
}

export function addCancelStreamSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vaultName: string,
    streamId: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vault_init_actions::add_cancel_stream_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.string(vaultName), tx.pure.id(streamId)],
    });
}

export function addCancelVestingSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    vestingId: string,
    resourceName: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::vesting_init_actions::add_cancel_vesting_spec`,
        typeArguments: [coinType],
        arguments: [builder, tx.pure.address(vestingId), tx.pure.string(resourceName)],
    });
}

export function addMemoSpec(tx: Transaction, builder: ActionSpecBuilder, memo: string) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::memo_init_actions::add_emit_memo_spec`,
        arguments: [builder, tx.pure.string(memo)],
    });
}

export function addUnlockTreasuryCapToAddressSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    recipient: string
) {
    const p = pkgs();
    const resourceName = `treasury_cap_out_${Date.now()}`;
    tx.moveCall({
        target: `${p.actions}::access_control_init_actions::add_unlock_to_resources_spec`,
        typeArguments: [`0x2::coin::TreasuryCap<${coinType}>`],
        arguments: [builder, tx.pure.string(resourceName)],
    });
    tx.moveCall({
        target: `${p.actions}::transfer_init_actions::add_transfer_object_spec`,
        typeArguments: [`0x2::coin::TreasuryCap<${coinType}>`],
        arguments: [builder, tx.pure.address(recipient), tx.pure.string(resourceName)],
    });
}

export function addUnlockMetadataCapToAddressSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    coinType: string,
    recipient: string
) {
    const resourceName = `metadata_cap_out_${Date.now()}`;
    tx.moveCall({
        target: `${pkgs().actions}::access_control_init_actions::add_unlock_to_resources_spec`,
        typeArguments: [`0x2::coin_registry::MetadataCap<${coinType}>`],
        arguments: [builder, tx.pure.string(resourceName)],
    });
    tx.moveCall({
        target: `${pkgs().actions}::transfer_init_actions::add_transfer_object_spec`,
        typeArguments: [`0x2::coin_registry::MetadataCap<${coinType}>`],
        arguments: [builder, tx.pure.address(recipient), tx.pure.string(resourceName)],
    });
}

export function addLockUpgradeCapSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    name: string,
    delayMs: bigint | number,
    resourceName: string,
    expectedCapId: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::package_upgrade_init_actions::add_lock_upgrade_cap_spec`,
        arguments: [
            builder,
            tx.pure.string(name),
            tx.pure.u64(delayMs),
            tx.pure.string(resourceName),
            tx.pure.id(expectedCapId),
        ],
    });
}

export function addUnlockUpgradeCapSpec(
    tx: Transaction,
    builder: ActionSpecBuilder,
    name: string,
    resourceName: string,
    expectedCapId: string
) {
    const p = pkgs();
    tx.moveCall({
        target: `${p.actions}::package_upgrade_init_actions::add_unlock_upgrade_cap_spec`,
        arguments: [builder, tx.pure.string(name), tx.pure.string(resourceName), tx.pure.id(expectedCapId)],
    });
}

// ---------------------------------------------------------------------------
// Action execution dispatch
// ---------------------------------------------------------------------------

/**
 * Extract the "module::TypeName" suffix from a full on-chain type string.
 * E.g. "0xabc::vault::VaultDeposit<0x2::sui::SUI>" → "vault::VaultDeposit"
 */
function extractModuleType(fullType: string): string {
    try {
        const tag = parseStructTag(fullType);
        return `${tag.module}::${tag.name}`;
    } catch {
        const base = parseTypeName(fullType).base;
        const parts = base.split("::");
        return parts.length >= 3 ? `${parts[parts.length - 2]}::${parts[parts.length - 1]}` : base;
    }
}

/**
 * Parse a full type name into base type and top-level type args.
 *
 * Handles nested generics, e.g.
 * "0x1::m::T<0x2::a::X<0x3::b::Y>, 0x4::c::Z>"
 */
function parseTypeName(fullType: string): { base: string; typeArgs: string[] } {
    const trimmed = fullType.trim();
    const firstLt = trimmed.indexOf("<");
    if (firstLt < 0 || !trimmed.endsWith(">")) {
        return { base: trimmed, typeArgs: [] };
    }

    let depth = 0;
    let topLt = -1;
    let topGt = -1;

    for (let i = 0; i < trimmed.length; i += 1) {
        const ch = trimmed[i];
        if (ch === "<") {
            if (depth === 0) topLt = i;
            depth += 1;
        } else if (ch === ">") {
            depth -= 1;
            if (depth === 0) topGt = i;
            if (depth < 0) return { base: trimmed, typeArgs: [] };
        }
    }

    if (depth !== 0 || topLt < 0 || topGt !== trimmed.length - 1) {
        return { base: trimmed, typeArgs: [] };
    }

    const inner = trimmed.slice(topLt + 1, topGt);
    const typeArgs: string[] = [];
    let chunkStart = 0;
    depth = 0;

    for (let i = 0; i < inner.length; i += 1) {
        const ch = inner[i];
        if (ch === "<") depth += 1;
        if (ch === ">") depth -= 1;
        if (ch === "," && depth === 0) {
            const chunk = inner.slice(chunkStart, i).trim();
            if (chunk) typeArgs.push(chunk);
            chunkStart = i + 1;
        }
    }

    const tail = inner.slice(chunkStart).trim();
    if (tail) typeArgs.push(tail);

    return { base: trimmed.slice(0, topLt), typeArgs };
}

function extractTypeAddress(fullType: string): string | undefined {
    return parseTypeName(fullType).base.split("::")[0];
}

function normalizeAddressForCompare(address: string | undefined): string | undefined {
    const trimmed = address?.trim().toLowerCase();
    if (!trimmed) return undefined;
    const noPrefix = trimmed.startsWith("0x") ? trimmed.slice(2) : trimmed;
    const noLeadingZeroes = noPrefix.replace(/^0+/, "");
    return noLeadingZeroes || "0";
}

/** Ensure all addresses in a Move type string have `0x` prefix (TypeName stores them without). */
export function normalizeTypeAddresses(typeStr: string): string {
    return typeStr.replace(/\b([0-9a-fA-F]{64})(?=::)/g, "0x$1");
}

/** Extract top-level generic type args from a full type name. */
export function extractTypeArgs(fullType: string): string[] {
    return parseTypeName(fullType).typeArgs;
}

export function isMultisigConfigChangeActionType(actionType: string): boolean {
    if (extractModuleType(actionType) !== CONFIG_CHANGE_ACTION_TYPE) return false;

    const expectedPackage = normalizeAddressForCompare(getSDK().packages.accountMultisig);
    if (!expectedPackage) return true;

    return normalizeAddressForCompare(extractTypeAddress(actionType)) === expectedPackage;
}

const UPGRADE_CAP_OBJECT_TYPE = "0x2::package::UpgradeCap";

function isUpgradeCapProvideAction(fullType: string): boolean {
    return (
        extractModuleType(fullType) === "owned::ProvideObjectToResources" &&
        getActionTypeArg(fullType) === UPGRADE_CAP_OBJECT_TYPE
    );
}

function findExplicitUpgradeCapProviderForLock(actionTypes: string[], lockActionIndex: number): number | null {
    for (let i = lockActionIndex - 1; i >= 0; i -= 1) {
        const modType = extractModuleType(actionTypes[i]);
        if (modType === "package_upgrade::LockUpgradeCap") return null;
        if (isUpgradeCapProvideAction(actionTypes[i])) return i;
    }
    return null;
}

/**
 * Info for mapping on-chain action types to do_* execution calls.
 *
 * Type args for each do_* vary — tracked explicitly:
 *   "COI"  = <Config, Outcome, IW>
 *   "OI"   = <Outcome, IW>
 *   "COCI" = <Config, Outcome, CoinType, IW>
 *   "OCI"  = <Outcome, CoinType, IW>
 */
interface ActionExecInfo {
    /** Target Move module (inside accountActions package) */
    module: string;
    /** Target function name */
    fn: string;
    /** Type arg pattern */
    typeArgPattern: "COI" | "OI" | "COCI" | "OCI";
    /** Whether account object is passed as arg */
    needsAccount: boolean;
    /** Whether PackageRegistry is passed as arg */
    needsRegistry: boolean;
    /** Whether Clock is passed as arg */
    needsClock: boolean;
    /** Type arg kind for COCI/OCI patterns */
    typeArgKind: "none" | "coin" | "object";
    /** Human-readable name for display */
    name: string;
    /** Category for display badge */
    category: string;
}

/**
 * Map from on-chain action_type suffix (marker module::StructName)
 * to execution info. Keys match what type_name::with_original_ids produces.
 *
 * do_* functions live in the lib modules (currency, vault, transfer, etc.),
 * NOT in the init modules.
 */
const ACTION_EXEC_MAP: Record<string, ActionExecInfo> = {
    // --- Currency (lib: currency.move) ---
    // do_init_mint<Outcome, CoinType, IW>(executable, account, registry, witness, ctx)
    "currency::CurrencyMint": {
        module: "currency",
        fn: "do_init_mint",
        typeArgPattern: "OCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Mint",
        category: "currency",
    },
    // do_init_burn<Outcome, CoinType, IW>(executable, account, registry, witness)
    "currency::CurrencyBurn": {
        module: "currency",
        fn: "do_init_burn",
        typeArgPattern: "OCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Burn",
        category: "currency",
    },
    // do_update<Outcome, CoinType, IW>(executable, account, registry, currency, witness) — needs external Currency obj
    "currency::CurrencyUpdate": {
        module: "currency",
        fn: "do_update",
        typeArgPattern: "OCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Update Currency",
        category: "currency",
    },
    // do_init_remove_treasury_cap_to_resources<Config, Outcome, CoinType, IW>
    "currency::RemoveTreasuryCapToResources": {
        module: "currency",
        fn: "do_init_remove_treasury_cap_to_resources",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Remove Treasury Cap To Resources",
        category: "currency",
    },
    // do_init_remove_metadata_cap_to_resources<Config, Outcome, CoinType, IW>
    "currency::RemoveMetadataCapToResources": {
        module: "currency",
        fn: "do_init_remove_metadata_cap_to_resources",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Remove Metadata Cap To Resources",
        category: "currency",
    },
    // do_init_lock_treasury_cap<Config, Outcome, CoinType, IW>(...)
    // TreasuryCap is now supplied from executable_resources via owned::ProvideObjectToResources.
    "currency::LockTreasuryCap": {
        module: "currency",
        fn: "do_init_lock_treasury_cap",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Lock Treasury Cap",
        category: "currency",
    },
    // do_init_lock_metadata_cap<Config, Outcome, CoinType, IW>(...)
    // MetadataCap is now supplied from executable_resources via owned::ProvideObjectToResources.
    "currency::LockMetadataCap": {
        module: "currency",
        fn: "do_init_lock_metadata_cap",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Lock Metadata Cap",
        category: "currency",
    },
    "owned::ProvideObjectToResources": {
        module: "owned",
        fn: "do_provide_object",
        typeArgPattern: "OCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "object",
        name: "Provide Object",
        category: "transfer",
    },

    // --- Owned (lib: owned.move in account_protocol) ---
    // do_withdraw_object<Outcome, T, IW>(executable, account, registry, receiving, witness, ctx)
    "owned::OwnedWithdrawObject": {
        module: "owned",
        fn: "do_withdraw_object",
        typeArgPattern: "OCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "object",
        name: "Withdraw Object",
        category: "transfer",
    },

    // --- Transfer (lib: transfer.move) ---
    // do_init_transfer_coin<Outcome, CoinType, IW>(executable, registry, witness)
    "transfer::TransferCoin": {
        module: "transfer",
        fn: "do_init_transfer_coin",
        typeArgPattern: "OCI",
        needsAccount: false,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Transfer Coin",
        category: "transfer",
    },
    // do_init_transfer_coin_to_sender<Outcome, CoinType, IW>(executable, registry, witness, ctx)
    "transfer::TransferCoinToSender": {
        module: "transfer",
        fn: "do_init_transfer_coin_to_sender",
        typeArgPattern: "OCI",
        needsAccount: false,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Transfer Coin to Sender",
        category: "transfer",
    },
    // do_init_transfer<Outcome, T, IW>(executable, registry, witness) — T is object type, not CoinType
    "transfer::TransferObject": {
        module: "transfer",
        fn: "do_init_transfer",
        typeArgPattern: "OCI",
        needsAccount: false,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "object",
        name: "Transfer Object",
        category: "transfer",
    },
    // do_init_transfer_to_sender<Outcome, T, IW>(executable, registry, witness, ctx)
    "transfer::TransferToSender": {
        module: "transfer",
        fn: "do_init_transfer_to_sender",
        typeArgPattern: "OCI",
        needsAccount: false,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "object",
        name: "Transfer Object to Sender",
        category: "transfer",
    },

    // --- Vault (lib: vault.move) ---
    // do_init_open<Config, Outcome, IW>(executable, account, registry, witness, ctx)
    "vault::VaultOpen": {
        module: "vault",
        fn: "do_init_open",
        typeArgPattern: "COI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Open Vault",
        category: "vault",
    },
    // do_init_close<Config, Outcome, IW>(executable, account, registry, witness)
    "vault::VaultClose": {
        module: "vault",
        fn: "do_init_close",
        typeArgPattern: "COI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Close Vault",
        category: "vault",
    },
    "vault::MintVaultAdminCap": {
        module: "vault",
        fn: "do_mint_vault_admin_cap",
        typeArgPattern: "OI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Mint Vault Admin Cap",
        category: "vault",
    },
    // do_init_deposit<Config, Outcome, CoinType, IW>(executable, account, registry, witness)
    "vault::VaultDeposit": {
        module: "vault",
        fn: "do_init_deposit",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Deposit to Vault",
        category: "vault",
    },
    // do_spend<Config, Outcome, CoinType, IW>(executable, account, registry, witness, ctx)
    "vault::VaultSpend": {
        module: "vault",
        fn: "do_spend",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Spend from Vault",
        category: "vault",
    },
    // do_deposit_external<Config, Outcome, CoinType, IW>(executable, account, registry, coin, witness)
    "vault::VaultDepositExternal": {
        module: "vault",
        fn: "do_deposit_external",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Deposit External",
        category: "vault",
    },
    // do_init_deposit_from_resources<Config, Outcome, CoinType, IW>(executable, account, registry, witness)
    "vault::VaultDepositFromResources": {
        module: "vault",
        fn: "do_init_deposit_from_resources",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Deposit from Resources",
        category: "vault",
    },
    // do_init_deposit_object_from_resources<Config, Outcome, CoinType, IW>(executable, account, registry, witness)
    "vault::VaultDepositObjectFromResources": {
        module: "vault",
        fn: "do_init_deposit_object_from_resources",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Deposit Object from Resources",
        category: "vault",
    },
    // do_approve_coin_type<Config, Outcome, CoinType, IW>(executable, account, registry, witness)
    "vault::VaultApproveCoinType": {
        module: "vault",
        fn: "do_approve_coin_type",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Approve Coin Type",
        category: "vault",
    },
    // do_remove_approved_coin_type<Config, Outcome, CoinType, IW>(executable, account, registry, witness)
    "vault::VaultRemoveApprovedCoinType": {
        module: "vault",
        fn: "do_remove_approved_coin_type",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "coin",
        name: "Remove Approved Coin Type",
        category: "vault",
    },
    // do_cancel_stream<Config, Outcome, CoinType, IW>(executable, account, registry, clock, witness, ctx)
    "vault::CancelStream": {
        module: "vault",
        fn: "do_cancel_stream",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "coin",
        name: "Cancel Payment Stream",
        category: "stream",
    },
    // do_collect_stream<Config, Outcome, CoinType, IW>(executable, account, registry, clock, witness, ctx)
    // StreamCap is supplied from executable_resources via owned::ProvideObjectToResources.
    "vault::CollectStream": {
        module: "vault",
        fn: "do_collect_stream",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "coin",
        name: "Collect Payment Stream",
        category: "stream",
    },

    // --- Stream (do_* lives in vault.move) ---
    // do_init_create_stream<Config, Outcome, CoinType, IW>(executable, account, registry, clock, witness, ctx)
    "vault::CreateStream": {
        module: "vault",
        fn: "do_init_create_stream",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "coin",
        name: "Create Payment Stream",
        category: "stream",
    },

    // --- Vesting (lib: vesting.move) ---
    // do_create_vesting<Config, Outcome, CoinType, IW>(executable, account, registry, clock, witness, ctx)
    "vesting::CreateVesting": {
        module: "vesting",
        fn: "do_create_vesting",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "coin",
        name: "Create Vesting",
        category: "vesting",
    },
    // do_cancel_vesting<Outcome, CoinType, IW>(..., vesting, clock, witness, ctx) — needs external Vesting obj
    "vesting::CancelVesting": {
        module: "vesting",
        fn: "do_cancel_vesting",
        typeArgPattern: "OCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "coin",
        name: "Cancel Vesting",
        category: "vesting",
    },

    // --- Memo (lib: memo.move) ---
    // do_emit_memo<Config, Outcome, IW>(executable, account, registry, witness, clock, ctx)
    "memo::Memo": {
        module: "memo",
        fn: "do_emit_memo",
        typeArgPattern: "COI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "none",
        name: "Emit Memo",
        category: "memo",
    },

    // --- Access Control (lib: access_control.move) ---
    // do_unlock_to_resources<Config, Outcome, Cap, IW>(executable, account, registry, witness)
    "access_control::AccessControlUnlockToResources": {
        module: "access_control",
        fn: "do_unlock_to_resources",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "object",
        name: "Unlock Cap",
        category: "currency",
    },
    "access_control::AccessControlLock": {
        module: "access_control",
        fn: "do_lock",
        typeArgPattern: "COCI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "object",
        name: "Lock Access",
        category: "transfer",
    },

    // --- Package Upgrade (lib: package_upgrade.move) ---
    // do_init_upgrade<Outcome, IW>(executable, account, registry, clock, witness): UpgradeTicket
    "package_upgrade::PackageUpgrade": {
        module: "package_upgrade",
        fn: "do_init_upgrade",
        typeArgPattern: "OI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: true,
        typeArgKind: "none",
        name: "Upgrade Package",
        category: "package",
    },
    // do_init_commit<Outcome, IW>(executable, account, registry, receipt, witness)
    "package_upgrade::PackageCommit": {
        module: "package_upgrade",
        fn: "do_init_commit",
        typeArgPattern: "OI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Commit Upgrade",
        category: "package",
    },
    // do_init_restrict<Outcome, IW>(executable, account, registry, witness)
    "package_upgrade::PackageRestrict": {
        module: "package_upgrade",
        fn: "do_init_restrict",
        typeArgPattern: "OI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Restrict Package",
        category: "package",
    },
    // do_init_lock_upgrade_cap<Outcome, IW>(executable, account, registry, witness)
    // UpgradeCap is now supplied from executable_resources via owned::ProvideObjectToResources.
    "package_upgrade::LockUpgradeCap": {
        module: "package_upgrade",
        fn: "do_init_lock_upgrade_cap",
        typeArgPattern: "OI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Lock UpgradeCap",
        category: "package",
    },
    // do_init_unlock_upgrade_cap<Outcome, IW>(executable, account, registry, witness)
    "package_upgrade::UnlockUpgradeCap": {
        module: "package_upgrade",
        fn: "do_init_unlock_upgrade_cap",
        typeArgPattern: "OI",
        needsAccount: true,
        needsRegistry: true,
        needsClock: false,
        typeArgKind: "none",
        name: "Unlock UpgradeCap",
        category: "package",
    },
};

const UPGRADE_ACTION_TYPE = "package_upgrade::PackageUpgrade";
const COMMIT_ACTION_TYPE = "package_upgrade::PackageCommit";

const OBJECT_INPUT_BY_ACTION_TYPE: Record<string, { label: string; placeholder: string }> = {
    "owned::OwnedWithdrawObject": {
        label: "Object ID to receive",
        placeholder: "0x... (object owned by account)",
    },
    "owned::ProvideObjectToResources": {
        label: "Object ID",
        placeholder: "0x... (wallet-owned object to provide)",
    },
    "currency::CurrencyUpdate": {
        label: "Currency object ID",
        placeholder: "0x... (shared Currency<CoinType>)",
    },
    "vault::VaultDepositExternal": {
        label: "Coin object ID",
        placeholder: "0x... (Coin<CoinType>)",
    },
    "vesting::CancelVesting": {
        label: "Vesting object ID",
        placeholder: "0x... (Vesting<CoinType>)",
    },
    "package_upgrade::LockUpgradeCap": {
        label: "UpgradeCap object ID",
        placeholder: "0x... (UpgradeCap)",
    },
};

function actionNeedsGenericTypeArg(info: ActionExecInfo): boolean {
    return info.typeArgPattern === "COCI" || info.typeArgPattern === "OCI";
}

function getActionTypeArg(fullType: string): string | undefined {
    const first = extractTypeArgs(fullType)[0];
    const trimmed = first?.trim();
    return trimmed ? normalizeTypeAddresses(trimmed) : undefined;
}

function isMissingGenericTypeArg(fullType: string, info: ActionExecInfo): boolean {
    if (!actionNeedsGenericTypeArg(info)) return false;
    return !getActionTypeArg(fullType);
}

export interface ActionExecutionRequirement {
    actionIndex: number;
    actionType: string;
    actionName: string;
    category: string;
    kind: "coinType" | "objectType" | "objectId" | "upgradeArtifacts";
    label: string;
    placeholder?: string;
}

export interface UpgradeExecutionInput {
    packageId: string;
    modules: string[];
    dependencies: string[];
}

export interface BuildActionsExecutionOptions {
    /** Fallback CoinType for actions where type arg is absent from action_type */
    coinType?: string;
    /** Per-action object type fallback (for TransferObject / TransferToSender when generic missing) */
    objectTypeByAction?: Record<number, string>;
    /** Per-action object IDs for actions that take external PTB objects */
    objectIdByAction?: Record<number, string>;
    /** Per-upgrade-action package artifacts required for tx.upgrade */
    upgradeByAction?: Record<number, UpgradeExecutionInput>;
}

/**
 * Get required execution inputs for known actions in this intent.
 */
export function getActionExecutionRequirements(actionTypes: string[]): ActionExecutionRequirement[] {
    const requirements: ActionExecutionRequirement[] = [];

    for (let i = 0; i < actionTypes.length; i += 1) {
        const actionType = actionTypes[i];
        const modType = extractModuleType(actionType);
        const info = ACTION_EXEC_MAP[modType];
        if (!info) continue;

        if (isMissingGenericTypeArg(actionType, info) && info.typeArgKind === "coin") {
            requirements.push({
                actionIndex: i,
                actionType,
                actionName: info.name,
                category: info.category,
                kind: "coinType",
                label: "Coin type",
                placeholder: "0x2::sui::SUI",
            });
        }

        if (isMissingGenericTypeArg(actionType, info) && info.typeArgKind === "object") {
            requirements.push({
                actionIndex: i,
                actionType,
                actionName: info.name,
                category: info.category,
                kind: "objectType",
                label: "Object type",
                placeholder: "0x...::module::Struct",
            });
        }

        const objectReq = OBJECT_INPUT_BY_ACTION_TYPE[modType];
        const needsDirectObjectInput =
            !!objectReq &&
            !(
                modType === "package_upgrade::LockUpgradeCap" &&
                findExplicitUpgradeCapProviderForLock(actionTypes, i) !== null
            );
        if (needsDirectObjectInput) {
            requirements.push({
                actionIndex: i,
                actionType,
                actionName: info.name,
                category: info.category,
                kind: "objectId",
                label: objectReq.label,
                placeholder: objectReq.placeholder,
            });
        }

        if (modType === UPGRADE_ACTION_TYPE) {
            requirements.push({
                actionIndex: i,
                actionType,
                actionName: info.name,
                category: info.category,
                kind: "upgradeArtifacts",
                label: "Upgrade artifacts",
            });
        }
    }

    return requirements;
}

/**
 * Look up action info from an on-chain action_type string.
 * Returns both execution info and human-readable display data.
 */
export function getActionExecInfo(fullType: string): ActionExecInfo | undefined {
    return ACTION_EXEC_MAP[extractModuleType(fullType)];
}

/**
 * Check whether any action in the list requires a CoinType type parameter.
 */
export function actionTypesNeedCoinType(actionTypes: string[]): boolean {
    return getActionExecutionRequirements(actionTypes).some((r) => r.kind === "coinType");
}

/**
 * Detect action sequences that cannot be executed in a single PTB.
 */
export function getUnsupportedActions(actionTypes: string[]): string[] {
    const reasons: string[] = [];

    // Commit consumes an UpgradeReceipt produced by an earlier Upgrade in the same PTB.
    // Track available receipts by sequence position.
    let pendingReceipts = 0;
    for (let i = 0; i < actionTypes.length; i += 1) {
        const actionType = actionTypes[i];
        const modType = extractModuleType(actionType);
        if (isMultisigConfigChangeActionType(actionType)) {
            reasons.push(
                `ConfigChange action (action ${i + 1}) must use the multisig config-change flow, not a generic actions intent`
            );
            continue;
        }
        if (modType === UPGRADE_ACTION_TYPE) {
            pendingReceipts += 1;
            continue;
        }
        if (modType === COMMIT_ACTION_TYPE) {
            if (pendingReceipts === 0) {
                reasons.push(
                    `Commit Upgrade (action ${i + 1}) requires an earlier Upgrade Package action in the same intent`
                );
            } else {
                pendingReceipts -= 1;
            }
        }
    }

    return reasons;
}

/**
 * Build and execute an approved actions intent by dispatching the correct
 * do_* calls for each action type in the intent.
 */
export function buildActionsExecution(
    tx: Transaction,
    accountId: string,
    key: string,
    actionTypes: string[],
    options: BuildActionsExecutionOptions = {}
) {
    const p = pkgs();
    const configType = `${p.multisig}::multisig::MultisigConfig`;
    const outcomeType = `${p.multisig}::multisig::Approvals`;
    const iwType = `${p.multisig}::actions_staging::ActionsIntent`;
    const fallbackCoinType = options.coinType?.trim() || undefined;

    const unsupported = getUnsupportedActions(actionTypes);
    if (unsupported.length > 0) {
        throw new Error(`Intent contains unsupported action sequence: ${unsupported.join("; ")}`);
    }

    executeActionsIntent(tx, accountId, key, (tx, executable, witness) => {
        const upgradeReceipts: MoveCallResult[] = [];

        for (let actionIndex = 0; actionIndex < actionTypes.length; actionIndex += 1) {
            const fullType = actionTypes[actionIndex];
            const modType = extractModuleType(fullType);
            const info = ACTION_EXEC_MAP[modType];
            if (!info) {
                throw new Error(`Unknown action type: ${fullType} (${modType})`);
            }

            // Build type arguments based on pattern
            const typeArgFromAction = getActionTypeArg(fullType);
            const fallbackObjectType = options.objectTypeByAction?.[actionIndex]?.trim() || undefined;
            const resolvedTypeArg =
                typeArgFromAction ||
                (info.typeArgKind === "coin" ? fallbackCoinType : undefined) ||
                (info.typeArgKind === "object" ? fallbackObjectType : undefined);

            let typeArguments: string[];
            switch (info.typeArgPattern) {
                case "COI":
                    typeArguments = [configType, outcomeType, iwType];
                    break;
                case "OI":
                    typeArguments = [outcomeType, iwType];
                    break;
                case "COCI":
                    if (!resolvedTypeArg) {
                        throw new Error(
                            `Action ${info.name} requires a type argument (coin/object) but none was provided`
                        );
                    }
                    typeArguments = [configType, outcomeType, resolvedTypeArg, iwType];
                    break;
                case "OCI":
                    if (!resolvedTypeArg) {
                        throw new Error(
                            `Action ${info.name} requires a type argument (coin/object) but none was provided`
                        );
                    }
                    typeArguments = [outcomeType, resolvedTypeArg, iwType];
                    break;
            }

            // Build arguments: executable is always first, witness is always last
            const args: MoveCallArgs = [executable];
            if (info.needsAccount) args.push(tx.object(accountId));
            if (info.needsRegistry) args.push(tx.object(p.registryId));

            // Special actions with external PTB args or upgrade/commit chaining
            if (modType === "owned::OwnedWithdrawObject") {
                // do_withdraw_object lives in account_protocol (not actions!)
                // Signature: (executable, account, registry, receiving, witness, ctx)
                const objectId = options.objectIdByAction?.[actionIndex]?.trim();
                if (!objectId)
                    throw new Error(`Action ${info.name} requires ${OBJECT_INPUT_BY_ACTION_TYPE[modType].label}`);
                args.push(tx.object(objectId)); // Receiving<T>
                args.push(witness);
                tx.moveCall({
                    target: `${p.protocol}::owned::do_withdraw_object`,
                    typeArguments,
                    arguments: args,
                });
                continue;
            } else if (modType === "owned::ProvideObjectToResources") {
                const objectId = options.objectIdByAction?.[actionIndex]?.trim();
                if (!objectId)
                    throw new Error(`Action ${info.name} requires ${OBJECT_INPUT_BY_ACTION_TYPE[modType].label}`);
                args.push(witness);
                tx.moveCall({
                    target: `${p.protocol}::owned::do_provide_object`,
                    typeArguments,
                    arguments: [...args, tx.object(objectId)],
                });
                continue;
            } else if (modType === "currency::CurrencyUpdate") {
                const objectId = options.objectIdByAction?.[actionIndex]?.trim();
                if (!objectId)
                    throw new Error(`Action ${info.name} requires ${OBJECT_INPUT_BY_ACTION_TYPE[modType].label}`);
                args.push(tx.object(objectId));
                args.push(witness);
            } else if (modType === "package_upgrade::LockUpgradeCap") {
                const explicitProviderIndex = findExplicitUpgradeCapProviderForLock(actionTypes, actionIndex);
                if (explicitProviderIndex === null) {
                    const objectId = options.objectIdByAction?.[actionIndex]?.trim();
                    if (!objectId)
                        throw new Error(`Action ${info.name} requires ${OBJECT_INPUT_BY_ACTION_TYPE[modType].label}`);
                    tx.moveCall({
                        target: `${p.protocol}::owned::do_provide_object`,
                        typeArguments: [outcomeType, UPGRADE_CAP_OBJECT_TYPE, iwType],
                        arguments: [...args, witness, tx.object(objectId)],
                    });
                }
                tx.moveCall({
                    target: `${p.actions}::${info.module}::${info.fn}`,
                    typeArguments,
                    arguments: [...args, witness],
                });
                continue;
            } else if (modType === "vault::VaultDepositExternal") {
                const objectId = options.objectIdByAction?.[actionIndex]?.trim();
                if (!objectId)
                    throw new Error(`Action ${info.name} requires ${OBJECT_INPUT_BY_ACTION_TYPE[modType].label}`);
                args.push(tx.object(objectId));
                args.push(witness);
            } else if (modType === "vesting::CancelVesting") {
                const objectId = options.objectIdByAction?.[actionIndex]?.trim();
                if (!objectId)
                    throw new Error(`Action ${info.name} requires ${OBJECT_INPUT_BY_ACTION_TYPE[modType].label}`);
                args.push(tx.object(objectId));
                args.push(tx.object(CLOCK));
                args.push(witness);
            } else if (modType === UPGRADE_ACTION_TYPE) {
                const upgrade = options.upgradeByAction?.[actionIndex];
                if (!upgrade?.packageId?.trim()) throw new Error(`Action ${info.name} requires upgrade package ID`);
                if (!upgrade.modules?.length) throw new Error(`Action ${info.name} requires upgrade modules`);
                if (!upgrade.dependencies?.length) throw new Error(`Action ${info.name} requires upgrade dependencies`);

                const ticket = tx.moveCall({
                    target: `${p.actions}::${info.module}::${info.fn}`,
                    typeArguments,
                    arguments: [...args, tx.object(CLOCK), witness],
                });

                const receipt = tx.upgrade({
                    package: upgrade.packageId.trim(),
                    modules: upgrade.modules,
                    dependencies: upgrade.dependencies,
                    ticket,
                });
                upgradeReceipts.push(receipt);
                continue;
            } else if (modType === COMMIT_ACTION_TYPE) {
                if (upgradeReceipts.length === 0) {
                    throw new Error(
                        `Action ${info.name} requires an earlier Upgrade Package action in the same intent`
                    );
                }
                const receipt = upgradeReceipts.shift()!;
                args.push(receipt);
                args.push(witness);
            } else if (modType === "memo::Memo") {
                // do_emit_memo signature: (executable, account, registry, witness, clock, ctx)
                // witness comes BEFORE clock, unlike other actions
                args.push(witness);
                args.push(tx.object(CLOCK));
            } else {
                if (info.needsClock) args.push(tx.object(CLOCK));
                args.push(witness);
            }

            tx.moveCall({
                target: `${p.actions}::${info.module}::${info.fn}`,
                typeArguments,
                arguments: args,
            });
        }
    });
}
