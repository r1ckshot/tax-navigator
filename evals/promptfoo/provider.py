"""provider.py — кастомний Promptfoo-провайдер для агента diff-reviewer.

Навіщо свій: готовий провайдер `anthropic:claude-agent-sdk` не запускає
НАЗВАНОГО агента з `.claude/agents/` головним потоком, а предмет тесту — саме
конфігурація `diff-reviewer`. Тож `call_api` — це наш `sandbox.py` +
`fixture_p0.py` + `claude -p --agent`, загорнуті в одну функцію.

Друга причина, вже локальна: виклик іде через `claude-scrubbed.sh`. Без
env-скраба вкладений `claude -p` успадковує CLAUDE_CODE_SESSION_ID батьківської
сесії і висне в D-стані (`.claude/rules/environment-limits.md`). У CI скраб
безпечно нічого не робить.

Контракт Promptfoo: call_api(prompt, options, context) -> {"output": <текст>}.

BREAK=1 підкладає в пісочницю `evals/broken/diff-reviewer.md` — асерти
конфігурації мають почервоніти.
"""
import os
import shutil
import subprocess
import sys
from pathlib import Path

EVALS = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(EVALS))

import fixture_p0          # noqa: E402
import sandbox as sb       # noqa: E402

SANDBOX = EVALS / "tmp" / "pf-sandbox"
TIMEOUT_S = 900


def call_api(prompt, options, context):
    sb.build(SANDBOX)
    fixture_p0.apply(SANDBOX)

    if os.environ.get("BREAK"):
        shutil.copy2(EVALS / "broken" / "diff-reviewer.md",
                     SANDBOX / ".claude" / "agents" / "diff-reviewer.md")
        print("[BREAK] застейджено evals/broken/diff-reviewer.md")

    run = subprocess.run(
        [str(EVALS / "claude-scrubbed.sh"), "-p", prompt,
         "--agent", "diff-reviewer", "--permission-mode", "acceptEdits"],
        cwd=SANDBOX, capture_output=True, text=True, timeout=TIMEOUT_S)

    (SANDBOX / "transcript.txt").write_text(run.stdout + run.stderr,
                                            encoding="utf-8")
    return {"output": run.stdout}
