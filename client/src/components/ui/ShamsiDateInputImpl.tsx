import { useMemo } from "react";
import DatePicker, { type Value } from "react-multi-date-picker";
import DateObject, { type Calendar, type Locale } from "react-date-object";
import gregorian from "react-date-object/calendars/gregorian";
import persian from "react-date-object/calendars/persian";
import TimePicker from "react-multi-date-picker/plugins/time_picker";
import { rtlLanguages } from "../../i18n/config";
import {
  formatDateInputValue,
  formatDateTimeLocalInputValue,
  formatMonthInputValue,
  parseDateInputValue,
  parseDateTimeLocalInputValue,
  parseMonthInputValue,
} from "../../shared/dateInputValue";
import type { ShamsiDateInputProps } from "./ShamsiDateInput";
import type { LocalizedDateTimeInputProps } from "./LocalizedDateTimeInput";
import type { LocalizedMonthInputProps } from "./LocalizedMonthInput";

const DARI_PERSIAN_LOCALE: Locale = {
  name: "persian_dari",
  months: [
    ["حمل", "حم"],
    ["ثور", "ثو"],
    ["جوزا", "جو"],
    ["سرطان", "سر"],
    ["اسد", "اس"],
    ["سنبله", "سن"],
    ["میزان", "میز"],
    ["عقرب", "عق"],
    ["قوس", "قو"],
    ["جدی", "جد"],
    ["دلو", "دل"],
    ["حوت", "حو"],
  ],
  weekDays: [
    ["شنبه", "شن"],
    ["یکشنبه", "یک"],
    ["دوشنبه", "دو"],
    ["سه‌شنبه", "سه"],
    ["چهارشنبه", "چه"],
    ["پنجشنبه", "پن"],
    ["جمعه", "جم"],
  ],
  digits: ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"],
  meridiems: [
    ["قبل از ظهر", "ق.ظ"],
    ["بعد از ظهر", "ب.ظ"],
  ],
};

const PASHTO_PERSIAN_LOCALE: Locale = {
  name: "persian_ps",
  months: [
    ["وری", "ور"],
    ["غویی", "غو"],
    ["غبرګولی", "غب"],
    ["چنګاښ", "چن"],
    ["زمری", "زم"],
    ["وږی", "وږ"],
    ["تله", "تل"],
    ["لړم", "لړ"],
    ["لیندۍ", "لی"],
    ["مرغومی", "مر"],
    ["سلواغه", "سل"],
    ["کب", "کب"],
  ],
  weekDays: [
    ["شنبه", "شن"],
    ["یکشنبه", "یک"],
    ["دوشنبه", "دو"],
    ["سه‌شنبه", "سه"],
    ["چهارشنبه", "څل"],
    ["پنجشنبه", "پن"],
    ["جمعه", "جم"],
  ],
  digits: ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"],
  meridiems: [
    ["غ.م", "غ.م"],
    ["غ.و", "غ.و"],
  ],
};

const DARI_GREGORIAN_LOCALE: Locale = {
  name: "gregorian_dari",
  months: [
    ["جنوری", "جنو"],
    ["فبروری", "فبر"],
    ["مارچ", "مار"],
    ["اپریل", "اپر"],
    ["می", "می"],
    ["جون", "جون"],
    ["جولای", "جول"],
    ["آگست", "آگس"],
    ["سپتامبر", "سپت"],
    ["اکتوبر", "اکت"],
    ["نوامبر", "نوا"],
    ["دسامبر", "دسا"],
  ],
  weekDays: [
    ["شنبه", "شن"],
    ["یکشنبه", "یک"],
    ["دوشنبه", "دو"],
    ["سه‌شنبه", "سه"],
    ["چهارشنبه", "چه"],
    ["پنجشنبه", "پن"],
    ["جمعه", "جم"],
  ],
  digits: ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"],
  meridiems: [
    ["قبل از ظهر", "ق.ظ"],
    ["بعد از ظهر", "ب.ظ"],
  ],
};

const PASHTO_GREGORIAN_LOCALE: Locale = {
  name: "gregorian_ps",
  months: [
    ["جنوري", "جن"],
    ["فبروري", "فبر"],
    ["مارچ", "مار"],
    ["اپرېل", "اپر"],
    ["مې", "مې"],
    ["جون", "جون"],
    ["جولای", "جول"],
    ["اګست", "اګس"],
    ["سپتمبر", "سپت"],
    ["اکتوبر", "اکت"],
    ["نومبر", "نوم"],
    ["دسمبر", "دسم"],
  ],
  weekDays: [
    ["شنبه", "شن"],
    ["یکشنبه", "یک"],
    ["دوشنبه", "دو"],
    ["سه‌شنبه", "سه"],
    ["چهارشنبه", "څل"],
    ["پنجشنبه", "پن"],
    ["جمعه", "جم"],
  ],
  digits: ["۰", "۱", "۲", "۳", "۴", "۵", "۶", "۷", "۸", "۹"],
  meridiems: [
    ["غ.م", "غ.م"],
    ["غ.و", "غ.و"],
  ],
};

type PickerConfig = {
  calendar?: Calendar;
  locale?: Locale;
};

