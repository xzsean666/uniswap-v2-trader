import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["tests/**/*.test.ts"],
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      "better-sqlite3": path.resolve(__dirname, "./src/shims/empty.ts"),
      pg: path.resolve(__dirname, "./src/shims/empty.ts"),
    },
  },
});
