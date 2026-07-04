/**
 * FutarchySDK singleton for the frontend
 *
 * Usage:
 * ```typescript
 * import { sdk } from '@/lib/sdk';
 *
 * // Transaction building
 * const tx = sdk.proposal.conditionalSwap({...});
 *
 * // Onchain queries
 * const balances = await sdk.utils.queryHelper.getProposalBalances(...);
 * ```
 */

import { FutarchySDK } from "@govex/futarchy-sdk";
import type { DAO, Proposal } from "@/types";
import { network, rpcUrl } from "./config";

const sdkInstances = new Map<string, FutarchySDK>();

function normalizeProtocolVersion(version?: string | null): string | undefined {
    const normalized = version?.trim().toLowerCase();
    if (!normalized) return undefined;
    return normalized.startsWith("v") ? normalized : `v${normalized}`;
}

function getProtocolVersion(version?: string | null): string | undefined {
    return normalizeProtocolVersion(version);
}

function assertSupportedProtocolVersion(protocolVersion?: string | null): void {
    const normalizedVersion = normalizeProtocolVersion(protocolVersion);
    if (normalizedVersion && normalizedVersion !== "v3") {
        throw new Error(`Unsupported Govex protocol version: ${normalizedVersion}. This frontend supports v3 only.`);
    }
}

function createSDK(): FutarchySDK {
    return new FutarchySDK({
        network,
        rpcUrl,
    });
}

/**
 * Get the FutarchySDK singleton instance
 * Lazily initialized on first access
 */
export function getSDK(): FutarchySDK {
    return getSDKForProtocolVersion();
}

export function getSDKForProtocolVersion(protocolVersion?: string | null): FutarchySDK {
    assertSupportedProtocolVersion(protocolVersion);

    const cacheKey = `${network}:${rpcUrl}:current`;
    let sdkInstance = sdkInstances.get(cacheKey);
    if (!sdkInstance) {
        sdkInstance = createSDK();
        sdkInstances.set(cacheKey, sdkInstance);
    }
    return sdkInstance;
}

export function getProtocolVersionForDAO(dao?: Pick<DAO, "id" | "version"> | null): string | undefined {
    return getProtocolVersion(dao?.version);
}

export function getProtocolVersionForProposal(
    proposal?: Pick<Proposal, "dao_id" | "version"> | null
): string | undefined {
    return getProtocolVersion(proposal?.version);
}

export function isSupportedProtocolVersion(version?: string | null): boolean {
    const normalizedVersion = normalizeProtocolVersion(version);
    return !normalizedVersion || normalizedVersion === "v3";
}

export function isSupportedProtocolDAO(dao?: Pick<DAO, "version"> | null): boolean {
    return !!dao && isSupportedProtocolVersion(dao.version);
}

export function isSupportedProtocolProposal(proposal?: Pick<Proposal, "version"> | null): boolean {
    return !!proposal && isSupportedProtocolVersion(proposal.version);
}

export function getSDKForDAO(dao?: Pick<DAO, "id" | "version"> | null): FutarchySDK {
    return getSDKForProtocolVersion(getProtocolVersionForDAO(dao));
}

export function getSDKForProposal(proposal?: Pick<Proposal, "dao_id" | "version"> | null): FutarchySDK {
    return getSDKForProtocolVersion(getProtocolVersionForProposal(proposal));
}

/**
 * Direct SDK export for convenience
 * Note: This triggers SDK initialization on import
 */
export const sdk = new Proxy({} as FutarchySDK, {
    get(_, prop) {
        return getSDK()[prop as keyof FutarchySDK];
    },
});
