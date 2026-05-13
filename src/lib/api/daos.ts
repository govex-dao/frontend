/**
 * DAO API queries
 */

import type { DAO } from '../../types';
import { api } from './client';

export async function fetchDAOs(): Promise<DAO[]> {
  return api.get<DAO[]>('/api/daos');
}

export async function fetchDAO(id: string): Promise<DAO> {
  return api.get<DAO>(`/api/daos/${id}`);
}
