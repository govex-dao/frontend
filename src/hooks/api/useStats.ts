import { useQuery } from '@tanstack/react-query';
import { fetchStats } from '../../lib/api';
import type { Stats } from '../../lib/api';

export function useStats() {
  return useQuery<Stats>({
    queryKey: ['stats'],
    queryFn: fetchStats,
  });
}
