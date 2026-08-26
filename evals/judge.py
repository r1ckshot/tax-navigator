#!/usr/bin/env python3
"""judge.py — шар 4: LLM-суддя над текстом рев'ю. Єдиний шар, що коштує токени.

Три попередні шари відповідають на питання «чи не зламалась конфігурація» і
«чи не змінилось дерево» — обидва бінарні й дешеві. Питання «чи рев'ю взагалі
вартісне» бінарним не буває, тому тут ще один `claude -p` читає `rubric.md` і
повертає {score, reason}. Поріг 0.7.

Суддя свідомо не бачить ні діфу, ні конфігурації агента — лише текст звіту і
рубрику. Інакше він оцінював би не звіт, а свою власну здогадку про дифф.

  python3 evals/judge.py                 # оцінює evals/tmp/review.md
  python3 evals/judge.py <файл>
"""
import json
import re
import subprocess
import sys
from pathlib import Path

EVALS = Path(__file__).resolve().parent
DEFAULT_REVIEW = EVALS / "tmp" / "review.md"
THRESHOLD = 0.7
TIMEOUT_S = 600


def judge(review_text: str) -> dict:
    rubric = (EVALS / "rubric.md").read_text(encoding="utf-8")
    prompt = (rubric
              + "\n\nОціни текст рев'ю нижче. Відповідай ТІЛЬКИ JSON-обʼєктом "
                '{"score": <число 0..1>, "reason": "<одне речення>"}.\n\n'
                "=== ТЕКСТ РЕВʼЮ ===\n" + review_text)

    run = subprocess.run([str(EVALS / "claude-scrubbed.sh"), "-p", prompt],
                         capture_output=True, text=True, timeout=TIMEOUT_S)
    out = run.stdout.strip()
    match = re.search(r"\{.*\}", out, re.S)
    if not match:
        return {"score": 0.0,
                "reason": f"суддя не повернув JSON: {out[:200]!r}"}
    try:
        return json.loads(match.group(0))
    except json.JSONDecodeError as exc:
        return {"score": 0.0, "reason": f"JSON судді не парситься: {exc}"}


def main(argv) -> int:
    path = Path(argv[0]) if argv else DEFAULT_REVIEW
    if not path.exists():
        sys.exit(f"нема {path} — спершу прожени python3 evals/check.py")

    verdict = judge(path.read_text(encoding="utf-8"))
    print(json.dumps(verdict, ensure_ascii=False, indent=2))

    score = verdict.get("score", 0.0)
    if not isinstance(score, (int, float)) or score < THRESHOLD:
        print(f"\nFAIL: score {score} < поріг {THRESHOLD}")
        return 1
    print(f"\nPASS: score {score} >= поріг {THRESHOLD}")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
