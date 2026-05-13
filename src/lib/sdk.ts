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
 * // On-chain queries
 * const balances = await sdk.utils.queryHelper.getProposalBalances(...);
 * ```
 */

import { FutarchySDK } from '@govex/futarchy-sdk';
import { network, rpcUrl } from './config';
import type { DAO, Proposal } from '@/types';

const sdkInstances = new Map<string, FutarchySDK>();

function normalizeProtocolVersion(version?: string | null): string | undefined {
  const normalized = version?.trim().toLowerCase();
  if (!normalized) return undefined;
  return normalized.startsWith('v') ? normalized : `v${normalized}`;
}

function getProtocolVersion(version?: string | null): string | undefined {
  const explicitVersion = normalizeProtocolVersion(version);
  if (!explicitVersion || explicitVersion === 'v2' || explicitVersion === 'v3') return undefined;
  return explicitVersion;
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
  const normalizedVersion = normalizeProtocolVersion(protocolVersion);
  const cacheKey = `${network}:${rpcUrl}:${normalizedVersion ?? 'current'}`;
  let sdkInstance = sdkInstances.get(cacheKey);
  if (!sdkInstance) {
    sdkInstance = createSDK();
    sdkInstances.set(cacheKey, sdkInstance);
  }
  return sdkInstance;
}

export function getProtocolVersionForDAO(dao?: Pick<DAO, 'id' | 'version'> | null): string | undefined {
  return getProtocolVersion(dao?.version);
}

export function getProtocolVersionForProposal(
  proposal?: Pick<Proposal, 'dao_id' | 'version'> | null
): string | undefined {
  return getProtocolVersion(proposal?.version);
}

export function isLegacyV2Version(version?: string | null): boolean {
  return normalizeProtocolVersion(version) === 'v2';
}

export function isLegacyV2DAO(dao?: Pick<DAO, 'version'> | null): boolean {
  return isLegacyV2Version(dao?.version);
}

export function isLegacyV2Proposal(proposal?: Pick<Proposal, 'version'> | null): boolean {
  return isLegacyV2Version(proposal?.version);
}

export function getSDKForDAO(dao?: Pick<DAO, 'id' | 'version'> | null): FutarchySDK {
  return getSDKForProtocolVersion(getProtocolVersionForDAO(dao));
}

export function getSDKForProposal(proposal?: Pick<Proposal, 'dao_id' | 'version'> | null): FutarchySDK {
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
