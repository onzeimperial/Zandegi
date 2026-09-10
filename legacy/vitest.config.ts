import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    globals: true,
    include: ["test/**/*.test.ts", "test/**/*.test.tsx"],
    // Satisfy src/lib/env.ts (imported transitively by some pure modules).
    env: {
      DATABASE_URL: "file:./test.db",
      AUTH_SECRET: "test-secret-value-not-used-anywhere-1234",
      NODE_ENV: "test",
    },
  },
});
