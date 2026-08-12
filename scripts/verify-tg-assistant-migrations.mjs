#!/usr/bin/env node
/**
 * Прогонить staged-міграції tg-assistant (docs/features/tg-assistant/migrations/)
 * через in-memory node:sqlite: up (усі файли по порядку) → down (у зворотному
 * порядку) → up знову, і звіряє фінальну схему з початковою (roundtrip) та з
 * переліком таблиць/колонок у data-model.md → «Entities» (drift).
 *
 * Живого Postgres у цьому контейнері нема (той самий блокер, що на
 * rules-change-monitor — docs/features/rules-change-monitor/_audit/data-model-2026-08-07.md),
 * тож перевірка йде проти node:sqlite з мінімальним шаром трансляції: тільки
 * `DEFAULT now()` → `DEFAULT CURRENT_TIMESTAMP`, бо `now()` як функція в SQLite
 * не існує. Типи (`UUID`, `TIMESTAMPTZ`, `BIGINT`, ...) не перекладаються — SQLite
 * динамічно типізована і приймає довільну назву типу в CREATE TABLE (type affinity),
 * синтаксичної помилки вони не дають.
 *
 * Запуск:  node --experimental-sqlite scripts/verify-tg-assistant-migrations.mjs
 *            [--migrations-dir <path>] [--data-model <path>]
 * Вихід:   0 — roundtrip і drift-перевірка пройшли; 1 — перша знайдена розбіжність
 *          (повідомлення називає конкретну таблицю/колонку, не просто "error").
 */

import { readFileSync, readdirSync } from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import { fileURLToPath } from 'node:url';

function parseArgs(argv) {
  const opts = {
    migrationsDir: new URL('../docs/features/tg-assistant/migrations/', import.meta.url),
    dataModel: new URL('../docs/features/tg-assistant/data-model.md', import.meta.url),
  };
  for (let i = 0; i < argv.length; i += 1) {
    if (argv[i] === '--migrations-dir') opts.migrationsDir = new URL(`file://${resolvePath(argv[++i])}/`);
    if (argv[i] === '--data-model') opts.dataModel = new URL(`file://${resolvePath(argv[++i])}`);
  }
  return opts;
}

function resolvePath(p) {
  return p.startsWith('/') ? p : `${process.cwd()}/${p}`;
}

function translate(sql) {
  return sql.replace(/DEFAULT\s+now\(\)/gi, 'DEFAULT CURRENT_TIMESTAMP');
}

function loadMigrations(dirUrl, suffix) {
  const dirPath = fileURLToPath(dirUrl);
  return readdirSync(dirPath)
    .filter((f) => f.endsWith(suffix))
    .sort()
    .map((f) => ({ file: f, sql: translate(readFileSync(`${dirPath}${f}`, 'utf8')) }));
}

function applyAll(db, migrations) {
  for (const { file, sql } of migrations) {
    try {
      db.exec(sql);
    } catch (err) {
      throw new Error(`migration ${file} failed to apply: ${err.message}`);
    }
  }
}

function schemaSnapshot(db) {
  const tables = db
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name != 'sqlite_sequence' ORDER BY name")
    .all()
    .map((r) => r.name);
  const snapshot = {};
  for (const table of tables) {
    const columns = db
      .prepare(`PRAGMA table_info(${table})`)
      .all()
      .map((c) => ({ name: c.name, type: c.type, notnull: c.notnull, pk: c.pk }));
    snapshot[table] = columns;
  }
  return snapshot;
}

function diffSnapshots(before, after) {
  const beforeTables = Object.keys(before).sort();
  const afterTables = Object.keys(after).sort();
  if (beforeTables.join(',') !== afterTables.join(',')) {
    return `roundtrip drift: tables before up→down→up = [${beforeTables}], after = [${afterTables}]`;
  }
  for (const table of beforeTables) {
    const b = JSON.stringify(before[table]);
    const a = JSON.stringify(after[table]);
    if (b !== a) {
      return `roundtrip drift: table "${table}" columns changed after up→down→up\n  before: ${b}\n  after:  ${a}`;
    }
  }
  return null;
}

/** Парсить `## Entities` з data-model.md: { tableName: [columnName, ...] }. */
function parseDataModelEntities(dataModelUrl) {
  const text = readFileSync(fileURLToPath(dataModelUrl), 'utf8');
  const entitiesStart = text.indexOf('\n## Entities');
  if (entitiesStart === -1) throw new Error('data-model.md: "## Entities" section not found');
  const nextSectionRel = text.slice(entitiesStart + 1).search(/\n## (?!Entities)/);
  const entitiesBlock = nextSectionRel === -1 ? text.slice(entitiesStart) : text.slice(entitiesStart, entitiesStart + 1 + nextSectionRel);

  const entities = {};
  const tableHeaderRe = /### `(\w+)`/g;
  const headerMatches = [...entitiesBlock.matchAll(tableHeaderRe)];
  for (let i = 0; i < headerMatches.length; i += 1) {
    const name = headerMatches[i][1];
    const start = headerMatches[i].index;
    const end = i + 1 < headerMatches.length ? headerMatches[i + 1].index : entitiesBlock.length;
    const section = entitiesBlock.slice(start, end);
    const columnRe = /^\|\s*`(\w+)`\s*\|/gm;
    entities[name] = [...section.matchAll(columnRe)].map((m) => m[1]);
  }
  return entities;
}

function diffAgainstDataModel(snapshot, entities) {
  for (const [table, columns] of Object.entries(entities)) {
    const actualColumns = snapshot[table];
    if (!actualColumns) {
      return `drift: data-model.md lists table "${table}" but migrations do not create it`;
    }
    const actualNames = new Set(actualColumns.map((c) => c.name));
    for (const col of columns) {
      if (!actualNames.has(col)) {
        return `drift: data-model.md table "${table}" lists column "${col}" but the migration schema does not have it`;
      }
    }
  }
  for (const table of Object.keys(snapshot)) {
    if (!entities[table]) {
      return `drift: migrations create table "${table}" but data-model.md → Entities does not document it`;
    }
  }
  return null;
}

function main() {
  const opts = parseArgs(process.argv.slice(2));
  const upMigrations = loadMigrations(opts.migrationsDir, '.up.sql');
  const downMigrations = loadMigrations(opts.migrationsDir, '.down.sql').reverse();

  if (upMigrations.length === 0) {
    console.error('No .up.sql migrations found — nothing to verify.');
    process.exit(1);
  }

  const db = new DatabaseSync(':memory:');
  db.exec('PRAGMA foreign_keys = ON;');

  applyAll(db, upMigrations);
  const before = schemaSnapshot(db);

  applyAll(db, downMigrations);
  const afterDown = schemaSnapshot(db);
  if (Object.keys(afterDown).length !== 0) {
    console.error(`down migrations left tables behind: [${Object.keys(afterDown)}]`);
    process.exit(1);
  }

  applyAll(db, upMigrations);
  const after = schemaSnapshot(db);

  const roundtripDiff = diffSnapshots(before, after);
  if (roundtripDiff) {
    console.error(roundtripDiff);
    process.exit(1);
  }

  const entities = parseDataModelEntities(opts.dataModel);
  const modelDiff = diffAgainstDataModel(after, entities);
  if (modelDiff) {
    console.error(modelDiff);
    process.exit(1);
  }

  console.log(`OK: ${upMigrations.length} migrations roundtrip (up→down→up) clean, schema matches data-model.md Entities (${Object.keys(entities).length} tables).`);
  process.exit(0);
}

main();
