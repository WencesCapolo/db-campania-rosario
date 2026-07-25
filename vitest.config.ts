import { defineConfig } from "vitest/config";
import { resolve } from "node:path";
import { TEST_DATABASE_URL } from "./src/test/connection";

export default defineConfig({
  resolve: {
    alias: { "@": resolve(__dirname, "./src") },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
    globalSetup: ["./src/test/global-setup.ts"],
    setupFiles: ["./src/test/setup.ts"],
    // The suite runs against a real Postgres and truncates between tests, so
    // parallel files would tread on each other.
    fileParallelism: false,
    // DATABASE_URL has to be set before src/db evaluates, which happens at
    // import time — hence here rather than in a setup file.
    env: { DATABASE_URL: TEST_DATABASE_URL },
    testTimeout: 30_000,
  },
});
