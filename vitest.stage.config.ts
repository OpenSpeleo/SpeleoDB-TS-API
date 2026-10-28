import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["tests/stage-negotiation.live.ts"],
    environment: "node",
    testTimeout: 120_000,
    fileParallelism: false,
  },
});
