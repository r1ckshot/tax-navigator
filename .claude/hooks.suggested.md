# Пропоновані hooks (вставляє Mike руками)

> ⚠️ **Перехідний файл — видалити після вставки.** Сам по собі він нічого не
> вмикає. Хуки стають робочими лише в `.claude/settings.json`, а той у git —
> тож після вставки команди житимуть у двох місцях і почнуть розходитись.
> Причини вибору (чому `node`, а не `jq`; що свідомо не додано) продубльовані в
> `docs/DECISIONS.md`, тож із видаленням цього файлу вони не загубляться.

Claude Code не редагує власний `.claude/settings.json` — тому блок нижче треба
**додати вручну** до наявного об'єкта (поруч із `permissions`, `sandbox`, `env`,
не замість них). Після вставки — відкрити `/hooks` один раз, щоб конфіг перечитався.

Усі три команди **перевірені пайп-тестом** 2026-07-24 в обидва боки (спрацьовує /
мовчить). Парсинг stdin — через `node`, а не `jq`: `jq` у девконтейнері немає, і
стандартні приклади з документації тут мовчки не працюють.

Правила, які ці хуки підпирають: [testing.md](rules/testing.md),
[visual-review.md](rules/visual-review.md), [environment-limits.md](rules/environment-limits.md).

```json
{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          {
            "type": "command",
            "if": "Bash(git commit*)",
            "statusMessage": "Ганяю тести перед комітом…",
            "timeout": 180,
            "command": "npm test --silent >/tmp/tn-test.log 2>&1 || node -e 'console.log(JSON.stringify({hookSpecificOutput:{hookEventName:\"PreToolUse\",permissionDecision:\"deny\",permissionDecisionReason:\"npm test впав — коміт заблоковано. Лог: /tmp/tn-test.log\"}}))'"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Write|Edit",
        "hooks": [
          {
            "type": "command",
            "command": "node -e 'let s=\"\";process.stdin.on(\"data\",d=>s+=d).on(\"end\",()=>{const f=(JSON.parse(s||\"{}\").tool_input||{}).file_path||\"\";if(/\\.(tsx|css)$/.test(f))console.log(JSON.stringify({hookSpecificOutput:{hookEventName:\"PostToolUse\",additionalContext:\"Візуальна зміна — не називати роботу готовою, поки Mike не подивився очима (.claude/rules/visual-review.md).\"}}))})'"
          }
        ]
      }
    ],
    "SessionStart": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "node -e 'const fs=require(\"fs\");try{console.log(JSON.stringify({hookSpecificOutput:{hookEventName:\"SessionStart\",additionalContext:fs.readFileSync(\".claude/rules/environment-limits.md\",\"utf8\")}}))}catch(e){}'"
          }
        ]
      }
    ]
  }
}
```

## Що кожен робить

| Хук | Коли | Ефект |
|---|---|---|
| PreToolUse / Bash | лише на `git commit*` (через `if`, тож на решті Bash не витрачається час) | тести впали → коміт **блокується** з причиною |
| PostToolUse / Write\|Edit | після правки `.tsx` або `.css` | нагадування, що візуальне не «готове» без твоїх очей |
| SessionStart | старт сесії | підтягує журнал меж середовища в контекст, щоб не відкривати блокери заново |

## Свідомо НЕ додано

- Хук, що ганяє тести після **кожної** правки: у цьому проєкті прогін ~7 с, на
  кожен Edit це роздратування без користі — тести й так ганяються перед комітом.
- Блокування коміту на «Mike не подивився UI»: хук не може знати, дивився чи ні.
  Це лишається правилом, а не автоматикою.
