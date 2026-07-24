import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * `npm test` ганяє логіку двигуна в node.
 *
 * UI-тести (`*.test.tsx`, потребують jsdom) виключені з дефолтного прогону:
 * у девконтейнері jsdom-воркер не стартує — та сама межа середовища, через яку
 * тут не піднімаються `next build` і `next dev`. Запускати їх треба там, де
 * середовище це дозволяє: `npm run test:ui`.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['app/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
