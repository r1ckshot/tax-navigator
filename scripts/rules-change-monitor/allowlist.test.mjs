import { describe, expect, it } from 'vitest';

import { SCRIPTABLE_HOSTS, classifyScope, hostOf, isScriptable } from './allowlist.mjs';
import { STATES } from './states.mjs';
import ruleSet from '../../app/lib/rules/rules.2026.json';

describe('hostOf', () => {
  it('дістає хост з валідного URL', () => {
    expect(hostOf('https://www.zus.pl/firmy')).toBe('www.zus.pl');
  });

  it('битий URL не кидає — повертає null', () => {
    expect(() => hostOf('не url')).not.toThrow();
    expect(hostOf('не url')).toBeNull();
  });
});

describe('isScriptable', () => {
  it('піддомен дозволеного хоста — дозволений', () => {
    expect(isScriptable('https://www.zus.pl/firmy/rozliczenia-z-zus/30-krotnosc')).toBe(true);
  });

  it('домен, що лише МІСТИТЬ дозволений хост як префікс — заборонений', () => {
    // zus.pl.evil.com не є піддоменом zus.pl (не закінчується на ".zus.pl"
    // саме тому, що там немає крапки перед zus.pl) — підрядковий матчинг
    // пропустив би це, endsWith('.' + host) — ні.
    expect(isScriptable('https://zus.pl.evil.com/pastka')).toBe(false);
  });

  it('http (не https) — заборонений навіть на дозволеному хості', () => {
    expect(isScriptable('http://zus.pl/firmy')).toBe(false);
  });

  it('битий URL не кидає — повертає false', () => {
    expect(() => isScriptable('точно не url')).not.toThrow();
    expect(isScriptable('точно не url')).toBe(false);
  });

  it('SCRIPTABLE_HOSTS — рівно zus.pl і podatki.gov.pl, і список заморожений', () => {
    expect(SCRIPTABLE_HOSTS).toEqual(['zus.pl', 'podatki.gov.pl']);
    expect(Object.isFrozen(SCRIPTABLE_HOSTS)).toBe(true);
  });
});

describe('classifyScope — порядок перевірок', () => {
  it('немає verified_at → not_verified, навіть коли source_url теж поза allowlist', () => {
    // Обидві причини присутні одночасно: verified_at порожній І джерело —
    // tax.gov.ua (WAF, поза SCRIPTABLE_HOSTS). Перевірка verified_at йде
    // першою, тож результат мусить бути not_verified, а не out_of_scope.
    const rule = {
      rule_id: 'test.both_broken',
      source_url: 'https://www.tax.gov.ua/kudy-nezrozumilo',
      verified_at: '',
    };

    const result = classifyScope(rule);

    expect(result).toEqual({
      state: STATES.NOT_VERIFIED,
      failure_reason: expect.any(String),
    });
  });

  it('є verified_at, немає source_url → out_of_scope', () => {
    const rule = { rule_id: 'test.no_source', source_url: undefined, verified_at: '2026-07-18' };

    expect(classifyScope(rule)).toEqual({
      state: STATES.OUT_OF_SCOPE,
      failure_reason: expect.any(String),
    });
  });

  it('є verified_at, source_url не скриптується → out_of_scope', () => {
    const rule = {
      rule_id: 'test.waf_source',
      source_url: 'https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU19940630269',
      verified_at: '2026-07-18',
    };

    expect(classifyScope(rule)).toEqual({
      state: STATES.OUT_OF_SCOPE,
      failure_reason: expect.any(String),
    });
  });

  it('verified_at і скриптоване source_url → null (у скоупі, фетчити далі)', () => {
    const rule = {
      rule_id: 'test.in_scope',
      source_url: 'https://www.zus.pl/firmy/rozliczenia-z-zus/30-krotnosc',
      verified_at: '2026-07-24',
    };

    expect(classifyScope(rule)).toBeNull();
  });
});

describe('classifyScope — на реальних правилах з rules.2026.json', () => {
  it('residency.treaty_tiebreakers (isap.sejm.gov.pl, за WAF) — out_of_scope', () => {
    const rule = ruleSet.rules.find((r) => r.rule_id === 'residency.treaty_tiebreakers');

    expect(rule).toBeDefined();
    expect(classifyScope(rule)).toEqual({
      state: STATES.OUT_OF_SCOPE,
      failure_reason: expect.any(String),
    });
  });

  it('common.minimum_wage (zus.pl, верифіковане) — у скоупі, null', () => {
    const rule = ruleSet.rules.find((r) => r.rule_id === 'common.minimum_wage');

    expect(rule).toBeDefined();
    expect(classifyScope(rule)).toBeNull();
  });
});
