import type { EvidenceItem } from "./types";
import { useTranslation } from "react-i18next";
import { TablePager } from "./TablePager";
import { resolveDateLocale } from "../../../shared/dateLocale";
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
} from "../../../components/ui/DataTable";

type Props = {
  items: EvidenceItem[];
  loading: boolean;
  page: number;
  pageInfo: { page: number; pageSize: number; totalItems: number; totalPages: number };
  onPageChange: (page: number) => void;
  onlyAnomalies: boolean;
  onToggleOnlyAnomalies: () => void;
  staffOnly?: boolean;
};

export function EvidenceTable({ items, loading, page, pageInfo, onPageChange, onlyAnomalies, onToggleOnlyAnomalies, staffOnly = false }: Props) {
  const { t, i18n } = useTranslation();

  return (
    <section className="space-y-2.5">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("attendanceReport.evidence.title")}</h3>
          <p className="text-[11px] text-slate-500 dark:text-slate-400">{t("attendanceReport.evidence.subtitle")}</p>
        </div>
        <button
          type="button"
          onClick={onToggleOnlyAnomalies}
          className={`h-8 rounded-lg border px-2.5 text-[11px] font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 ${
            onlyAnomalies
              ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
              : "border-slate-300 bg-white text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          }`}
        >
          {onlyAnomalies ? t("attendanceReport.evidence.showingAnomaliesOnly") : t("attendanceReport.evidence.showOnlyAnomalies")}
        </button>
      </header>

      <DataTableShell>
        <DataTable variant="report" minWidth="980px">
          <DataTableHead>
            <DataTableRow>
              <DataTableHeaderCell>{t("attendanceReport.evidence.timestamp")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.evidence.member")}</DataTableHeaderCell>
              {!staffOnly && <DataTableHeaderCell>{t("attendanceReport.evidence.type")}</DataTableHeaderCell>}
              <DataTableHeaderCell>{t("attendanceReport.evidence.event")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.evidence.device")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.evidence.source")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.evidence.result")}</DataTableHeaderCell>
              <DataTableHeaderCell>{t("attendanceReport.evidence.notes")}</DataTableHeaderCell>
            </DataTableRow>
          </DataTableHead>
          <DataTableBody>
            {loading ? (
              <DataTableSkeletonRows columns={staffOnly ? 7 : 8} rows={10} />
            ) : items.length === 0 ? (
              <DataTableEmptyRow colSpan={staffOnly ? 7 : 8}>{t("attendanceReport.evidence.empty")}</DataTableEmptyRow>
            ) : (
              items.map((item) => (
                <DataTableRow key={item.id}>
                  <DataTableCell>{new Date(item.timestamp).toLocaleString(resolveDateLocale(i18n.language))}</DataTableCell>
                  <DataTableCell className="font-medium text-slate-900 dark:text-slate-100">{item.memberName}</DataTableCell>
                  {!staffOnly && <DataTableCell>{formatMemberType(item.memberType, t)}</DataTableCell>}
                  <DataTableCell>
                    <EventChip eventType={item.eventType} />
                  </DataTableCell>
                  <DataTableCell>{item.deviceName ?? "-"}</DataTableCell>
                  <DataTableCell>{formatSource(item.source, t)}</DataTableCell>
                  <DataTableCell>
                    <ResultChip result={item.result} />
                  </DataTableCell>
                  <DataTableCell className="text-slate-600 dark:text-slate-300">{item.notes || item.denyReason || "-"}</DataTableCell>
                </DataTableRow>
              ))
            )}
          </DataTableBody>
        </DataTable>
      </DataTableShell>

      <TablePager pageInfo={pageInfo} page={page} onPageChange={onPageChange} />
    </section>
  );
}

function EventChip({ eventType }: { eventType: EvidenceItem["eventType"] }) {
  const { t } = useTranslation();
  const classes =
    eventType === "DENIED"
      ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
      : eventType === "OUT"
        ? "border-sky-300 bg-sky-100 text-sky-700 dark:border-sky-800 dark:bg-sky-900/30 dark:text-sky-200"
        : "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
  const label = eventType === "IN" ? t("attendance.badges.in") : eventType === "OUT" ? t("attendance.badges.out") : t("attendance.badges.denied");
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>{label}</span>;
}

function ResultChip({ result }: { result: EvidenceItem["result"] }) {
  const { t } = useTranslation();
  const classes =
    result === "denied"
      ? "border-rose-300 bg-rose-100 text-rose-700 dark:border-rose-800 dark:bg-rose-900/30 dark:text-rose-200"
      : "border-emerald-300 bg-emerald-100 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200";
  const label = result === "denied" ? t("attendance.badges.denied") : t("attendance.badges.authorized");
  return <span className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold ${classes}`}>{label}</span>;
}

function formatMemberType(memberType: EvidenceItem["memberType"], t: (key: string) => string) {
  if (memberType === "STAFF") return t("attendance.badges.staff");
  if (memberType === "CUSTOMER") return t("attendance.badges.customer");
  return t("common.labels.unknown");
}

function formatSource(source: EvidenceItem["source"], t: (key: string) => string) {
  if (source === "MANUAL") return t("attendance.badges.manual");
  if (source === "API") return t("attendance.badges.api");
  return t("attendance.badges.device");
}
