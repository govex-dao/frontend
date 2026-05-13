/**
 * Raise/Launchpad API queries
 */

import type { Raise } from '../../types';
import { api } from './client';

export interface UserContribution {
  hasInvested: boolean;
  amount: string;
  percentage: string;
  rank: number;
}

export async function fetchRaises(): Promise<Raise[]> {
  return api.get<Raise[]>('/api/raises');
}

export async function fetchRaise(id: string): Promise<Raise> {
  return api.get<Raise>(`/api/launchpads/${id}`);
}

export async function fetchUserContribution(raiseId: string, address: string): Promise<UserContribution> {
  return api.get<UserContribution>(`/api/launchpads/${raiseId}/contribution?address=${address}`);
}

export interface UserReservation {
  hasReservation: boolean;
  amount: string;
  accepted: boolean;
}

export async function fetchUserReservation(raiseId: string, address: string): Promise<UserReservation> {
  return api.get<UserReservation>(`/api/launchpads/${raiseId}/reservation?address=${address}`);
}
