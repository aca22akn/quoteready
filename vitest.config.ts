import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export const sharedResolve = {
  alias: {
    "server-only": fileURLToPath(new URL("./test/server-only-stub.ts", import.meta.url)),
    "@": fileURLToPath(new URL("./", import.meta.url)),
  },
};

export default defineConfig({
  resolve: sharedResolve,
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
});
