import { StrictMode, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  IconAlertTriangle,
  IconCalendarCheck,
  IconChartBar,
  IconCircleCheck,
  IconPlus,
  IconRefresh,
  IconUsers,
} from "@tabler/icons-react";
import i18n, { rtlLanguages } from "../src/i18n/config";
import { ReportFilterField, ReportFiltersPanel } from "../src/components/reports/ReportFiltersPanel";
import { Button } from "../src/components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
} from "../src/components/ui/DataTable";
import { Modal } from "../src/components/ui/Modal";
import { PageHeader } from "../src/components/ui/PageHeader";
import { PaginationControls } from "../src/components/ui/PaginationControls";
import { EmptyState, ErrorState } from "../src/components/ui/StatePanel";
import { StatusBadge } from "../src/components/ui/StatusBadge";
import { SummaryCard } from "../src/components/ui/SummaryCard";
import "../src/index.css";

const query = new URLSearchParams(window.location.search);
const language = query.get("language") === "fa" ? "fa" : "en";
const theme = query.get("theme") === "light" ? "light" : "dark";
const isRtl = rtlLanguages.includes(language);

document.documentElement.lang = language;
document.documentElement.dir = isRtl ? "rtl" : "ltr";
document.documentElement.classList.toggle("theme-light", theme === "light");
void i18n.changeLanguage(language);

const copy = language === "fa"
  ? {
      eyebrow: "عملیات روزانه",
      title: "مرکز حاضری کارمندان",
      description: "نمونهٔ قطعی اجزای مشترک برای هر دو نسخه",
      add: "افزودن کارمند",
      secondary: "گزینهٔ دوم",
      active: "فعال",
      warning: "نیازمند بررسی",
      employees: "کارمندان فعال",
      present: "حاضر امروز",
      late: "تأخیرها",
      devices: "دستگاه‌های آنلاین",
      filters: "نمایش فیلترها",
      group: "گروپ",
      allGroups: "همه گروپ‌ها",
      date: "تاریخ",
      name: "نام",
      status: "وضعیت",
      time: "زمان ورود",
      emptyTitle: "داده‌ای پیدا نشد",
      emptyDescription: "فیلترها را تغییر دهید و دوباره تلاش کنید.",
      errorTitle: "داده بارگذاری نشد",
      errorDescription: "ارتباط را بررسی و درخواست را دوباره اجرا کنید.",
      retry: "تلاش دوباره",
      openModal: "بازکردن نمونه Modal",
      modalTitle: "ثبت حاضری دستی",
      modalDescription: "Modal مشترک با مدیریت Focus، Escape و جهت متن",
      cancel: "لغو",
      save: "ذخیره",
      modalBody: "این بخش محل محتوای فرم است.",
      tableCaption: "نمونهٔ جدول حاضری",
    }
  : {
      eyebrow: "Daily operations",
      title: "Employee attendance center",
      description: "Deterministic shared primitives for both product editions",
      add: "Add employee",
      secondary: "Secondary action",
      active: "Active",
      warning: "Needs review",
      employees: "Active employees",
      present: "Present today",
      late: "Late arrivals",
      devices: "Devices online",
      filters: "Show filters",
      group: "Group",
      allGroups: "All groups",
      date: "Date",
      name: "Name",
      status: "Status",
      time: "Check-in",
      emptyTitle: "No matching data",
      emptyDescription: "Change the filters and try again.",
      errorTitle: "Data could not be loaded",
      errorDescription: "Check the connection and retry the request.",
      retry: "Retry",
      openModal: "Open modal example",
      modalTitle: "Record manual attendance",
      modalDescription: "Shared modal with focus, Escape, and direction handling",
      cancel: "Cancel",
      save: "Save",
      modalBody: "This area represents form content.",
      tableCaption: "Attendance table example",
    };