export function ShamsiDateInputImpl({
  value,
  onChange,
  locale,
  inputClassName = "",
  containerClassName = "",
  placeholder = "YYYY/MM/DD",
  disabled = false,
}: ShamsiDateInputProps) {
  const language = locale.toLowerCase().split("-")[0] ?? locale;
  const isRtl = rtlLanguages.includes(language);
  const pickerConfig = useMemo(() => resolvePickerConfig(language), [language]);
  const pickerValue = useMemo(() => parseDateInputValue(value), [value]);
  const calendarClassName = `shamsi-date-input-calendar ${isRtl ? "shamsi-date-input-calendar--rtl" : ""}`.trim();

  return (
    <DatePicker
      value={pickerValue}
      onChange={(selected) => {
        const nextDate = toJsDate(selected);
        onChange(nextDate ? formatDateInputValue(nextDate) : "");
      }}
      calendar={pickerConfig.calendar}
      locale={pickerConfig.locale}
      format="YYYY/MM/DD"
      editable={false}
      weekStartDayIndex={0}
      zIndex={80}
      offsetY={4}
      disabled={disabled}
      placeholder={placeholder}
      inputClass={inputClassName}
      className={calendarClassName}
      containerClassName={`shamsi-date-input ${containerClassName}`.trim()}
      calendarPosition={isRtl ? "bottom-right" : "bottom-left"}
    />
  );
}

export function LocalizedMonthInputImpl({
  value,
  onChange,
  locale,
  inputClassName = "",
  containerClassName = "",
  placeholder = "YYYY/MM",
  disabled = false,
}: LocalizedMonthInputProps) {
  const language = locale.toLowerCase().split("-")[0] ?? locale;
  const isRtl = rtlLanguages.includes(language);
  const pickerConfig = useMemo(() => resolveMonthPickerConfig(language), [language]);
  const pickerValue = useMemo(() => parseMonthInputValue(value), [value]);
  const calendarClassName = `shamsi-date-input-calendar ${isRtl ? "shamsi-date-input-calendar--rtl" : ""}`.trim();

  return (
    <DatePicker
      value={pickerValue}
      onChange={(selected) => {
        const nextDate = toJsDate(selected);
        onChange(nextDate ? formatMonthInputValue(nextDate) : "");
      }}
      calendar={pickerConfig.calendar}
      locale={pickerConfig.locale}
      format="MMMM YYYY"
      onlyMonthPicker
      editable={false}
      weekStartDayIndex={0}
      zIndex={80}
      offsetY={4}
      disabled={disabled}
      placeholder={placeholder}
      inputClass={inputClassName}
      className={calendarClassName}
      containerClassName={`shamsi-date-input ${containerClassName}`.trim()}
      calendarPosition={isRtl ? "bottom-right" : "bottom-left"}
    />
  );
}

export function LocalizedDateTimeInputImpl({
  value,
  onChange,
  locale,
  inputClassName = "",
  containerClassName = "",
  placeholder = "YYYY/MM/DD HH:mm",
  disabled = false,
}: LocalizedDateTimeInputProps) {
  const language = locale.toLowerCase().split("-")[0] ?? locale;
  const isRtl = rtlLanguages.includes(language);
  const pickerConfig = useMemo(() => resolvePickerConfig(language), [language]);
  const pickerValue = useMemo(() => parseDateTimeLocalInputValue(value), [value]);
  const calendarClassName =
    `shamsi-date-input-calendar shamsi-date-input-calendar--datetime ${isRtl ? "shamsi-date-input-calendar--rtl" : ""}`.trim();

  return (
    <DatePicker
      value={pickerValue}
      onChange={(selected) => {
        const nextDate = toJsDate(selected);
        onChange(nextDate ? formatDateTimeLocalInputValue(nextDate) : "");
      }}
      calendar={pickerConfig.calendar}
      locale={pickerConfig.locale}
      format="YYYY/MM/DD HH:mm"
      editable={false}
      weekStartDayIndex={0}
      zIndex={80}
      offsetY={4}
      disabled={disabled}
      placeholder={placeholder}
      inputClass={inputClassName}
      className={calendarClassName}
      containerClassName={`shamsi-date-input shamsi-date-input--datetime ${containerClassName}`.trim()}
      calendarPosition={isRtl ? "bottom-right" : "bottom-left"}
      plugins={[<TimePicker key="time-picker" position={isRtl ? "left" : "right"} hideSeconds header={false} />]}
    />
  );
}

function resolvePickerConfig(language: string): PickerConfig {
  if (language === "fa") {
    return {
      calendar: persian,
      locale: DARI_PERSIAN_LOCALE,
    };
  }

  if (language === "ps") {
    return {
      calendar: persian,
      locale: PASHTO_PERSIAN_LOCALE,
    };
  }

  return {};
}

function resolveMonthPickerConfig(language: string): PickerConfig {
  if (language === "fa") {
    return {
      calendar: gregorian,
      locale: DARI_GREGORIAN_LOCALE,
    };
  }

  if (language === "ps") {
    return {
      calendar: gregorian,
      locale: PASHTO_GREGORIAN_LOCALE,
    };
  }

  return {};
}

function toJsDate(value: Value) {
  if (!value) return null;
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value;
  if (value instanceof DateObject) {
    const parsed = value.toDate();
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  if (typeof value === "string" || typeof value === "number") {
    const parsed = new Date(value);
    return Number.isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}
