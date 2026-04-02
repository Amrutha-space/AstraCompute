import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node"
  },
  server: {
    host: "127.0.0.1"
  }
});

