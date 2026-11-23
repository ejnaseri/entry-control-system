import React, { useState } from "react";
import { createRoot } from "react-dom/client";
import { ShamsiDateInput } from "../src/components/ui/ShamsiDateInput";
import { LocalizedDateTimeInput } from "../src/components/ui/LocalizedDateTimeInput";
import { LocalizedMonthInput } from "../src/components/ui/LocalizedMonthInput";
import "../src/index.css";

export function Harness() {
  const locale = new URLSearchParams(window.location.search).get("locale") ?? "en";
  const [date, setDate] = useState("2026-03-21");
  const [month, setMonth] = useState("2026-03");
  const [dateTime, setDateTime] = useState("2026-03-21T09:05");

  return (
    <main dir={locale === "en" ? "ltr" : "rtl"} style={{ display: "grid", gap: 24, padding: 40, width: 440 }}>
      <section data-testid="date-control">
        <ShamsiDateInput value={date} onChange={setDate} locale={locale} inputClassName="form-input" />
        <output data-testid="date-value">{date}</output>
      </section>
      <section data-testid="month-control">
        <LocalizedMonthInput value={month} onChange={setMonth} locale={locale} inputClassName="form-input" />
        <output data-testid="month-value">{month}</output>
      </section>
      <section data-testid="datetime-control">
        <LocalizedDateTimeInput value={dateTime} onChange={setDateTime} locale={locale} inputClassName="form-input" />
        <output data-testid="datetime-value">{dateTime}</output>
      </section>
    </main>
  );
}

const root = document.getElementById("root");
if (!root) throw new Error("Date localization test root is missing");
createRoot(root).render(<Harness />);
