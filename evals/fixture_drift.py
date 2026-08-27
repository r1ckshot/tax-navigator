#!/usr/bin/env python3
"""fixture_drift.py — golden-задача для `drift-reviewer`.

Звіт місячної звірки з трьома підкладеними дефектами, по одному на перші три
перевірки з промпту агента. Четверта (цифра без джерела) навмисно ЧИСТА: eval,
у якому червоне все, не відрізняє уважного рецензента від того, хто просто
кричить REJECT на будь-що.

Фікстура — окремий файл у пісочниці, а не правка справжньої історії циклів:
предмет рев'ю тут читається агентом як дані (`Read`), тож `git diff` не
потрібен, на відміну від `fixture_p0.py`.

Дефекти:
  D1 (перевірка 2) — `match` при недоступному джерелі: тиша видана за
     підтвердження. Найдорожчий, бо людина повз такий рядок пройде.
  D2 (перевірка 3) — `cosmetic` там, де число зсунулось на 4%.
  D3 (перевірка 1) — стан поза переліком семи (`ok`).
"""
import json
from pathlib import Path

REPORT_NAME = "cycle-history.json"

# rule_id, за якими eval судить, чи агент назвав саме ці рядки
D1_RULE = "common.minimum_wage"
D2_RULE = "jdg.zdrowotna.ryczalt"
D3_RULE = "uop.pit"
CLEAN_RULE = "nierejestrowana.limit"

HISTORY = {
    "cycles": [
        {
            "month": "2026-08",
            "started_at": "2026-08-01T03:00:00.000Z",
            "finished_at": "2026-08-01T03:04:11.000Z",
            "status": "completed",
            "checks": [
                {
                    # D1: джерело не відповіло, а стан каже «збігається».
                    "rule_id": D1_RULE,
                    "state": "match",
                    "matrix_value": 4806,
                    "fetched_value": None,
                    "diff_percent": None,
                    "failure_reason": "запит не вдався: ETIMEDOUT",
                    "fetched_from": "https://www.zus.pl/baza-wiedzy/skladki",
                    "source_url": "https://www.zus.pl/baza-wiedzy/skladki",
                    "verified_at": "2026-07-18",
                },
                {
                    # D2: 4% різниці названо форматуванням.
                    "rule_id": D2_RULE,
                    "state": "cosmetic",
                    "matrix_value": 498.35,
                    "fetched_value": 518.28,
                    "diff_percent": 4.0,
                    "failure_reason": None,
                    "fetched_from": "https://www.zus.pl/baza-wiedzy/zdrowotna",
                    "source_url": "https://www.zus.pl/baza-wiedzy/zdrowotna",
                    "verified_at": "2026-07-18",
                },
                {
                    # D3: стану `ok` у переліку семи немає.
                    "rule_id": D3_RULE,
                    "state": "ok",
                    "matrix_value": 250,
                    "fetched_value": 250,
                    "diff_percent": 0,
                    "failure_reason": None,
                    "fetched_from": "https://www.podatki.gov.pl/twoj-e-pit",
                    "source_url": "https://www.podatki.gov.pl/twoj-e-pit",
                    "verified_at": "2026-07-24",
                },
                {
                    # Чистий рядок: справжня розбіжність, оформлена правильно.
                    "rule_id": CLEAN_RULE,
                    "state": "divergence",
                    "matrix_value": 10813.5,
                    "fetched_value": 11000.0,
                    "diff_percent": 1.72,
                    "failure_reason": None,
                    "fetched_from": "https://www.zus.pl/baza-wiedzy/nierejestrowana",
                    # Джерело в SCRIPTABLE_HOSTS: запис із доменом поза allowlist
                    # код видати не може, і уважний рецензент назвав би це
                    # знахідкою — тобто чистий рядок перестав би бути чистим.
                    "source_url": "https://www.zus.pl/baza-wiedzy/nierejestrowana",
                    "verified_at": "2026-08-03",
                },
            ],
        }
    ]
}


def plant(sandbox: Path) -> Path:
    """Кладе звіт у пісочницю і повертає шлях до нього."""
    target = sandbox / "scripts" / "rules-change-monitor" / "data"
    target.mkdir(parents=True, exist_ok=True)
    report = target / REPORT_NAME
    report.write_text(json.dumps(HISTORY, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(HISTORY, ensure_ascii=False, indent=2))
