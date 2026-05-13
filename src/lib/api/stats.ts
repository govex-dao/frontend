import { api } from './client';

export interface Stats {
  dao_count: number;
  proposal_count: number;
  raise_count: number;
  multisig_count: number;
  tvl?: number;
}

export async function fetchStats(): Promise<Stats> {
  return api.get<Stats>('/api/stats');
}
