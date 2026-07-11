import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { RouterProvider } from "react-router";
import { HelmetProvider } from "react-helmet-async";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import { FavoritesProvider } from "./hooks/useFavorites";
import { router } from "./App.tsx";
import "./index.css";

const queryClient = new QueryClient({
    defaultOptions: {
        queries: {
            staleTime: 30_000,
            retry: false,
            refetchOnWindowFocus: false,
            refetchOnReconnect: true,
        },
    },
});

createRoot(document.getElementById("root")!).render(
    <StrictMode>
        <HelmetProvider>
            <QueryClientProvider client={queryClient}>
                <FavoritesProvider>
                    <RouterProvider router={router} />
                </FavoritesProvider>
            </QueryClientProvider>
        </HelmetProvider>
    </StrictMode>
);
