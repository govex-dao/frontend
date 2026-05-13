import { bcs } from "@mysten/sui/bcs";
import type { ActionData } from "@/types/Proposal";

export interface DecodedActionParam {
    name: string;
    type: string;
    value: string;
}

export interface DecodedActionParams {
    actionName: string;
    params: DecodedActionParam[];
    error?: string;
}

interface ActionParamDef {
    name: string;
    type: string;
}

interface ActionDataSchema {
    actionName: string;
    suffixes: string[];
    params: ActionParamDef[];
}

const ACTION_DATA_SCHEMAS: ActionDataSchema[] = [
    {
        actionName: "MetadataUpdate",
        suffixes: ["::config_actions::MetadataUpdate"],
        params: [
            { name: "daoName", type: "option<string>" },
            { name: "iconUrl", type: "option<string>" },
            { name: "description", type: "option<string>" },
        ],
    },
    {
        actionName: "TradingParamsUpdate",
        suffixes: ["::config_actions::TradingParamsUpdate"],
        params: [
            { name: "minAssetAmount", type: "option<u64>" },
            { name: "minStableAmount", type: "option<u64>" },
            { name: "reviewPeriodMs", type: "option<u64>" },
            { name: "tradingPeriodMs", type: "option<u64>" },
            { name: "ammTotalFeeBps", type: "option<u64>" },
            { name: "conditionalLiquidityRatioPercent", type: "option<u64>" },
        ],
    },
    {
        actionName: "TwapConfigUpdate",
        suffixes: ["::config_actions::TwapConfigUpdate"],
        params: [
            { name: "startDelay", type: "option<u64>" },
            { name: "capPpm", type: "option<u64>" },
            { name: "initialObservation", type: "option<u128>" },
            { name: "threshold", type: "option<u128>" },
            { name: "sponsoredThreshold", type: "option<u128>" },
        ],
    },
    {
        actionName: "VaultSpend",
        suffixes: ["::vault::VaultSpend"],
        params: [
            { name: "vaultName", type: "string" },
            { name: "amount", type: "u64" },
            { name: "spendAll", type: "bool" },
            { name: "resourceName", type: "string" },
        ],
    },
    {
        actionName: "TransferCoin",
        suffixes: ["::transfer::TransferCoin"],
        params: [
            { name: "recipient", type: "address" },
            { name: "resourceName", type: "string" },
        ],
    },
    {
        actionName: "CreateStream",
        suffixes: ["::vault::CreateStream"],
        params: [
            { name: "vaultName", type: "string" },
            { name: "beneficiary", type: "address" },
            { name: "amountPerIteration", type: "u64" },
            { name: "startTime", type: "option<u64>" },
            { name: "iterationsTotal", type: "u64" },
            { name: "iterationPeriodMs", type: "u64" },
            { name: "claimWindowMs", type: "option<u64>" },
            { name: "expiryMs", type: "option<u64>" },
            { name: "whitelistedRecipients", type: "vector<address>" },
        ],
    },
];

function hexToBytes(value: string): Uint8Array {
    const normalized = value.startsWith("0x") ? value.slice(2) : value;
    if (normalized.length % 2 !== 0 || !/^[0-9a-fA-F]*$/.test(normalized)) {
        throw new Error("invalid hex actionData");
    }

    const bytes = new Uint8Array(normalized.length / 2);
    for (let i = 0; i < normalized.length; i += 2) {
        bytes[i / 2] = parseInt(normalized.slice(i, i + 2), 16);
    }
    return bytes;
}

function bcsTypeForParam(type: string) {
    switch (type) {
        case "address":
            return bcs.Address;
        case "bool":
            return bcs.bool();
        case "string":
            return bcs.string();
        case "u64":
            return bcs.u64();
        case "u128":
            return bcs.u128();
        case "option<string>":
            return bcs.option(bcs.string());
        case "option<u64>":
            return bcs.option(bcs.u64());
        case "option<u128>":
            return bcs.option(bcs.u128());
        case "vector<address>":
            return bcs.vector(bcs.Address);
        default:
            throw new Error(`unsupported BCS param type '${type}'`);
    }
}

function normalizeValue(value: unknown): unknown {
    if (typeof value === "bigint") return value.toString();
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(Object.entries(value).map(([key, nested]) => [key, normalizeValue(nested)]));
    }
    return value;
}

function formatValue(value: unknown): string {
    const normalized = normalizeValue(value);
    if (normalized == null) return "none";
    if (typeof normalized === "string") return normalized;
    if (typeof normalized === "number" || typeof normalized === "boolean") return String(normalized);
    return JSON.stringify(normalized);
}

function schemaMatches(schema: ActionDataSchema, action: ActionData): boolean {
    const cleanFullType = action.fullType?.split("<")[0] ?? "";
    return (
        schema.actionName === action.actionType ||
        schema.suffixes.some((suffix) => cleanFullType.endsWith(suffix) || action.fullType?.includes(suffix))
    );
}

export function decodeActionParams(action: ActionData): DecodedActionParams | null {
    const schema = ACTION_DATA_SCHEMAS.find((candidate) => schemaMatches(candidate, action));
    if (!schema || !action.actionData) return null;

    try {
        const fields = Object.fromEntries(schema.params.map((param) => [param.name, bcsTypeForParam(param.type)]));

        const parsed = bcs.struct(`${schema.actionName}ActionData`, fields).parse(hexToBytes(action.actionData));
        return {
            actionName: schema.actionName,
            params: schema.params.map((param) => ({
                ...param,
                value: formatValue(parsed[param.name]),
            })),
        };
    } catch (error) {
        return {
            actionName: schema.actionName,
            params: [],
            error: error instanceof Error ? error.message : String(error),
        };
    }
}
