/**
 * Network and API configuration
 */

export type NetworkName = "mainnet" | "testnet" | "devnet" | "localnet";

const NETWORKS: NetworkName[] = ["mainnet", "testnet", "devnet", "localnet"];

function parseNetwork(value: unknown): NetworkName {
    return typeof value === "string" && NETWORKS.includes(value as NetworkName) ? (value as NetworkName) : "localnet";
}

export const network: NetworkName = parseNetwork(import.meta.env.VITE_NETWORK);

// Backend API URL - defaults based on network
const defaultBackendUrls: Record<NetworkName, string> = {
    mainnet: "https://backend-api-v2-mainnet.up.railway.app",
    testnet: "https://backend-api-v2-testnet-ed82.up.railway.app",
    devnet: "http://localhost:3000",
    localnet: "http://localhost:3000",
};

export const backendUrl = import.meta.env.VITE_BACKEND_URL || defaultBackendUrls[network];

// Sui RPC URL - defaults based on network
const defaultRpcUrls: Record<NetworkName, string> = {
    mainnet: "https://fullnode.mainnet.sui.io:443",
    testnet: "https://fullnode.testnet.sui.io:443",
    devnet: "https://fullnode.devnet.sui.io:443",
    localnet: "http://127.0.0.1:9000",
};

export const rpcUrl = import.meta.env.VITE_SUI_RPC_URL || defaultRpcUrls[network];
