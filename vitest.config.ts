import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import { resolve } from "node:path";
import { TEST_DATABASE_URL } from "./src/test/connection";

/**
 * Two projects, and the separation is the point rather than tidiness.
 *
 * The `node` project runs against a real Postgres: a `globalSetup` that drops and
 * replays every migration, and a `setupFiles` that truncates every table between
 * tests. Neither has any business running before a component is mounted in a
 * browser — and both are expensive enough that inheriting them would make somebody
 * think twice about adding an accessibility test, which is already the test nobody
 * adds.
 *
 * The `navegador` project therefore declares its own `setupFiles` and no
 * `globalSetup` at all. It has no database and needs none.
 *
 * `pnpm test` runs both, because an accessibility suite you have to remember to
 * run is an accessibility suite that is not run.
 */

const alias = { "@": resolve(__dirname, "./src") };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "node",
          environment: "node",
          // `.ts` only. The browser project owns `.tsx`, so a component test
          // cannot be picked up here and then fail for want of a DOM.
          include: ["src/**/*.test.ts"],
          globalSetup: ["./src/test/global-setup.ts"],
          setupFiles: ["./src/test/setup.ts"],
          // The suite runs against a real Postgres and truncates between tests,
          // so parallel files would tread on each other.
          fileParallelism: false,
          // DATABASE_URL has to be set before src/db evaluates, which happens at
          // import time — hence here rather than in a setup file.
          env: { DATABASE_URL: TEST_DATABASE_URL },
          testTimeout: 30_000,
          // The migration suite creates a throwaway database per case inside its
          // hooks, and 10s (the default) is not enough for that on a cold
          // container.
          hookTimeout: 30_000,
        },
      },
      {
        resolve: { alias },
        // `next/link` reads `process.env.__NEXT_ROUTER_BASEPATH` at module scope,
        // and `process` does not exist in a browser. Next's own bundler replaces
        // it at build time; Vite has to be told to. Every primitive that navigates
        // is a `next/link`, so without this the suite cannot import them at all.
        define: { "process.env": "{}" },
        test: {
          name: "navegador",
          include: ["src/**/*.test.tsx"],
          setupFiles: ["./src/test/setup-navegador.ts"],
          browser: {
            enabled: true,
            provider: playwright(),
            headless: true,
            // Chromium alone, deliberately. These tests check accessible names,
            // computed contrast, target sizes and keyboard behaviour — all of
            // which come from the DOM and from our own CSS rather than from a
            // rendering engine's quirks. A second browser would triple the
            // install and catch nothing these assertions are about.
            instances: [
              {
                browser: "chromium",
                // A phone, because that is the device. Every target-size
                // assertion is close to meaningless at 1280px, where nothing is
                // ever cramped.
                viewport: { width: 390, height: 844 },
              },
            ],
          },
        },
      },
    ],
  },
});
