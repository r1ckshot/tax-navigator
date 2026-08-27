#!/usr/bin/env python3
"""lint.py — шар 1 із чотирьох: статичний лінт конфігурації агентів.

Нуль токенів, секунда, агент не запускається. Лінт читає ТЕКСТ
`.claude/agents/*.md` і звіряє frontmatter із контрактом нижче. Диф
«+Write, +Edit» або тихий зсув `model` червоніють ще до першого прогону.

Що цей шар НЕ ловить (і чому потрібні наступні три): обхід через `Bash`
(`sed -i` замість `Edit`), накази в body («виправ прямо у файлі») і
недетермінізм самої моделі. Це видно лише поведінковому шару.

Запуск із кореня репо:  python3 evals/lint.py
"""
import re
import sys
from pathlib import Path

AGENTS_DIR = Path(".claude/agents")
HOOK = Path(".claude/hooks/readonly-bash.mjs")

# ──────────────────────────────────────────────────────────────────────────
# Контракт. Агента, якого тут немає, лінт валить — новий агент без свідомого
# контракту теж помилка. `model` присутній у кожного запису навмисно: поле,
# відсутнє у файлі агента, означає, що клас моделі мовчки їде за `/model`
# сесії (знайдено рев'ю 10.2 на п'ятьох агентах одразу).
# ──────────────────────────────────────────────────────────────────────────
CONTRACT = {
    "diff-reviewer": {
        "tools": {"Read", "Grep", "Glob", "Bash"},
        "model": "sonnet",
    },
    "drift-reviewer": {
        "tools": {"Read", "Grep", "Glob"},
        "model": "opus",
    },
    "env-scout": {
        "tools": {"Read", "Grep", "Glob", "Bash", "Write", "Edit"},
        "model": "sonnet",
        "memory": "project",
    },
    "explorer": {
        "tools": {"Read", "Grep", "Glob"},
        "model": "haiku",
    },
    "prd-critic": {
        "tools": {"Read", "Grep", "Glob"},
        "model": "opus",
    },
    "ro-reviewer": {
        "tools": {"Read", "Grep", "Glob"},
        "model": "opus",
    },
    "rules-auditor": {
        "tools": {"Read", "Grep", "Glob",
                  "mcp__evidence-guard__list_rules",
                  "mcp__evidence-guard__get_rule",
                  "mcp__evidence-guard__check_freshness"},
        "model": "opus",
    },
    "sad-critic": {
        "tools": {"Read", "Grep", "Glob"},
        "model": "opus",
    },
    "tdd-implementer": {
        "tools": {"Read", "Write", "Edit", "Bash", "Glob", "Grep"},
        "model": "inherit",
    },
    "tdd-refactorer": {
        "tools": {"Read", "Write", "Edit", "Bash", "Glob", "Grep"},
        "model": "inherit",
    },
    "tdd-test-writer": {
        "tools": {"Read", "Write", "Edit", "Bash", "Glob", "Grep"},
        "model": "inherit",
    },
}

KEY_RE = re.compile(r"^([A-Za-z_][A-Za-z0-9_-]*):(.*)$")


def frontmatter(md: Path) -> dict:
    """Пари ключ-значення між двома лініями `---`.

    Наївний парсер kit-а (`key, _, value = line.partition(":")`) на наших
    агентах ламається: `description: >` — згорнутий блок, і його рядки з
    двокрапкою всередині ставали б фальшивими ключами. Тому ключем
    вважається лише рядок БЕЗ відступу, що починається з `ключ:`.
    """
    lines = md.read_text(encoding="utf-8").splitlines()
    if not lines or lines[0].strip() != "---":
        return {}
    fm = {}
    for line in lines[1:]:
        if line.strip() == "---":
            break
        if line[:1].isspace():          # продовження згорнутого блоку
            continue
        m = KEY_RE.match(line)
        if m:
            fm[m.group(1)] = m.group(2).strip()
    return fm


def hook_allowlisted_agents() -> set:
    """Імена агентів із ALLOWLISTS у readonly-bash.mjs.

    Потрібне для крос-перевірки: хук і файл агента — дві половини однієї
    межі, і розійтись вони можуть мовчки (агент перейменували, хук лишився
    зі старим ключем і перестав фільтрувати будь-що).
    """
    if not HOOK.exists():
        return set()
    src = HOOK.read_text(encoding="utf-8")
    block = re.search(r"const ALLOWLISTS = \{(.*?)\n\};", src, re.S)
    if not block:
        return set()
    return set(re.findall(r"^\s{2}'([^']+)':", block.group(1), re.M))


def main() -> int:
    failed = False
    seen = set()

    for md in sorted(AGENTS_DIR.glob("*.md")):
        fm = frontmatter(md)
        name = fm.get("name", md.stem)
        seen.add(name)
        expected = CONTRACT.get(name)

        if expected is None:
            print(f"✗ {name}: агента нема в CONTRACT — додай контракт")
            failed = True
            continue

        tools = {t.strip() for t in fm.get("tools", "").split(",") if t.strip()}
        if tools != expected["tools"]:
            extra = sorted(tools - expected["tools"])
            missing = sorted(expected["tools"] - tools)
            print(f"✗ {name}: tools розійшлись із контрактом"
                  + (f"; зайве: {extra}" if extra else "")
                  + (f"; бракує: {missing}" if missing else ""))
            failed = True
            continue

        model = fm.get("model", "")
        if not model:
            print(f"✗ {name}: поле model відсутнє — клас моделі мовчки їде "
                  f"за /model сесії")
            failed = True
            continue
        if model != expected["model"]:
            print(f"✗ {name}: model «{model}» != контракт «{expected['model']}»")
            failed = True
            continue

        memory = fm.get("memory", "")
        if memory != expected.get("memory", ""):
            print(f"✗ {name}: memory «{memory or '—'}» != контракт "
                  f"«{expected.get('memory') or '—'}»")
            failed = True
            continue

        print(f"✓ {name}: tools, model{', memory' if memory else ''} "
              f"збігаються з контрактом")

    for name in sorted(set(CONTRACT) - seen):
        print(f"✗ {name}: є в CONTRACT, але файла агента нема")
        failed = True

    # Крос-перевірка хука: ключ ALLOWLISTS без агента фільтрує порожнечу,
    # а агент із Bash поза ALLOWLISTS має повний Bash попри «read-only» роль.
    for name in sorted(hook_allowlisted_agents() - seen):
        print(f"✗ readonly-bash.mjs: allowlist для «{name}», а такого агента нема")
        failed = True

    print()
    print(f"агентів: {len(seen)}, контракт: {len(CONTRACT)} — "
          + ("ПРОВАЛ" if failed else "усі збігаються"))
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
