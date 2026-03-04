import { defineConfig } from "vite";
import path from "path";

export default defineConfig({
  resolve: {
    alias: [
      {
        find: "@",
        replacement: path.resolve(import.meta.dirname, "client", "src"),
      },
      {
        find: "@shared",
        replacement: path.resolve(import.meta.dirname, "shared"),
      },
    ],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "extension", "src"),
    emptyOutDir: false,
    modulePreload: false,
    lib: {
      entry: {
        content: path.resolve(import.meta.dirname, "client", "src", "extension", "content.ts"),
        background: path.resolve(import.meta.dirname, "client", "src", "extension", "background.ts"),
      },
      formats: ["es"],
    },
    rollupOptions: {
      output: {
        entryFileNames: "[name].js",
        inlineDynamicImports: false,
      },
    },
  },
});
