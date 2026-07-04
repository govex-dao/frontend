import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { HelmetProvider } from "react-helmet-async";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FavoritesProvider } from "./hooks/useFavorites";
import { network, rpcUrl } from "./lib/config";
import { router } from "./App.tsx";
import "./index.css";

const { networkConfig } = createNetworkConfig({
    localnet: { url: network === "localnet" ? rpcUrl : getFullnodeUrl("localnet") },
    devnet: { url: network === "devnet" ? rpcUrl : getFullnodeUrl("devnet") },
    testnet: { url: network === "testnet" ? rpcUrl : getFullnodeUrl("testnet") },
    mainnet: { url: network === "mainnet" ? rpcUrl : getFullnodeUrl("mainnet") },
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
        },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <SuiClientProvider networks={networkConfig} defaultNetwork={network}>
                    <WalletProvider>
                        <FavoritesProvider>
                            <RouterProvider router={router} />
                        </FavoritesProvider>
                    </WalletProvider>
                </SuiClientProvider>
            </QueryClientProvider>
        </HelmetProvider>
    </StrictMode>
);
