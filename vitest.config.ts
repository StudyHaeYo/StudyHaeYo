import { fileURLToPath } from "node:url"
import { defineConfig } from "vitest/config"

// Tests cover the calculations that must not drift (review days, 이해도, AI 답 → 블록). Screens are checked by hand.
export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
  test: { include: ["tests/**/*.test.ts"], environment: "node" },
})
