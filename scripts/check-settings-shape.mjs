#!/usr/bin/env node
/**
 * Форма значень у `.claude/settings.json` — не лише валідність JSON.
 *
 * Привід: 2026-08-04 у файл потрапило `"attribution": { "commit": true }`, тоді як
 * схема чекає ТЕКСТ трейлера. JSON лишився валідним, тож `verify` був зелений —
 * але Claude Code відкидає весь файл на першій же невідповідності схемі, і добу
 * не діяли ні `deny`-правила, ні sandbox, ні хуки. Помітив це врешті скріншот
 * помилки, а не гейт.
 *
 * Тут перевіряються не всі ключі схеми, а ті, що є у файлі: чужі й нові ключі
 * пропускаються мовчки, бо схема росте з кожним релізом, а гейт, який падає на
 * незнайомому ключі, швидко навчить його обходити.
 *
 * Запуск: node scripts/check-settings-shape.mjs [шлях]
 * Тест:   node scripts/check-settings-shape.mjs <фікстура>  (див. test-check-settings-shape.sh)
 */
import { existsSync, readFileSync } from 'node:fs';

const target = process.argv[2] ?? '.claude/settings.json';
let failed = false;
const fail = (msg) => {
  console.error(`FAIL: ${msg}`);
  failed = true;
};

const isString = (v) => typeof v === 'string';
const isBoolean = (v) => typeof v === 'boolean';
const isNumber = (v) => typeof v === 'number';
const arrayOfStrings = (v) => Array.isArray(v) && v.every(isString);
const objectOfStrings = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && Object.values(v).every(isString);
const oneOf = (...allowed) => (v) => isString(v) && allowed.includes(v);

/**
 * Ключі, які тут уже стояли або стоять поруч і в яких помилитись найлегше.
 * `attribution.commit` — перший рядок не випадково: саме він і зламав файл.
 */
const RULES = [
  ['attribution.commit', isString, 'рядок із текстом трейлера (порожній рядок ховає атрибуцію); true/false схема не приймає'],
  ['attribution.pr', isString, 'рядок із текстом для опису PR'],
  ['attribution.sessionUrl', isBoolean, 'булеве'],
  ['includeCoAuthoredBy', isBoolean, 'булеве'],
  ['model', isString, 'рядок'],
  ['agent', isString, 'рядок'],
  ['language', isString, 'рядок'],
  ['permissions.allow', arrayOfStrings, 'масив рядків'],
  ['permissions.deny', arrayOfStrings, 'масив рядків'],
  ['permissions.ask', arrayOfStrings, 'масив рядків'],
  ['permissions.additionalDirectories', arrayOfStrings, 'масив рядків'],
  ['permissions.defaultMode', oneOf('acceptEdits', 'auto', 'bypassPermissions', 'default', 'dontAsk', 'plan'), 'один із: acceptEdits, auto, bypassPermissions, default, dontAsk, plan'],
  ['env', objectOfStrings, 'обʼєкт, де КОЖНЕ значення — рядок (число тут теж ламає файл)'],
  ['sandbox.enabled', isBoolean, 'булеве'],
  ['sandbox.allowUnsandboxedCommands', isBoolean, 'булеве'],
  ['sandbox.excludedCommands', arrayOfStrings, 'масив рядків'],
  ['sandbox.network.allowedDomains', arrayOfStrings, 'масив рядків'],
  ['sandbox.network.allowManagedDomainsOnly', isBoolean, 'булеве'],
  ['sandbox.filesystem.denyRead', arrayOfStrings, 'масив рядків'],
  ['sandbox.filesystem.allowWrite', arrayOfStrings, 'масив рядків'],
  ['sandbox.filesystem.denyWrite', arrayOfStrings, 'масив рядків'],
];

/** Значення за крапковим шляхом; `undefined` означає «ключа немає», а не «ключ порожній». */
function at(root, path) {
  let node = root;
  for (const part of path.split('.')) {
    if (node === null || typeof node !== 'object' || !(part in node)) return undefined;
    node = node[part];
  }
  return node;
}

const typeName = (v) => (Array.isArray(v) ? 'масив' : v === null ? 'null' : typeof v);

/** Хуки: структура вкладена, тож перевіряється обходом, а не таблицею. */
function checkHooks(hooks) {
  if (hooks === undefined) return;
  if (hooks === null || typeof hooks !== 'object' || Array.isArray(hooks)) {
    fail(`hooks — має бути обʼєкт подій, а тут ${typeName(hooks)}`);
    return;
  }
  for (const [event, matchers] of Object.entries(hooks)) {
    if (!Array.isArray(matchers)) {
      fail(`hooks.${event} — має бути масив, а тут ${typeName(matchers)}`);
      continue;
    }
    matchers.forEach((entry, i) => {
      const where = `hooks.${event}[${i}]`;
      if (entry === null || typeof entry !== 'object') {
        fail(`${where} — має бути обʼєкт, а тут ${typeName(entry)}`);
        return;
      }
      if ('matcher' in entry && !isString(entry.matcher)) {
        fail(`${where}.matcher — має бути рядок, а тут ${typeName(entry.matcher)}`);
      }
      if (!Array.isArray(entry.hooks)) {
        fail(`${where}.hooks — має бути масив, а тут ${typeName(entry.hooks)}`);
        return;
      }
      entry.hooks.forEach((hook, j) => {
        const hookWhere = `${where}.hooks[${j}]`;
        if (hook === null || typeof hook !== 'object') {
          fail(`${hookWhere} — має бути обʼєкт, а тут ${typeName(hook)}`);
          return;
        }
        if (!isString(hook.type)) {
          fail(`${hookWhere}.type — має бути рядок, а тут ${typeName(hook.type)}`);
        }
        // Тип `command` — єдиний, що вживається в цьому репо; решту (prompt,
        // agent, http, mcp_tool) не розбираємо, щоб не вгадувати чужі поля.
        if (hook.type === 'command' && !isString(hook.command)) {
          fail(`${hookWhere}.command — має бути рядок, а тут ${typeName(hook.command)}`);
        }
        if ('timeout' in hook && !isNumber(hook.timeout)) {
          fail(`${hookWhere}.timeout — має бути число (секунди), а тут ${typeName(hook.timeout)}`);
        }
        if ('statusMessage' in hook && !isString(hook.statusMessage)) {
          fail(`${hookWhere}.statusMessage — має бути рядок, а тут ${typeName(hook.statusMessage)}`);
        }
        if ('if' in hook && !isString(hook.if)) {
          fail(`${hookWhere}.if — має бути рядок правила дозволів, а тут ${typeName(hook.if)}`);
        }
      });
    });
  }
}

if (!existsSync(target)) {
  console.error(`FAIL: ${target} відсутній`);
  process.exit(1);
}

let settings;
try {
  settings = JSON.parse(readFileSync(target, 'utf8'));
} catch (e) {
  console.error(`FAIL: ${target} невалідний JSON: ${e.message}`);
  process.exit(1);
}

let checked = 0;
for (const [path, isValid, expected] of RULES) {
  const value = at(settings, path);
  if (value === undefined) continue;
  checked++;
  if (!isValid(value)) {
    fail(`${path} — очікується ${expected}, а тут ${typeName(value)} (${JSON.stringify(value)}). Claude Code відкине ВЕСЬ файл: ні deny-правил, ні sandbox, ні хуків`);
  }
}
checkHooks(settings.hooks);

if (failed) process.exit(1);
console.log(`OK: форма значень у ${target}: ${checked} ключів звірено зі схемою + структура hooks`);
