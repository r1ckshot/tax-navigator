import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { parseTokens } from '../tokens';

const FIXTURE = `
/* --ghost: #000000; коментар не декларація */
:root {
  --teal-51: #0f766e;
  --stone-99: #fefdfb;
  --stone-26: #262521;
  --red-57: #d03b3b;
  --surface: var(--stone-99);
  --risk-red: var(--red-57);
  --text-sm: 0.88rem;
  --space-1: 0.25rem;
  --radius-sm: 6px;
  --radius: 10px;
  --shadow-sm: 0 1px 2px rgba(0, 0, 0, 0.4);
  --gap: var(--space-1);
}
@media (prefers-color-scheme: dark) {
  :root {
    --surface: var(--stone-26);
  }
}
button { color: var(--surface); }
`;

describe('parseTokens: фікстура', () => {
  const dict = parseTokens(FIXTURE);

  it('палітра — лише родини палітри, коментар не рахується', () => {
    expect(dict.palette.map((t) => t.name)).toEqual(['--teal-51', '--stone-99', '--stone-26', '--red-57']);
  });

  it('роль із перевизначенням у темній темі бере темне посилання', () => {
    expect(dict.colorRoles).toContainEqual({ name: '--surface', light: '--stone-99', dark: '--stone-26' });
  });

  it('роль без перевизначення лишається тією самою в обох темах', () => {
    expect(dict.colorRoles).toContainEqual({ name: '--risk-red', light: '--red-57', dark: '--red-57' });
  });

  it('посилання не на палітру (--gap → --space-1) — не роль кольору', () => {
    expect(dict.colorRoles.map((r) => r.name)).not.toContain('--gap');
  });

  it('шкали розкладаються за префіксом; --radius без суфікса теж радіус', () => {
    expect(dict.text.map((t) => t.name)).toEqual(['--text-sm']);
    expect(dict.space.map((t) => t.name)).toEqual(['--space-1']);
    expect(dict.radius.map((t) => t.name)).toEqual(['--radius-sm', '--radius']);
  });

  it('CSS без темної теми: ролі однакові в обох темах', () => {
    const [lightOnly] = FIXTURE.split('@media');
    expect(parseTokens(lightOnly).colorRoles).toContainEqual({
      name: '--surface',
      light: '--stone-99',
      dark: '--stone-99',
    });
  });
});

describe('parseTokens: справжній globals.css', () => {
  const dict = parseTokens(readFileSync(join(process.cwd(), 'app', 'globals.css'), 'utf8'));

  it('розмір словника', () => {
    // 16 stone + white + 9 teal + 3 статусні; 8 поверхонь + 5 акцент + 3 ризик;
    // 7 кеглів, 7 відступів, 3 радіуси. Змінився словник — число міняється свідомо.
    expect(dict.palette).toHaveLength(29);
    expect(dict.colorRoles).toHaveLength(16);
    expect(dict.text).toHaveLength(7);
    expect(dict.space).toHaveLength(7);
    expect(dict.radius).toHaveLength(3);
  });

  it('акцент у двох темах вказує на різні кроки teal', () => {
    expect(dict.colorRoles).toContainEqual({ name: '--accent', light: '--teal-51', dark: '--teal-78' });
  });

  it('кожна роль вказує на колір, що є в палітрі', () => {
    const known = new Set(dict.palette.map((t) => t.name));
    const dangling = dict.colorRoles.filter((r) => !known.has(r.light) || !known.has(r.dark));
    expect(dangling).toEqual([]);
  });
});
