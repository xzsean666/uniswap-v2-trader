import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "better-sqlite3": path.resolve(__dirname, "./src/shims/empty.ts"),
      pg: path.resolve(__dirname, "./src/shims/empty.ts"),
      module: path.resolve(__dirname, "./src/shims/module.ts"),
      "node:module": path.resolve(__dirname, "./src/shims/module.ts"),
      fs: path.resolve(__dirname, "./src/shims/fs.ts"),
      "node:fs": path.resolve(__dirname, "./src/shims/fs.ts"),
      path: path.resolve(__dirname, "./src/shims/path.ts"),
      "node:path": path.resolve(__dirname, "./src/shims/path.ts"),
      crypto: path.resolve(__dirname, "./src/shims/crypto.ts"),
      "node:crypto": path.resolve(__dirname, "./src/shims/crypto.ts"),
      http: path.resolve(__dirname, "./src/shims/http.ts"),
      https: path.resolve(__dirname, "./src/shims/http.ts"),
    },
  },
  define: {
    "process.env": {},
  },
  server: {
    port: 5173,
    host: true,
  },
  build: {
    target: "es2022",
    rollupOptions: {
      external: [],
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/react/") || id.includes("node_modules/react-dom/")) {
            return "vendor-react";
          }
          if (id.includes("node_modules/viem/")) {
            return "vendor-viem";
          }
          if (id.includes("node_modules/lucide-react/")) {
            return "vendor-icons";
          }
          if (id.includes("node_modules/@evm-event-lake/")) {
            return "vendor-lake";
          }
        },
      },
    },
  },
});
