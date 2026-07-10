import { resolve } from "node:path";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    outDir: "assets/build/airstrike-animation-editor",
    emptyOutDir: true,
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, "assets/ts/airstrike-animation-editor/index.ts"),
      formats: ["es"],
      fileName: () => "airstrike-animation-compiler.js",
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
});
