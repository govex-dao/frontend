/**
 * Multisig API queries
 */

import { api } from './client';

export interface MultisigPolicyRequirementApi {
  group_idx: number;
  threshold: string;
}

export interface MultisigPolicyPathApi {
  requirements: MultisigPolicyRequirementApi[];
}

export interface MultisigPolicyApi {
  paths: MultisigPolicyPathApi[];
}

export interface MultisigListItem {
  account_id: string;
  name: string;
  groups: unknown[];
  approve_policy: MultisigPolicyApi;
  cancel_policy: MultisigPolicyApi;
  propose_groups: number[];
  execute_groups: number[];
  cancel_groups: number[];
  intent_expiry_ms: string;
  config_nonce: string;
  your_address: string;
  your_weight: string;
  your_permissions: number;
  your_groups: number[];
  member_count: number;
}

export interface MultisigMemberApi {
  address: string;
  weight: string;
  permissions: number;
  group_indices: number[];
}

export interface MultisigDetailApi {
  account_id: string;
  name: string;
  groups: unknown[];
  approve_policy: MultisigPolicyApi;
  cancel_policy: MultisigPolicyApi;
  propose_groups: number[];
  execute_groups: number[];
  cancel_groups: number[];
  intent_expiry_ms: string;
  config_nonce: string;
  last_updated_at: string;
  members: MultisigMemberApi[];
}

export async function fetchMyMultisigs(address: string): Promise<MultisigListItem[]> {
  return api.get<MultisigListItem[]>(`/api/multisigs?member=${address}`);
}

export async function fetchMultisigDetail(accountId: string): Promise<MultisigDetailApi> {
  return api.get<MultisigDetailApi>(`/api/multisigs/${accountId}`);
}
