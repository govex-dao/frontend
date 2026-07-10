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
