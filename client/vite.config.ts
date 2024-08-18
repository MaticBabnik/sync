import { defineConfig } from "vite";

export default defineConfig({
    build: {
        lib: {
            entry: "./lib/SyncClient.ts",
            fileName: "sync-client",
        },
    },
    server: {
        proxy: {
            "/ws": {
                target: "ws://127.0.0.1:3000/",
                ws: true,
            },
        },
    },
});
