/**
 * React Query hooks for wallet balances via SDK
 */

import { useQuery } from '@tanstack/react-query';
import { useCurrentAccount } from '@mysten/dapp-kit';
import { buildBalanceWrapperType } from '@govex/futarchy-sdk';
import { getProtocolVersionForProposal, getSDKForProposal, isLegacyV2Proposal } from '../../lib/sdk';
import type { Proposal } from '../../types';
import { parseConditionalTypes, parseOutcomeMessages } from '../../types';

export const balanceKeys = {
  all: ['balances'] as const,
  proposal: (address: string, proposalId: string, protocolVersion?: string | null) =>
    [...balanceKeys.all, 'proposal', address, proposalId, protocolVersion ?? 'current'] as const,
};

/**
 * Get all balances for a proposal (spot + conditional per outcome + balance wrappers)
 * Includes coin names for display
 */
export function useProposalBalances(proposal?: Proposal) {
  const account = useCurrentAccount();
  const address = account?.address;

  const { assetTypes, stableTypes } = proposal ? parseConditionalTypes(proposal) : { assetTypes: [], stableTypes: [] };
  const outcomeMessages = proposal ? parseOutcomeMessages(proposal) : [];
  const protocolVersion = getProtocolVersionForProposal(proposal);
  const isLegacyV2 = isLegacyV2Proposal(proposal);

  return useQuery({
    queryKey: balanceKeys.proposal(address || '', String(proposal?.id ?? ''), protocolVersion),
    queryFn: async () => {
      const sdk = getSDKForProposal(proposal);

      // Build balance wrapper type if we have the market_state_id
      const marketStateId = proposal!.market_state_id;
      const balanceWrapperType = marketStateId
        ? buildBalanceWrapperType(sdk.packages.futarchyMarketsPrimitives, proposal!.asset_type, proposal!.stable_type)
        : undefined;

      return sdk.utils.queryHelper.getProposalBalances(
        address!,
        proposal!.asset_type,
        proposal!.stable_type,
        assetTypes,
        stableTypes,
        proposal!.asset_symbol || 'ASSET',
        proposal!.stable_symbol || 'STABLE',
        outcomeMessages,
        marketStateId || undefined,
        balanceWrapperType
      );
    },
    enabled: !!address && !!proposal && !isLegacyV2 && assetTypes.length > 0,
    refetchInterval: 10000,
  });
}
