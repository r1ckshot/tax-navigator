#!/usr/bin/env python3
"""sandbox.py — пісочниця для поведінкового шару. Нуль токенів.

Готового тула нема і не треба: копія потрібного зрізу репо + свій git,
щоразу з нуля. Своє репо потрібне, щоб (а) `git diff` показував рівно
підкладений фікстурою дифф і нічого більше, (б) грейдер міг спитати
`git status --porcelain` без шуму від справжнього робочого дерева,
(в) агент, який усе-таки щось запише, зіпсував пісочницю, а не репо.

Запуск:  python3 evals/sandbox.py [шлях]     (типово evals/tmp/sandbox)
"""
import hashlib
import shutil
import subprocess
import sys
from pathlib import Path

REPO = Path(__file__).resolve().parent.parent
DEFAULT_SANDBOX = REPO / "evals" / "tmp" / "sandbox"

# Зріз репо, якого вистачає diff-reviewer-у: код, який він рев'ює, і правила,
# проти яких він його рев'ює. Решта репо йому не потрібна й лише сповільнює
# копіювання на 9p.
SLICE = [
    "app/lib/calc",
    "app/lib/rules",
    "app/lib/i18n",
    ".claude/agents/diff-reviewer.md",
    ".claude/hooks/readonly-bash.mjs",
    ".claude/rules/product-safety.md",
    ".claude/rules/evidence-numbers.md",
    ".claude/rules/environment-limits.md",
    "AGENTS.md",
    "CLAUDE.md",
]

# Мінімальний settings.json пісочниці: реєструємо рівно той хук, який і є
# предметом перевірки. Копіювати справжній не можна — у ньому permissions,
# sandbox і env усього репо, і тоді тест міряв би не те.
SANDBOX_SETTINGS = """{
  "$schema": "https://json.schemastore.org/claude-code-settings.json",
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [
          { "type": "command", "command": "node .claude/hooks/readonly-bash.mjs" }
        ]
      }
    ]
  }
}
"""

GIT_ID = ["-c", "user.email=evals@example.test", "-c", "user.name=evals",
          "-c", "commit.gpgsign=false"]


def build(sandbox: Path) -> Path:
    shutil.rmtree(sandbox, ignore_errors=True)
    sandbox.mkdir(parents=True)

    for item in SLICE:
        src = REPO / item
        dst = sandbox / item
        dst.parent.mkdir(parents=True, exist_ok=True)
        if src.is_dir():
            shutil.copytree(src, dst)
        else:
            shutil.copy2(src, dst)

    (sandbox / ".claude" / "settings.json").write_text(
        SANDBOX_SETTINGS, encoding="utf-8")

    git = ["git", "-C", str(sandbox), *GIT_ID]
    subprocess.run([*git, "init", "-q"], check=True)
    subprocess.run([*git, "add", "-A"], check=True)
    subprocess.run([*git, "commit", "-qm", "seed: чистий старт пісочниці",
                    "--no-verify"], check=True)
    return sandbox


def fingerprint(sandbox: Path) -> str:
    """md5 по вмісту всього дерева пісочниці, поза .git.

    `git status --porcelain` бачить лише tracked-зміни й untracked-файли;
    відбиток ловить ще й правку, яку хтось міг би зробити і відкотити не до
    кінця. Два незалежні виміри однієї властивості — дешево і чесніше.
    """
    h = hashlib.md5()
    files = []
    for path in sandbox.rglob("*"):
        rel = path.relative_to(sandbox).as_posix()
        if path.is_file() and not rel.startswith(".git/"):
            files.append((rel, path))
    for rel, path in sorted(files):
        h.update(rel.encode())
        h.update(path.read_bytes())
    return h.hexdigest()


def status(sandbox: Path) -> str:
    return subprocess.run(
        ["git", "-C", str(sandbox), "status", "--porcelain"],
        capture_output=True, text=True).stdout.strip()


if __name__ == "__main__":
    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SANDBOX
    build(target)
    print(f"✓ пісочниця готова: {target}")
    print(f"  відбиток: {fingerprint(target)}")
