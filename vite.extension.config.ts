import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: [
      {
        find: /^@\/lib\/queryClient$/,
        replacement: path.resolve(
          import.meta.dirname,
          "client",
          "src",
          "lib",
          "chrome-query-client.ts"
        ),
      },
      {
        find: "@",
        replacement: path.resolve(import.meta.dirname, "client", "src"),
      },
      {
        find: "@shared",
        replacement: path.resolve(import.meta.dirname, "shared"),
      },
      {
        find: "@assets",
        replacement: path.resolve(import.meta.dirname, "attached_assets"),
      },
    ],
  },
  root: path.resolve(import.meta.dirname, "client", "src", "extension"),
  build: {
    outDir: path.resolve(import.meta.dirname, "dist", "extension"),
    emptyOutDir: true,
    modulePreload: false,
    rollupOptions: {
      input: {
        "popup/index": path.resolve(
          import.meta.dirname,
          "client",
          "src",
          "extension",
          "popup",
          "index.html"
        ),
        "dashboard/index": path.resolve(
          import.meta.dirname,
          "client",
          "src",
          "extension",
          "dashboard",
          "index.html"
        ),
        "options/index": path.resolve(
          import.meta.dirname,
          "client",
          "src",
          "extension",
          "options",
          "index.html"
        ),
      },
      output: {
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
      },
    },
  },
});
