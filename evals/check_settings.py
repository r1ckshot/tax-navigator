#!/usr/bin/env python3
"""check_settings.py — шар 2, регресійний кейс із реального інциденту репо.

Інцидент (2026-08-04 → 08-05, `CLAUDE.md` §Git). У `.claude/settings.json`
лежав ключ `attribution` зі значенням `true`. Схема чекає РЯДОК (текст
трейлера) — і через невідповідність типу Claude Code мовчки не застосовував
**весь** файл цілу добу. Нічого не впало, нічого не почервоніло: permissions,
hooks і env просто перестали діяти. Рівно та регресія конфігурації, заради
якої урок 10.3 існує.

Тому перевірка типів тут — не формальність: один неправильний тип у будь-якому
ключі глушить файл цілком. Нуль токенів, агент не запускається.

Другий чек того ж класу — зареєстрований хук, чий файл не існує. Він теж не
падає: конвеєр просто мовчки не викликає нічого.

Запуск:
    python3 evals/check_settings.py                       # .claude/settings.json
    python3 evals/check_settings.py <шлях>                 # довільний файл
    python3 evals/check_settings.py --self-test            # red-green на інциденті
"""
import json
import sys
import tempfile
from pathlib import Path

DEFAULT = Path(".claude/settings.json")

# Тип кожного відомого ключа верхнього рівня. Ключ поза списком — не помилка
# (схема Claude Code росте швидше за цей файл), але типи тих, що ми ставили
# свідомо, зафіксовані.
TOP_LEVEL_TYPES = {
    "$schema": str,
    "attribution": str,          # ← сам інцидент: тут було True
    "permissions": dict,
    "hooks": dict,
    "env": dict,
    "sandbox": dict,
    "worktree": dict,
    "model": str,
    "statusLine": dict,
    "enabledPlugins": dict,
    "enableAllProjectMcpServers": bool,
    "includeCoAuthoredBy": bool,
    "cleanupPeriodDays": int,
}

PERMISSION_LISTS = ("allow", "ask", "deny")


def check(path: Path, root: Path = None) -> list:
    """Повертає список помилок; порожній список = конфіг здоровий.

    `root` — корінь репо, від якого резолвляться шляхи хуків. Потрібен окремо
    від `path`, бо self-test кладе копію конфіга у tmp, а хуки лишаються тут.
    """
    errors = []

    try:
        raw = path.read_text(encoding="utf-8")
    except OSError as exc:
        return [f"{path}: не читається ({exc})"]

    try:
        cfg = json.loads(raw)
    except json.JSONDecodeError as exc:
        return [f"{path}: не валідний JSON — {exc}"]

    if not isinstance(cfg, dict):
        return [f"{path}: корінь має бути обʼєктом, а не {type(cfg).__name__}"]

    # 1. Типи відомих ключів верхнього рівня — той самий чек, що зловив би
    #    attribution: true.
    for key, want in TOP_LEVEL_TYPES.items():
        if key not in cfg:
            continue
        got = cfg[key]
        # bool — підклас int у Python; для int-ключів це треба відсікти окремо.
        if want is int and isinstance(got, bool):
            errors.append(f"{key}: очікується int, а лежить bool ({got!r})")
        elif not isinstance(got, want):
            errors.append(f"{key}: очікується {want.__name__}, "
                          f"а лежить {type(got).__name__} ({got!r})")

    # 2. env: КОЖНЕ значення — рядок. Число чи булеве тут дає ту саму тиху
    #    відмову, що attribution.
    for key, value in (cfg.get("env") or {}).items():
        if not isinstance(value, str):
            errors.append(f"env.{key}: очікується рядок, "
                          f"а лежить {type(value).__name__} ({value!r})")

    # 3. permissions.{allow,ask,deny} — списки рядків.
    perms = cfg.get("permissions") or {}
    if isinstance(perms, dict):
        for name in PERMISSION_LISTS:
            if name not in perms:
                continue
            lst = perms[name]
            if not isinstance(lst, list):
                errors.append(f"permissions.{name}: очікується список, "
                              f"а лежить {type(lst).__name__}")
                continue
            for item in lst:
                if not isinstance(item, str):
                    errors.append(f"permissions.{name}: елемент не рядок "
                                  f"({item!r})")

    # 4. Кожен зареєстрований хук вказує на файл, що існує. Хук зі зниклим
    #    файлом не падає — конвеєр мовчки не викликає нічого.
    if root is None:
        root = path.parent.parent if path.parent.name == ".claude" else Path(".")
    for event, matchers in (cfg.get("hooks") or {}).items():
        if not isinstance(matchers, list):
            errors.append(f"hooks.{event}: очікується список")
            continue
        for matcher in matchers:
            for hook in (matcher or {}).get("hooks", []) or []:
                command = (hook or {}).get("command", "")
                if not isinstance(command, str) or not command:
                    errors.append(f"hooks.{event}: порожня команда хука")
                    continue
                for token in command.split():
                    if token.endswith((".mjs", ".js", ".sh", ".py")):
                        if not (root / token).exists():
                            errors.append(
                                f"hooks.{event}: файл «{token}» не існує, "
                                f"хук мовчки не виконується")

    return errors


def self_test() -> int:
    """Red-green на самому інциденті: підкладаємо attribution: true."""
    good = json.loads(DEFAULT.read_text(encoding="utf-8"))

    print("── GREEN: чинний .claude/settings.json")
    errors = check(DEFAULT)
    for e in errors:
        print(f"  ✗ {e}")
    if errors:
        print("  self-test неможливий: чинний конфіг уже червоний")
        return 1
    print("  ✓ помилок нема")

    print("\n── RED: той самий файл із attribution: true (інцидент 2026-08-04)")
    broken = dict(good, attribution=True)
    with tempfile.TemporaryDirectory() as tmp:
        target = Path(tmp) / "settings.json"
        target.write_text(json.dumps(broken, ensure_ascii=False, indent=2),
                          encoding="utf-8")
        # root лишається реальним репо: предмет self-test-у — тип ключа,
        # а не відсутні у tmp файли хуків.
        errors = check(target, root=Path("."))
    for e in errors:
        print(f"  ✗ {e}")
    if not any(e.startswith("attribution:") for e in errors):
        print("  self-test ПРОВАЛЕНО: інцидент не спійманий")
        return 1
    print("  ✓ інцидент спійманий")
    return 0


def main(argv) -> int:
    if "--self-test" in argv:
        return self_test()

    path = Path(argv[0]) if argv else DEFAULT
    errors = check(path)
    for e in errors:
        print(f"✗ {e}")
    if errors:
        print(f"\n{path}: {len(errors)} помилок — конфіг може мовчки не діяти")
        return 1
    print(f"✓ {path}: типи ключів і файли хуків на місці")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
