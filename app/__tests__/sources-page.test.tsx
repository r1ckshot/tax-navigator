/**
 * @vitest-environment jsdom
 */
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen } from '@testing-library/react';
import SourcesPage from '@/sources/page';
import { RULES } from '@/lib/rules/types';

/** Сторінка читає `new Date()`: стан свіжості без фіксованого годинника плив би. */
function renderOn(isoDay: string) {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(new Date(`${isoDay}T12:00:00Z`));
  render(<SourcesPage />);
}

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe('/sources', () => {
  it('кожне з 26 правил має лінк на свій source_url', () => {
    renderOn('2026-09-15');
    const hrefs = screen.getAllByRole('link').map((a) => a.getAttribute('href'));
    for (const rule of RULES.rules) expect(hrefs).toContain(rule.source_url);
    expect(screen.getAllByRole('listitem')).toHaveLength(26);
  });

  it('вісім груп із лічильником у правильній формі', () => {
    renderOn('2026-09-15');
    expect(screen.getAllByRole('heading', { level: 2 })).toHaveLength(8);
    expect(screen.getByText('1 правило')).toBeDefined();
    expect(screen.getByText('6 правил')).toBeDefined();
    expect(screen.getAllByText('4 правила')).toHaveLength(3);
  });

  it('підсумок без розділювачів, поріг у тексті з того самого числа', () => {
    renderOn('2026-09-15');
    expect(screen.getByText('26 правил у 8 групах')).toBeDefined();
    expect(screen.getByText('Через 90 днів без звірки правило позначається як давно не звірене.')).toBeDefined();
  });

  it('сьогодні рядка про давні правила немає, і жодного ▲', () => {
    renderOn('2026-09-15');
    expect(screen.queryByText(/давно не звірялись/)).toBeNull();
    expect(screen.queryAllByText('давно не звірялось')).toHaveLength(0);
  });

  it('на 2026-10-17 з\'являються 12 давніх: і рядок, і позначка з формою ▲', () => {
    renderOn('2026-10-17');
    expect(screen.getByText('12 правил давно не звірялись')).toBeDefined();
    const labels = screen.getAllByText('давно не звірялось');
    expect(labels).toHaveLength(12);
    // Колір значення сам не несе: поруч із підписом стоїть гліф.
    expect(labels[0].previousElementSibling?.textContent).toBe('▲');
  });

  it('дисклеймер присутній', () => {
    renderOn('2026-09-15');
    expect(screen.getByText(/Це інформаційний калькулятор орієнтовного характеру/)).toBeDefined();
  });
});
