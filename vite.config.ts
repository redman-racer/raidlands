import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "assets/build/airstrike-animation-editor",
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      preserveEntrySignatures: "strict",
      input: {
        "airstrike-animation-compiler": resolve(__dirname, "assets/ts/airstrike-animation-editor/index.ts"),
        "airstrike-animation-editor": resolve(__dirname, "assets/ts/airstrike-animation-editor/app.ts"),
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
