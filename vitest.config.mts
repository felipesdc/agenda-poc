import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

// As regras de prazo usam dias civis; mantenha os testes independentes do fuso da máquina.
process.env.TZ = "America/Sao_Paulo";

export default defineConfig({
  resolve: { alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) } },
  esbuild: { jsx: "automatic" },
  test: {
    include: ["tests/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
    clearMocks: true,
    maxWorkers: 2,
    minWorkers: 1,
    testTimeout: 10000,
    hookTimeout: 20000,
  },
});
