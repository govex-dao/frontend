/**
 * Coin Bytecode Modifier
 *
 * This utility modifies pre-compiled coin template bytecode to create
 * custom coins without needing backend compilation.
 */

import { bcs } from "@mysten/sui/bcs";
import { fromB64, toB64 } from "@mysten/sui/utils";
import init, { update_constants, update_identifiers } from "@mysten/move-bytecode-template";
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore - Vite ?url import for WASM
import wasmUrl from "@mysten/move-bytecode-template/web/move_bytecode_template_bg.wasm?url";
import { COIN_TEMPLATE_BYTECODE, COIN_TEMPLATE_DEPENDENCIES, TEMPLATE_DEFAULTS } from "./coinTemplate";

// Track WASM initialization
let wasmInitialized = false;
let wasmInitPromise: Promise<void> | null = null;

// Enable debug logging in development
const DEBUG = import.meta.env.DEV;

function debugLog(message: string, details?: unknown) {
    if (!DEBUG) return;
    if (details === undefined) {
        console.warn(message);
        return;
    }
    console.warn(message, details);
}

/**
 * Initialize the WASM module (call once before using bytecode functions)
 */
async function ensureWasmInitialized(): Promise<void> {
    if (wasmInitialized) return;

    if (!wasmInitPromise) {
        wasmInitPromise = (async () => {
            try {
                debugLog("[Bytecode] Initializing WASM...");
                await init({ module_or_path: wasmUrl });
                wasmInitialized = true;
                debugLog("[Bytecode] WASM initialized");
            } catch (error) {
                console.error("[Bytecode] WASM init failed:", error);
                wasmInitPromise = null; // Allow retry
                throw error;
            }
        })();
    }

    await wasmInitPromise;
}

export interface CoinParameters {
    coinName: string;
    coinSymbol: string;
    decimals: number;
    description: string;
    iconUrl?: string;
}

export interface ModifiedCoinBytecode {
    modules: string[];
    dependencies: string[];
    moduleName: string;
}

/**
 * Derives a valid Move module name from a coin name
 */
function deriveModuleName(coinName: string): string {
    let name = coinName
        .toLowerCase()
        .replace(/[^a-z0-9]/g, "_")
        .replace(/_{2,}/g, "_") // Replace multiple underscores with single
        .replace(/^_|_$/g, ""); // Remove leading/trailing underscores
    // Ensure it doesn't start with a number (after trimming)
    if (/^[0-9]/.test(name)) {
        name = "c_" + name;
    }
    return name || "coin";
}

/**
 * Derives the struct name (uppercase module name for one-time witness)
 */
function deriveStructName(moduleName: string): string {
    return moduleName.toUpperCase();
}

/**
 * Modifies the template bytecode with custom coin parameters
 *
 * This function:
 * 1. Initializes WASM module if needed
 * 2. Updates constant values (decimals, symbol, name, description, iconUrl)
 * 3. Updates module and struct identifiers
 * 4. Returns the modified bytecode ready for deployment
 */
export async function modifyCoinBytecode(params: CoinParameters): Promise<ModifiedCoinBytecode> {
    // Ensure WASM is initialized
    await ensureWasmInitialized();

    // Derive module and struct names
    const moduleName = deriveModuleName(params.coinName);
    const structName = deriveStructName(moduleName);

    debugLog("[Bytecode] Modifying:", { coinName: params.coinName, moduleName, structName });

    // Decode the template bytecode from base64
    // Using 'as Uint8Array' to fix type compatibility with update_constants
    let bytecode: Uint8Array = fromB64(COIN_TEMPLATE_BYTECODE) as Uint8Array;

    // Helper to serialize BCS values to bytes
    const serializeBytes = (value: { toBytes: () => Uint8Array }): Uint8Array =>
        new Uint8Array(value.toBytes()) as Uint8Array;

    // Step 1: Update DECIMALS constant (u8)
    bytecode = update_constants(
        bytecode,
        serializeBytes(bcs.u8().serialize(params.decimals)),
        serializeBytes(bcs.u8().serialize(TEMPLATE_DEFAULTS.decimals)),
        "U8"
    ) as Uint8Array;

    // Step 2: Update SYMBOL constant (vector<u8>)
    bytecode = update_constants(
        bytecode,
        serializeBytes(bcs.string().serialize(params.coinSymbol)),
        serializeBytes(bcs.string().serialize(TEMPLATE_DEFAULTS.symbol)),
        "Vector(U8)"
    ) as Uint8Array;

    // Step 3: Update NAME constant (vector<u8>)
    bytecode = update_constants(
        bytecode,
        serializeBytes(bcs.string().serialize(params.coinName)),
        serializeBytes(bcs.string().serialize(TEMPLATE_DEFAULTS.name)),
        "Vector(U8)"
    ) as Uint8Array;

    // Step 4: Update DESCRIPTION constant (vector<u8>)
    bytecode = update_constants(
        bytecode,
        serializeBytes(bcs.string().serialize(params.description)),
        serializeBytes(bcs.string().serialize(TEMPLATE_DEFAULTS.description)),
        "Vector(U8)"
    ) as Uint8Array;

    // Step 5: Update ICON_URL constant (vector<u8>)
    const iconUrl = params.iconUrl || "";
    bytecode = update_constants(
        bytecode,
        serializeBytes(bcs.string().serialize(iconUrl)),
        serializeBytes(bcs.string().serialize(TEMPLATE_DEFAULTS.iconUrl)),
        "Vector(U8)"
    ) as Uint8Array;

    // Step 6: Update module and struct identifiers
    bytecode = update_identifiers(bytecode, {
        [TEMPLATE_DEFAULTS.moduleName]: moduleName,
        [TEMPLATE_DEFAULTS.structName]: structName,
    }) as Uint8Array;

    // Encode the modified bytecode back to base64
    const modifiedBytecodeB64 = toB64(bytecode);

    debugLog("[Bytecode] Modification complete");

    return {
        modules: [modifiedBytecodeB64],
        dependencies: COIN_TEMPLATE_DEPENDENCIES,
        moduleName,
    };
}

/**
 * Validates coin parameters before modification
 */
export function validateCoinParameters(params: CoinParameters): { valid: boolean; error?: string } {
    if (!params.coinName || params.coinName.trim().length === 0) {
        return { valid: false, error: "Coin name is required" };
    }

    if (params.coinName.length > 50) {
        return { valid: false, error: "Coin name must be 50 characters or less" };
    }

    if (!params.coinSymbol || params.coinSymbol.trim().length === 0) {
        return { valid: false, error: "Coin symbol is required" };
    }

    if (params.coinSymbol.length > 10) {
        return { valid: false, error: "Coin symbol must be 10 characters or less" };
    }

    if (!/^[A-Z0-9]+$/.test(params.coinSymbol)) {
        return { valid: false, error: "Coin symbol must contain only uppercase letters and numbers" };
    }

    if (params.decimals < 0 || params.decimals > 18 || !Number.isInteger(params.decimals)) {
        return { valid: false, error: "Decimals must be an integer between 0 and 18" };
    }

    if (!params.description || params.description.trim().length === 0) {
        return { valid: false, error: "Description is required" };
    }

    if (params.description.length > 500) {
        return { valid: false, error: "Description must be 500 characters or less" };
    }

    if (params.iconUrl && params.iconUrl.length > 500) {
        return { valid: false, error: "Icon URL must be 500 characters or less" };
    }

    if (params.iconUrl && !params.iconUrl.match(/^https?:\/\/.+/)) {
        return { valid: false, error: "Icon URL must be a valid HTTP or HTTPS URL" };
    }

    return { valid: true };
}
