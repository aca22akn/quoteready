import { defineConfig } from "vitest/config";
import { sharedResolve } from "./vitest.config";

// Keyed runs only (eval and smoke call). Ak runs these in the secrets tab.
export default defineConfig({
  resolve: sharedResolve,
  test: { include: ["eval/**/*.eval.ts"], environment: "node", testTimeout: 600_000 },
});
