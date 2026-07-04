import { network } from "@/lib/config";

export type Network = "mainnet" | "testnet" | "devnet" | "localnet";

/** Current network - configured via VITE_NETWORK env var, defaults to localnet */
export const NETWORK: Network = network;

/**
 * Explorer URL for the current network
 */
export const EXPLORER_URL = `https://suiscan.xyz/${NETWORK}`;

/**
 * Get explorer URL for a transaction
 */
export function getTransactionUrl(digest: string): string {
    return `${EXPLORER_URL}/tx/${digest}`;
}

/**
 * Get explorer URL for an object
 */
export function getObjectUrl(objectId: string): string {
    return `${EXPLORER_URL}/object/${objectId}`;
}

/**
 * Get explorer URL for an address
 */
export function getAddressUrl(address: string): string {
    return `${EXPLORER_URL}/address/${address}`;
}
