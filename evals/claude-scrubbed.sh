#!/usr/bin/env bash
# claude-scrubbed.sh — обгортка над `claude`, придатна до виклику З-ПІД
# інтерактивної сесії Claude Code.
#
# Навіщо. Кожен скрипт eval-харнесу (`check.py`, `judge.py`, `promptfoo/provider.py`)
# шелить `claude -p …`. Запущений із Bash-тулу вже активної сесії, вкладений
# процес успадковує CLAUDECODE / CLAUDE_CODE_* / AI_AGENT — і головне,
# CLAUDE_CODE_SESSION_ID, ІДЕНТИЧНИЙ батьківському. Він торкається того самого
# session-стану (checkpointing / файловий лок), що й батьківська сесія, а та
# сама заблокована, чекаючи завершення цього-таки Bash-виклику. Дедлок:
# процес висить у D-стані (uninterruptible I/O wait), `timeout` шле SIGTERM
# вчасно, але доставити його нікуди — виміряно ~5 хв на реальному виклику
# (`.claude/rules/environment-limits.md`, 2026-08-02).
#
# CLAUDE_CONFIG_DIR свідомо НЕ знімається: без нього Claude Code не бачить
# довіру до /workspace і мовчки ігнорує permissions.allow з .claude/settings.json.
#
# З голого терміналу (CI, звичайний запуск людиною) жодної з цих змінних нема,
# і `env -u` просто нічого не робить — обгортка безпечна завжди.
#
# Використання:
#   evals/claude-scrubbed.sh -p "промпт" --agent diff-reviewer
#   CLAUDE_BIN=/usr/local/bin/claude evals/claude-scrubbed.sh --version
#
# Форма запозичена зі scripts/state-checkpoint/draft.sh (5.7 SDK), де цей самий
# скраб уже перевірений живими прогонами.

set -euo pipefail

exec env \
  -u CLAUDECODE \
  -u CLAUDE_CODE_CHILD_SESSION \
  -u CLAUDE_PID \
  -u CLAUDE_CODE_SESSION_ID \
  -u CLAUDE_CODE_ENABLE_SDK_FILE_CHECKPOINTING \
  -u CLAUDE_CODE_SUBPROCESS_ENV_SCRUB \
  -u CLAUDE_CODE_ENABLE_TASKS \
  -u CLAUDE_CODE_DISABLE_FEEDBACK_SURVEY \
  -u CLAUDE_CODE_ENTRYPOINT \
  -u CLAUDE_CODE_EXECPATH \
  -u CLAUDE_AGENT_SDK_VERSION \
  -u CLAUDE_AUTOCOMPACT_PCT_OVERRIDE \
  -u CLAUDE_EFFORT \
  -u AI_AGENT \
  "${CLAUDE_BIN:-claude}" "$@"
