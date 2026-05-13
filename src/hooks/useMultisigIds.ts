/**
 * localStorage persistence of saved multisig Account IDs per wallet address.
 */

import { useState, useCallback, useEffect } from 'react';
import { useCurrentAccount } from '@mysten/dapp-kit';

const STORAGE_KEY_PREFIX = 'govex:multisig-ids:';

function getStorageKey(walletAddress: string): string {
  return `${STORAGE_KEY_PREFIX}${walletAddress}`;
}

function loadIds(walletAddress: string): string[] {
  try {
    const stored = localStorage.getItem(getStorageKey(walletAddress));
    if (!stored) return [];
    const parsed = JSON.parse(stored);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveIds(walletAddress: string, ids: string[]): void {
  localStorage.setItem(getStorageKey(walletAddress), JSON.stringify(ids));
}

export function useSavedMultisigIds() {
  const account = useCurrentAccount();
  const walletAddress = account?.address || '';
  const [ids, setIds] = useState<string[]>([]);

  // Load from localStorage when wallet changes
  useEffect(() => {
    if (walletAddress) {
      setIds(loadIds(walletAddress));
    } else {
      setIds([]);
    }
  }, [walletAddress]);

  const addId = useCallback(
    (id: string) => {
      if (!walletAddress || !id) return;
      setIds((prev) => {
        if (prev.includes(id)) return prev;
        const next = [...prev, id];
        saveIds(walletAddress, next);
        return next;
      });
    },
    [walletAddress]
  );

  const removeId = useCallback(
    (id: string) => {
      if (!walletAddress) return;
      setIds((prev) => {
        const next = prev.filter((x) => x !== id);
        saveIds(walletAddress, next);
        return next;
      });
    },
    [walletAddress]
  );

  return { ids, addId, removeId };
}
