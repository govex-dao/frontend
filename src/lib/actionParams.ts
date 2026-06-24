import { bcs } from "@mysten/sui/bcs";
import { ALL_ACTIONS, getActionByFullType, type ActionDefinition, type ParamType } from "@govex/futarchy-sdk";
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
    type: ParamType | string;
}

interface ActionDataSchema {
    actionName: string;
    displayName?: string;
    definition?: ActionDefinition;
    suffixes: string[];
    params: ActionParamDef[];
}

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

const BcsRecipientMint = bcs.struct("RecipientMint", {
    recipient: bcs.Address,
    amount: bcs.u64(),
});

const BcsTierSpec = bcs.struct("TierSpec", {
    price_threshold: bcs.u128(),
    is_above: bcs.bool(),
    recipients: bcs.vector(BcsRecipientMint),
    tier_description: bcs.string(),
});

const BcsUrl = bcs.struct("Url", {
    url: bcs.string(),
});

const BcsConditionalMetadata = bcs.struct("ConditionalMetadata", {
    decimals: bcs.u8(),
    coin_name_prefix: bcs.string(),
    coin_icon_url: BcsUrl,
});

const BcsLockTreasuryCapAction = bcs.struct("LockTreasuryCapAction", {
    has_max_supply: bcs.bool(),
    max_supply: bcs.u64(),
    can_mint: bcs.bool(),
    can_burn: bcs.bool(),
    can_update_name: bcs.bool(),
    can_update_description: bcs.bool(),
    can_update_icon: bcs.bool(),
    resource_name: bcs.string(),
});

function bcsTypeForParam(type: string) {
    switch (type) {
        case "u8":
            return bcs.u8();
        case "address":
        case "id":
            return bcs.Address;
        case "bool":
            return bcs.bool();
        case "string":
            return bcs.string();
        case "u64":
            return bcs.u64();
        case "u128":
            return bcs.u128();
        case "vector<u8>":
            return bcs.vector(bcs.u8());
        case "vector<string>":
            return bcs.vector(bcs.string());
        case "vector<address>":
            return bcs.vector(bcs.Address);
        case "option<u8>":
            return bcs.option(bcs.u8());
        case "option<string>":
            return bcs.option(bcs.string());
        case "option<u64>":
            return bcs.option(bcs.u64());
        case "option<u128>":
            return bcs.option(bcs.u128());
        case "option<bool>":
            return bcs.option(bcs.bool());
        case "option<vector<u8>>":
            return bcs.option(bcs.vector(bcs.u8()));
        case "tier_specs":
            return bcs.vector(BcsTierSpec);
        case "conditional_metadata":
            return bcs.option(bcs.option(BcsConditionalMetadata));
        default:
            throw new Error(`unsupported BCS param type '${type}'`);
    }
}

function toCamelCaseKey(key: string): string {
    return key.replace(/_([a-z])/g, (_match, char: string) => char.toUpperCase());
}

function normalizeValue(value: unknown): unknown {
    if (typeof value === "bigint") return value.toString();
    if (value instanceof Uint8Array) return Array.from(value);
    if (Array.isArray(value)) return value.map(normalizeValue);
    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value).map(([key, nested]) => [toCamelCaseKey(key), normalizeValue(nested)])
        );
    }
    return value;
}

function isByteArray(value: unknown): value is number[] {
    return (
        Array.isArray(value) &&
        value.every((item) => Number.isInteger(item) && Number(item) >= 0 && Number(item) <= 255)
    );
}

function bytesToHex(bytes: number[]): string {
    return `0x${bytes.map((byte) => byte.toString(16).padStart(2, "0")).join("")}`;
}

function bytesToDisplay(bytes: number[]): string {
    const hex = bytesToHex(bytes);
    try {
        const text = new TextDecoder("utf-8", { fatal: true }).decode(new Uint8Array(bytes));
        if (/^[\x20-\x7E]*$/.test(text) && text.length > 0) return `${text} (${hex})`;
    } catch {
        // Fall through to hex for non-UTF8 payloads.
    }
    return hex;
}

function formatValue(value: unknown): string {
    const normalized = normalizeValue(value);
    if (normalized == null) return "none";
    if (typeof normalized === "string") return normalized;
    if (typeof normalized === "number" || typeof normalized === "boolean") return String(normalized);
    if (isByteArray(normalized)) return bytesToDisplay(normalized);
    return JSON.stringify(normalized);
}

function extractShortMoveType(type: string | undefined): string {
    if (!type) return "";
    const withoutTypeArgs = type.split("<")[0] || type;
    const parts = withoutTypeArgs.split("::");
    return parts[parts.length - 1] || withoutTypeArgs;
}

function markerSuffix(definition: ActionDefinition): string {
    const parts = definition.markerType.split("::");
    return `::${parts.slice(-2).join("::")}`;
}

function schemaFromDefinition(definition: ActionDefinition): ActionDataSchema {
    return {
        actionName: extractShortMoveType(definition.markerType) || definition.id,
        displayName: definition.name,
        definition,
        suffixes: [markerSuffix(definition)],
        params: definition.params.map(({ name, type }) => ({ name, type })),
    };
}

function findActionDefinition(action: ActionData): ActionDefinition | undefined {
    if (action.fullType) {
        const byFullType = getActionByFullType(action.fullType);
        if (byFullType) return byFullType;
    }

    const rawCandidates = [
        action.actionType,
        action.displayName,
        extractShortMoveType(action.fullType),
        action.fullType?.split("<")[0],
    ].filter((value): value is string => Boolean(value));

    const normalizedCandidates = rawCandidates.map((value) => value.toLowerCase().replace(/[\s_-]/g, ""));

    return ALL_ACTIONS.find((definition) => {
        const markerShort = extractShortMoveType(definition.markerType);
        const values = [definition.id, definition.name, markerShort, definition.markerType, markerSuffix(definition)];
        return values.some((value) => {
            const normalized = value.toLowerCase().replace(/[\s_-]/g, "");
            return (
                normalizedCandidates.includes(normalized) ||
                rawCandidates.some((candidate) => candidate.endsWith(value))
            );
        });
    });
}

function findActionSchema(action: ActionData): ActionDataSchema | null {
    const definition = findActionDefinition(action);
    if (definition) return schemaFromDefinition(definition);
    return null;
}

function decodeSpecialAction(schema: ActionDataSchema, bytes: Uint8Array): Record<string, unknown> | null {
    if (schema.definition?.id !== "lock_treasury_cap") return null;

    const parsed = BcsLockTreasuryCapAction.parse(bytes);
    return {
        maxSupply: parsed.has_max_supply ? normalizeValue(parsed.max_supply) : null,
        canMint: parsed.can_mint,
        canBurn: parsed.can_burn,
        canUpdateName: parsed.can_update_name,
        canUpdateDescription: parsed.can_update_description,
        canUpdateIcon: parsed.can_update_icon,
        resourceName: parsed.resource_name,
    };
}

export function decodeActionParams(action: ActionData): DecodedActionParams | null {
    const schema = findActionSchema(action);
    if (!schema || !action.actionData) return null;

    try {
        const bytes = hexToBytes(action.actionData);
        const parsed =
            decodeSpecialAction(schema, bytes) ??
            bcs
                .struct(
                    `${schema.definition?.id || schema.actionName}ActionData`,
                    Object.fromEntries(schema.params.map((param) => [param.name, bcsTypeForParam(param.type)]))
                )
                .parse(bytes);

        return {
            actionName: schema.displayName || schema.actionName,
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
