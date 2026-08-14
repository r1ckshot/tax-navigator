---
name: tdd
description: TDD-orchestrator, що проганяє повний Red-Green-Refactor цикл через 3 ізольовані agents (адаптація демо 7.7-tdd-discipline під стек tax-navigator — vitest, колоковані `*.test.ts`, обов'язковий Co-Authored-By трейлер). Використовуй коли користувач каже `/tdd <story-id>` (наприклад `/tdd step2-retry-queue`), або «прогон TDD циклу на story X», «запусти TDD pipeline», «зроби RGR на цій story». Послідовно викликає tdd-test-writer → tdd-implementer → tdd-refactorer через Agent tool, з automatic bash-gates між фазами. Підтримує опційний flag `--review-tests` для зупинки після RED і human review.
allowed-tools: Bash, Read, Agent
---

# tdd — orchestrator повного RGR циклу

Цей skill — диригент. Сам НЕ пише ні тестів, ні коду. Викликає 3 справжніх Claude Code agents (з `.claude/agents/`) через Agent tool, кожен у своєму isolated context. Між фазами виконує bash-гейти автоматично. На failure будь-якого гейту — STOP з actionable error.

Чому 3 окремі agents, а не 3 кроки в одному контексті: якби я сам писав тести й код inline, увесь TDD-цикл проходив би в одному context window — той самий context pollution, від якого лікує ізоляція (лекція 7.7, Section 4). Agent tool створює окреме context window per phase зі своїм system prompt.

## Inputs

З користувацького промпта витягни:
- `<story-id>` — обов'язково. Наприклад `step2-retry-queue`. Має існувати файл `research/tg-assistant/tasks/<story-id>.md`.
- `--review-tests` — опційний flag. Якщо є, після Phase 1 зупинитись і чекати на user input («continue» / «abort») перед запуском Phase 2. Це augmented coding варіант з Section 9 лекції.

## Test command (стек цього репо)

Усі гейти нижче ганяють:

```
npx vitest run --config research/tg-assistant/vitest.config.ts
```

Не кореневий `npm test` — той сканує лише `app/**/*.test.ts` (окремий scope, `vitest.config.ts` в корені репо).

## Pre-flight checks (виконати ПЕРЕД будь-якою фазою)

Виконай у Bash:

1. `git status --porcelain` — output має бути порожній.
   - Якщо ні: STOP з `Working tree not clean. Commit or stash changes before /tdd <story-id>.`
2. `test -f research/tg-assistant/tasks/<story-id>.md && echo OK` — story-файл має існувати.
   - Якщо ні: STOP з `Story file research/tg-assistant/tasks/<story-id>.md not found.`
3. `git rev-parse HEAD` — запам'ятай baseline SHA для фінального звіту.

## Phase 1 — RED (tdd-test-writer)

Виклич Agent tool:

```
Agent(
  subagent_type="tdd-test-writer",
  description="RED phase: write failing tests for <story-id>",
  prompt="Story: <story-id>. Read research/tg-assistant/tasks/<story-id>.md, then follow your standard RED-phase workflow: write failing tests colocated as research/tg-assistant/<feature>.test.ts, confirm vitest red, commit with `test(<scope>): add failing tests per AC` (scope = domain prefix from story) plus the repo's Co-Authored-By trailer, output `RED phase commit: <SHA>`. STOP after commit. Do not write implementation."
)
```

Дочекайся завершення. Витягни з output рядок `RED phase commit: <SHA>` — запиши як `RED_SHA`.

### Gate 1 — verify RED state

Виконай у Bash послідовно:

- `git log -1 --pretty=%s` — output має починатись з `test(`.
  - Якщо ні: STOP з `Phase 1 gate failed: last commit subject doesn't start with test(. Got: <subject>. SHA: <RED_SHA>.`
- `git log -1 --pretty=%b | grep -q '^Co-Authored-By:'` — трейлер має бути присутній.
  - Якщо ні: STOP з `Phase 1 gate failed: commit missing Co-Authored-By trailer. pre-commit-gate would have rejected this — investigate why it didn't. SHA: <RED_SHA>.`
- `npx vitest run --config research/tg-assistant/vitest.config.ts; echo "EXIT:$?"` — exit code MUST be != 0 (нові тести мають падати).
  - Якщо EXIT:0: STOP з `Phase 1 gate failed: vitest passes after RED phase. Tests don't actually verify new behavior — they pass on the stub. SHA: <RED_SHA>.`

Якщо `--review-tests` flag присутній: STOP з:
```
Phase 1 complete (RED). Review tests via `git show <RED_SHA>`.
To continue: reply "continue" (skill re-detects RED state at HEAD and skips straight to Phase 2).
To abort: `git reset --hard <baseline-SHA>`.
```

## Phase 2 — GREEN (tdd-implementer)

Виклич Agent tool:

```
Agent(
  subagent_type="tdd-implementer",
  description="GREEN phase: implement <story-id> to make tests pass",
  prompt="Story: <story-id>. Read the test file (read-only) and interface stub under research/tg-assistant/. Follow your standard GREEN-phase workflow: write minimal implementation, drive vitest to green, commit with `feat(<scope>): implement to make tests pass` plus Co-Authored-By trailer, output `GREEN phase commit: <SHA>`. STOP after commit. Do NOT modify the test file."
)
```

Витягни `GREEN_SHA` з output.

### Gate 2 — verify GREEN state

Виконай у Bash:

- `git log -1 --pretty=%s` — output має починатись з `feat(`.
  - Якщо ні: STOP з `Phase 2 gate failed: last commit subject doesn't start with feat(. Got: <subject>. SHA: <GREEN_SHA>.`
- `git log -1 --pretty=%b | grep -q '^Co-Authored-By:'` — трейлер присутній.
  - Якщо ні: STOP з `Phase 2 gate failed: commit missing Co-Authored-By trailer. SHA: <GREEN_SHA>.`
- `npx vitest run --config research/tg-assistant/vitest.config.ts; echo "EXIT:$?"` — exit code MUST be 0.
  - Якщо ні: STOP з `Phase 2 gate failed: vitest still red after implementer. SHA: <GREEN_SHA>.`
- `git diff --name-only HEAD~1 HEAD -- '**/*.test.ts'` — output MUST be порожній (тести не торкалися).
  - Якщо непорожній: STOP з `Phase 2 gate failed: implementer modified a test file. Hard rule violated. Files changed: <files>. SHA: <GREEN_SHA>.`

## Phase 3 — REFACTOR (tdd-refactorer)

Виклич Agent tool:

```
Agent(
  subagent_type="tdd-refactorer",
  description="REFACTOR phase: extract helpers for <story-id>",
  prompt="Story: <story-id>. Refactor the implementation under research/tg-assistant/: extract at least 2 private helpers based on natural branches per story rules, run vitest after each change. Commit with `refactor(<scope>): extract helpers` plus Co-Authored-By trailer, output `REFACTOR phase commit: <SHA>`. If there is genuinely nothing to extract, output `REFACTOR phase skipped: implementation has no natural extraction points` instead and do not commit. Tests are STRICTLY read-only."
)
```

Витягни `REFACTOR_SHA` з output, або зафіксуй skip-рядок.

### Gate 3 — verify REFACTOR state

Якщо agent повернув skip-рядок — прийми без коміту, перейди одразу до Final report, познач Phase 3 як `skipped (no extraction points)`.

Інакше виконай у Bash:

- `git log -1 --pretty=%s` — output має починатись з `refactor(`.
  - Якщо ні: STOP з `Phase 3 gate failed: last commit subject doesn't start with refactor(. Got: <subject>. SHA: <REFACTOR_SHA>.`
- `git log -1 --pretty=%b | grep -q '^Co-Authored-By:'`.
  - Якщо ні: STOP з `Phase 3 gate failed: commit missing Co-Authored-By trailer. SHA: <REFACTOR_SHA>.`
- `npx vitest run --config research/tg-assistant/vitest.config.ts; echo "EXIT:$?"` — exit code MUST be 0.
  - Якщо ні: STOP з `Phase 3 gate failed: refactor broke tests. SHA: <REFACTOR_SHA>.`
- `git diff --name-only HEAD~1 HEAD -- '**/*.test.ts'` — output MUST be порожній.
  - Якщо непорожній: STOP з `Phase 3 gate failed: refactorer modified a test file. SHA: <REFACTOR_SHA>. Files: <files>.`
- `git show --stat HEAD -- research/tg-assistant/*.ts | grep -v test.ts` знайти змінений feature-файл, потім `grep -cE '^function \w|^const \w+\s*=\s*\(' <feature>.ts` — output MUST be ≥ 2 (мінімум 2 приватні helpers, не-експортовані; `export function`/`export const` не матчаться, бо не починаються з `function`/`const`). Не Python-конвенція з `_underscore` — цей репо називає приватні helpers звичайним camelCase (див. `state.ts`), без префікса.
  - Якщо < 2: STOP з `Phase 3 gate failed: refactorer extracted only <n> helpers, expected ≥ 2. SHA: <REFACTOR_SHA>.`

## Final report

Виведи користувачу:

```
TDD pipeline complete for <story-id>.

Commits:
  RED      <RED_SHA>      test(<scope>): add failing tests per AC
  GREEN    <GREEN_SHA>    feat(<scope>): implement to make tests pass
  REFACTOR <REFACTOR_SHA> refactor(<scope>): extract helpers   [or: skipped]

Gates passed:
  ✓ Phase 1: vitest red after test-writer, commit subject = test(, trailer present
  ✓ Phase 2: vitest green after implementer, test file untouched, trailer present
  ✓ Phase 3: vitest green after refactorer (or skip justified), test file untouched, trailer present

Inspect: git log --oneline -3
Verify isolation: git diff HEAD~3 HEAD -- '**/*.test.ts' (must be non-empty for RED phase only)
```

## Anti-patterns

- **Не виконуй фази inline.** Кожна фаза = окремий Agent tool call. Якщо пишеш тести сам у головному контексті — context pollution повернувся, semantic argument лекції зламано.
- **Не пропускай gates.** Gate 2/3 (`git diff -- '**/*.test.ts'`) — критичний; без нього втрачаєш гарантію, що implementer/refactorer не "виправив" тест.
- **Не пропускай trailer-gate.** Це не стилістична дрібниця цього репо — коміт без `Co-Authored-By` фізично блокується `pre-commit-gate`-хуком. Якщо гейт побачив коміт без трейлера, значить хук чомусь не спрацював — це сигнал зупинитись, не проігнорувати.
- **Не намагайся "fix" failing agent.** Якщо agent не зміг закрити phase — це сигнал про story або стек. STOP, дай користувачу побачити helpful error. Pipeline не повинен "майже працювати".
- **Не амальгамуй commits.** 3 окремих commits (або 2, якщо REFACTOR обґрунтовано пропущено) — це observability layer. Squash-у не місце у цьому pipeline.

## Example invocations

```
User: /tdd step2-retry-queue
You:  (run pre-flight → Phase 1 via Agent → Gate 1 via Bash → Phase 2 → Gate 2 → Phase 3 → Gate 3 → final report)

User: /tdd step2-retry-queue --review-tests
You:  (same as above, але STOP після Gate 1 з review prompt)

User: /tdd broken-story  (де тести виявились зеленими після test-writer)
You:  STOP з "Phase 1 gate failed: vitest passes after RED phase..."
```
