import { fileURLToPath, URL } from "node:url";

import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react-swc";
import { defineConfig } from "vite";

import { buildInfoPlugin, createBuildInfo } from "./scripts/build-info";

const buildInfo = createBuildInfo();

// https://vite.dev/config/
export default defineConfig({
    define: {
        __BUILD_INFO__: JSON.stringify(buildInfo),
    },
    build: {
        rollupOptions: {
            output: {
                manualChunks(id) {
                    if (!id.includes("node_modules")) return;
                    if (id.includes("@govex/futarchy-sdk")) return "govex-sdk";
                    if (id.includes("@mysten/dapp-kit")) return "sui-dapp-kit";
                    if (id.includes("@mysten/sui")) return "sui-client";
                    if (id.includes("lightweight-charts")) return "charts";
                    if (id.includes("react-markdown") || id.includes("remark-") || id.includes("rehype-")) {
                        return "markdown";
                    }
                    if (id.includes("motion")) return "motion";
                    if (id.includes("lucide-react")) return "icons";
                    if (id.includes("react")) return "react-vendor";
                    return "vendor";
                },
            },
        },
    },
    plugins: [react(), tailwindcss(), buildInfoPlugin(buildInfo)],
    resolve: {
        alias: {
            "@": fileURLToPath(new URL("./src", import.meta.url)),
            "@lib": fileURLToPath(new URL("./src/lib", import.meta.url)),
            "@components": fileURLToPath(new URL("./src/components", import.meta.url)),
            "@routes": fileURLToPath(new URL("./src/routes", import.meta.url)),
            "@mockData": fileURLToPath(new URL("./src/mockData", import.meta.url)),
        },
    },
});
