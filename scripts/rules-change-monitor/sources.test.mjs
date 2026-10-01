import { describe, it, expect } from 'vitest';
import { fetchSource } from './sources.mjs';

describe('fetchSource: недоступність називається, а не ковтається', () => {
  it('не-2xx дає причину з кодом і жодного html', async () => {
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => ({ ok: false, status: 503, text: async () => 'x' }),
    });
    expect(result.html).toBeNull();
    expect(result.failure_reason).toContain('503');
  });

  it('кинуту помилку мережі перетворює на причину, а не на порожній html', async () => {
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => {
        throw new Error('ECONNRESET');
      },
    });
    expect(result.html).toBeNull();
    expect(result.failure_reason).toContain('ECONNRESET');
  });
});
