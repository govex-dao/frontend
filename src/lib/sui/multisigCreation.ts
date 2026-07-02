import type { FutarchySDK } from "@govex/futarchy-sdk";
import { bcs } from "@mysten/sui/bcs";
import type { SuiClient } from "@mysten/sui/client";
import { Transaction, type TransactionObjectArgument } from "@mysten/sui/transactions";
import { flattenMultisigConfigInput, type SimpleMultisigConfigInput } from "./multisigConfigValidation";

const SUI_COIN_TYPE = "0x2::sui::SUI";

function parseU64Field(value: unknown, fieldName: string): bigint {
    if (typeof value === "bigint") return value;
    if (typeof value === "number" && Number.isInteger(value) && value >= 0) return BigInt(value);
    if (typeof value === "string" && /^\d+$/.test(value)) return BigInt(value);
    throw new Error(`Invalid ${fieldName} on multisig fee vault`);
}

function getMoveObjectFields(content: unknown): Record<string, unknown> | null {
    if (!content || typeof content !== "object") return null;
    const data = content as { dataType?: unknown; fields?: unknown };
    if (data.dataType !== "moveObject" || !data.fields || typeof data.fields !== "object") return null;
    return data.fields as Record<string, unknown>;
}

export async function fetchMultisigCreationFeeMist(sdk: FutarchySDK, client: SuiClient): Promise<bigint> {
    const feeVaultId = sdk.sharedObjects.multisigFeeVault?.id;
    if (!feeVaultId) throw new Error("multisig fee vault is not configured");

    const result = await client.getObject({
        id: feeVaultId,
        options: { showContent: true },
    });
    const fields = getMoveObjectFields(result.data?.content);
    if (!fields || !("creation_fee" in fields)) {
        throw new Error("could not read multisig creation fee");
    }

    return parseU64Field(fields.creation_fee, "creation_fee");
}

export function formatSuiFee(mist: bigint | null): string {
    if (mist === null) return "Loading...";
    if (mist === 0n) return "Free";

    const decimals = 1_000_000_000n;
    const whole = mist / decimals;
    const fraction = mist % decimals;
    if (fraction === 0n) return `${whole.toString()} SUI`;

    const trimmedFraction = fraction.toString().padStart(9, "0").replace(/0+$/, "");
    return `${whole.toString()}.${trimmedFraction} SUI`;
}

export function appendCreateMultisigAccount(
    tx: Transaction,
    sdk: FutarchySDK,
    params: {
        configInput: SimpleMultisigConfigInput;
        metadata?: Record<string, string>;
        treasuryCoinType: string;
        paymentCoin?: TransactionObjectArgument;
    }
): Transaction {
    const pkg = sdk.packages.accountMultisig;
    const actionsPackage = sdk.packages.accountActions;
    const feeVault = sdk.sharedObjects.multisigFeeVault;
    const registryId = sdk.sharedObjects.packageRegistry.id;

    if (!pkg) throw new Error("accountMultisig package not configured");
    if (!actionsPackage) throw new Error("accountActions package not configured");
    if (!feeVault) throw new Error("multisigFeeVault shared object not configured");

    const keys = Object.keys(params.metadata ?? {});
    const values = Object.values(params.metadata ?? {});
    const configArgs = flattenMultisigConfigInput(params.configInput);
    const paymentCoin =
        params.paymentCoin ??
        tx.moveCall({
            target: "0x2::coin::zero",
            typeArguments: [SUI_COIN_TYPE],
            arguments: [],
        });

    const accountObject = tx.moveCall({
        target: `${pkg}::multisig::new_account`,
        arguments: [
            tx.object(feeVault.id),
            tx.object(registryId),
            paymentCoin,
            tx.pure.vector("string", keys),
            tx.pure.vector("string", values),
            tx.pure.vector("string", configArgs.groupNames),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.groupMemberCounts).toBytes()),
            tx.pure(bcs.vector(bcs.Address).serialize(configArgs.allMemberAddresses).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allMemberWeights).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.timeBandCounts).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allTimeBandAfters).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allTimeBandWeights).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.approvePathReqCounts).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allApproveGroupIndices).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allApproveThresholds).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.cancelPathReqCounts).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allCancelGroupIndices).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.allCancelThresholds).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.proposeGroups).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.executeGroups).toBytes()),
            tx.pure(bcs.vector(bcs.u64()).serialize(configArgs.cancelGroups).toBytes()),
            tx.pure.u64(configArgs.intentExpiryMs),
        ],
    });

    tx.moveCall({
        target: `${actionsPackage}::vault::init_treasury_vault_with_coin_type`,
        typeArguments: [params.treasuryCoinType],
        arguments: [accountObject, tx.object(registryId)],
    });

    tx.moveCall({
        target: `${pkg}::multisig::share`,
        arguments: [accountObject],
    });

    return tx;
}
