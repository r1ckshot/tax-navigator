import { defineConfig } from 'vitest/config';

/**
 * research/tg-assistant/ живе поза app/, тож не потрапляє в include кореневого
 * vitest.config.ts (app/**\/*.test.ts). Окремий скоуп замість правки
 * кореневого конфіга — той самий принцип, що app/ vs test:ui-розкол.
 */
export default defineConfig({
  test: {
    include: ['research/tg-assistant/**/*.test.ts'],
    environment: 'node',
  },
});
