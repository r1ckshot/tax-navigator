# tax-navigator-toolkit

## Purpose

Частина реального `.claude/` Tax Navigator, спакована в плагін: одна команда,
один скіл, один hook.

## Install

```bash
claude --plugin-dir ./tax-navigator-toolkit
```

## Commands

| Команда | Що робить |
|---|---|
| `/tax-navigator-toolkit:scaffold-rule` | Веде одну цифру `rules.2026.json` через evidence-numbers ланцюг. Без аргументу просить `rule_id`, нічого не редагує наосліп |

## Skills

| Skill | Коли спрацьовує |
|---|---|
| `add-source-domain` | Джерело-домен поза allowlist — чи варто відкривати і як |

## Hooks

| Event | Що робить |
|---|---|
| `PreToolUse` (`Bash`, `if: git commit*`) | `npm test` перед комітом, блокує при червоному |
| `PreToolUse` (`Bash`) | `${CLAUDE_PLUGIN_ROOT}/hooks/block-env-writes.mjs` — блокує запис у `.env*` через шелл |
| `PostToolUse` (`Write\|Edit`) | Нагадування про візуальний рев'ю після `.tsx`/`.css` |
| `SessionStart` | Вантажить `.claude/rules/environment-limits.md` проєкту-хоста в контекст |
