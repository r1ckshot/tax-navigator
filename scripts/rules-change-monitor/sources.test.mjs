import { describe, it, expect } from 'vitest';
import { fetchDigest, fetchSource } from './sources.mjs';

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

  it('код причини з cause доходить до звіту, а не губиться за «fetch failed»', async () => {
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => {
        throw Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });
      },
      sleep: async () => {},
    });
    expect(result.failure_reason).toBe('запит не вдався: fetch failed (UND_ERR_CONNECT_TIMEOUT)');
  });

  const connectTimeout = () => Object.assign(new TypeError('fetch failed'), { cause: { code: 'UND_ERR_CONNECT_TIMEOUT' } });

  it('збій з\'єднання повторюється один раз, і друга спроба дає сторінку', async () => {
    let calls = 0;
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => {
        calls += 1;
        if (calls === 1) throw connectTimeout();
        return { ok: true, status: 200, text: async () => 'body' };
      },
      sleep: async () => {},
    });
    expect(calls).toBe(2);
    expect(result).toEqual({ html: 'body', failure_reason: null });
  });

  it('лише один повтор: два збої з\'єднання поспіль — причина, а не третя спроба', async () => {
    let calls = 0;
    const result = await fetchSource('https://example.test/x', {
      fetchImpl: async () => {
        calls += 1;
        throw connectTimeout();
      },
      sleep: async () => {},
    });
    expect(calls).toBe(2);
    expect(result.failure_reason).toContain('UND_ERR_CONNECT_TIMEOUT');
  });

  it('відповідь сервера не повторюється: 403 — його слово, а не збій з\'єднання', async () => {
    let calls = 0;
    await fetchSource('https://example.test/x', {
      fetchImpl: async () => ((calls += 1), { ok: false, status: 403, text: async () => '' }),
      sleep: async () => {},
    });
    expect(calls).toBe(1);
  });
});

describe('fetchDigest: відбиток сирих байтів', () => {
  it('sha256 рахується з байтів відповіді', async () => {
    const bytes = new TextEncoder().encode('abc');
    const result = await fetchDigest('https://example.test/doc.pdf', {
      fetchImpl: async () => ({ ok: true, status: 200, arrayBuffer: async () => bytes.buffer }),
    });
    // sha256("abc") — стандартний тестовий вектор FIPS 180-2.
    expect(result).toEqual({ sha256: 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad', failure_reason: null });
  });

  it('не-2xx — причина без відбитка', async () => {
    const result = await fetchDigest('https://example.test/doc.pdf', {
      fetchImpl: async () => ({ ok: false, status: 404, arrayBuffer: async () => new ArrayBuffer(0) }),
    });
    expect(result.sha256).toBeNull();
    expect(result.failure_reason).toContain('404');
  });
});

