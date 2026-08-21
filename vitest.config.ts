import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * `npm test` ганяє логіку двигуна в node — швидко і без DOM.
 *
 * UI-тести (`*.test.tsx`) потребують jsdom, тож живуть в окремому конфізі
 * (`npm run test:ui`), щоб кожен прогін двигуна не платив за підняття DOM.
 * Стара примітка «jsdom-воркер у девконтейнері не стартує» знята 2026-07-24:
 * причиною була 9p-ФС, `node_modules` переїхали на ext4-том.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['app/**/*.test.ts', 'scripts/**/*.test.mjs'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
