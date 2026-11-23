import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import type { TFunction } from "i18next";
import { useTranslation } from "react-i18next";
import {
  IconAlertTriangle,
  IconCircleCheck,
  IconClock,
  IconDatabaseSearch,
  IconFileText,
  IconPackageExport,
  IconRefresh,
  IconSearch,
} from "@tabler/icons-react";
import {
  downloadDeviceRawLogSupportBundle,
  listDeviceRawLogs,
  type Device,
  type DeviceRawLogItem,
  type DeviceRawLogQuery,
  type DeviceRawLogStatus,
  type DeviceRawLogsResponse,
} from "../../api/devices";
import { CloseIconButton } from "../../components/CloseIconButton";
import { useToast } from "../../components/ToastContext";
import { ShamsiDateInput } from "../../components/ui/ShamsiDateInput";
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
import { PaginationControls } from "../../components/ui/PaginationControls";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { rtlLanguages } from "../../i18n/config";

const RAW_LOG_STATUSES: DeviceRawLogStatus[] = [
  "PENDING",
  "PROCESSED",
  "SKIPPED_DUPLICATE",
  "SKIPPED_INVALID",
  "FAILED",
];

type RawLogFilters = {
  deviceId: string;
  status: DeviceRawLogStatus | "";
  from: string;
  to: string;
  search: string;
};

type DeviceRawLogsModalProps = {
  open: boolean;
  devices: Device[];
  onClose: () => void;
};

const emptyFilters: RawLogFilters = {
  deviceId: "",
  status: "",
  from: "",
  to: "",
  search: "",
};

