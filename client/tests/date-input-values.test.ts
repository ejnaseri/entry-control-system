import assert from "node:assert/strict";
import {
  formatDateInputValue,
  formatDateTimeLocalInputValue,
  formatMonthInputValue,
  localDateTimeInputToIso,
  parseDateInputValue,
  parseDateTimeLocalInputValue,
  parseMonthInputValue,
} from "../src/shared/dateInputValue.ts";

const leapDay = parseDateInputValue("2024-02-29");
assert.ok(leapDay);
assert.equal(formatDateInputValue(leapDay), "2024-02-29");
assert.equal(parseDateInputValue("2026-02-29"), null);
assert.equal(parseDateInputValue("2026-02-31"), null);
assert.equal(parseDateInputValue("2026-13-01"), null);
assert.equal(parseDateInputValue("2026/07/15"), null);

const month = parseMonthInputValue("2026-07");
assert.ok(month);
assert.equal(formatMonthInputValue(month), "2026-07");
assert.equal(parseMonthInputValue("2026-00"), null);
assert.equal(parseMonthInputValue("2026-13"), null);

const dateTime = parseDateTimeLocalInputValue("2026-07-15T09:05");
assert.ok(dateTime);
assert.equal(formatDateTimeLocalInputValue(dateTime), "2026-07-15T09:05");
assert.equal(localDateTimeInputToIso("2026-07-15T09:05"), new Date(2026, 6, 15, 9, 5, 0, 0).toISOString());
assert.equal(localDateTimeInputToIso("2026-02-31T09:05"), null);
assert.equal(parseDateTimeLocalInputValue("2026-07-15T24:00"), null);
assert.equal(parseDateTimeLocalInputValue("2026-07-15T12:60"), null);
assert.equal(parseDateTimeLocalInputValue("2026-02-31T12:00"), null);

assert.equal(formatDateInputValue(new Date(Number.NaN)), "");
assert.equal(formatMonthInputValue(new Date(Number.NaN)), "");
assert.equal(formatDateTimeLocalInputValue(new Date(Number.NaN)), "");

console.log("ok - localized date input values preserve valid Gregorian contracts and reject rollover values");
