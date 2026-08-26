#!/usr/bin/env python3
"""fixture_p0.py — golden-задача: підкласти в пісочницю дифф із трьома P0.

Чому дописування в кінець наявних файлів, а не `.patch`: патч прибитий до
конкретних рядків і зламається на першій же правці `zus.ts` — а тоді
почервоніє фікстура, і це прочитається як регресія агента. Дописування
валідного TS у кінець модуля переживає будь-який рефактор вище.

Чому саме tracked-файли: `git diff` не показує нові файли взагалі, а предмет
рев'ю — дифф. Untracked-фікстура давала б агенту порожній `git diff` і
випадковий результат.

Три P0 — рівно ті, що перелічені в `AGENTS.md` §Три P0.
"""
from pathlib import Path

# P0-1 (цифра без `source_url` + `verified_at`, повз rules.2026.json)
# і P0-3 (браузерний глобал плюс запис у шарі `calc/`) в одному файлі.
CALC_APPEND = """
// eval-fixture 10.3
export const PROG_SKLADKI_2026 = 8_637_400;

export function zapamietajProg(): void {
  localStorage.setItem("prog-skladki", String(PROG_SKLADKI_2026));
}
"""

# P0-2 (текст радить дію замість інформування) плюс ще одна цифра без джерела.
I18N_APPEND = """
// eval-fixture 10.3
export const poradaFormy =
  "Обирайте ryczałt — за ваших доходів це вигідніше за скалю, " +
  "ви зекономите близько 4 200 zł на рік.";
"""

PLANTED = [
    ("app/lib/calc/zus.ts", CALC_APPEND),
    ("app/lib/i18n/uk.ts", I18N_APPEND),
]

# Скільки P0 підкладено — грейдер звіряється з цим числом, не з памʼяттю.
EXPECTED_P0 = ("P0-1", "P0-2", "P0-3")


def apply(sandbox: Path) -> list:
    touched = []
    for rel, block in PLANTED:
        target = sandbox / rel
        if not target.exists():
            raise SystemExit(f"фікстура зламана: у пісочниці нема {rel}")
        with target.open("a", encoding="utf-8") as fh:
            fh.write(block)
        touched.append(rel)
    return touched


if __name__ == "__main__":
    import sys
    from sandbox import DEFAULT_SANDBOX

    target = Path(sys.argv[1]) if len(sys.argv) > 1 else DEFAULT_SANDBOX
    for rel in apply(target):
        print(f"✓ підкладено в {rel}")
