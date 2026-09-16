import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

import { detectChallenge } from './challenge.mjs';
import { fetchSource } from './sources.mjs';
import { runCycle } from './cycle.mjs';
import { renderReport } from './report.mjs';
import { STATES } from './states.mjs';

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), '__fixtures__');
const fixture = (name) => readFileSync(join(FIXTURES, name), 'utf8');

const respond = (status, body) => async () => ({ ok: status >= 200 && status < 300, status, text: async () => body });

describe('detectChallenge на живих відповідях WAF (знято 2026-09-16)', () => {
  it('Incapsula з isap.sejm.gov.pl', () => {
    expect(detectChallenge(fixture('waf-incapsula-challenge.html'))).toBe('incapsula');
  });

  it('Akamai з tax.gov.ua: посилання закодоване HTML-сутностями', () => {
    expect(detectChallenge(fixture('waf-akamai-denied.html'))).toBe('akamai');
  });

  /**
   * Хибнопозитив тут дорожчий за пропуск: справжня сторінка ZUS стала б
   * `unavailable` щомісяця, і звірка мовчки перестала б звіряти.
   */
  it('справжні сторінки ZUS не вважаються challenge, включно з отруєною', () => {
    for (const name of ['zus-skladki.html', 'zus-skladki-raised.html', 'zus-skladki-poisoned.html']) {
      expect(detectChallenge(fixture(name))).toBeNull();
    }
  });

  it('порожнє і не-рядок — null', () => {
    expect(detectChallenge('')).toBeNull();
    expect(detectChallenge(null)).toBeNull();
  });
});

describe('fetchSource і challenge-сторінка', () => {
  it('challenge з кодом 200 не проходить як контент', async () => {
    const result = await fetchSource('https://www.zus.pl/x', { fetchImpl: respond(200, fixture('waf-incapsula-challenge.html')) });
    expect(result.html).toBeNull();
    expect(result.failure_reason).toMatch(/^challenge_page \(incapsula\).*200/);
  });

  it('403 від WAF названо challenge_page, а не просто кодом', async () => {
    const result = await fetchSource('https://www.zus.pl/x', { fetchImpl: respond(403, fixture('waf-akamai-denied.html')) });
    expect(result.failure_reason).toMatch(/^challenge_page \(akamai\).*403/);
  });

  it('звичайний 403 без сигнатури лишається кодом', async () => {
    const result = await fetchSource('https://www.zus.pl/x', { fetchImpl: respond(403, '<h1>Forbidden</h1>') });
    expect(result.failure_reason).toBe('джерело відповіло 403');
  });
});

describe('challenge у циклі', () => {
  const rule = {
    rule_id: 'common.minimum_wage',
    params: { monthly: 4806 },
    source_url: 'https://www.zus.pl/baza-wiedzy/x',
    verified_at: '2026-07-18',
  };

  /**
   * Сторінку спершу «отруєно» сумою, що збігається з матрицею: без
   * розпізнавання екстрактор узяв би її, і вийшов би `match` на сторінці, де
   * ставки немає взагалі. Тобто тест ловить саме тиху підміну, а не лише стан.
   */
  it('challenge із сумою поруч з маркером — unavailable, не match, і нічого зі сторінки у звіті', async () => {
    const page = fixture('waf-incapsula-challenge.html').replace(
      '</iframe>',
      '</iframe><p>kwota 4 806 zł (100% minimalnego wynagrodzenia)</p>',
    );
    const cycle = await runCycle({ rules: [rule], now: new Date('2026-09-16T08:00:00Z'), fetchImpl: respond(200, page) });

    expect(cycle.checks[0].state).toBe(STATES.UNAVAILABLE);
    expect(cycle.checks[0].fetched_value).toBeNull();
    expect(cycle.checks[0].failure_reason).toMatch(/^challenge_page \(incapsula\)/);
    expect(cycle.status).toBe('partial');

    const report = renderReport(cycle);
    expect(report).toContain('challenge_page (incapsula)');
    expect(report).not.toContain('incident_id');
    expect(report).not.toContain('203.0.113.7');
  });
});
