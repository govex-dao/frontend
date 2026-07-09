import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { HelmetProvider } from "react-helmet-async";

import { DAppKitProvider } from "@mysten/dapp-kit-react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FavoritesProvider } from "./hooks/useFavorites";
import { dAppKit } from "./lib/sui/dapp-kit";
import { router } from "./App.tsx";
import "./index.css";

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
                <DAppKitProvider dAppKit={dAppKit}>
                    <FavoritesProvider>
                        <RouterProvider router={router} />
                    </FavoritesProvider>
                </DAppKitProvider>
            </QueryClientProvider>
        </HelmetProvider>
    </StrictMode>
);
