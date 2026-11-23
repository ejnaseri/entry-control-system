import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { IconFileExport } from "@tabler/icons-react";
import { getEmployeeCopy } from "../../employees/employeeCopy";
import {
  ReportFilterField,
  ReportFiltersPanel,
  REPORT_FILTER_FIELD_CLASS,
} from "../../../components/reports/ReportFiltersPanel";
import { DropdownSelect } from "../../../components/ui/DropdownSelect";
import { ShamsiDateInput } from "../../../components/ui/ShamsiDateInput";
import type { AttendanceReportFilters, DatePreset, ExportKind } from "./types";

export type MemberFilterOption = {
  id: string;
  label: string;
};

type Props = {
  filters: AttendanceReportFilters;
  onChange: (patch: Partial<AttendanceReportFilters>) => void;
  onApplyPreset: (preset: DatePreset) => void;
  onApplyFilters: () => void;
  canApplyFilters: boolean;
  invalidDateRange: boolean;
  loading: boolean;
  shifts: Array<{ id: string; shiftName: string; shiftStart: string; shiftEnd: string }>;
  groups: Array<{ id: string; name: string }>;
  devices: Array<{ id: string; name: string }>;
  members: MemberFilterOption[];
  filtersOpen: boolean;
  onToggleFilters: () => void;
  exportMenuOpen: boolean;
  onToggleExportMenu: () => void;
  onExport: (kind: ExportKind) => void;
  busyExport: ExportKind | null;
  staffOnly?: boolean;
  allowExport?: boolean;
  exportPermission?: "financial" | "attendance";
};

