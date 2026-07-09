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

// Sui v2 transport URLs. Keep these public-safe; never put provider secrets in VITE_*.
const defaultGrpcUrls: Record<NetworkName, string> = {
    mainnet: "https://fullnode.mainnet.sui.io:443",
    testnet: "https://fullnode.testnet.sui.io:443",
    devnet: "https://fullnode.devnet.sui.io:443",
    localnet: "http://127.0.0.1:9000",
};

const defaultGraphqlUrls: Record<NetworkName, string> = {
    mainnet: "https://graphql.mainnet.sui.io/graphql",
    testnet: "https://graphql.testnet.sui.io/graphql",
    devnet: "https://graphql.devnet.sui.io/graphql",
    localnet: "http://127.0.0.1:9125/graphql",
};

export function getGrpcUrlForNetwork(name: NetworkName): string {
    return name === network ? import.meta.env.VITE_SUI_GRPC_URL || defaultGrpcUrls[name] : defaultGrpcUrls[name];
}

export function getGraphqlUrlForNetwork(name: NetworkName): string {
    return name === network ? import.meta.env.VITE_SUI_GRAPHQL_URL || defaultGraphqlUrls[name] : defaultGraphqlUrls[name];
}

export const suiGrpcUrl = import.meta.env.VITE_SUI_GRPC_URL || defaultGrpcUrls[network];
export const suiGraphqlUrl = import.meta.env.VITE_SUI_GRAPHQL_URL || defaultGraphqlUrls[network];
