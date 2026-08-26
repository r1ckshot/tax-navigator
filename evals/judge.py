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


# Контракт на відповідь судді — схемою, не проханням у промпті. Перший нічний
# прогін (2026-08-26) упав саме тут: суддя почав писати правильний JSON, але
# вивід обірвався без закривальної дужки, `\{.*\}` не зматчився, і скрипт
# віддав score 0.0 як «не повернув JSON». Тобто червоне означало зламаний
# парсер, а не низьку якість рев'ю — найгірший різновид червоного.
SCHEMA = json.dumps({
    "type": "object",
    "properties": {
        "score": {"type": "number", "minimum": 0, "maximum": 1},
        "reason": {"type": "string"},
    },
    "required": ["score", "reason"],
    "additionalProperties": False,
})


def judge(review_text: str) -> dict:
    rubric = (EVALS / "rubric.md").read_text(encoding="utf-8")
    prompt = (rubric
              + "\n\nОціни текст рев'ю нижче. Відповідай ТІЛЬКИ JSON-обʼєктом "
                '{"score": <число 0..1>, "reason": "<одне коротке речення, '
                'не довше 200 символів>"}.\n\n'
                "=== ТЕКСТ РЕВʼЮ ===\n" + review_text)

    run = subprocess.run(
        [str(EVALS / "claude-scrubbed.sh"), "-p", prompt,
         "--output-format", "json", "--json-schema", SCHEMA,
         "--model", "claude-haiku-4-5", "--max-turns", "3"],
        capture_output=True, text=True, timeout=TIMEOUT_S)

    out = run.stdout.strip()
    # `--output-format json` загортає відповідь у конверт CLI; сама відповідь
    # лежить у полі `result` і вже провалідована проти схеми.
    try:
        envelope = json.loads(out)
        result = envelope.get("result", envelope)
        return result if isinstance(result, dict) else json.loads(result)
    except (json.JSONDecodeError, AttributeError):
        pass

    # Запасний шлях — і повний вивід у лог, а не 200 символів: діагностувати
    # обрив по обрізаному рядку неможливо.
    match = re.search(r"\{.*\}", out, re.S)
    if match:
        try:
            return json.loads(match.group(0))
        except json.JSONDecodeError:
            pass
    print("--- сирий вивід судді (не розібрався) ---")
    print(out or "(порожньо)")
    print(f"--- stderr ---\n{run.stderr[:2000]}")
    return {"score": 0.0, "reason": "вивід судді не розібрався, див. лог вище"}


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
