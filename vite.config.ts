import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  // Every entry is served from assets/build/airstrike-animation-editor/. Relative
  // preload URLs keep Vite's dynamic-import dependencies under that directory.
  base: "./",
  build: {
    outDir: "assets/build/airstrike-animation-editor",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        "airstrike-animation-compiler": resolve(__dirname, "assets/ts/airstrike-animation-editor/index.ts"),
        "airstrike-animation-editor": resolve(__dirname, "assets/ts/airstrike-animation-editor/app.ts"),
        "server-map-viewer": resolve(__dirname, "assets/ts/server-map-viewer/app.ts"),
        "store-kit-preview": resolve(__dirname, "assets/ts/store-kit-preview/app.ts"),
        "leaderboard-podium-loader": resolve(__dirname, "assets/ts/leaderboard-podium/loader.ts"),
        "leaderboard-podium": resolve(__dirname, "assets/ts/leaderboard-podium/app.ts"),
      },
      output: {
        entryFileNames: "[name].js",
        chunkFileNames: "chunks/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash][extname]",
      },
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
