import {
  IconCalendar,
  IconChevronLeft,
  IconChevronRight,
  IconClock,
  IconDots,
  IconLayoutGrid,
  IconList,
  IconSearch,
  IconUserCheck,
  IconUserPause,
  IconUserX,
  type Icon,
} from "@tabler/icons-react";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { Link } from "react-router-dom";
import {
  listStaffDailyAttendance,
  removeStaffJustification,
  saveStaffJustification,
  type StaffDailyResponse,
  type StaffDailyRow,
} from "../../api/attendanceEdition";
import { listEmployeeStaffGroupOptions, type EmployeeStaffGroupOption } from "../../api/employees";
import { useAuth } from "../../auth/AuthContext";
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
import { Modal } from "../../components/ui/Modal";
import { DropdownSelect } from "../../components/ui/DropdownSelect";
import { ShamsiDateInput } from "../../components/ui/ShamsiDateInput";
import { rtlLanguages } from "../../i18n/config";
import { formatDateInputValue, parseDateInputValue } from "../../shared/dateInputValue";
import { formatLocalizedLongDate } from "../../shared/dateLocale";
import { getAttendanceCopy } from "./attendanceCopy";

type ViewMode = "rows" | "cards";
type Copy = ReturnType<typeof getAttendanceCopy>;

const emptyDaily: StaffDailyResponse = {
  date: "",
  summary: { present: 0, absent: 0, late: 0, inside: 0, justified: 0, unscheduledPresentCount: 0, deniedCount: 0 },
  warnings: { noCheckout: 0, noShift: 0, multipleEvents: 0 },
  rows: [],
};

const STATUS_STYLES: Record<StaffDailyRow["status"], string> = {
  PRESENT: "border-emerald-500/40 bg-emerald-500/10 text-emerald-700 dark:border-emerald-500/50 dark:bg-emerald-500/10 dark:text-emerald-200",
  ABSENT: "border-rose-500/40 bg-rose-500/10 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-200",
  LATE: "border-amber-500/40 bg-amber-500/10 text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-200",
  INSIDE: "border-sky-500/40 bg-sky-500/10 text-sky-700 dark:border-sky-500/50 dark:bg-sky-500/10 dark:text-sky-200",
};

function dayValue(offset = 0) {
  const date = new Date();
  date.setDate(date.getDate() + offset);
  return formatDateInputValue(date);
}

function moveDay(value: string, offset: number) {
  const date = parseDateInputValue(value) ?? new Date();
  date.setDate(date.getDate() + offset);
  return formatDateInputValue(date);
}