export function DeviceRawLogsModal({ open, devices, onClose }: DeviceRawLogsModalProps) {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const language = i18n.language.split("-")[0];
  const isRtl = rtlLanguages.includes(language);
  const [draftFilters, setDraftFilters] = useState<RawLogFilters>(emptyFilters);
  const [appliedFilters, setAppliedFilters] = useState<RawLogFilters>(emptyFilters);
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [data, setData] = useState<DeviceRawLogsResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [selectedLog, setSelectedLog] = useState<DeviceRawLogItem | null>(null);

  useModalDismiss(onClose, open);

  const query = useMemo<DeviceRawLogQuery>(
    () => ({
      page,
      limit,
      deviceId: appliedFilters.deviceId || undefined,
      status: appliedFilters.status || undefined,
      from: appliedFilters.from || undefined,
      to: appliedFilters.to || undefined,
      search: appliedFilters.search.trim() || undefined,
    }),
    [appliedFilters, limit, page]
  );

  const loadLogs = useCallback(async () => {
    if (!open) return;
    setLoading(true);
    try {
      const result = await listDeviceRawLogs(query);
      setData(result);
      setSelectedLog((current) => (current && !result.items.some((item) => item.id === current.id) ? null : current));
    } catch (error) {
      push({
        kind: "error",
        title: error instanceof Error ? error.message : t("devices.rawLogs.errors.loadFailed"),
      });
    } finally {
      setLoading(false);
    }
  }, [open, push, query, t]);

  useEffect(() => {
    void loadLogs();
  }, [loadLogs]);

  const applyFilters = () => {
    setPage(1);
    setAppliedFilters({ ...draftFilters, search: draftFilters.search.trim() });
  };

  const resetFilters = () => {
    setDraftFilters(emptyFilters);
    setAppliedFilters(emptyFilters);
    setPage(1);
  };

  const exportSupportBundle = async () => {
    setExporting(true);
    try {
      const bundleLanguage = language === "fa" || language === "ps" ? language : "en";
      const result = await downloadDeviceRawLogSupportBundle({
        deviceId: appliedFilters.deviceId || undefined,
        status: appliedFilters.status || undefined,
        from: appliedFilters.from || undefined,
        to: appliedFilters.to || undefined,
        search: appliedFilters.search.trim() || undefined,
        limit: 500,
        language: bundleLanguage,
      });
      downloadBlob(result.blob, result.filename);
      push({ kind: "success", title: t("devices.rawLogs.supportBundle.ready") });
    } catch (error) {
      push({
        kind: "error",
        title: error instanceof Error ? error.message : t("devices.rawLogs.errors.exportFailed"),
      });
    } finally {
      setExporting(false);
    }
  };

  const total = data?.meta.total ?? 0;
  const totalPages = data?.meta.totalPages ?? 1;
  const items = data?.items ?? [];
  const statusCounts = data?.statusCounts;

  return (
    <div data-testid="device-raw-logs-modal" className="fixed inset-0 z-50 bg-slate-950/70 p-4 backdrop-blur-sm" dir={isRtl ? "rtl" : "ltr"}>
      <div className="devices-compact mx-auto flex h-[calc(100vh-2rem)] max-w-7xl flex-col overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950/95 shadow-2xl shadow-slate-950/70">
        <div className="flex items-start justify-between gap-3 border-b border-slate-800/80 px-4 py-3">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-2xl border border-brand-500/30 bg-brand-500/10 text-brand-200">
              <IconDatabaseSearch size={20} />
            </span>
            <div>
              <h2 className="text-sm font-semibold text-white">{t("devices.rawLogs.title")}</h2>
              <p className="mt-1 text-xs text-slate-400">{t("devices.rawLogs.subtitle")}</p>
            </div>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>

        <div className="flex-1 overflow-y-auto p-4">
          <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_18rem]">
            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
              <div className="grid gap-2 md:grid-cols-5">
                <Field label={t("devices.rawLogs.filters.device")}>
                  <select
                    className="form-input"
                    value={draftFilters.deviceId}
                    onChange={(event) => setDraftFilters((current) => ({ ...current, deviceId: event.target.value }))}
                  >
                    <option value="">{t("devices.rawLogs.filters.allDevices")}</option>
                    {devices.map((device) => (
                      <option key={device.id} value={device.id}>
                        {device.name}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("devices.rawLogs.filters.status")}>
                  <select
                    className="form-input"
                    value={draftFilters.status}
                    onChange={(event) =>
                      setDraftFilters((current) => ({
                        ...current,
                        status: event.target.value as DeviceRawLogStatus | "",
                      }))
                    }
                  >
                    <option value="">{t("devices.rawLogs.filters.allStatuses")}</option>
                    {RAW_LOG_STATUSES.map((status) => (
                      <option key={status} value={status}>
                        {t(statusLabelKey(status))}
                      </option>
                    ))}
                  </select>
                </Field>
                <Field label={t("devices.rawLogs.filters.from")}>
                  <ShamsiDateInput
                    inputClassName="form-input"
                    containerClassName="device-raw-logs-from"
                    locale={i18n.language}
                    value={draftFilters.from}
                    onChange={(value) => setDraftFilters((current) => ({ ...current, from: value }))}
                  />
                </Field>
                <Field label={t("devices.rawLogs.filters.to")}>
                  <ShamsiDateInput
                    inputClassName="form-input"
                    containerClassName="device-raw-logs-to"
                    locale={i18n.language}
                    value={draftFilters.to}
                    onChange={(value) => setDraftFilters((current) => ({ ...current, to: value }))}
                  />
                </Field>
                <Field label={t("devices.rawLogs.filters.search")}>
                  <div className="relative">
                    <input
                      className="form-input pr-9"
                      type="search"
                      value={draftFilters.search}
                      placeholder={t("devices.rawLogs.filters.searchPlaceholder")}
                      onChange={(event) => setDraftFilters((current) => ({ ...current, search: event.target.value }))}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") applyFilters();
                      }}
                    />
                    <IconSearch
                      size={16}
                      className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500"
                    />
                  </div>
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
                <div className="space-y-1">
                  <p className="text-[11px] text-slate-400">{t("devices.rawLogs.securityNote")}</p>
                  <p className="text-[10px] text-slate-500">{t("devices.rawLogs.supportBundle.hint")}</p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    data-testid="device-raw-logs-export"
                    type="button"
                    onClick={() => void exportSupportBundle()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-xs font-semibold text-emerald-200 transition hover:border-emerald-400 hover:bg-emerald-500/20 disabled:cursor-wait disabled:opacity-60"
                    disabled={exporting}
                  >
                    <IconPackageExport size={15} />
                    {exporting ? t("devices.rawLogs.actions.exporting") : t("devices.rawLogs.actions.exportBundle")}
                  </button>
                  <button
                    type="button"
                    onClick={() => void loadLogs()}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-200 transition hover:border-brand-400 hover:text-white disabled:opacity-60"
                    disabled={loading}
                  >
                    <IconRefresh size={15} className={loading ? "animate-spin" : ""} />
                    {t("devices.rawLogs.actions.refresh")}
                  </button>
                  <button
                    type="button"
                    onClick={resetFilters}
                    className="rounded-xl border border-slate-700 px-3 py-2 text-xs font-semibold text-slate-300 transition hover:border-slate-500 hover:text-white"
                  >
                    {t("devices.rawLogs.actions.reset")}
                  </button>
                  <button
                    data-testid="device-raw-logs-apply"
                    type="button"
                    onClick={applyFilters}
                    className="rounded-xl border border-brand-500/40 bg-brand-500/80 px-3 py-2 text-xs font-semibold text-white shadow-lg shadow-brand-950/30 transition hover:bg-brand-500"
                  >
                    {t("devices.rawLogs.actions.apply")}
                  </button>
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
              <p className="text-xs font-semibold text-white">{t("devices.rawLogs.summary.title")}</p>
              <div className="mt-2 grid grid-cols-2 gap-2">
                {RAW_LOG_STATUSES.map((status) => (
                  <div key={status} className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
                    <p className="text-[10px] uppercase tracking-wide text-slate-500">{t(statusLabelKey(status))}</p>
                    <p className="mt-1 text-sm font-semibold text-white">{statusCounts?.[status] ?? 0}</p>
                  </div>
                ))}
              </div>
            </section>
          </div>

          <section className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
            <DataTableShell>
              <DataTable minWidth="980px" variant="compact">
                <DataTableHead>
                  <DataTableRow>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.recordedAt")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.device")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.user")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.event")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.status")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.attendance")}</DataTableHeaderCell>
                    <DataTableHeaderCell>{t("devices.rawLogs.table.error")}</DataTableHeaderCell>
                    <DataTableHeaderCell align="end">{t("devices.rawLogs.table.details")}</DataTableHeaderCell>
                  </DataTableRow>
                </DataTableHead>
                <DataTableBody>
                  {loading ? (
                    <DataTableSkeletonRows columns={8} rows={6} />
                  ) : items.length === 0 ? (
                    <DataTableEmptyRow colSpan={8}>{t("devices.rawLogs.table.empty")}</DataTableEmptyRow>
                  ) : (
                    items.map((item) => (
                      <DataTableRow
                        key={item.id}
                        clickable
                        onClick={() => setSelectedLog((current) => (current?.id === item.id ? null : item))}
                      >
                        <DataTableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-white">{formatDateTime(item.recordedAt, i18n.language)}</span>
                            <span className="text-[10px] text-slate-500">
                              {t("devices.rawLogs.table.received")}: {formatDateTime(item.createdAt, i18n.language)}
                            </span>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-white">{item.deviceName}</span>
                            <span className="text-[10px] text-slate-500">{item.deviceStatus}</span>
                          </div>
                        </DataTableCell>
                        <DataTableCell>
                          <div className="flex flex-col gap-0.5">
                            <span className="font-medium text-white">{item.externalUserId ?? "-"}</span>
                            <span className="text-[10px] text-slate-500">
                              {item.recordId ? t("devices.rawLogs.table.recordId", { value: item.recordId }) : item.dataHash.slice(0, 10)}
                            </span>
                          </div>
                        </DataTableCell>
                        <DataTableCell>{formatRawLogEvent(item.eventType, t)}</DataTableCell>
                        <DataTableCell>
                          <RawLogStatusBadge status={item.status} />
                        </DataTableCell>
                        <DataTableCell>
                          {item.attendance ? (
                            <div className="flex flex-col gap-0.5">
                              <span className={item.attendance.isAuthorized ? "text-emerald-300" : "text-rose-300"}>
                                {item.attendance.entryType} /{" "}
                                {item.attendance.isAuthorized
                                  ? t("devices.rawLogs.attendance.authorized")
                                  : t("devices.rawLogs.attendance.denied")}
                              </span>
                              <span className="text-[10px] text-slate-500">{formatMemberName(item)}</span>
                            </div>
                          ) : (
                            <span className="text-slate-500">{t("devices.rawLogs.attendance.notLinked")}</span>
                          )}
                        </DataTableCell>
                        <DataTableCell>
                          <span className={item.processError ? "text-amber-300" : "text-slate-500"}>
                            {item.processError ?? "-"}
                          </span>
                        </DataTableCell>
                        <DataTableCell align="end">
                          <button
                            type="button"
                            onClick={(event) => {
                              event.stopPropagation();
                              setSelectedLog((current) => (current?.id === item.id ? null : item));
                            }}
                            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-brand-400 hover:text-white"
                          >
                            <IconFileText size={14} />
                            {t("devices.rawLogs.actions.details")}
                          </button>
                        </DataTableCell>
                      </DataTableRow>
                    ))
                  )}
                </DataTableBody>
              </DataTable>
            </DataTableShell>

            <PaginationControls
              className="mt-3"
              page={page}
              totalPages={totalPages}
              totalItems={total}
              pageSize={limit}
              showFirstLast
              onPageChange={setPage}
            />
          </section>

          {selectedLog ? <RawLogDetailsPanel log={selectedLog} /> : null}
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-semibold text-slate-300">{label}</span>
      {children}
    </label>
  );
}

