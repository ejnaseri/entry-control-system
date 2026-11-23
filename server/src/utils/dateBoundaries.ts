export type LocalDateBoundaries = {
  todayStart: Date;
  tomorrowStart: Date;
  weekEndExclusive: Date;
  monthStart: Date;
  nextMonthStart: Date;
};

// Day/month boundaries are computed in server local time. config/env.ts sets
// Node's local timezone from validated APP_TIMEZONE (default: Asia/Kabul).
// Example local checks:
// now = 2026-02-19 14:30 => todayStart = 2026-02-19 00:00, monthStart = 2026-02-01 00:00
// now = 2026-03-01 09:10 => monthStart = 2026-03-01 00:00, nextMonthStart = 2026-04-01 00:00
export function getLocalDateBoundaries(now: Date): LocalDateBoundaries {
  const todayStart = startOfDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const weekEndExclusive = addDays(todayStart, 8);
  const monthStart = new Date(todayStart.getFullYear(), todayStart.getMonth(), 1);
  const nextMonthStart = new Date(todayStart.getFullYear(), todayStart.getMonth() + 1, 1);

  return {
    todayStart,
    tomorrowStart,
    weekEndExclusive,
    monthStart,
    nextMonthStart,
  };
}

function startOfDay(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  return d;
}

function addDays(date: Date, days: number): Date {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}
