import react from "@vitejs/plugin-react";
import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "src"),
      // Next's marker package throws outside the server bundle; tests run in plain Node.
      "server-only": path.resolve(import.meta.dirname, "src/test/server-only.ts"),
    },
  },
  test: {
    environment: "jsdom",
    setupFiles: ["./src/test/setup.ts"],
    include: ["src/**/*.test.{ts,tsx}"],
    coverage: {
      provider: "v8",
      include: ["src/lib/**", "src/components/**", "src/app/**"],
      exclude: [
        "src/lib/api/schema.d.ts",
        "src/components/ui/**", // shadcn/ui, generated
        "src/test/**",
        "**/*.test.{ts,tsx}",
        // Declarative framework glue (layouts, pages, boundaries): covered by the Playwright E2E in phase 4.
        "src/app/**/{layout,page,loading,error,global-error,not-found}.tsx",
        "src/components/providers.tsx",
        "src/components/theme-provider.tsx",
      ],
    },
  },
});
