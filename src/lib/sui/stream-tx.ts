import type { SuiClient } from "@govex/futarchy-sdk";
import { Transaction } from "@mysten/sui/transactions";
import { SUI_CLOCK_OBJECT_ID } from "@mysten/sui/utils";
import type { VaultStreamInfo } from "@govex/futarchy-sdk/multisig/reads";
import { getAllDynamicFields } from "@govex/futarchy-sdk/utils";
import { getSDK } from "@/lib/sdk";

async function resolveAccountConfigType(client: SuiClient, accountId: string): Promise<string> {
    const sdk = getSDK();
    const fields = await getAllDynamicFields(client, accountId);
    const configField = fields.find((field) => {
        const objectType = field.objectType ?? "";
        const nameType = (field.name as { type?: string } | undefined)?.type ?? "";
        return (
            nameType.includes("ConfigKey") &&
            !nameType.includes("Proposed") &&
            !nameType.includes("ManagedData") &&
            (objectType.includes("::multisig::MultisigConfig") ||
                objectType.includes("::futarchy_config::FutarchyConfig"))
        );
    });

    const objectType = configField?.objectType ?? "";
    if (objectType.includes("::multisig::MultisigConfig")) {
        const multisigPackage = sdk.packages.accountMultisig;
        if (!multisigPackage) throw new Error("accountMultisig package not configured");
        return `${multisigPackage}::multisig::MultisigConfig`;
    }

    if (objectType.includes("::futarchy_config::FutarchyConfig")) {
        return `${sdk.packages.futarchyCore}::futarchy_config::FutarchyConfig`;
    }

    throw new Error("Could not resolve account config type for this stream");
}

export async function buildCollectStreamTransaction(
    client: SuiClient,
    stream: VaultStreamInfo,
    recipient: string
): Promise<Transaction> {
    if (!stream.capId) throw new Error("StreamCap is required to collect this stream");
    if (!stream.accountId) throw new Error("Account ID is required to collect this stream");
    if (!stream.coinType || stream.coinType === "unknown")
        throw new Error("Coin type is required to collect this stream");

    const sdk = getSDK();
    const configType = await resolveAccountConfigType(client, stream.accountId);
    const tx = new Transaction();

    const coin = tx.moveCall({
        target: `${sdk.packages.accountActions}::vault::collect_stream`,
        typeArguments: [configType, stream.coinType],
        arguments: [
            tx.object(stream.accountId),
            tx.object(sdk.sharedObjects.packageRegistry.id),
            tx.object(stream.capId),
            tx.pure.u64(0),
            tx.object(SUI_CLOCK_OBJECT_ID),
        ],
    });

    tx.transferObjects([coin], tx.pure.address(recipient));
    return tx;
}
