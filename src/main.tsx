import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { HelmetProvider } from "react-helmet-async";

import { createNetworkConfig, SuiClientProvider, WalletProvider } from "@mysten/dapp-kit";
import { getFullnodeUrl } from "@mysten/sui/client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FavoritesProvider } from "./hooks/useFavorites";
import { router } from "./App.tsx";
import "./index.css";

const { networkConfig } = createNetworkConfig({
    localnet: { url: getFullnodeUrl("localnet") },
    devnet: { url: getFullnodeUrl("devnet") },
    testnet: { url: getFullnodeUrl("testnet") },
    mainnet: { url: getFullnodeUrl("mainnet") },
});

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: 1,
            refetchOnWindowFocus: false,
        },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <SuiClientProvider
                    networks={networkConfig}
                    defaultNetwork={(import.meta.env.VITE_NETWORK as keyof typeof networkConfig) || "localnet"}
                >
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
