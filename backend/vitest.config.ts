import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  test: {
    environment: "node"
  },
  resolve: {
    alias: {
      "@astra/core-engine": path.resolve(import.meta.dirname, "../core-engine/src/index.ts")
    }
  },
  server: {
    host: "127.0.0.1"
  }
});
