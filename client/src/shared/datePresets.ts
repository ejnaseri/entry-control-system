export type LocalizedDatePreset = "today" | "thisWeek" | "thisMonth" | "custom";

type DateRange = {
  from: string;
  to: string;
};

const PERSIAN_DAY_FORMATTER = new Intl.DateTimeFormat("en-u-ca-persian", {
  day: "numeric",
});

export function getLocalizedDatePresetRange(
  preset: LocalizedDatePreset,
  locale = "en",
  now = new Date()
): DateRange {
  const today = startOfDay(now);

  if (preset === "today") {
    return { from: dateInput(today), to: dateInput(today) };
  }

  if (preset === "thisWeek") {
    const start = isPersianUiLocale(locale) ? startOfSaturdayWeek(today) : startOfMondayWeek(today);
    return { from: dateInput(start), to: dateInput(today) };
  }

  if (preset === "thisMonth") {
    const start = isPersianUiLocale(locale) ? startOfPersianMonth(today) : startOfGregorianMonth(today);
    return { from: dateInput(start), to: dateInput(today) };
  }

  return { from: dateInput(today), to: dateInput(today) };
}

export function dateInput(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isPersianUiLocale(locale: string) {
  const language = locale.toLowerCase().split("-")[0];
  return language === "fa" || language === "ps";
}

function startOfDay(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfGregorianMonth(date: Date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfMondayWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
  return start;
}

function startOfSaturdayWeek(date: Date) {
  const start = new Date(date);
  const day = start.getDay();
  start.setDate(start.getDate() - ((day + 1) % 7));
  return start;
}

function startOfPersianMonth(date: Date) {
  const currentPersianDay = Number(PERSIAN_DAY_FORMATTER.format(date));
  if (!Number.isFinite(currentPersianDay) || currentPersianDay <= 1) {
    return new Date(date);
  }

  const start = new Date(date);
  start.setDate(start.getDate() - (currentPersianDay - 1));
  return start;
}