export function FiltersPanel({
  filters,
  onChange,
  onApplyPreset,
  onApplyFilters,
  canApplyFilters,
  invalidDateRange,
  loading,
  shifts,
  groups,
  devices,
  members,
  filtersOpen,
  onToggleFilters,
  exportMenuOpen,
  onToggleExportMenu,
  onExport,
  busyExport,
  staffOnly = false,
  allowExport = true,
  exportPermission = "financial",
}: Props) {
  const { t, i18n } = useTranslation();
  const employeeCopy = getEmployeeCopy(i18n.language);
  const toggleLabel = filtersOpen ? t("common.actions.hideFilters") : t("common.actions.showFilters");
  const activeFiltersCount = [
    !staffOnly && filters.memberType !== "both",
    filters.onlyAnomalies,
    filters.eventType !== "all",
    filters.shiftMode !== "primary",
    Boolean(filters.shiftId),
    Boolean(filters.staffGroupId),
    Boolean(filters.deviceId),
    Boolean(filters.memberId),
  ].filter(Boolean).length;

  return (
    <ReportFiltersPanel
      open={filtersOpen}
      onToggle={onToggleFilters}
      toggleLabel={toggleLabel}
      activeFiltersCount={activeFiltersCount}
      actions={allowExport ? (
        <div className="relative">
          <button
            type="button"
            data-testid="attendance-report-export-menu"
            data-export-permission={exportPermission}
            onClick={onToggleExportMenu}
            className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
          >
            <IconFileExport className="h-3.5 w-3.5" stroke={1.8} />
            {busyExport ? t("attendanceReport.filters.exporting") : t("attendanceReport.filters.export")}
          </button>
          {exportMenuOpen ? (
            <div className="submenu-panel submenu-panel--compact absolute right-0 z-10 mt-1.5 w-44 rounded-lg border backdrop-blur">
              <ExportMenuItem testId="attendance-report-export-csv-daily" onClick={() => onExport("csvDaily")}>{t("attendanceReport.filters.exportCsvSummary")}</ExportMenuItem>
              <ExportMenuItem testId="attendance-report-export-csv-members" onClick={() => onExport("csvMembers")}>{t("attendanceReport.filters.exportCsvMembers")}</ExportMenuItem>
              <ExportMenuItem testId="attendance-report-export-csv-evidence" onClick={() => onExport("csvEvidence")}>{t("attendanceReport.filters.exportCsvEvidence")}</ExportMenuItem>
              <ExportMenuItem testId="attendance-report-export-xlsx" onClick={() => onExport("xlsx")}>{t("attendanceReport.filters.exportExcel")}</ExportMenuItem>
              <ExportMenuItem testId="attendance-report-export-pdf" onClick={() => onExport("pdf")}>{t("attendanceReport.filters.exportPdf")}</ExportMenuItem>
            </div>
          ) : null}
        </div>
      ) : null}
    >
      <ReportFilterField label={t("attendanceReport.filters.period")}>
        <DropdownSelect
          testId="attendance-report-preset"
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.preset}
          onChange={(value) => onApplyPreset(value as DatePreset)}
          options={[
            { value: "today", label: t("attendanceReport.filters.periodToday") },
            { value: "thisWeek", label: t("attendanceReport.filters.periodThisWeek") },
            { value: "thisMonth", label: t("attendanceReport.filters.periodThisMonth") },
            { value: "custom", label: t("attendanceReport.filters.periodCustom") },
          ]}
        />
      </ReportFilterField>

      <ReportFilterField label={t("attendanceReport.filters.from")}>
        <div data-testid="attendance-report-date-from">
          <ShamsiDateInput
            value={filters.from}
            onChange={(value) => onChange({ preset: "custom", from: value })}
            locale={i18n.language}
            inputClassName={REPORT_FILTER_FIELD_CLASS}
          />
        </div>
      </ReportFilterField>

      <ReportFilterField label={t("attendanceReport.filters.to")}>
        <div data-testid="attendance-report-date-to">
          <ShamsiDateInput
            value={filters.to}
            onChange={(value) => onChange({ preset: "custom", to: value })}
            locale={i18n.language}
            inputClassName={REPORT_FILTER_FIELD_CLASS}
          />
        </div>
      </ReportFilterField>

      {invalidDateRange ? (
        <p
          className="self-end text-[11px] font-semibold text-rose-600 dark:text-rose-300"
          data-testid="attendance-report-date-error"
        >
          {t("attendanceReport.filters.from")} ≤ {t("attendanceReport.filters.to")}
        </p>
      ) : null}

      {!staffOnly ? <ReportFilterField label={t("attendanceReport.filters.memberType")}>
        <DropdownSelect
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.memberType}
          onChange={(value) => onChange({ memberType: value as AttendanceReportFilters["memberType"] })}
          options={[
            { value: "both", label: t("attendanceReport.filters.memberTypeBoth") },
            { value: "staff", label: t("attendanceReport.filters.memberTypeStaff") },
            { value: "customer", label: t("attendanceReport.filters.memberTypeCustomer") },
          ]}
        />
      </ReportFilterField> : null}

      <ReportFilterField label={t("attendanceReport.filters.eventType")}>
        <DropdownSelect
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.eventType}
          onChange={(value) => onChange({ eventType: value as AttendanceReportFilters["eventType"] })}
          options={[
            { value: "all", label: t("attendanceReport.filters.allEvents") },
            { value: "in", label: t("attendanceReport.filters.eventIn") },
            { value: "out", label: t("attendanceReport.filters.eventOut") },
            { value: "denied", label: t("attendanceReport.filters.eventDenied") },
          ]}
        />
      </ReportFilterField>

      <ReportFilterField label={t("attendanceReport.filters.shiftMode")}>
        <DropdownSelect
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.shiftMode}
          onChange={(value) => onChange({ shiftMode: value as AttendanceReportFilters["shiftMode"], shiftId: "" })}
          options={[
            { value: "primary", label: t("attendanceReport.filters.shiftPrimary") },
            { value: "all", label: t("attendanceReport.filters.shiftAll") },
            { value: "ignoreShifts", label: t("attendanceReport.filters.shiftIgnore") },
          ]}
        />
      </ReportFilterField>

      {filters.shiftMode === "all" ? (
        <ReportFilterField label={t("attendanceReport.filters.shift")}>
          <DropdownSelect
            buttonClassName={REPORT_FILTER_FIELD_CLASS}
            value={filters.shiftId}
            onChange={(value) => onChange({ shiftId: value })}
            options={[
              { value: "", label: t("attendanceReport.filters.allShifts") },
              ...shifts.map((shift) => ({
                value: shift.id,
                label: `${shift.shiftName} (${shift.shiftStart}-${shift.shiftEnd})`,
              })),
            ]}
          />
        </ReportFilterField>
      ) : null}

      <ReportFilterField label={t("attendanceReport.filters.group")}>
        <DropdownSelect
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.staffGroupId}
          onChange={(value) => onChange({ staffGroupId: value })}
          options={[
            { value: "", label: t("attendanceReport.filters.allGroups") },
            ...groups.map((group) => ({ value: group.id, label: group.name })),
          ]}
        />
      </ReportFilterField>

      <ReportFilterField label={t("attendanceReport.filters.device")}>
        <DropdownSelect
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.deviceId}
          onChange={(value) => onChange({ deviceId: value })}
          options={[
            { value: "", label: t("attendanceReport.filters.allDevices") },
            ...devices.map((device) => ({ value: device.id, label: device.name })),
          ]}
        />
      </ReportFilterField>

      <ReportFilterField label={staffOnly ? employeeCopy.employees : t("attendanceReport.tabs.members")} className="md:col-span-2 xl:col-span-2">
        <DropdownSelect
          buttonClassName={REPORT_FILTER_FIELD_CLASS}
          value={filters.memberId}
          onChange={(value) => onChange({ memberId: value })}
          searchable
          searchPlaceholder={t("attendanceReport.filters.searchPlaceholder")}
          options={[
            { value: "", label: t("attendanceReport.filters.searchPlaceholder") },
            ...members.map((member) => ({
              value: member.id,
              label: member.label,
            })),
          ]}
        />
      </ReportFilterField>

      <ReportFilterField label={t("attendanceReport.filters.scope")}>
        <div className="flex h-9 items-center">
          <label className="report-inline-toggle">
            <input
              type="checkbox"
              checked={filters.onlyAnomalies}
              onChange={(event) => onChange({ onlyAnomalies: event.target.checked })}
              className="report-inline-toggle__input"
            />
            <span className="report-inline-toggle__text">{t("attendanceReport.filters.onlyAnomalies")}</span>
          </label>
        </div>
      </ReportFilterField>

      <div className="flex items-end justify-end">
        <button
          type="button"
          data-testid="attendance-report-apply-filters"
          className="attendance-export-btn inline-flex h-8 min-w-24 items-center justify-center gap-1.5 rounded-lg border border-brand-500 bg-brand-500 px-2.5 text-[11px] font-semibold text-white transition hover:bg-brand-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30 disabled:opacity-45"
          disabled={!canApplyFilters || loading}
          onClick={onApplyFilters}
        >
          {t("common.actions.applyFilters")}
        </button>
      </div>
    </ReportFiltersPanel>
  );
}

function ExportMenuItem({ children, onClick, testId }: { children: ReactNode; onClick: () => void; testId?: string }) {
  return (
    <button
      type="button"
      data-testid={testId}
      onClick={onClick}
      className="submenu-option block w-full rounded-md text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500/30"
    >
      {children}
    </button>
  );
}
