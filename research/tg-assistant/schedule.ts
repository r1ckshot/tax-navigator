/**
 * Тижневий розклад циклу (AC-01): ISO-тиждень як ключ ідемпотентності
 * (`cycle_runs.week_of`, data-model.md) і момент, з якого цикл цього тижня
 * вважається належним. Усе в UTC — сервер і дослідник у різних поясах, а
 * межа тижня не має залежати від TZ контейнера.
 */

const DAY_MS = 24 * 60 * 60 * 1000;

export interface WeeklySchedule {
  /** ISO-день тижня: 1 = понеділок … 7 = неділя. */
  weekday: number;
  /** Година UTC, 0-23. */
  hourUtc: number;
}

/** Понеділок 00:00 UTC того ISO-тижня, в який потрапляє `date`. */
function isoWeekMonday(date: Date): Date {
  const midnight = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate());
  const daysSinceMonday = (new Date(midnight).getUTCDay() + 6) % 7;
  return new Date(midnight - daysSinceMonday * DAY_MS);
}

/** `2026-W38`. Рік — той, якому належить четвер тижня (ISO 8601). */
export function isoWeek(date: Date): string {
  const thursday = new Date(isoWeekMonday(date).getTime() + 3 * DAY_MS);
  const year = thursday.getUTCFullYear();
  const firstThursday = new Date(isoWeekMonday(new Date(Date.UTC(year, 0, 4))).getTime() + 3 * DAY_MS);
  const week = 1 + Math.round((thursday.getTime() - firstThursday.getTime()) / (7 * DAY_MS));
  return `${year}-W${String(week).padStart(2, '0')}`;
}

/** Момент циклу в ISO-тижні, якому належить `now`. */
export function scheduledMoment(now: Date, schedule: WeeklySchedule): Date {
  const monday = isoWeekMonday(now).getTime();
  return new Date(monday + (schedule.weekday - 1) * DAY_MS + schedule.hourUtc * 60 * 60 * 1000);
}

/**
 * Цикл належний, коли момент цього тижня настав, а тиждень ще не оброблено.
 * Пропущений тиждень окремо не наздоганяється: маркер `lastReadAt` на чат
 * покриває весь проміжок наступним же прогоном (AC-09).
 */
export function isCycleDue(now: Date, schedule: WeeklySchedule, weekAlreadyRun: boolean): boolean {
  return !weekAlreadyRun && now.getTime() >= scheduledMoment(now, schedule).getTime();
}
