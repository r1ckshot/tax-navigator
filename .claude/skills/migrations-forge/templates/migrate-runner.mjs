#!/usr/bin/env node
// Reference migration runner for migrations-forge. Copy into a project as
// scripts/migrate.mjs (or stack-equivalent) only when a feature reaches
// implement-tasks — staged migrations stay staged until then, same
// discipline as the course skill's live-tree promotion.
//
// No golang-migrate / Alembic / Liquibase: none are present in this repo,
// and node:sqlite (built into Node 22+, experimental) covers everything a
// solo local-first tool needs without a new dependency.
//
// Usage:
//   node scripts/migrate.mjs up    [--dir <migrations-dir>] [--db <path>]
//   node scripts/migrate.mjs down  [--steps N] [--dir <migrations-dir>] [--db <path>]
//   node scripts/migrate.mjs status [--dir <migrations-dir>] [--db <path>]
//
// --db defaults to ./data.db; use :memory: for tests.

import { DatabaseSync } from 'node:sqlite';
import { readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';

function parseArgs(argv) {
  const [command, ...rest] = argv;
  const opts = { dir: 'migrations', db: 'data.db', steps: 1 };
  for (let i = 0; i < rest.length; i++) {
    if (rest[i] === '--dir') opts.dir = rest[++i];
    else if (rest[i] === '--db') opts.db = rest[++i];
    else if (rest[i] === '--steps') opts.steps = Number(rest[++i]);
  }
  return { command, opts };
}

function ensureBookkeeping(db) {
  db.exec(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      applied_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ','now'))
    );
  `);
}

function listMigrations(dir) {
  const files = readdirSync(dir).filter(f => f.endsWith('.up.sql')).sort();
  return files.map(f => ({ id: f.replace(/\.up\.sql$/, ''), up: f, down: f.replace(/\.up\.sql$/, '.down.sql') }));
}

function applied(db) {
  return new Set(db.prepare('SELECT id FROM schema_migrations').all().map(r => r.id));
}

function up(db, dir) {
  ensureBookkeeping(db);
  const done = applied(db);
  const pending = listMigrations(dir).filter(m => !done.has(m.id));
  if (pending.length === 0) { console.log('nothing to apply'); return; }
  for (const m of pending) {
    const sql = readFileSync(join(dir, m.up), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('INSERT INTO schema_migrations (id) VALUES (?)').run(m.id);
      db.exec('COMMIT');
      console.log('applied', m.up);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`migration ${m.up} failed: ${err.message}`);
    }
  }
}

function down(db, dir, steps) {
  ensureBookkeeping(db);
  const done = [...applied(db)];
  const all = listMigrations(dir);
  const doneOrdered = all.filter(m => done.includes(m.id)).slice(-steps).reverse();
  if (doneOrdered.length === 0) { console.log('nothing to revert'); return; }
  for (const m of doneOrdered) {
    const sql = readFileSync(join(dir, m.down), 'utf8');
    db.exec('BEGIN');
    try {
      db.exec(sql);
      db.prepare('DELETE FROM schema_migrations WHERE id = ?').run(m.id);
      db.exec('COMMIT');
      console.log('reverted', m.down);
    } catch (err) {
      db.exec('ROLLBACK');
      throw new Error(`rollback ${m.down} failed: ${err.message}`);
    }
  }
}

function status(db, dir) {
  ensureBookkeeping(db);
  const done = applied(db);
  for (const m of listMigrations(dir)) {
    console.log(done.has(m.id) ? '[x]' : '[ ]', m.id);
  }
}

const { command, opts } = parseArgs(process.argv.slice(2));
const db = new DatabaseSync(opts.db);
db.exec('PRAGMA foreign_keys = ON;');

if (command === 'up') up(db, opts.dir);
else if (command === 'down') down(db, opts.dir, opts.steps);
else if (command === 'status') status(db, opts.dir);
else {
  console.error('usage: migrate.mjs <up|down|status> [--dir <dir>] [--db <path>] [--steps N]');
  process.exit(1);
}