function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1000);
}

function RawLogStatusBadge({ status }: { status: DeviceRawLogStatus }) {
  const { t } = useTranslation();
  return (
    <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-semibold ${statusClass(status)}`}>
      <RawLogStatusIcon status={status} />
      {t(statusLabelKey(status))}
    </span>
  );
}

function RawLogStatusIcon({ status }: { status: DeviceRawLogStatus }) {
  switch (status) {
    case "PROCESSED":
      return <IconCircleCheck size={13} />;
    case "FAILED":
    case "SKIPPED_INVALID":
      return <IconAlertTriangle size={13} />;
    case "SKIPPED_DUPLICATE":
      return <IconRefresh size={13} />;
    default:
      return <IconClock size={13} />;
  }
}

function RawLogDetailsPanel({ log }: { log: DeviceRawLogItem }) {
  const { t, i18n } = useTranslation();
  const [showTechnicalPayload, setShowTechnicalPayload] = useState(false);
  const payloadSummary = summarizePayload(log, i18n.language);
  return (
    <section className="mt-3 rounded-2xl border border-slate-800/80 bg-slate-900/40 p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-xs font-semibold text-white">{t("devices.rawLogs.details.title")}</p>
          <p className="mt-1 text-[11px] text-slate-400">
            {log.deviceName} - {formatDateTime(log.recordedAt, i18n.language)}
          </p>
        </div>
        <RawLogStatusBadge status={log.status} />
      </div>
      <p className="mt-2 text-[11px] text-slate-400">{t("devices.rawLogs.details.subtitle")}</p>
      <div className="mt-3 grid gap-2 md:grid-cols-3">
        <DetailItem label={t("devices.rawLogs.details.event")} value={formatRawLogEvent(log.eventType, t)} />
        <DetailItem label={t("devices.rawLogs.details.deviceUser")} value={payloadSummary.deviceUserId ?? "-"} />
        <DetailItem label={t("devices.rawLogs.details.sourceIp")} value={payloadSummary.sourceIp ?? "-"} />
        <DetailItem label={t("devices.rawLogs.details.deviceRecordTime")} value={payloadSummary.deviceRecordTime ?? "-"} />
        <DetailItem label={t("devices.rawLogs.details.normalizedTime")} value={payloadSummary.normalizedTime ?? "-"} />
        <DetailItem label={t("devices.rawLogs.details.processedAt")} value={log.processedAt ? formatDateTime(log.processedAt, i18n.language) : "-"} />
        <DetailItem label={t("devices.rawLogs.details.error")} value={log.processError ?? t("devices.rawLogs.details.noError")} />
        <DetailItem label={t("devices.rawLogs.details.hash")} value={log.dataHash} />
      </div>
      <div className="mt-3 rounded-2xl border border-slate-800 bg-slate-950/40 p-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-xs font-semibold text-slate-100">{t("devices.rawLogs.details.technicalPayload")}</p>
            <p className="mt-1 text-[11px] text-slate-500">{t("devices.rawLogs.details.technicalPayloadHelp")}</p>
          </div>
          <button
            type="button"
            onClick={() => setShowTechnicalPayload((current) => !current)}
            className="inline-flex items-center gap-1 rounded-lg border border-slate-700 px-2.5 py-1.5 text-[11px] font-semibold text-slate-200 transition hover:border-brand-400 hover:text-white"
          >
            <IconFileText size={14} />
            {showTechnicalPayload ? t("devices.rawLogs.actions.hideTechnical") : t("devices.rawLogs.actions.showTechnical")}
          </button>
        </div>
        {showTechnicalPayload ? (
          <pre className="mt-3 max-h-72 overflow-auto rounded-xl border border-slate-800 bg-slate-950/70 p-3 text-[11px] leading-relaxed text-slate-200">
            {JSON.stringify(log.payload, null, 2)}
          </pre>
        ) : null}
      </div>
    </section>
  );
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-800 bg-slate-950/40 px-3 py-2">
      <p className="text-[10px] uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-1 break-all text-xs font-medium text-slate-100">{value}</p>
    </div>
  );
}

function statusLabelKey(status: DeviceRawLogStatus) {
  return `devices.rawLogs.status.${status.toLowerCase()}`;
}

function statusClass(status: DeviceRawLogStatus) {
  switch (status) {
    case "PROCESSED":
      return "border-emerald-500/35 bg-emerald-500/10 text-emerald-200";
    case "SKIPPED_DUPLICATE":
      return "border-sky-500/35 bg-sky-500/10 text-sky-200";
    case "SKIPPED_INVALID":
      return "border-amber-500/35 bg-amber-500/10 text-amber-200";
    case "FAILED":
      return "border-rose-500/35 bg-rose-500/10 text-rose-200";
    default:
      return "border-slate-500/35 bg-slate-500/10 text-slate-200";
  }
}

function formatDateTime(value: string, locale: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(locale, {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function formatMemberName(item: DeviceRawLogItem) {
  const member = item.attendance?.member;
  if (!member) return "-";
  return `${member.firstName ?? ""} ${member.lastName ?? ""}`.trim() || member.code;
}

function formatRawLogEvent(eventType: string | null | undefined, t: TFunction) {
  if (!eventType || eventType === "UNKNOWN") return t("devices.rawLogs.event.deviceScan");
  return eventType;
}

function summarizePayload(log: DeviceRawLogItem, locale: string) {
  const payload = isObjectRecord(log.payload) ? log.payload : {};
  const raw = isObjectRecord(payload.raw) ? payload.raw : {};
  const timestamp = readPayloadString(payload, "timestamp");
  return {
    deviceUserId: log.externalUserId ?? readPayloadString(payload, "externalUserId") ?? readPayloadString(raw, "deviceUserId"),
    sourceIp: readPayloadString(raw, "ip"),
    deviceRecordTime: readPayloadString(raw, "recordTime"),
    normalizedTime: timestamp ? formatDateTime(timestamp, locale) : formatDateTime(log.recordedAt, locale),
  };
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readPayloadString(payload: Record<string, unknown>, key: string) {
  const value = payload[key];
  if (typeof value === "string") return value;
  if (typeof value === "number") return String(value);
  return undefined;
}
