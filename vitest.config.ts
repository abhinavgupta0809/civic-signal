import { resolve } from "path";
import { defineConfig } from "vitest/config";

// Vitest config scoped to the eval suite. The deterministic tests live under
// eval/ and import product code via the same "@/..." alias the app uses.
export default defineConfig({
  resolve: {
    alias: {
      "@": resolve(__dirname, "."),
    },
  },
  test: {
    environment: "node",
    include: ["eval/**/*.test.ts"],
  },
});
