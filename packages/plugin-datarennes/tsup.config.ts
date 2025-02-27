import { defineConfig } from "tsup";

export default defineConfig({
    entry: ["src/index.ts"],
    outDir: "dist",
    sourcemap: true,
    clean: true,
    format: ["esm"], // Ensure you're targeting ESM
    external: [
        "@elizaos/core",
        "node-fetch", // Externalize node-fetch to prevent bundling
        "dotenv", // Externalize dotenv to prevent bundling
        "fs", // Externalize fs to use Node.js built-in module
        "path", // Externalize other built-ins if necessary
        "https",
        "http",
        "agentkeepalive",
        // Add other modules you want to externalize
    ],
});
