import DateObject from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";

const SOLAR_MONTH_NAMES = {
  fa: ["حمل", "ثور", "جوزا", "سرطان", "اسد", "سنبله", "میزان", "عقرب", "قوس", "جدی", "دلو", "حوت"],
  ps: ["وری", "غویی", "غبرګولی", "چنګاښ", "زمری", "وږی", "تله", "لړم", "لیندۍ", "مرغومی", "سلواغه", "کب"],
} as const;

const SOLAR_WEEKDAY_NAMES = {
  fa: ["یکشنبه", "دوشنبه", "سه‌شنبه", "چهارشنبه", "پنجشنبه", "جمعه", "شنبه"],
  ps: ["یکشنبه", "دوشنبه", "سه‌شنبه", "څلرنۍ", "پنجشنبه", "جمعه", "شنبه"],
} as const;

const PERSIAN_DIGITS = ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"] as const;
type SolarLocale = keyof typeof SOLAR_MONTH_NAMES;

export function resolveDateLocale(locale = "en") {
  const normalized = locale.toLowerCase();
  if (normalized === "fa" || normalized.startsWith("fa-")) {
    return "fa-AF-u-ca-persian";
  }
  return locale;
}

export function resolveGregorianMonthLocale(locale = "en") {
  const normalized = locale.toLowerCase();
  if (normalized === "fa" || normalized.startsWith("fa-")) {
    return "fa-AF-u-ca-gregory";
  }
  if (normalized === "ps" || normalized.startsWith("ps-")) {
    return "ps-AF-u-ca-gregory";
  }
  return locale;
}

export function formatLocalizedLongDate(value: string | Date, locale = "en") {
  const parsed = parseLocalDate(value);
  if (!parsed) return typeof value === "string" ? value : "";

  const language = resolveLanguage(locale);
  if (language === "fa" || language === "ps") {
    return formatAfghanSolarLongDate(parsed, language);
  }

  return new Intl.DateTimeFormat(resolveDateLocale(locale), {
    weekday: "long",
    day: "2-digit",
    month: "long",
  }).format(parsed);
}

function formatAfghanSolarLongDate(date: Date, locale: SolarLocale) {
  const solarDate = new DateObject({ date, calendar: gregorian }).convert(persian);
  const weekday = SOLAR_WEEKDAY_NAMES[locale][date.getDay()];
  const day = toPersianDigits(solarDate.day);
  const month = SOLAR_MONTH_NAMES[locale][solarDate.month.index];
  return `${weekday} ${day} ${month}`;
}

function parseLocalDate(value: string | Date) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value;
  }

  if (!value) return null;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;
    const parsed = new Date(Number(year), Number(month) - 1, Number(day));
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function resolveLanguage(locale = "en") {
  return locale.toLowerCase().split("-")[0];
}

function toPersianDigits(value: number | string) {
  return String(value).replace(/\d/g, (digit) => PERSIAN_DIGITS[Number(digit)]);
}
