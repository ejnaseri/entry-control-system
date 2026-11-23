import {
  IconAdjustmentsHorizontal,
  IconAlertTriangle,
  IconArrowDownLeft,
  IconArrowUpRight,
  IconChevronUp,
  IconFileExport,
  IconFilter,
  IconPlus,
  IconRefresh,
  IconShieldX,
  IconSearch,
  IconUsersGroup,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import {
  createStaffManualEntry,
  downloadStaffEntryLogsCsv,
  downloadStaffEntryLogsXlsx,
  listAttendanceDeviceOptions,
  listStaffEntryLogs,
  type AttendanceDeviceOption,
  type EntryEventType,
  type EntryResult,
  type EntrySource,
  type StaffEntryLogsResponse,
} from "../../api/attendanceEdition";
import { listEmployees, type EmployeeSummary } from "../../api/employees";
import { useAuth } from "../../auth/AuthContext";
import { useToast } from "../../components/ToastContext";
import { Button } from "../../components/ui/Button";
import {
  DataTable,
  DataTableBody,
  DataTableCell,
  DataTableEmptyRow,
  DataTableHead,
  DataTableHeaderCell,
  DataTableRow,
  DataTableShell,
  DataTableSkeletonRows,
} from "../../components/ui/DataTable";
import { LocalizedDateTimeInput } from "../../components/ui/LocalizedDateTimeInput";
import { Modal } from "../../components/ui/Modal";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { PaginationControls } from "../../components/ui/PaginationControls";
import { ShamsiDateInput } from "../../components/ui/ShamsiDateInput";
import { ErrorState } from "../../components/ui/StatePanel";
import { formatDateTimeLocalInputValue, localDateTimeInputToIso, parseDateInputValue } from "../../shared/dateInputValue";
import { getAttendanceCopy } from "./attendanceCopy";

const PAGE_SIZE = 20;
const emptyLogs: StaffEntryLogsResponse = { items: [], page: 1, pageSize: PAGE_SIZE, total: 0, summary: { totalIn: 0, totalOut: 0, uniqueVisitors: 0, deniedAttempts: 0 } };

function dateBoundary(value: string, end: boolean) {
  const parsed = parseDateInputValue(value);
  if (!parsed) return undefined;
  if (end) parsed.setHours(23, 59, 59, 999);
  return parsed.toISOString();
}

export function StaffEntryLogs() {
  const { i18n } = useTranslation();
  const copy = getAttendanceCopy(i18n.language);
  const { hasPermission } = useAuth();
  const { push } = useToast();
  const [data, setData] = useState(emptyLogs);
  const [devices, setDevices] = useState<AttendanceDeviceOption[]>([]);
  const [employees, setEmployees] = useState<EmployeeSummary[]>([]);
  const [searchDraft, setSearchDraft] = useState("");
  const [search, setSearch] = useState("");
  const [memberId, setMemberId] = useState("");
  const [deviceId, setDeviceId] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [eventType, setEventType] = useState<EntryEventType | "ALL">("ALL");
  const [source, setSource] = useState<EntrySource | "ALL">("ALL");
  const [result, setResult] = useState<EntryResult | "ALL">("ALL");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [manualOpen, setManualOpen] = useState(false);
  const [manualEmployeeId, setManualEmployeeId] = useState("");
  const [manualEvent, setManualEvent] = useState<EntryEventType>("IN");
  const [occurredAt, setOccurredAt] = useState(() => formatDateTimeLocalInputValue(new Date()));
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState<"CSV" | "XLSX" | null>(null);

  const queryFilters = useMemo(() => ({
    eventType,
    source,
    result,
    ...(search ? { search } : {}),
    ...(memberId ? { memberId } : {}),
    ...(deviceId ? { deviceId } : {}),
    ...(dateBoundary(from, false) ? { from: dateBoundary(from, false) } : {}),
    ...(dateBoundary(to, true) ? { to: dateBoundary(to, true) } : {}),
  }), [deviceId, eventType, from, memberId, result, search, source, to]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listStaffEntryLogs({
        page,
        pageSize: PAGE_SIZE,
        ...queryFilters,
      });
      setData(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, page, queryFilters]);

  useEffect(() => {
    void Promise.all([
      listAttendanceDeviceOptions().then((response) => setDevices(response.data)),
      listEmployees({ status: "ACTIVE", take: 100, skip: 0 }).then((response) => setEmployees(response.data.items)),
    ]).catch(() => { setDevices([]); setEmployees([]); });
  }, []);
  useEffect(() => { void load(); }, [load]);

  const closeManual = () => {
    if (!saving) setManualOpen(false);
  };

  const submitManual = async () => {
    const occurredAtIso = localDateTimeInputToIso(occurredAt);
    if (!manualEmployeeId || !occurredAtIso) { setError(copy.required); return; }
    setSaving(true);
    setError(null);
    try {
      await createStaffManualEntry({ memberId: manualEmployeeId, eventType: manualEvent, occurredAt: occurredAtIso, ...(notes.trim() ? { notes: notes.trim() } : {}) });
      setManualOpen(false);
      setNotes("");
      setPage(1);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const reset = () => {
    setSearchDraft(""); setSearch(""); setMemberId(""); setDeviceId(""); setFrom(""); setTo("");
    setEventType("ALL"); setSource("ALL"); setResult("ALL"); setPage(1);
  };

  const handleExport = async (format: "CSV" | "XLSX") => {
    setExporting(format);
    try {
      const lang = resolveExportLanguage(i18n.language);
      const response = format === "CSV"
        ? await downloadStaffEntryLogsCsv({ ...queryFilters, lang })
        : await downloadStaffEntryLogsXlsx({ ...queryFilters, lang });
      saveBlob(response.data, `entry-control-attendance-entry-logs-${new Date().toISOString().slice(0, 10)}.${format.toLowerCase()}`);
      push({ kind: "success", title: copy.exportCompleted });
    } catch (exportError) {
      push({ kind: "error", title: exportError instanceof Error ? exportError.message : copy.exportFailed });
    } finally {
      setExporting(null);
    }
  };

  const lastPage = Math.max(1, Math.ceil(data.total / PAGE_SIZE));
  const activeFiltersCount = [search, memberId, deviceId, from, to, eventType !== "ALL", source !== "ALL", result !== "ALL"].filter(Boolean).length;
  return (
    <section className="entry-logs-compact entry-logs-page space-y-4" data-testid="staff-entry-logs">
      <section className="rounded-2xl border border-slate-200/80 bg-white/80 p-3 text-slate-900 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70 dark:text-slate-100">
        <div className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{copy.entryLogs}</h2>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">{copy.operationalOnly}</p>
          </div>
          <div className="flex flex-wrap gap-2">
            {hasPermission("ATTENDANCE_EXPORT") ? <>
              <CompactAction testId="entry-logs-export-csv" onClick={() => void handleExport("CSV")} disabled={exporting !== null} icon={<IconFileExport />}>{exporting === "CSV" ? copy.loading : copy.exportCsv}</CompactAction>
              <CompactAction testId="entry-logs-export-xlsx" onClick={() => void handleExport("XLSX")} disabled={exporting !== null} icon={<IconFileExport />}>{exporting === "XLSX" ? copy.loading : copy.exportXlsx}</CompactAction>
            </> : null}
            {hasPermission("ATTENDANCE_MANUAL") ? (
              <button type="button" data-testid="entry-logs-manual-open" onClick={() => setManualOpen(true)} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-600 px-2.5 text-[11px] font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 dark:border-brand-500 dark:bg-brand-500 dark:hover:bg-brand-600">
                <IconPlus className="h-3.5 w-3.5" stroke={1.9} /><span>{copy.addManual}</span>
              </button>
            ) : null}
          </div>
        </div>
      </section>

      <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4" data-testid="entry-logs-metrics">
        <EntryMetric testId="in" label={copy.totalIn} value={data.summary.totalIn} helper={copy.event} tone="emerald" icon={<IconArrowDownLeft />} />
        <EntryMetric testId="out" label={copy.totalOut} value={data.summary.totalOut} helper={copy.event} tone="blue" icon={<IconArrowUpRight />} />
        <EntryMetric testId="employees" label={copy.uniqueEmployees} value={data.summary.uniqueVisitors} helper={copy.employee} tone="violet" icon={<IconUsersGroup />} />
        <EntryMetric testId="denied" label={copy.deniedAttempts} value={data.summary.deniedAttempts} helper={copy.result} tone="amber" icon={<IconShieldX />} />
      </div>

      <form onSubmit={(event) => { event.preventDefault(); setPage(1); setSearch(searchDraft.trim()); }} className="overflow-visible rounded-2xl border border-slate-200/90 bg-white/80 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
        <div className="flex items-center justify-between gap-3 border-b border-slate-200/80 px-3 py-2.5 dark:border-slate-800">
          <div className="flex items-center gap-2"><IconAdjustmentsHorizontal className="h-3.5 w-3.5 text-brand-600 dark:text-brand-300" stroke={1.9} /><h3 className="text-xs font-semibold text-slate-900 dark:text-slate-100">{copy.filters}{activeFiltersCount ? ` (${activeFiltersCount})` : ""}</h3></div>
          <button type="button" data-testid="entry-logs-filter-toggle" onClick={() => setFiltersOpen((current) => !current)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-[10px] font-semibold text-brand-600 transition hover:bg-brand-50 dark:text-brand-200 dark:hover:bg-brand-500/10">
            <span>{filtersOpen ? copy.hideFilters : copy.showFilters}</span><IconChevronUp className={`h-3 w-3 transition ${filtersOpen ? "" : "rotate-180"}`} stroke={1.9} />
          </button>
        </div>
        {filtersOpen ? <div className="grid gap-2.5 p-3 sm:grid-cols-2 lg:grid-cols-4">
          <FilterField label={copy.search}><div className="relative"><IconSearch className="pointer-events-none absolute start-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" /><input aria-label={copy.search} className="form-input h-8 ps-8" placeholder={copy.search} value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} /></div></FilterField>
          <FilterField label={copy.employee}><DropdownSelect ariaLabel={copy.employee} buttonClassName="form-input h-8" searchable value={memberId} onChange={(value) => { setMemberId(value); setPage(1); }} options={[{ value: "", label: `${copy.all} — ${copy.employee}` }, ...employees.map((employee) => ({ value: employee.id, label: `${employee.code} — ${employee.firstName} ${employee.lastName}` }))]} /></FilterField>
          <FilterField label={copy.device}><DropdownSelect ariaLabel={copy.device} buttonClassName="form-input h-8" value={deviceId} onChange={(value) => { setDeviceId(value); setPage(1); }} options={[{ value: "", label: `${copy.all} — ${copy.device}` }, ...devices.map((device) => ({ value: device.id, label: device.name }))]} /></FilterField>
          <FilterField label={copy.event}><DropdownSelect ariaLabel={copy.event} buttonClassName="form-input h-8" value={eventType} onChange={(value) => { setEventType(value as EntryEventType | "ALL"); setPage(1); }} options={[{ value: "ALL", label: copy.all }, { value: "IN", label: copy.in }, { value: "OUT", label: copy.out }]} /></FilterField>
          <FilterField label={copy.from}><ShamsiDateInput value={from} onChange={(value) => { setFrom(value); setPage(1); }} locale={i18n.language} inputClassName="form-input h-8" /></FilterField>
          <FilterField label={copy.to}><ShamsiDateInput value={to} onChange={(value) => { setTo(value); setPage(1); }} locale={i18n.language} inputClassName="form-input h-8" /></FilterField>
          <FilterField label={copy.source}><DropdownSelect ariaLabel={copy.source} buttonClassName="form-input h-8" value={source} onChange={(value) => { setSource(value as EntrySource | "ALL"); setPage(1); }} options={[{ value: "ALL", label: copy.all }, { value: "DEVICE", label: copy.deviceSource }, { value: "MANUAL", label: copy.manual }, { value: "API", label: copy.api }]} /></FilterField>
          <FilterField label={copy.result}><DropdownSelect ariaLabel={copy.result} buttonClassName="form-input h-8" value={result} onChange={(value) => { setResult(value as EntryResult | "ALL"); setPage(1); }} options={[{ value: "ALL", label: copy.all }, { value: "AUTHORIZED", label: copy.authorized }, { value: "DENIED", label: copy.denied }]} /></FilterField>
          <div className="flex flex-wrap items-end justify-end gap-2 sm:col-span-2 lg:col-span-4">
            <button type="button" onClick={reset} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-slate-300 bg-white px-2.5 text-[11px] font-semibold text-slate-600 transition hover:border-brand-300 hover:text-brand-700 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-200"><IconRefresh className="h-3.5 w-3.5" /><span>{copy.clear}</span></button>
            <button type="submit" data-testid="entry-logs-apply-filters" className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-600 bg-brand-600 px-3 text-[11px] font-semibold text-white shadow-sm shadow-brand-600/20 transition hover:bg-brand-700 dark:border-brand-500 dark:bg-brand-500"><IconFilter className="h-3.5 w-3.5" /><span>{copy.search}</span></button>
          </div>
        </div> : null}
      </form>

      {error ? (
        <ErrorState
          data-testid="entry-logs-error"
          icon={<IconAlertTriangle className="h-5 w-5" stroke={1.8} />}
          title={error}
          action={<Button size="sm" onClick={() => void load()}>{copy.retry}</Button>}
        />
      ) : null}

      <DataTableShell className="staff-entry-logs-table-shell" data-testid="entry-logs-table">
        <DataTable minWidth="820px">
          <DataTableHead>
            <DataTableRow>
              {[copy.recordedAt, copy.employee, copy.event, copy.result, copy.device, copy.reason].map((label) => <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>)}
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? <DataTableSkeletonRows columns={6} rows={6} /> : data.items.length === 0 ? (
              <DataTableEmptyRow colSpan={6}>{copy.noLogs}</DataTableEmptyRow>
            ) : data.items.map((item) => (
              <DataTableRow data-testid="entry-log-row" key={item.id}>
                <DataTableCell className="staff-entry-logs-time">{formatDateTime(item.recordedAt, i18n.language)}</DataTableCell>
                <DataTableCell><div className="flex flex-wrap items-baseline gap-1.5"><span className="font-semibold text-slate-950 dark:text-slate-100">{item.memberFullName}</span><span className="text-[10px] text-slate-500 dark:text-slate-400">#{item.memberCode}</span></div></DataTableCell>
                <DataTableCell><EntryBadge tone={item.eventType === "IN" ? "emerald" : "amber"}>{item.eventType === "IN" ? copy.in : copy.out}</EntryBadge></DataTableCell>
                <DataTableCell><EntryBadge tone={item.isAuthorized ? "emerald" : "rose"}>{item.isAuthorized ? copy.authorized : copy.denied}</EntryBadge></DataTableCell>
                <DataTableCell className="text-slate-700 dark:text-slate-300">{item.deviceName || (item.source === "DEVICE" ? copy.deviceSource : item.source === "MANUAL" ? copy.manual : copy.api)}</DataTableCell>
                <DataTableCell><span className="staff-entry-logs-reason">{item.reason || "—"}</span></DataTableCell>
              </DataTableRow>
            ))}
          </DataTableBody>
        </DataTable>
      </DataTableShell>

      <PaginationControls
        buttonVariant="text"
        disabled={loading}
        nextLabel={copy.next}
        onPageChange={setPage}
        page={page}
        pageSize={PAGE_SIZE}
        previousLabel={copy.previous}
        totalItems={data.total}
        totalPages={lastPage}
      />

      <Modal
        open={manualOpen}
        onClose={closeManual}
        title={copy.addManual}
        description={copy.operationalOnly}
        closeLabel={copy.close}
        size="sm"
        testId="staff-entry-logs-manual-modal"
        footer={(
          <>
            <Button variant="secondary" size="sm" disabled={saving} onClick={closeManual}>{copy.cancel}</Button>
            <Button variant="primary" size="sm" loading={saving} loadingLabel={copy.loading} onClick={() => void submitManual()}>{copy.submit}</Button>
          </>
        )}
      >
        <div className="staff-entry-logs-manual-form">
          <label className="staff-entry-logs-modal-field">
            <span>{copy.employee}</span>
            <DropdownSelect ariaLabel={copy.selectEmployee} buttonClassName="staff-entry-logs-modal-control" searchable value={manualEmployeeId} onChange={setManualEmployeeId} options={[{ value: "", label: copy.selectEmployee }, ...employees.map((employee) => ({ value: employee.id, label: `${employee.code} — ${employee.firstName} ${employee.lastName}` }))]} />
          </label>
          <label className="staff-entry-logs-modal-field">
            <span>{copy.event}</span>
            <DropdownSelect ariaLabel={copy.event} buttonClassName="staff-entry-logs-modal-control" value={manualEvent} onChange={(value) => setManualEvent(value as EntryEventType)} options={[{ value: "IN", label: copy.in }, { value: "OUT", label: copy.out }]} />
          </label>
          <label className="staff-entry-logs-modal-field">
            <span>{copy.occurredAt}</span>
            <LocalizedDateTimeInput value={occurredAt} onChange={setOccurredAt} locale={i18n.language} inputClassName="staff-entry-logs-modal-control" />
          </label>
          <label className="staff-entry-logs-modal-field">
            <span>{copy.notes}</span>
            <textarea aria-label={copy.notes} value={notes} onChange={(event) => setNotes(event.target.value)} placeholder={copy.notes} />
          </label>
        </div>
      </Modal>
    </section>
  );
}

function EntryMetric({ icon, label, helper, tone, value, testId }: { icon: ReactNode; label: string; helper: string; tone: "emerald" | "blue" | "violet" | "amber"; value: number; testId: string }) {
  const tones = {
    emerald: "bg-emerald-100 text-emerald-600 dark:bg-emerald-500/15 dark:text-emerald-300",
    blue: "bg-blue-100 text-blue-600 dark:bg-blue-500/15 dark:text-blue-300",
    violet: "bg-violet-100 text-violet-600 dark:bg-violet-500/15 dark:text-violet-300",
    amber: "bg-amber-100 text-amber-600 dark:bg-amber-500/15 dark:text-amber-300",
  };
  return (
    <article data-testid={`entry-logs-metric-${testId}`} className="rounded-2xl border border-slate-200/90 bg-white/80 p-3 shadow-sm dark:border-slate-800/80 dark:bg-slate-950/70">
      <div className="flex items-start justify-between gap-3"><div><p className="text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</p><p className="mt-1 text-xl font-bold text-slate-950 dark:text-white">{value}</p><p className="text-[10px] text-slate-400 dark:text-slate-500">{helper}</p></div><span className={`inline-flex h-8 w-8 items-center justify-center rounded-xl ${tones[tone]} [&>svg]:h-4 [&>svg]:w-4`}>{icon}</span></div>
    </article>
  );
}

function FilterField({ children, label }: { children: ReactNode; label: string }) {
  return <label className="min-w-0 space-y-1.5"><span className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">{label}</span>{children}</label>;
}

function CompactAction({ children, disabled, icon, onClick, testId }: { children: ReactNode; disabled: boolean; icon: ReactNode; onClick: () => void; testId: string }) {
  return <button type="button" data-testid={testId} onClick={onClick} disabled={disabled} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-brand-300 bg-white px-2.5 text-[11px] font-semibold text-brand-700 shadow-sm transition hover:border-brand-400 hover:bg-brand-50 disabled:cursor-not-allowed disabled:opacity-50 dark:border-brand-500/40 dark:bg-slate-950/70 dark:text-brand-100 [&>svg]:h-3.5 [&>svg]:w-3.5">{icon}<span>{children}</span></button>;
}

function EntryBadge({ children, tone }: { children: ReactNode; tone: "emerald" | "amber" | "rose" }) {
  const classes = tone === "emerald" ? "border-emerald-300 bg-emerald-50 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200" : tone === "amber" ? "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200" : "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200";
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase ${classes}`}>{children}</span>;
}

function formatDateTime(value: string, language: string) {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(language, { dateStyle: "medium", timeStyle: "short" }).format(date);
}

function resolveExportLanguage(language: string): "en" | "fa" | "ps" {
  const normalized = language.toLowerCase();
  if (normalized.startsWith("fa") || normalized.startsWith("dr")) return "fa";
  if (normalized.startsWith("ps")) return "ps";
  return "en";
}

function saveBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.URL.revokeObjectURL(url);
}
