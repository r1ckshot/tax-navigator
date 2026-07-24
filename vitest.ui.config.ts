import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

/**
 * UI-тести (`*.test.tsx`). Окремий конфіг, бо в девконтейнері jsdom-воркер не
 * стартує — та сама межа середовища, через яку тут не піднімаються
 * `next build` і `next dev`. Запускати там, де середовище це дозволяє.
 */
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['app/**/*.test.tsx'],
    environment: 'jsdom',
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./app', import.meta.url)),
    },
  },
});