export function StaffDailyAttendance() {
  const { i18n } = useTranslation();
  const copy = getAttendanceCopy(i18n.language);
  const { hasPermission } = useAuth();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const [date, setDate] = useState(() => dayValue());
  const [search, setSearch] = useState("");
  const [staffGroupId, setStaffGroupId] = useState("");
  const [shiftId, setShiftId] = useState("");
  const [mode, setMode] = useState<"primary" | "all">("primary");
  const [viewMode, setViewMode] = useState<ViewMode>("rows");
  const [groups, setGroups] = useState<EmployeeStaffGroupOption[]>([]);
  const [data, setData] = useState(emptyDaily);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [justifyRow, setJustifyRow] = useState<StaffDailyRow | null>(null);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);

  const shifts = useMemo(() => {
    const candidates = staffGroupId ? groups.filter((group) => group.id === staffGroupId) : groups;
    const unique = new Map<string, { id: string; shiftName: string }>();
    candidates.flatMap((group) => group.shifts).forEach((shift) => unique.set(shift.id, shift));
    return [...unique.values()];
  }, [groups, staffGroupId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await listStaffDailyAttendance({
        date,
        mode,
        ...(search.trim() ? { search: search.trim() } : {}),
        ...(staffGroupId ? { staffGroupId } : {}),
        ...(shiftId ? { shiftId } : {}),
      });
      setData(response.data);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : copy.loadFailed);
    } finally {
      setLoading(false);
    }
  }, [copy.loadFailed, date, mode, search, shiftId, staffGroupId]);

  useEffect(() => {
    void listEmployeeStaffGroupOptions().then((response) => setGroups(response.data)).catch(() => setGroups([]));
  }, []);
  useEffect(() => { void load(); }, [load]);

  const openJustification = (row: StaffDailyRow) => {
    if (!hasPermission("ATTENDANCE_JUSTIFY")) return;
    setJustifyRow(row);
    setReason(row.justificationReason ?? "");
  };

  const closeJustification = () => { if (!saving) setJustifyRow(null); };

  const saveJustification = async () => {
    if (!justifyRow) return;
    setSaving(true);
    setError(null);
    try {
      await saveStaffJustification({ memberId: justifyRow.memberId, date, ...(reason.trim() ? { reason: reason.trim() } : {}) });
      setJustifyRow(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const removeJustification = async () => {
    if (!justifyRow) return;
    setSaving(true);
    try {
      await removeStaffJustification(justifyRow.memberId, date);
      setJustifyRow(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : copy.saveFailed);
    } finally {
      setSaving(false);
    }
  };

  const cards = [
    { title: copy.present, icon: IconUserCheck, metrics: [{ label: copy.present, value: data.summary.present }, { label: copy.inside, value: data.summary.inside }, { label: copy.justified, value: data.summary.justified }] },
    { title: copy.absent, icon: IconUserX, metrics: [{ label: copy.absent, value: data.summary.absent }, { label: copy.late, value: data.summary.late }, { label: copy.denied, value: data.summary.deniedCount }] },
    { title: copy.warnings, icon: IconUserPause, metrics: [{ label: copy.noCheckout, value: data.warnings.noCheckout }, { label: copy.noShift, value: data.warnings.noShift }, { label: copy.multipleEvents, value: data.warnings.multipleEvents }] },
  ];

  const displayDate = formatLocalizedLongDate(date, i18n.language);
  const canGoForward = date < dayValue();

  return (
    <div className="attendance-clean space-y-4" data-testid="staff-daily-attendance" dir={isRtl ? "rtl" : "ltr"}>
      <header className="attendance-clean__header">
        <h2 className="attendance-clean__title">{copy.daily}</h2>
        <div className="attendance-clean__date" data-testid="attendance-daily-date-bar">
          <button aria-label={copy.previousDay} onClick={() => setDate(moveDay(date, -1))} type="button">
            {isRtl ? <IconChevronRight className="attendance-clean__date-icon" /> : <IconChevronLeft className="attendance-clean__date-icon" />}
          </button>
          <span>{displayDate}</span>
          <button aria-label={copy.nextDay} disabled={!canGoForward} onClick={() => setDate(moveDay(date, 1))} type="button">
            {isRtl ? <IconChevronLeft className="attendance-clean__date-icon" /> : <IconChevronRight className="attendance-clean__date-icon" />}
          </button>
        </div>
        <div className="attendance-clean__actions">
          <Link className="attendance-clean__btn" to="/reports/attendance"><IconList className="attendance-clean__btn-icon" />{copy.report}</Link>
        </div>
      </header>

      <div className="attendance-summary-grid" data-testid="attendance-daily-metrics">
        {cards.map((card) => <DailySummaryCard {...card} key={card.title} />)}
      </div>

      <div className="attendance-filterbar">
        <div className="attendance-search">
          <IconSearch className="attendance-icon" />
          <input aria-label={copy.search} onChange={(event) => setSearch(event.target.value)} placeholder={copy.search} type="search" value={search} />
        </div>
        <div className="attendance-select">
          <IconCalendar className="attendance-icon" />
          <ShamsiDateInput inputClassName="attendance-input" locale={i18n.language} onChange={setDate} value={date} />
        </div>
        <CompactSelect ariaLabel={copy.group} icon={IconUserCheck} onChange={(value) => { setStaffGroupId(value); setShiftId(""); }} value={staffGroupId} options={[{ value: "", label: `${copy.all} — ${copy.group}` }, ...groups.map((group) => ({ value: group.id, label: group.name }))]} />
        <CompactSelect ariaLabel={copy.shiftMode} icon={IconClock} onChange={(value) => { setMode(value as "primary" | "all"); if (value === "primary") setShiftId(""); }} value={mode} options={[{ value: "primary", label: copy.primaryShift }, { value: "all", label: copy.allShifts }]} />
        {mode === "all" ? <CompactSelect ariaLabel={copy.shift} icon={IconClock} onChange={setShiftId} value={shiftId} options={[{ value: "", label: copy.allShifts }, ...shifts.map((shift) => ({ value: shift.id, label: shift.shiftName }))]} /> : null}
        <div className="attendance-view-toggle">
          <button aria-label={copy.cardView} aria-pressed={viewMode === "cards"} className={`attendance-view-btn ${viewMode === "cards" ? "is-active" : ""}`} onClick={() => setViewMode("cards")} type="button"><IconLayoutGrid className="attendance-icon" /></button>
          <button aria-label={copy.rowView} aria-pressed={viewMode === "rows"} className={`attendance-view-btn ${viewMode === "rows" ? "is-active" : ""}`} onClick={() => setViewMode("rows")} type="button"><IconList className="attendance-icon" /></button>
        </div>
      </div>

      {error ? (
        <div className="attendance-cards-empty" data-testid="attendance-daily-error" role="alert">
          <p>{error}</p>
          <Button className="mt-2" size="sm" onClick={() => void load()}>{copy.retry}</Button>
        </div>
      ) : null}

      {viewMode === "rows" ? (
        <DailyTable copy={copy} language={i18n.language} loading={loading} onJustify={openJustification} rows={data.rows} />
      ) : (
        <DailyCards copy={copy} language={i18n.language} loading={loading} onJustify={openJustification} rows={data.rows} />
      )}

      <Modal
        closeLabel={copy.close}
        description={justifyRow?.memberFullName}
        footer={<>{justifyRow?.isJustified ? <Button disabled={saving} onClick={() => void removeJustification()} size="sm" variant="danger">{copy.remove}</Button> : null}<Button disabled={saving} onClick={closeJustification} size="sm" variant="secondary">{copy.cancel}</Button><Button loading={saving} loadingLabel={copy.loading} onClick={() => void saveJustification()} size="sm" variant="primary">{copy.save}</Button></>}
        onClose={closeJustification}
        open={Boolean(justifyRow)}
        size="sm"
        testId="attendance-justification-modal"
        title={copy.justification}
      >
        <label className="attendance-daily-justification-field"><span>{copy.reason}</span><textarea aria-label={copy.reason} onChange={(event) => setReason(event.target.value)} placeholder={copy.reason} value={reason} /></label>
      </Modal>
    </div>
  );
}

function DailySummaryCard({ icon: CardIcon, metrics, title }: { icon: Icon; metrics: Array<{ label: string; value: number }>; title: string }) {
  return (
    <div className="attendance-summary-card">
      <div className="attendance-summary-card__header">
        <div className="attendance-summary-card__title"><span className="attendance-summary-card__icon"><CardIcon className="h-5 w-5" stroke={1.8} /></span><span>{title}</span></div>
        <span aria-hidden="true" className="attendance-summary-card__menu"><IconDots className="h-4 w-4" /></span>
      </div>
      <div className="attendance-summary-card__metrics" style={{ gridTemplateColumns: `repeat(${metrics.length}, minmax(0, 1fr))` }}>
        {metrics.map((metric) => <div className="summary-metric" key={metric.label}><p className="summary-metric__label">{metric.label}</p><p className="summary-metric__value">{metric.value}</p><p className="summary-metric__delta neutral">—</p></div>)}
      </div>
    </div>
  );
}

function CompactSelect({ ariaLabel, icon: SelectIcon, onChange, options, value }: { ariaLabel: string; icon: Icon; onChange: (value: string) => void; options: Array<{ value: string; label: string }>; value: string }) {
  return <div className="attendance-select"><SelectIcon className="attendance-icon" /><DropdownSelect ariaLabel={ariaLabel} buttonClassName="attendance-native-select" onChange={onChange} options={options} value={value} /></div>;
}

function DailyTable({ copy, language, loading, onJustify, rows }: { copy: Copy; language: string; loading: boolean; onJustify: (row: StaffDailyRow) => void; rows: StaffDailyRow[] }) {
  return (
    <DataTableShell data-testid="attendance-daily-table">
      <DataTable minWidth="840px">
        <DataTableHead><DataTableRow>{[copy.employee, copy.duration, copy.status, copy.overtime, copy.shift, copy.justification].map((label) => <DataTableHeaderCell key={label}>{label}</DataTableHeaderCell>)}</DataTableRow></DataTableHead>
        <DataTableBody>
          {loading ? <DataTableSkeletonRows columns={6} rows={8} /> : rows.length === 0 ? <DataTableEmptyRow colSpan={6}>{copy.noRows}</DataTableEmptyRow> : rows.map((row) => (
            <DataTableRow clickable key={`${row.memberId}-${row.shiftId ?? "none"}`} onClick={() => onJustify(row)} data-testid="daily-row">
              <DataTableCell><EmployeeCell row={row} /></DataTableCell>
              <DataTableCell><ClockCell copy={copy} language={language} row={row} /></DataTableCell>
              <DataTableCell><StatusCell copy={copy} row={row} /></DataTableCell>
              <DataTableCell>{formatMinutes(row.overtimeMinutes, copy)}</DataTableCell>
              <DataTableCell><span className="attendance-pill"><IconClock className="attendance-icon" /><span className="attendance-pill__label">{row.hasShift ? row.shiftName : copy.noShift}</span></span></DataTableCell>
              <DataTableCell className="attendance-note"><Button onClick={(event) => { event.stopPropagation(); onJustify(row); }} size="sm" variant="ghost">{row.isJustified ? copy.details : copy.justification}</Button></DataTableCell>
            </DataTableRow>
          ))}
        </DataTableBody>
      </DataTable>
    </DataTableShell>
  );
}

function DailyCards({ copy, language, loading, onJustify, rows }: { copy: Copy; language: string; loading: boolean; onJustify: (row: StaffDailyRow) => void; rows: StaffDailyRow[] }) {
  return <div className="attendance-cards-grid">{loading ? Array.from({ length: 8 }).map((_, index) => <div className="attendance-card" key={index}><div className="attendance-skeleton" /><div className="attendance-skeleton" /><div className="attendance-skeleton" /></div>) : rows.length === 0 ? <div className="attendance-cards-empty">{copy.noRows}</div> : rows.map((row) => <button className="attendance-card" key={`${row.memberId}-${row.shiftId ?? "none"}`} onClick={() => onJustify(row)} type="button"><div className="attendance-card__head"><EmployeeCell row={row} /><StatusCell copy={copy} row={row} /></div><div className="attendance-card__meta"><CardItem label={copy.duration} value={clockLabel(row, language, copy)} /><CardItem label={copy.overtime} value={formatMinutes(row.overtimeMinutes, copy)} /><CardItem label={copy.shift} value={row.hasShift ? row.shiftName : copy.noShift} /><CardItem label={copy.justification} value={row.justificationReason || "—"} /></div></button>)}</div>;
}

function EmployeeCell({ row }: { row: StaffDailyRow }) {
  return <div className="attendance-employee"><span className="attendance-avatar" style={{ backgroundColor: getAvatarColor(row.memberFullName) }}>{getInitials(row.memberFullName)}</span><div><p className="attendance-employee__name">{row.memberFullName}</p><p className="attendance-employee__meta">{row.memberCode}{row.memberPhone ? ` | ${row.memberPhone}` : ""}</p></div></div>;
}

function ClockCell({ copy, language, row }: { copy: Copy; language: string; row: StaffDailyRow }) {
  return <div className="attendance-clock"><span className="attendance-time attendance-time--in">{formatTime(row.checkInAt, language)}</span><span className="attendance-clock__dot" /><span className="attendance-clock__duration">{formatMinutes(row.durationMinutes ?? row.liveDurationMinutes, copy)}</span><span className="attendance-clock__dot" /><span className="attendance-time attendance-time--out">{formatTime(row.checkOutAt, language)}</span></div>;
}

function StatusCell({ copy, row }: { copy: Copy; row: StaffDailyRow }) {
  const label = row.isJustified ? copy.justified : row.status === "ABSENT" ? copy.absent : row.status === "LATE" ? copy.late : row.status === "INSIDE" ? copy.inside : copy.present;
  return <span className={`attendance-status ${STATUS_STYLES[row.status]}`}>{label}</span>;
}

function CardItem({ label, value }: { label: string; value: string }) { return <div className="attendance-card__item"><span className="attendance-card__label">{label}</span><span className="attendance-card__value">{value}</span></div>; }

function clockLabel(row: StaffDailyRow, language: string, copy: Copy) { return `${formatTime(row.checkInAt, language)} - ${formatTime(row.checkOutAt, language)} (${formatMinutes(row.durationMinutes ?? row.liveDurationMinutes, copy)})`; }

function formatMinutes(value: number | null | undefined, copy: Copy) { return value == null ? "—" : `${value} ${copy.minutes}`; }

function formatTime(value: string | null | undefined, language: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "—" : new Intl.DateTimeFormat(language, { hour: "2-digit", minute: "2-digit" }).format(date);
}

const AVATAR_COLORS = ["#4f46e5", "#0ea5e9", "#14b8a6", "#f97316", "#a855f7", "#ef4444"];
function getInitials(name: string) { const parts = name.trim().split(/\s+/u).filter(Boolean); return parts.length ? parts.slice(0, 2).map((part) => part[0]).join("").toUpperCase() : "?"; }
function getAvatarColor(name: string) { let hash = 0; for (let index = 0; index < name.length; index += 1) { hash = (hash << 5) - hash + name.charCodeAt(index); hash |= 0; } return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]; }
