import { defineConfig } from "vitest/config";

// Власний конфіг потрібен, бо інакше vitest підхоплює кореневий
// (`include: app/**/*.test.ts`) і не бачить жодного тесту цього пакета.
export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
  },
});