function PrimitiveGallery() {
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [page, setPage] = useState(2);
  const [rowActivations, setRowActivations] = useState(0);

  return (
    <main
      data-testid="ui-primitives-gallery"
      style={{ minHeight: "100vh", background: "var(--bg-main)", color: "var(--text-primary)", padding: "24px" }}
    >
      <div style={{ width: "min(1080px, 100%)", margin: "0 auto", display: "grid", gap: "16px" }}>
        <PageHeader
          eyebrow={copy.eyebrow}
          title={copy.title}
          description={copy.description}
          icon={<IconCalendarCheck size={20} />}
          actions={(
            <>
              <Button variant="secondary">{copy.secondary}</Button>
              <Button variant="primary" startIcon={<IconPlus size={15} />}>{copy.add}</Button>
            </>
          )}
        />

        <section aria-label="Summary cards" style={{ display: "grid", gridTemplateColumns: "repeat(4, minmax(0, 1fr))", gap: "10px" }}>
          <SummaryCard label={copy.employees} value="48" detail="+2" tone="brand" icon={<IconUsers size={16} />} />
          <SummaryCard label={copy.present} value="42" detail="87.5%" tone="success" icon={<IconCircleCheck size={16} />} />
          <SummaryCard label={copy.late} value="3" detail="18 min" tone="warning" icon={<IconAlertTriangle size={16} />} />
          <SummaryCard label={copy.devices} value="2 / 2" detail="100%" tone="neutral" icon={<IconChartBar size={16} />} />
        </section>

        <ReportFiltersPanel
          open={filtersOpen}
          onToggle={() => setFiltersOpen((value) => !value)}
          toggleLabel={copy.filters}
          activeFiltersCount={1}
          panelId="primitive-filter-content"
          actions={<Button size="sm" variant="ghost">{copy.retry}</Button>}
        >
          <ReportFilterField label={copy.group}>
            <select className="attendance-report-filter-control h-9 w-full rounded-xl px-2.5 text-[12px]" defaultValue="all">
              <option value="all">{copy.allGroups}</option>
            </select>
          </ReportFilterField>
          <ReportFilterField label={copy.date}>
            <input className="attendance-report-filter-control h-9 w-full rounded-xl px-2.5 text-[12px]" value="2026-09-26" readOnly />
          </ReportFilterField>
        </ReportFiltersPanel>

        <section style={{ display: "grid", gridTemplateColumns: "minmax(0, 1.5fr) minmax(280px, 0.5fr)", gap: "12px" }}>
          <div style={{ minWidth: 0 }}>
            <DataTableShell>
              <DataTable variant="compact" minWidth="620px">
                <caption className="sr-only">{copy.tableCaption}</caption>
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{copy.name}</DataTableHeaderCell>
                    <DataTableHeaderCell>{copy.status}</DataTableHeaderCell>
                    <DataTableHeaderCell>{copy.time}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  <DataTableRow clickable aria-label="Activate Eraj Naseri row" onClick={() => setRowActivations((value) => value + 1)}>
                    <DataTableCell>Eraj Naseri</DataTableCell>
                    <DataTableCell><StatusBadge tone="success">{copy.active}</StatusBadge></DataTableCell>
                    <DataTableCell>08:02</DataTableCell>
                  </DataTableRow>
                  <DataTableRow>
                    <DataTableCell>Maryam Ahmadi</DataTableCell>
                    <DataTableCell><StatusBadge tone="warning">{copy.warning}</StatusBadge></DataTableCell>
                    <DataTableCell>08:17</DataTableCell>
                  </DataTableRow>
                </DataTableBody>
              </DataTable>
            </DataTableShell>
            <div style={{ marginTop: "8px" }}>
              <PaginationControls page={page} totalPages={6} totalItems={48} pageSize={10} onPageChange={setPage} showFirstLast compact />
            </div>
            <output data-testid="row-activation-count" style={{ position: "absolute", width: 1, height: 1, overflow: "hidden" }}>{rowActivations}</output>
          </div>

          <div style={{ display: "grid", gap: "10px" }}>
            <EmptyState title={copy.emptyTitle} description={copy.emptyDescription} icon={<IconUsers size={18} />} />
            <ErrorState
              title={copy.errorTitle}
              description={copy.errorDescription}
              icon={<IconAlertTriangle size={18} />}
              action={<Button size="sm" variant="ghost" startIcon={<IconRefresh size={14} />}>{copy.retry}</Button>}
            />
          </div>
        </section>

        <section aria-label="Buttons and badges" style={{ display: "flex", flexWrap: "wrap", alignItems: "center", gap: "8px", padding: "12px", border: "1px solid var(--ui-border)", borderRadius: "14px", background: "var(--ui-surface)" }}>
          <StatusBadge tone="brand">Brand</StatusBadge>
          <StatusBadge tone="info">Info</StatusBadge>
          <StatusBadge tone="danger">Blocked</StatusBadge>
          <Button data-testid="loading-button" loading loadingLabel="Loading">Loading</Button>
          <Button data-testid="open-primitive-modal" variant="primary" onClick={() => setModalOpen(true)}>{copy.openModal}</Button>
        </section>
      </div>

      <Modal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        title={copy.modalTitle}
        description={copy.modalDescription}
        closeLabel={copy.cancel}
        testId="primitive-modal"
        footer={(
          <>
            <Button variant="ghost" onClick={() => setModalOpen(false)}>{copy.cancel}</Button>
            <Button variant="primary" onClick={() => setModalOpen(false)}>{copy.save}</Button>
          </>
        )}
      >
        <p style={{ margin: 0, color: "var(--text-secondary)", fontSize: "13px" }}>{copy.modalBody}</p>
      </Modal>
    </main>
  );
}

createRoot(document.getElementById("root") as HTMLElement).render(
  <StrictMode>
    <PrimitiveGallery />
  </StrictMode>,
);
