import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts", "tests/**/*.test.ts"],
    environment: "node",
    coverage: {
      provider: "istanbul",
      include: [
        "src/runtime/request.ts",
        "src/runtime/response.ts",
        "src/runtime/browser.ts",
        "src/runtime/form-data.ts",
      ],
      reporter: ["text", "json-summary", "lcov"],
      thresholds: {
        perFile: true,
        statements: 95,
        branches: 95,
        functions: 100,
        lines: 95,
      },
    },
  },
});
