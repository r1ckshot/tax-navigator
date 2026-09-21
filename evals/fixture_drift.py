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
CLEAN_RULE = "common.projected_average_wage"

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
                    # Значення, `source_url` і `verified_at` — рівно ті, що в
                    # rules.2026.json, а хост у SCRIPTABLE_HOSTS: інакше монітор
                    # такого запису видати не міг би, і уважний рецензент мав би
                    # право назвати рядок знахідкою. 2026-09-21 так і сталось із
                    # `nierejestrowana.limit`: у матриці його джерело на
                    # biznes.gov.pl, а фікстура підставляла zus.pl.
                    # diff_percent як у diff.mjs: (9500 - 9420) / 9420 · 100 = 0.85.
                    "rule_id": CLEAN_RULE,
                    "state": "divergence",
                    "matrix_value": 9420,
                    "fetched_value": 9500,
                    "diff_percent": 0.85,
                    "failure_reason": None,
                    "fetched_from": "https://www.zus.pl/en/firmy/rozliczenia-z-zus/30-krotnosc",
                    "source_url": "https://www.zus.pl/en/firmy/rozliczenia-z-zus/30-krotnosc",
                    "verified_at": "2026-07-24",
                },
            ],
        }
    ]
}


def clean_row_drift(matrix: dict) -> list[str]:
    """Чим чистий рядок розходиться з матрицею. Порожній список — він чистий.

    Звіряється до прогону агента: фікстура, що розійшлась із правилами, валить
    ворота на рецензенті, який якраз помітив розбіжність.
    """
    rules = {}

    def walk(node):
        if isinstance(node, list):
            for item in node:
                walk(item)
        elif isinstance(node, dict):
            if "rule_id" in node and "source_url" in node:
                rules[node["rule_id"]] = node
            for value in node.values():
                walk(value)

    walk(matrix)
    row = next(c for c in HISTORY["cycles"][0]["checks"] if c["rule_id"] == CLEAN_RULE)
    rule = rules.get(CLEAN_RULE)
    if rule is None:
        return [f"{CLEAN_RULE} немає в матриці"]
    problems = []
    for field in ("source_url", "verified_at"):
        if row[field] != rule[field]:
            problems.append(f"{field}: у фікстурі {row[field]!r}, у матриці {rule[field]!r}")
    if row["matrix_value"] not in (rule.get("params") or {}).values():
        problems.append(f"matrix_value {row['matrix_value']} немає серед params правила")
    return problems


def plant(sandbox: Path) -> Path:
    """Кладе звіт у пісочницю і повертає шлях до нього."""
    target = sandbox / "scripts" / "rules-change-monitor" / "data"
    target.mkdir(parents=True, exist_ok=True)
    report = target / REPORT_NAME
    report.write_text(json.dumps(HISTORY, ensure_ascii=False, indent=2), encoding="utf-8")
    return report


if __name__ == "__main__":
    print(json.dumps(HISTORY, ensure_ascii=False, indent=2))
