export function parseDateInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const date = buildExactLocalDate(Number(match[1]), Number(match[2]), Number(match[3]));
  return date;
}

export function parseMonthInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})$/u.exec(value);
  if (!match) return null;
  const year = Number(match[1]);
  const month = Number(match[2]);
  if (!Number.isInteger(year) || month < 1 || month > 12) return null;
  return new Date(year, month - 1, 1);
}

export function parseDateTimeLocalInputValue(value: string) {
  const match = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/u.exec(value);
  if (!match) return null;
  const hours = Number(match[4]);
  const minutes = Number(match[5]);
  if (hours < 0 || hours > 23 || minutes < 0 || minutes > 59) return null;
  return buildExactLocalDate(Number(match[1]), Number(match[2]), Number(match[3]), hours, minutes);
}

export function formatDateInputValue(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}-${twoDigits(date.getDate())}`;
}

export function formatMonthInputValue(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  return `${date.getFullYear()}-${twoDigits(date.getMonth() + 1)}`;
}

export function formatDateTimeLocalInputValue(date: Date) {
  if (Number.isNaN(date.getTime())) return "";
  return `${formatDateInputValue(date)}T${twoDigits(date.getHours())}:${twoDigits(date.getMinutes())}`;
}

export function localDateTimeInputToIso(value: string) {
  const parsed = parseDateTimeLocalInputValue(value);
  return parsed ? parsed.toISOString() : null;
}

function buildExactLocalDate(year: number, month: number, day: number, hours = 0, minutes = 0) {
  if (!Number.isInteger(year) || month < 1 || month > 12 || day < 1 || day > 31) return null;
  const date = new Date(year, month - 1, day, hours, minutes, 0, 0);
  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day ||
    date.getHours() !== hours ||
    date.getMinutes() !== minutes
  ) {
    return null;
  }
  return date;
}

function twoDigits(value: number) {
  return String(value).padStart(2, "0");
}
