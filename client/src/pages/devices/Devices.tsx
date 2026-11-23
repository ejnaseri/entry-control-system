import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { useTranslation } from "react-i18next";
import type { TFunction } from "i18next";
import { IconActivityHeartbeat, IconAlertTriangle, IconCheck, IconChevronDown, IconDatabaseSearch } from "@tabler/icons-react";
import {
  clearDeviceAttendanceLogs,
  cancelDeviceScan,
  createDevice,
  deleteDeviceUser,
  diagnoseDevice,
  disableDevice,
  enableDevice,
  enrollDevice,
  fetchDeviceAttendanceLogs,
  getDeviceScan,
  getDeviceRuntimeStatus,
  getDeviceStatus,
  getDeviceTime,
  listDeviceUsers,
  listDevices,
  setDeviceTime,
  startDeviceScan,
  syncDeviceUsers,
  testDevice,
  unlockDeviceDoor,
  updateDevice,
  upsertDeviceUser,
  type Device,
  type DeviceAttendanceItem,
  type DeviceConfig,
  type DeviceDiagnostics,
  type DeviceConnectionType,
  type DeviceFilter,
  type DeviceHeartbeat,
  type DevicePayload,
  type DeviceScanStatus,
  type DeviceStatus,
  type DeviceType,
  type DeviceUserSummary,
} from "../../api/devices";
import { rtlLanguages } from "../../i18n/config";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { useToast } from "../../components/ToastContext";
import { CloseIconButton } from "../../components/CloseIconButton";
import { useAuth } from "../../auth/AuthContext";
import { DeviceRawLogsModal } from "./DeviceRawLogsModal";
import { resolveDateLocale } from "../../shared/dateLocale";

type FormValues = DevicePayload;
type DiagnosticInterface = DeviceDiagnostics["localInterfaces"][number];
type DiagnosticNetworkIssue = DeviceDiagnostics["networkIssues"][number];

const DEVICE_TYPES: DeviceType[] = ["FINGERPRINT", "RELAY", "GATE", "CAMERA", "OTHER"];
const CONNECTION_TYPES: DeviceConnectionType[] = ["NETWORK", "USB", "SERIAL", "ZKTECO_PULL_SDK"];
const DEVICE_STATUSES: DeviceStatus[] = ["UNKNOWN", "ONLINE", "OFFLINE", "ERROR"];
const DEVICE_TYPE_LABEL_KEYS: Record<DeviceType, string> = {
  FINGERPRINT: "devices.types.fingerprint",
  RELAY: "devices.types.relay",
  GATE: "devices.types.gate",
  CAMERA: "devices.types.camera",
  OTHER: "devices.types.other",
};
const CONNECTION_TYPE_LABEL_KEYS: Record<DeviceConnectionType, string> = {
  NETWORK: "devices.connectionTypes.network",
  USB: "devices.connectionTypes.usb",
  SERIAL: "devices.connectionTypes.serial",
  ZKTECO_PULL_SDK: "devices.connectionTypes.zktecoPullSdk",
};
const DEVICE_STATUS_LABEL_KEYS: Record<DeviceStatus, string> = {
  UNKNOWN: "devices.status.unknown",
  ONLINE: "devices.status.online",
  OFFLINE: "devices.status.offline",
  ERROR: "devices.status.error",
};
const DIAGNOSTIC_STATUS_LABEL_KEYS: Record<string, string> = {
  reachable: "devices.diagnostics.status.reachable",
  open: "devices.diagnostics.status.open",
  closed: "devices.diagnostics.status.closed",
  timeout: "devices.diagnostics.status.timeout",
  unreachable: "devices.diagnostics.status.unreachable",
  error: "devices.diagnostics.status.error",
};
const SCAN_STATUS_LABEL_KEYS: Record<string, string> = {
  running: "devices.diagnostics.scan.status.running",
  done: "devices.diagnostics.scan.status.done",
  idle: "devices.diagnostics.scan.status.idle",
  error: "devices.diagnostics.scan.status.error",
};

export function Devices() {
  const { t, i18n } = useTranslation();
  const { hasPermission } = useAuth();
  const { push } = useToast();
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);
  const canViewRawLogs = hasPermission("DEVICES_DIAGNOSTICS");
  const canManageDevices = hasPermission("SYSTEM_SETTINGS_MANAGE");
  const canDiagnoseDevices = hasPermission("DEVICES_DIAGNOSTICS");
  const canEnrollDevices = hasPermission("DEVICES_ENROLL");
  const canUseDeviceTools =
    hasPermission("DEVICES_USER_SYNC") ||
    canDiagnoseDevices ||
    hasPermission("DOOR_UNLOCK") ||
    hasPermission("DEVICES_CLEAR_LOGS");
  const [devices, setDevices] = useState<Device[]>([]);
  const [runtimeStatuses, setRuntimeStatuses] = useState<Record<string, DeviceHeartbeat>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Device | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [filters, setFilters] = useState<{ type?: DeviceType; status?: DeviceStatus; connectionType?: DeviceConnectionType; enabled?: string; search?: string }>({});
  const [testingId, setTestingId] = useState<string | null>(null);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [enrollingId, setEnrollingId] = useState<string | null>(null);
  const [diagnosingId, setDiagnosingId] = useState<string | null>(null);
  const [diagnosisOpen, setDiagnosisOpen] = useState(false);
  const [diagnosis, setDiagnosis] = useState<DeviceDiagnostics | null>(null);
  const [diagnosisDevice, setDiagnosisDevice] = useState<Device | null>(null);
  const [toolsOpen, setToolsOpen] = useState(false);
  const [toolsDevice, setToolsDevice] = useState<Device | null>(null);
  const [statusDeviceId, setStatusDeviceId] = useState<string | null>(null);
  const [rawLogsOpen, setRawLogsOpen] = useState(false);
  const [scanStatus, setScanStatus] = useState<DeviceScanStatus | null>(null);
  const [scanLoading, setScanLoading] = useState(false);

  const loadDevices = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params: DeviceFilter = {};
      if (filters.type) params.type = filters.type;
      if (filters.status) params.status = filters.status;
      if (filters.connectionType) params.connectionType = filters.connectionType;
      if (filters.enabled === "true" || filters.enabled === "false") params.enabled = filters.enabled === "true";
      if (filters.search) params.search = filters.search;
      const [listRes, runtimeRes] = await Promise.all([listDevices(params), getDeviceStatus().catch(() => [])]);
      setDevices(listRes.data);
      const runtimeMap = runtimeRes.reduce<Record<string, DeviceHeartbeat>>((acc, curr) => {
        acc[curr.id] = curr;
        return acc;
      }, {});
      setRuntimeStatuses(runtimeMap);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.errors.loadFailed"));
    } finally {
      setLoading(false);
    }
  }, [filters, t]);

  useEffect(() => {
    void loadDevices();
  }, [loadDevices]);

  useEffect(() => {
    let active = true;
    const refreshRuntime = async () => {
      try {
        const runtimeRes = await getDeviceStatus().catch(() => []);
        if (!active) return;
        const runtimeMap = runtimeRes.reduce<Record<string, DeviceHeartbeat>>((acc, curr) => {
          acc[curr.id] = curr;
          return acc;
        }, {});
        setRuntimeStatuses(runtimeMap);
        setDevices((prev) =>
          prev.map((device) => {
            const runtime = runtimeMap[device.id];
            if (!runtime) return device;
            const nextStatus = runtime.connected ? "ONLINE" : "OFFLINE";
            return {
              ...device,
              status: nextStatus,
              lastSeenAt: runtime.lastPollAt ?? device.lastSeenAt,
              lastSuccessfulPollAt: runtime.lastPollAt ?? device.lastSuccessfulPollAt,
              lastEventReceivedAt: runtime.lastEventAt ?? device.lastEventReceivedAt,
              lastEventProcessedAt: runtime.lastEventProcessedAt ?? device.lastEventProcessedAt,
              lastErrorAt: runtime.lastErrorAt ?? device.lastErrorAt,
              lastErrorMessage: runtime.lastError ?? device.lastErrorMessage,
            };
          })
        );
      } catch {
        // ignore refresh errors
      }
    };
    const timer = window.setInterval(refreshRuntime, 5000);
    refreshRuntime();
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  useEffect(() => {
    if (error) {
      push({ kind: "error", title: error });
    }
  }, [error, push]);

  useEffect(() => {
    if (!scanStatus || scanStatus.status !== "running" || !scanStatus.scanId) return;
    const timer = window.setTimeout(() => {
      getDeviceScan(scanStatus.scanId)
        .then((data) => setScanStatus(data))
        .catch((err) => setError(err instanceof Error ? err.message : t("devices.diagnostics.errors.scanRefreshFailed")));
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [scanStatus, t]);

  const handleSave = async (payload: DevicePayload) => {
    setSubmitting(true);
    setError(null);
    try {
      if (editing) {
        const { data } = await updateDevice(editing.id, payload);
        setDevices((prev) => prev.map((d) => (d.id === editing.id ? (data as Device) : d)));
      } else {
        const { data } = await createDevice(payload);
        setDevices((prev) => [data as Device, ...prev]);
      }
      setModalOpen(false);
      setEditing(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.errors.saveFailed"));
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleEnabled = async (device: Device) => {
    const nextEnabled = !device.enabled;
    setTogglingId(device.id);
    try {
      const { data } = nextEnabled ? await enableDevice(device.id) : await disableDevice(device.id);
      setDevices((prev) => prev.map((d) => (d.id === device.id ? (data as Device) : d)));
      if (nextEnabled) {
        const runtime = await getDeviceRuntimeStatus(device.id);
        setRuntimeStatuses((prev) => ({ ...prev, [device.id]: runtime }));
      } else {
        setRuntimeStatuses((prev) => {
          const copy = { ...prev };
          delete copy[device.id];
          return copy;
        });
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.errors.updateFailed"));
    } finally {
      setTogglingId(null);
    }
  };

  const handleTest = async (device: Device) => {
    setTestingId(device.id);
    setError(null);
    try {
      const { data } = await testDevice(device.id);
      setDevices((prev) =>
        prev.map((d) => (d.id === device.id ? { ...d, status: data.status, lastSeenAt: data.ok ? new Date().toISOString() : d.lastSeenAt } : d))
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.errors.testFailed"));
    } finally {
      setTestingId(null);
    }
  };

  const handleEnroll = async (device: Device) => {
    const rawUserId = window.prompt(t("devices.enroll.prompt.userId"));
    const userId = rawUserId?.trim();
    if (!userId) return;

    const rawFinger = window.prompt(t("devices.enroll.prompt.fingerId"), "0");
    if (rawFinger === null) return;
    const fingerTrimmed = rawFinger.trim();
    let fingerId: number | undefined;
    if (fingerTrimmed.length > 0) {
      const parsed = Number(fingerTrimmed);
      if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) {
        setError(t("devices.enroll.errors.fingerRange"));
        return;
      }
      fingerId = parsed;
    }

    setEnrollingId(device.id);
    setError(null);
    try {
      await enrollDevice(device.id, { userId, ...(fingerId !== undefined ? { fingerId } : {}) });
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.enroll.errors.enrollFailed"));
    } finally {
      setEnrollingId(null);
    }
  };

  const handleDiagnose = async (device: Device) => {
    setDiagnosingId(device.id);
    setError(null);
    try {
      const { data } = await diagnoseDevice(device.id);
      setDiagnosis(data);
      setDiagnosisDevice(device);
      setScanStatus(null);
      setDiagnosisOpen(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.diagnostics.errors.failed"));
    } finally {
      setDiagnosingId(null);
    }
  };

  const handleStartScan = async () => {
    if (!diagnosisDevice) return;
    setScanLoading(true);
    setError(null);
    try {
      const { data } = await startDeviceScan(diagnosisDevice.id);
      setScanStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.diagnostics.errors.scanStartFailed"));
    } finally {
      setScanLoading(false);
    }
  };

  const handleCancelScan = async () => {
    if (!scanStatus?.scanId) return;
    setScanLoading(true);
    setError(null);
    try {
      const data = await cancelDeviceScan(scanStatus.scanId);
      setScanStatus(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.diagnostics.errors.scanCancelFailed"));
    } finally {
      setScanLoading(false);
    }
  };

  const handleUpdateIp = async (ip: string) => {
    if (!diagnosisDevice) return;
    const confirmed = window.confirm(t("devices.diagnostics.confirm.updateIp", { ip }));
    if (!confirmed) return;
    setScanLoading(true);
    setError(null);
    try {
      const currentConfig = (diagnosisDevice.config ?? {}) as Record<string, unknown>;
      const payload: DevicePayload = {
        name: diagnosisDevice.name,
        type: diagnosisDevice.type,
        connectionType: diagnosisDevice.connectionType,
        enabled: diagnosisDevice.enabled,
        model: diagnosisDevice.model ?? undefined,
        serialNumber: diagnosisDevice.serialNumber ?? undefined,
        config: {
          ...currentConfig,
          ip,
        },
      };
      const { data } = await updateDevice(diagnosisDevice.id, payload);
      setDevices((prev) => prev.map((d) => (d.id === diagnosisDevice.id ? (data as Device) : d)));
      setDiagnosisDevice(data as Device);
      const refreshed = await diagnoseDevice((data as Device).id);
      setDiagnosis(refreshed.data);
    } catch (err) {
      setError(err instanceof Error ? err.message : t("devices.diagnostics.errors.updateIpFailed"));
    } finally {
      setScanLoading(false);
    }
  };

  const filteredDevices = useMemo(() => devices, [devices]);
  const typeOptions: FilterOption[] = [
    { value: "", label: t("devices.filters.any") },
    ...DEVICE_TYPES.map((type) => ({ value: type, label: t(DEVICE_TYPE_LABEL_KEYS[type] ?? "devices.types.other") })),
  ];
  const connectionOptions: FilterOption[] = [
    { value: "", label: t("devices.filters.any") },
    ...CONNECTION_TYPES.map((type) => ({ value: type, label: t(CONNECTION_TYPE_LABEL_KEYS[type] ?? type) })),
  ];
  const statusOptions: FilterOption[] = [
    { value: "", label: t("devices.filters.any") },
    ...DEVICE_STATUSES.map((status) => ({ value: status, label: t(DEVICE_STATUS_LABEL_KEYS[status] ?? status) })),
  ];
  const enabledOptions: FilterOption[] = [
    { value: "", label: t("devices.filters.any") },
    { value: "true", label: t("devices.filters.enabledOptions.enabled") },
    { value: "false", label: t("devices.filters.enabledOptions.disabled") },
  ];

  return (
    <div className="devices-compact space-y-4" dir={isRtl ? "rtl" : "ltr"}>
      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-sm font-semibold text-white">{t("devices.title")}</h2>
            <p className="text-[11px] text-slate-400">{t("devices.subtitle")}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {canViewRawLogs ? (
              <button
                data-testid="devices-raw-logs-open"
                type="button"
                onClick={() => setRawLogsOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] font-semibold text-slate-200 transition hover:border-brand-400 hover:text-white"
              >
                <IconDatabaseSearch size={14} />
                {t("devices.actions.rawLogs")}
              </button>
            ) : null}
            {canManageDevices ? <button
              type="button"
              onClick={() => {
                setEditing(null);
                setModalOpen(true);
              }}
              className="rounded-lg border border-brand-500/40 bg-brand-500/80 px-2.5 py-1 text-[11px] font-semibold text-white shadow-lg shadow-brand-900/40 transition hover:bg-brand-500"
            >
              + {t("devices.actions.add")}
            </button> : null}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/60">
        <div className="grid gap-2 md:grid-cols-4">
          <FilterSelect label={t("devices.filters.type")} value={filters.type ?? ""} options={typeOptions} onChange={(v) => setFilters((f) => ({ ...f, type: (v as DeviceType) || undefined }))} />
          <FilterSelect label={t("devices.filters.connection")} value={filters.connectionType ?? ""} options={connectionOptions} onChange={(v) => setFilters((f) => ({ ...f, connectionType: (v as DeviceConnectionType) || undefined }))} />
          <FilterSelect label={t("devices.filters.status")} value={filters.status ?? ""} options={statusOptions} onChange={(v) => setFilters((f) => ({ ...f, status: (v as DeviceStatus) || undefined }))} />
          <FilterSelect
            label={t("devices.filters.enabled")}
            value={filters.enabled ?? ""}
            options={enabledOptions}
            onChange={(v) => setFilters((f) => ({ ...f, enabled: v || undefined }))}
          />
          <div className="md:col-span-2">
            <p className="text-xs font-semibold text-slate-300">{t("devices.filters.search")}</p>
            <input
              type="search"
              value={filters.search ?? ""}
              onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
              placeholder={t("devices.filters.searchPlaceholder")}
              className="form-input"
            />
          </div>
          <div className="flex items-end gap-2 md:col-span-2">
            <button
              type="button"
              onClick={loadDevices}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-100 hover:border-brand-400"
            >
              {t("devices.actions.applyFilters")}
            </button>
            <button
              type="button"
              onClick={() => setFilters({})}
              className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-300 hover:border-slate-500"
            >
              {t("common.actions.clear")}
            </button>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {loading ? (
          <SkeletonCard />
        ) : filteredDevices.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-800/80 bg-slate-950/40 p-3 text-[11px] text-slate-300">
            {t("devices.empty")}
          </div>
        ) : (
          filteredDevices.map((device) => (
            <DeviceRow
              key={device.id}
              device={device}
              runtime={runtimeStatuses[device.id]}
              onEdit={canManageDevices ? () => {
                setEditing(device);
                setModalOpen(true);
              } : undefined}
              onTools={canUseDeviceTools ? () => {
                setToolsDevice(device);
                setToolsOpen(true);
              } : undefined}
              onStatus={() => setStatusDeviceId(device.id)}
              onToggle={canManageDevices ? () => handleToggleEnabled(device) : undefined}
              onTest={canDiagnoseDevices ? () => handleTest(device) : undefined}
              onDiagnose={canDiagnoseDevices ? () => handleDiagnose(device) : undefined}
              onEnroll={canEnrollDevices ? () => handleEnroll(device) : undefined}
              testing={testingId === device.id}
              diagnosing={diagnosingId === device.id}
              toggling={togglingId === device.id}
              enrolling={enrollingId === device.id}
            />
          ))
        )}
      </div>

      {canManageDevices && modalOpen ? (
        <DeviceFormModal
          key={editing?.id ?? "new"}
          open={modalOpen}
          onClose={() => {
            setModalOpen(false);
            setEditing(null);
          }}
          initial={editing ?? undefined}
          submitting={submitting}
          onSubmit={handleSave}
        />
      ) : null}

      {diagnosisOpen && diagnosis && diagnosisDevice ? (
        <DeviceDiagnosticsModal
          open={diagnosisOpen}
          device={diagnosisDevice}
          diagnosis={diagnosis}
          scanStatus={scanStatus}
          scanLoading={scanLoading}
          onClose={() => {
            setDiagnosisOpen(false);
            setDiagnosis(null);
            setDiagnosisDevice(null);
            setScanStatus(null);
          }}
          onStartScan={handleStartScan}
          onCancelScan={handleCancelScan}
          onUpdateIp={handleUpdateIp}
        />
      ) : null}

      {toolsOpen && toolsDevice ? (
        <DeviceToolsModal
          key={toolsDevice.id}
          open={toolsOpen}
          device={toolsDevice}
          onClose={() => {
            setToolsOpen(false);
            setToolsDevice(null);
          }}
        />
      ) : null}

      {statusDeviceId ? (
        <DeviceStatusModal
          open
          device={devices.find((device) => device.id === statusDeviceId) ?? null}
          runtime={runtimeStatuses[statusDeviceId]}
          onClose={() => setStatusDeviceId(null)}
        />
      ) : null}

      {rawLogsOpen ? (
        <DeviceRawLogsModal open={rawLogsOpen} devices={devices} onClose={() => setRawLogsOpen(false)} />
      ) : null}
    </div>
  );
}

function DeviceRow({
  device,
  runtime,
  onEdit,
  onTools,
  onStatus,
  onToggle,
  onTest,
  onDiagnose,
  onEnroll,
  testing,
  diagnosing,
  toggling,
  enrolling,
}: {
  device: Device;
  runtime?: DeviceHeartbeat;
  onEdit?: () => void;
  onTools?: () => void;
  onStatus: () => void;
  onToggle?: () => void;
  onTest?: () => void;
  onDiagnose?: () => void;
  onEnroll?: () => void;
  testing: boolean;
  diagnosing: boolean;
  toggling: boolean;
  enrolling: boolean;
}) {
  const { t } = useTranslation();
  const summary = getAddressSummary(device);
  const typeLabel = t(DEVICE_TYPE_LABEL_KEYS[device.type] ?? "devices.types.other");
  const connectionLabel = t(CONNECTION_TYPE_LABEL_KEYS[device.connectionType] ?? device.connectionType);
  const statusStyles: Record<DeviceStatus, string> = {
    UNKNOWN: "border-slate-700 bg-slate-900/60 text-slate-200",
    ONLINE: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
    OFFLINE: "border-amber-500/50 bg-amber-500/10 text-amber-100",
    ERROR: "border-rose-500/50 bg-rose-500/10 text-rose-100",
  };
  const displayStatus: DeviceStatus =
    runtime?.connected === true ? "ONLINE" : runtime?.connected === false ? "OFFLINE" : device.status;
  const statusLabel = runtime
    ? runtime.connected
      ? t("devices.status.connected")
      : t("devices.status.disconnected")
    : t(DEVICE_STATUS_LABEL_KEYS[displayStatus] ?? displayStatus);
  const lastErrorMessage = runtime?.lastError ?? device.lastErrorMessage;
  const canEnroll =
    device.type === "FINGERPRINT" &&
    (device.connectionType === "ZKTECO_PULL_SDK" || device.connectionType === "NETWORK");
  const canDiagnose = device.connectionType === "ZKTECO_PULL_SDK" || device.connectionType === "NETWORK";
  return (
    <div className="rounded-2xl border border-slate-800/80 bg-slate-950/70 p-3 shadow-inner shadow-slate-950/50">
      <div className="flex flex-col gap-2.5 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-sm font-semibold text-white">{device.name}</p>
            <span className="rounded-full border border-slate-700 px-2 py-0.5 text-[9px] uppercase text-slate-200">{typeLabel}</span>
            <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${statusStyles[displayStatus]}`}>
              {statusLabel}
            </span>
          </div>
          <p className="text-[11px] text-slate-300">
            {connectionLabel} - {summary}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {onToggle ? <label className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-900/60 px-2 py-1 text-[10px] text-slate-200">
            <input type="checkbox" checked={device.enabled} onChange={onToggle} className="h-3 w-3 accent-brand-500" disabled={toggling} />
            {t("devices.labels.enabled")}
          </label> : null}
          <button
            type="button"
            data-testid={`device-status-open-${device.id}`}
            onClick={onStatus}
            className="device-status-trigger"
            title={lastErrorMessage ? `${t("devices.labels.lastError")}: ${lastErrorMessage}` : t("devices.actions.statusDetails")}
          >
            <IconActivityHeartbeat className="device-status-trigger__icon" stroke={1.9} aria-hidden="true" />
            <span>{t("devices.actions.statusDetails")}</span>
            {lastErrorMessage ? (
              <span className="device-status-trigger__alert" aria-label={t("devices.labels.lastError")}>
                <IconAlertTriangle stroke={2} aria-hidden="true" />
              </span>
            ) : null}
          </button>
          {onEdit ? <button onClick={onEdit} className="rounded-lg border border-slate-700 px-2.5 py-1 text-[11px] text-slate-100 hover:border-brand-400">
            {t("common.actions.edit")}
          </button> : null}
          {onTest ? <button
            onClick={onTest}
            className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1 text-[11px] text-white hover:bg-brand-500/20"
            disabled={testing}
          >
            {testing ? t("devices.actions.testing") : t("devices.actions.test")}
          </button> : null}
          {onTools ? <button
            onClick={onTools}
            className="rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-100 hover:border-slate-400"
          >
            {t("devices.actions.tools")}
          </button> : null}
          {onDiagnose ? <button
            onClick={onDiagnose}
            className="rounded-lg border border-slate-600 bg-slate-900/60 px-2.5 py-1 text-[11px] text-slate-100 hover:border-slate-400"
            disabled={diagnosing || !canDiagnose}
          >
            {diagnosing ? t("devices.actions.diagnosing") : t("devices.actions.diagnose")}
          </button> : null}
          {canEnroll && onEnroll ? (
            <button
              onClick={onEnroll}
              className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-[11px] text-emerald-100 hover:bg-emerald-500/20"
              disabled={enrolling}
            >
              {enrolling ? t("devices.actions.enrolling") : t("devices.actions.enroll")}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function DeviceStatusModal({
  open,
  device,
  runtime,
  onClose,
}: {
  open: boolean;
  device: Device | null;
  runtime?: DeviceHeartbeat;
  onClose: () => void;
}) {
  const { t, i18n } = useTranslation();
  useModalDismiss(onClose, open);
  if (!open || !device) return null;

  const displayStatus: DeviceStatus =
    runtime?.connected === true ? "ONLINE" : runtime?.connected === false ? "OFFLINE" : device.status;
  const statusLabel = runtime
    ? runtime.connected
      ? t("devices.status.connected")
      : t("devices.status.disconnected")
    : t(DEVICE_STATUS_LABEL_KEYS[displayStatus] ?? displayStatus);
  const statusStyles: Record<DeviceStatus, string> = {
    UNKNOWN: "border-slate-600 bg-slate-800 text-slate-200",
    ONLINE: "border-emerald-500/50 bg-emerald-500/10 text-emerald-100",
    OFFLINE: "border-amber-500/50 bg-amber-500/10 text-amber-100",
    ERROR: "border-rose-500/50 bg-rose-500/10 text-rose-100",
  };
  const lastErrorMessage = runtime?.lastError ?? device.lastErrorMessage;
  const lastErrorAt = runtime?.lastErrorAt ?? device.lastErrorAt;
  const activityItems = [
    {
      testId: "device-status-last-poll",
      label: t("devices.labels.lastSuccessfulPoll"),
      value: runtime?.lastPollAt ?? device.lastSuccessfulPollAt ?? device.lastSeenAt,
    },
    {
      testId: "device-status-last-event",
      label: t("devices.labels.lastEventReceived"),
      value: runtime?.lastEventAt ?? device.lastEventReceivedAt,
    },
    {
      testId: "device-status-last-processed",
      label: t("devices.labels.lastEventProcessed"),
      value: runtime?.lastEventProcessedAt ?? device.lastEventProcessedAt,
    },
  ];

  return (
    <div
      data-testid="device-status-modal"
      className="modal-overlay fixed inset-0 z-[70] flex items-center justify-center overflow-hidden bg-black/60 p-4 sm:p-6"
      onClick={onClose}
      dir={rtlLanguages.includes(i18n.language.split("-")[0]) ? "rtl" : "ltr"}
    >
      <div
        className="w-full max-w-2xl rounded-2xl border border-slate-800/80 bg-slate-950 p-4 shadow-2xl shadow-black/40 sm:p-5"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <p className="text-sm font-semibold text-white">{t("devices.statusDetails.title")}</p>
              <span className={`rounded-full border px-2 py-0.5 text-[9px] uppercase ${statusStyles[displayStatus]}`}>
                {statusLabel}
              </span>
            </div>
            <p className="mt-1 text-xs font-medium text-slate-200">{device.name}</p>
            <p className="mt-0.5 text-[10px] text-slate-400">
              {t(CONNECTION_TYPE_LABEL_KEYS[device.connectionType] ?? device.connectionType)} · {getAddressSummary(device)}
            </p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>

        <p className="mt-3 text-[11px] text-slate-400">{t("devices.statusDetails.subtitle")}</p>

        <div className="mt-3 grid gap-2 sm:grid-cols-3">
          {activityItems.map((item) => (
            <div data-testid={item.testId} key={item.label} className="rounded-xl border border-slate-800 bg-slate-900/70 p-2.5">
              <p className="text-[9px] font-semibold uppercase tracking-wide text-slate-500">{item.label}</p>
              <p className="mt-1 text-[11px] font-medium leading-5 text-slate-100">
                {formatOperationalTime(item.value, i18n.language, t)}
              </p>
            </div>
          ))}
        </div>

        {lastErrorMessage ? (
          <div data-testid="device-status-last-error" className="device-status-error-panel mt-3 rounded-xl border p-3 text-[11px]">
            <p className="device-status-error-title font-semibold">{t("devices.labels.lastError")}</p>
            <p className="device-status-error-message mt-1 break-words leading-5">{lastErrorMessage}</p>
            {lastErrorAt ? (
              <p className="device-status-error-time mt-1 text-[10px]">
                {t("devices.labels.errorAt", { time: formatOperationalTime(lastErrorAt, i18n.language, t) })}
              </p>
            ) : null}
          </div>
        ) : (
          <div className="mt-3 rounded-xl border border-emerald-500/25 bg-emerald-500/10 p-3 text-[11px] text-emerald-100">
            {t("devices.statusDetails.noError")}
          </div>
        )}

        <p className="mt-3 text-[10px] text-slate-500">{t("devices.statusDetails.persistedHint")}</p>
      </div>
    </div>
  );
}

type FilterOption = { value: string; label: string; disabled?: boolean };

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
}) {
  return (
    <div>
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      <FilterSelectMenu value={value} options={options} onChange={onChange} buttonClassName="form-input" />
    </div>
  );
}

function FilterSelectMenu({
  name,
  value,
  options,
  onChange,
  onBlur,
  buttonClassName = "",
  containerClassName = "",
  disabled = false,
  ariaInvalid = false,
}: {
  name?: string;
  value: string;
  options: FilterOption[];
  onChange: (value: string) => void;
  onBlur?: () => void;
  buttonClassName?: string;
  containerClassName?: string;
  disabled?: boolean;
  ariaInvalid?: boolean;
}) {
  const isDisabled = Boolean(disabled);
  const [open, setOpen] = useState(false);
  const [disabledSnapshot, setDisabledSnapshot] = useState(isDisabled);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const displayLabel = selectedOption?.label ?? options[0]?.label ?? value ?? "";

  if (disabledSnapshot !== isDisabled) {
    setDisabledSnapshot(isDisabled);
    if (isDisabled && open) setOpen(false);
  }

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      <button
        name={name}
        type="button"
        className={`${buttonClassName} flex w-full items-center justify-between gap-2 text-start ${
          isDisabled ? "cursor-not-allowed opacity-60" : "cursor-pointer hover:bg-brand-500/10"
        }`}
        onClick={() => {
          if (!isDisabled) {
            setOpen((prev) => !prev);
          }
        }}
        onBlur={onBlur}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-invalid={ariaInvalid || undefined}
        aria-disabled={isDisabled || undefined}
        disabled={isDisabled}
      >
        <span className="truncate">{displayLabel}</span>
        <IconChevronDown
          className={`h-3.5 w-3.5 shrink-0 text-slate-300/90 transition ${open ? "rotate-180" : ""}`}
          stroke={2}
        />
      </button>
      {open && !isDisabled ? (
        <div className="submenu-panel absolute z-50 mt-1 w-full overflow-hidden rounded-xl border backdrop-blur">
          <div role="listbox" className="max-h-56 overflow-auto">
            {options.map((option, index) => {
              const isSelected = option.value === value;
              const isOptionDisabled = Boolean(option.disabled);
              const optionKey = option.value === "" ? `empty-${index}` : option.value;
              return (
                <button
                  key={optionKey}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  aria-disabled={isOptionDisabled || undefined}
                  disabled={isOptionDisabled}
                  className={`submenu-option flex w-full items-center justify-between rounded-lg text-start transition ${
                    isSelected ? "is-selected" : ""
                  } ${isOptionDisabled ? "is-disabled" : ""}`}
                  onClick={() => {
                    if (isOptionDisabled) return;
                    if (option.value !== value) {
                      onChange(option.value);
                    }
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <IconCheck className="submenu-check h-3 w-3" stroke={2} /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DeviceFormModal({
  open,
  onClose,
  initial,
  onSubmit,
  submitting,
}: {
  open: boolean;
  onClose: () => void;
  initial?: Device;
  onSubmit: (payload: DevicePayload) => void | Promise<void>;
  submitting: boolean;
}) {
  const { t } = useTranslation();
  const defaultConnection = initial?.connectionType ?? "NETWORK";
  const form = useForm<FormValues>({
    defaultValues: {
      name: initial?.name ?? "",
      type: initial?.type ?? "FINGERPRINT",
      connectionType: defaultConnection,
      enabled: initial?.enabled ?? true,
      model: initial?.model ?? undefined,
      serialNumber: initial?.serialNumber ?? undefined,
      config: getConfigDefaults(defaultConnection, initial?.config),
    } as FormValues,
  });

  const connectionType = useWatch({ control: form.control, name: "connectionType" });

  useEffect(() => {
    form.setValue("config", getConfigDefaults(connectionType, initial?.config));
  }, [connectionType, form, initial?.config]);

  const handleSubmit = form.handleSubmit(async (values) => {
    const payload: DevicePayload = {
      name: values.name.trim(),
      type: values.type,
      connectionType: values.connectionType,
      enabled: values.enabled,
      model: values.model || undefined,
      serialNumber: values.serialNumber || undefined,
      config: buildConfig(values.connectionType, values.config as Record<string, unknown>),
    };
    await onSubmit(payload);
  });

  useModalDismiss(onClose, open);
  if (!open) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 sm:p-6 overflow-hidden" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[90vh] rounded-2xl border border-slate-800/80 bg-slate-950 p-4 sm:p-5 shadow-2xl shadow-black/40 overflow-hidden" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">
              {initial ? t("devices.form.titleEdit") : t("devices.form.titleAdd")}
            </p>
            <p className="text-xs text-slate-400">{t("devices.form.subtitle")}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>

        <form onSubmit={handleSubmit} className="mt-3 space-y-2.5 h-full overflow-y-auto pr-2">
          <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
            <Field label={t("devices.form.fields.name")}>
              <input {...form.register("name", { required: t("devices.form.errors.nameRequired") })} className="form-input" />
              {form.formState.errors.name ? <ErrorText message={form.formState.errors.name.message} /> : null}
            </Field>
            <Field label={t("devices.form.fields.type")}>
              <Controller
                control={form.control}
                name="type"
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={DEVICE_TYPES.map((type) => ({
                      value: type,
                      label: t(DEVICE_TYPE_LABEL_KEYS[type] ?? "devices.types.other"),
                    }))}
                    buttonClassName="form-input"
                  />
                )}
              />
            </Field>
            <Field label={t("devices.form.fields.connection")}>
              <Controller
                control={form.control}
                name="connectionType"
                render={({ field }) => (
                  <FilterSelectMenu
                    name={field.name}
                    value={field.value ?? ""}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                    options={CONNECTION_TYPES.map((type) => ({
                      value: type,
                      label: t(CONNECTION_TYPE_LABEL_KEYS[type] ?? type),
                    }))}
                    buttonClassName="form-input"
                  />
                )}
              />
            </Field>
            <Field label={t("devices.form.fields.enabled")}>
              <label className="flex items-center gap-2 text-xs text-slate-200">
                <input type="checkbox" {...form.register("enabled")} className="h-3.5 w-3.5 accent-brand-500" defaultChecked={form.getValues("enabled")} />
                {t("common.status.active")}
              </label>
            </Field>
            <Field label={t("devices.form.fields.modelOptional")}>
              <input {...form.register("model")} className="form-input" />
            </Field>
            <Field label={t("devices.form.fields.serialOptional")}>
              <input {...form.register("serialNumber")} className="form-input" />
            </Field>
          </div>

          <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
            {connectionType === "NETWORK" ? (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("devices.form.fields.ipHost")}>
                  <input {...form.register("config.ip", { required: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.port")}>
                  <input type="number" min={1} max={65535} {...form.register("config.port", { valueAsNumber: true, required: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.passwordOptional")}>
                  <input {...form.register("config.password")} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.dnsOptional")}>
                  <input {...form.register("config.dns")} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.gatewayOptional")}>
                  <input {...form.register("config.gateway")} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.subnetOptional")}>
                  <input {...form.register("config.subnet")} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.protocolOptional")}>
                  <input {...form.register("config.protocol")} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.timeoutMs")}>
                  <input type="number" min={100} max={30000} {...form.register("config.timeoutMs", { valueAsNumber: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.pollIntervalMs")}>
                  <input type="number" min={500} max={120000} {...form.register("config.pollIntervalMs", { valueAsNumber: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.eventMode")}>
                  <Controller
                    control={form.control}
                    name="config.eventMode"
                    render={({ field }) => (
                      <FilterSelectMenu
                        name={field.name}
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        options={[
                          { value: "PULL", label: t("devices.form.eventMode.pull") },
                          { value: "PUSH", label: t("devices.form.eventMode.push") },
                          { value: "AUTO", label: t("devices.form.eventMode.auto") },
                        ]}
                        buttonClassName="form-input"
                      />
                    )}
                  />
                </Field>
                <Field label={t("devices.form.fields.pushEnabled")}>
                  <label className="flex items-center gap-2 text-xs text-slate-200">
                    <input type="checkbox" {...form.register("config.pushEnabled")} className="h-3.5 w-3.5 accent-brand-500" />
                    {t("devices.form.fields.pushEnabledHint")}
                  </label>
                </Field>
              </div>
            ) : connectionType === "USB" ? (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("devices.form.fields.vendorId")}>
                  <input {...form.register("config.vendorId", { required: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.productId")}>
                  <input {...form.register("config.productId", { required: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.driverOptional")}>
                  <input {...form.register("config.driver")} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.timeoutMs")}>
                  <input type="number" min={100} max={30000} {...form.register("config.timeoutMs", { valueAsNumber: true })} className="form-input" />
                </Field>
              </div>
            ) : (
              <div className="grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <Field label={t("devices.form.fields.comPort")}>
                  <input {...form.register("config.comPort", { required: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.baudRate")}>
                  <input type="number" min={1200} max={1000000} {...form.register("config.baudRate", { valueAsNumber: true, required: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.parity")}>
                  <Controller
                    control={form.control}
                    name="config.parity"
                    render={({ field }) => (
                      <FilterSelectMenu
                        name={field.name}
                        value={typeof field.value === "string" ? field.value : ""}
                        onChange={field.onChange}
                        onBlur={field.onBlur}
                        options={[
                          { value: "", label: t("devices.form.parity.none") },
                          { value: "even", label: t("devices.form.parity.even") },
                          { value: "odd", label: t("devices.form.parity.odd") },
                          { value: "mark", label: t("devices.form.parity.mark") },
                          { value: "space", label: t("devices.form.parity.space") },
                        ]}
                        buttonClassName="form-input"
                      />
                    )}
                  />
                </Field>
                <Field label={t("devices.form.fields.stopBits")}>
                  <input type="number" min={1} max={2} {...form.register("config.stopBits", { valueAsNumber: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.dataBits")}>
                  <input type="number" min={5} max={8} {...form.register("config.dataBits", { valueAsNumber: true })} className="form-input" />
                </Field>
                <Field label={t("devices.form.fields.timeoutMs")}>
                  <input type="number" min={100} max={30000} {...form.register("config.timeoutMs", { valueAsNumber: true })} className="form-input" />
                </Field>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={onClose} className="btn-cancel rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-200">
              {t("common.actions.cancel")}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg border border-brand-500/40 bg-brand-500/80 px-3 py-1.5 text-xs font-semibold text-white"
            >
              {submitting ? t("common.actions.saving") : initial ? t("devices.form.actions.saveChanges") : t("devices.form.actions.create")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function InterfaceBadges({ iface }: { iface: DiagnosticInterface }) {
  return (
    <>
      {iface.addressState ? (
        <span
          className={`ms-2 inline-flex rounded-full border px-1.5 py-0.5 text-[10px] ${
            iface.isDuplicate
              ? "border-rose-300 bg-rose-50 text-rose-700 dark:border-rose-500/50 dark:bg-rose-500/10 dark:text-rose-100"
              : "border-slate-300 bg-white/70 text-slate-600 dark:border-slate-700 dark:bg-slate-900/60 dark:text-slate-300"
          }`}
        >
          {iface.addressState}
        </span>
      ) : null}
      {iface.isLinkLocal ? (
        <span className="ms-2 inline-flex rounded-full border border-amber-300 bg-amber-50 px-1.5 py-0.5 text-[10px] text-amber-700 dark:border-amber-500/50 dark:bg-amber-500/10 dark:text-amber-100">
          169.254
        </span>
      ) : null}
    </>
  );
}

function isIpv4Address(value: string | undefined): value is string {
  if (!value) return false;
  const parts = value.split(".");
  return parts.length === 4 && parts.every((part) => /^\d+$/.test(part) && Number(part) >= 0 && Number(part) <= 255);
}

function suggestDiagnosticPcAddress(deviceIp: string | undefined, localIfaces: DiagnosticInterface[]) {
  if (!isIpv4Address(deviceIp)) return null;
  const safeDeviceIp = deviceIp;
  const parts = safeDeviceIp.split(".");
  const prefix = parts.slice(0, 3).join(".");
  const deviceLast = Number(parts[3]);
  const used = new Set(localIfaces.map((iface) => iface.address));
  const selected = [250, 201, 10, 20, 100, 150].find((last) => last !== deviceLast && !used.has(`${prefix}.${last}`)) ?? 250;
  return `${prefix}.${selected}`;
}

function networkIssueTranslationKey(code: DiagnosticNetworkIssue["code"]) {
  switch (code) {
    case "DEVICE_IP_CONFLICT":
      return "deviceIpConflict";
    case "LOCAL_IP_DUPLICATE":
      return "localIpDuplicate";
    case "LINK_LOCAL_ADDRESS":
      return "linkLocalAddress";
    case "SUBNET_MISMATCH":
      return "subnetMismatch";
    case "DEVICE_UNREACHABLE":
      return "deviceUnreachable";
    default:
      return null;
  }
}

function translateNetworkIssue(
  issue: DiagnosticNetworkIssue,
  t: TFunction,
  context: { deviceIp: string; suggestedPcIp: string; port: number }
) {
  const key = networkIssueTranslationKey(issue.code);
  if (!key) return issue;
  const values = {
    deviceIp: context.deviceIp,
    suggestedPcIp: context.suggestedPcIp,
    port: context.port,
    interfaceName: issue.interfaceName ?? t("devices.diagnostics.detected"),
    address: issue.address ?? context.deviceIp,
  };
  return {
    ...issue,
    title: t(`devices.diagnostics.issues.${key}.title`, values),
    detail: t(`devices.diagnostics.issues.${key}.detail`, values),
    recommendation: t(`devices.diagnostics.issues.${key}.recommendation`, values),
  };
}

function translatedDiagnosticRecommendations(
  diagnosis: DeviceDiagnostics,
  issues: DiagnosticNetworkIssue[],
  t: TFunction,
  context: { deviceIp: string; suggestedPcIp: string; port: number }
) {
  const translated = issues.map((issue) => translateNetworkIssue(issue, t, context).recommendation);
  if (diagnosis.tcpPort.status !== "open" && !issues.some((issue) => issue.code === "DEVICE_UNREACHABLE")) {
    translated.push(t("devices.diagnostics.issues.deviceUnreachable.recommendation"));
  }
  const fallback = diagnosis.recommendations.length > 0 ? diagnosis.recommendations : [];
  return Array.from(new Set(translated.length > 0 ? translated : fallback));
}

function DeviceDiagnosticsModal({
  open,
  device,
  diagnosis,
  scanStatus,
  scanLoading,
  onClose,
  onStartScan,
  onCancelScan,
  onUpdateIp,
}: {
  open: boolean;
  device: Device;
  diagnosis: DeviceDiagnostics;
  scanStatus: DeviceScanStatus | null;
  scanLoading: boolean;
  onClose: () => void;
  onStartScan: () => void;
  onCancelScan: () => void;
  onUpdateIp: (ip: string) => void;
}) {
  const { t } = useTranslation();
  const { push } = useToast();
  const lastMismatchRef = useRef<string | null>(null);
  const lastWarningRef = useRef<string | null>(null);
  useModalDismiss(onClose, open);
  const target = diagnosis.target;
  const networkIssues = diagnosis.networkIssues ?? [];
  const mismatch = diagnosis.subnetMatch.matched === false && (target.resolvedIp ?? target.host);
  const scanTargets = diagnosis.scanTargets ?? [];
  const scanDisabled = scanTargets.length === 0 || scanTargets.every((t) => t.tooLarge);
  const candidates = (scanStatus?.candidates ?? []).slice().sort((a, b) => Number(Boolean(b.verified)) - Number(Boolean(a.verified)));
  const primaryIssue = networkIssues.find((issue) => issue.severity === "critical") ?? networkIssues[0];
  const localSetupIssue =
    primaryIssue?.code === "DEVICE_IP_CONFLICT" || primaryIssue?.code === "LOCAL_IP_DUPLICATE" || primaryIssue?.code === "LINK_LOCAL_ADDRESS";
  const canScan = (mismatch || diagnosis.tcpPort.status !== "open") && !localSetupIssue;
  const secondaryIssues = networkIssues.filter((issue) => issue !== primaryIssue);
  const issueContext = {
    deviceIp: target.resolvedIp ?? target.host,
    suggestedPcIp: suggestDiagnosticPcAddress(target.resolvedIp ?? target.host, diagnosis.localInterfaces) ?? t("devices.diagnostics.unusedAddress"),
    port: target.port,
  };
  const translatedPrimaryIssue = primaryIssue ? translateNetworkIssue(primaryIssue, t, issueContext) : null;
  const translatedSecondaryIssues = secondaryIssues.map((issue) => translateNetworkIssue(issue, t, issueContext));
  const translatedRecommendations = translatedDiagnosticRecommendations(diagnosis, networkIssues, t, issueContext);
  const matchingInterfaces = diagnosis.localInterfaces.filter((iface) => diagnosis.subnetMatch.matchedInterfaces.includes(iface.name));
  const activeInterface =
    matchingInterfaces.find((iface) => !iface.isDuplicate && !iface.isLinkLocal) ??
    matchingInterfaces[0] ??
    diagnosis.localInterfaces.find((iface) => iface.address === target.resolvedIp) ??
    null;
  const connectionHealthy = !primaryIssue && diagnosis.subnetMatch.matched !== false && diagnosis.tcpPort.status === "open";
  const nextStep = translatedPrimaryIssue?.recommendation ?? (connectionHealthy ? t("devices.diagnostics.noActionNeeded") : translatedRecommendations[0]);
  const summaryTone = primaryIssue
    ? primaryIssue.severity === "critical"
      ? "border-rose-300 bg-rose-50 text-rose-950 dark:border-rose-500/40 dark:bg-rose-950/30 dark:text-rose-50"
      : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-50"
    : connectionHealthy
      ? "border-emerald-300 bg-emerald-50 text-emerald-950 dark:border-emerald-500/40 dark:bg-emerald-950/30 dark:text-emerald-50"
      : "border-amber-300 bg-amber-50 text-amber-950 dark:border-amber-500/40 dark:bg-amber-950/30 dark:text-amber-50";

  useEffect(() => {
    if (!open) {
      lastMismatchRef.current = null;
      lastWarningRef.current = null;
      return;
    }
    if (mismatch) {
      const message = t("devices.diagnostics.mismatch", { host: target.resolvedIp ?? target.host });
      if (message !== lastMismatchRef.current) {
        push({ kind: "warning", title: message });
        lastMismatchRef.current = message;
      }
    }
  }, [mismatch, open, push, t, target.host, target.resolvedIp]);

  useEffect(() => {
    if (!open) {
      lastWarningRef.current = null;
      return;
    }
    if (target.warning && target.warning !== lastWarningRef.current) {
      push({ kind: "warning", title: target.warning });
      lastWarningRef.current = target.warning;
    }
  }, [open, push, target.warning]);

  if (!open) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4 sm:p-6" onClick={onClose}>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 p-4 shadow-2xl shadow-black/30 dark:border-slate-800/80 dark:bg-slate-950 sm:p-5" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">{t("devices.diagnostics.title")}</p>
            <p className="text-xs text-slate-500 dark:text-slate-400">{t("devices.diagnostics.deviceLabel", { name: device.name })}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>

        <div className="mt-4 min-h-0 flex-1 overflow-y-auto pr-2">
          <div className={`rounded-xl border p-4 ${summaryTone}`}>
            <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-sm font-semibold">
                  {primaryIssue
                    ? t("devices.diagnostics.summaryIssueTitle")
                    : connectionHealthy
                      ? t("devices.diagnostics.summaryHealthyTitle")
                      : t("devices.diagnostics.summaryReviewTitle")}
                </p>
                <p className="mt-1 text-sm opacity-90">
                  {translatedPrimaryIssue
                    ? translatedPrimaryIssue.title
                    : connectionHealthy
                      ? t("devices.diagnostics.healthyDescription", { target: `${target.host}:${target.port}` })
                      : t("devices.diagnostics.reviewDescription")}
                </p>
              </div>
              <span className="inline-flex w-fit rounded-full border border-black/10 bg-white/70 px-2.5 py-1 text-[11px] font-semibold uppercase text-slate-700 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-200">
                {primaryIssue
                  ? primaryIssue.severity === "critical"
                    ? t("devices.diagnostics.critical")
                    : t("devices.diagnostics.warning")
                  : connectionHealthy
                    ? t("devices.diagnostics.ready")
                    : t("devices.diagnostics.review")}
              </span>
            </div>
            {translatedPrimaryIssue?.detail ? <p className="mt-3 text-sm leading-relaxed opacity-90">{translatedPrimaryIssue.detail}</p> : null}
            {nextStep ? (
              <div className="mt-3 rounded-lg border border-black/10 bg-white/70 p-3 text-slate-900 dark:border-white/10 dark:bg-slate-950/30 dark:text-slate-100">
                <p className="text-[11px] font-semibold uppercase text-slate-500 dark:text-slate-300">{t("devices.diagnostics.nextStep")}</p>
                <p className="mt-1 text-sm leading-relaxed">{nextStep}</p>
              </div>
            ) : null}
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            <div className="space-y-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("devices.diagnostics.activePath")}</p>
              <div className="flex items-start justify-between gap-3 border-t border-slate-200 pt-2 text-xs dark:border-slate-800">
                <span className="text-slate-500 dark:text-slate-400">{t("devices.diagnostics.deviceTarget")}</span>
                <span className="text-right font-medium text-slate-800 dark:text-slate-100">
                  {target.host}:{target.port}
                </span>
              </div>
              {target.resolvedIp && target.resolvedIp !== target.host ? (
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t("devices.diagnostics.resolvedIpShort")}</span>
                  <span className="text-right font-medium text-slate-800 dark:text-slate-100">{target.resolvedIp}</span>
                </div>
              ) : null}
              <div className="flex items-start justify-between gap-3 text-xs">
                <span className="text-slate-500 dark:text-slate-400">{t("devices.diagnostics.pcAdapter")}</span>
                {activeInterface ? (
                  <span className="max-w-[70%] text-right font-medium text-slate-800 dark:text-slate-100">
                    {activeInterface.name}
                    <br />
                    {activeInterface.address} / {activeInterface.netmask}
                    <InterfaceBadges iface={activeInterface} />
                  </span>
                ) : (
                  <span className="text-right text-amber-700 dark:text-amber-200">{t("devices.diagnostics.noMatchingAdapter")}</span>
                )}
              </div>
              {diagnosis.subnetMatch.expectedSubnet ? (
                <div className="flex items-start justify-between gap-3 text-xs">
                  <span className="text-slate-500 dark:text-slate-400">{t("devices.diagnostics.subnet")}</span>
                  <span className="text-right font-medium text-slate-800 dark:text-slate-100">{diagnosis.subnetMatch.expectedSubnet.cidr}</span>
                </div>
              ) : null}
              {diagnosis.subnetMatch.matched === true ? (
                <p className="text-xs text-emerald-700 dark:text-emerald-200">{t("devices.diagnostics.matchingNics", { nics: diagnosis.subnetMatch.matchedInterfaces.join(", ") || t("devices.diagnostics.detected") })}</p>
              ) : diagnosis.subnetMatch.matched === false ? (
                <p className="text-xs text-rose-700 dark:text-rose-200">{t("devices.diagnostics.noMatchingNics")}</p>
              ) : null}
            </div>

            <div className="space-y-3 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("devices.diagnostics.reachability")}</p>
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
                <span>{t("devices.diagnostics.ping")}</span>
                <span className={statusTone(diagnosis.ping.status)}>{t(DIAGNOSTIC_STATUS_LABEL_KEYS[diagnosis.ping.status] ?? diagnosis.ping.status)}</span>
              </div>
              <div className="flex items-center justify-between text-xs text-slate-700 dark:text-slate-200">
                <span>{t("devices.diagnostics.tcpPort", { port: target.port })}</span>
                <span className={statusTone(diagnosis.tcpPort.status)}>{t(DIAGNOSTIC_STATUS_LABEL_KEYS[diagnosis.tcpPort.status] ?? diagnosis.tcpPort.status)}</span>
              </div>
              {diagnosis.tcpPort.latencyMs !== undefined ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{t("devices.diagnostics.latency", { ms: diagnosis.tcpPort.latencyMs })}</p>
              ) : null}
            </div>
          </div>

          {translatedSecondaryIssues.length > 0 ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("devices.diagnostics.otherIssues")}</p>
              <div className="mt-2 space-y-2">
                {translatedSecondaryIssues.map((issue, idx) => (
                  <div
                    key={`${issue.code}-${issue.address ?? idx}`}
                    className={`rounded-lg border px-2.5 py-2 text-xs ${
                      issue.severity === "critical"
                        ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/10 dark:text-rose-100"
                        : "border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/10 dark:text-amber-100"
                    }`}
                  >
                    <p className="font-semibold">{issue.title}</p>
                    <p className="mt-1 opacity-90">{issue.detail}</p>
                  </div>
                ))}
              </div>
            </div>
          ) : null}

          <details className="mt-4 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
            <summary className="cursor-pointer text-xs font-semibold text-slate-700 dark:text-slate-300">{t("devices.diagnostics.advancedDetails")}</summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-2">
              <div className="space-y-3">
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("devices.diagnostics.savedDevice")}</p>
                  <p className="mt-1 text-xs text-slate-700 dark:text-slate-200">
                    {target.host}:{target.port}
                  </p>
                  {diagnosis.subnetMatch.expectedSubnet ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">{t("devices.diagnostics.expectedSubnet", { subnet: diagnosis.subnetMatch.expectedSubnet.cidr })}</p>
                  ) : null}
                </div>
                <div>
                  <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("devices.diagnostics.localInterfaces")}</p>
                  {diagnosis.localInterfaces.length === 0 ? (
                    <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("devices.diagnostics.noInterfaces")}</p>
                  ) : (
                    <div className="mt-1 max-h-56 space-y-1 overflow-y-auto pr-1">
                      {diagnosis.localInterfaces.map((iface) => (
                        <div key={`${iface.name}-${iface.address}`} className="text-xs text-slate-700 dark:text-slate-200">
                          {iface.name}: {iface.address} / {iface.netmask} ({iface.network}/{iface.prefix})
                          <InterfaceBadges iface={iface} />
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold text-slate-600 dark:text-slate-300">{t("devices.diagnostics.recommended")}</p>
                {translatedRecommendations.length === 0 ? (
                  <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">{t("devices.diagnostics.noIssues")}</p>
                ) : (
                  <ul className="mt-2 space-y-1 text-xs text-slate-700 dark:text-slate-200">
                    {translatedRecommendations.map((rec, idx) => (
                      <li key={`${idx}-${rec}`}>{rec}</li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          </details>

          {canScan || scanStatus ? (
            <div className="mt-4 rounded-xl border border-slate-200 bg-white/60 p-3 dark:border-slate-800 dark:bg-slate-900/40">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">{t("devices.diagnostics.scan.title")}</p>
                  <p className="text-xs text-slate-500 dark:text-slate-400">{t("devices.diagnostics.scan.subtitle", { port: target.port })}</p>
                </div>
                <button
                  type="button"
                  onClick={onStartScan}
                  disabled={!canScan || scanDisabled || scanLoading}
                  className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-100 disabled:opacity-50"
                >
                  {t("devices.diagnostics.scan.start")}
                </button>
              </div>

              {scanTargets.length > 0 ? (
              <div className="mt-3 space-y-1 text-xs text-slate-700 dark:text-slate-300">
                {scanTargets.map((target, idx) => (
                  <div key={`${target.cidr}-${idx}`} className="flex items-center justify-between">
                    <span>{target.cidr}</span>
                    <span className="text-[11px] text-slate-500">
                      {target.reason} {target.tooLarge ? t("devices.diagnostics.scan.tooLarge") : t("devices.diagnostics.scan.hostCount", { count: target.hostCount })}
                    </span>
                  </div>
                ))}
              </div>
            ) : null}

              {scanStatus ? (
              <div className="mt-4 rounded-xl border border-slate-200 bg-white/70 p-3 text-xs text-slate-700 dark:border-slate-800/80 dark:bg-slate-950/50 dark:text-slate-200">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span>{t("devices.diagnostics.scan.statusLine", { status: t(SCAN_STATUS_LABEL_KEYS[scanStatus.status] ?? scanStatus.status) })}</span>
                  <span>{t("devices.diagnostics.scan.checked", { completed: scanStatus.completed, total: scanStatus.total })}</span>
                  {scanStatus.status === "running" ? (
                    <button
                      type="button"
                      onClick={onCancelScan}
                      disabled={scanLoading}
                      className="btn-cancel rounded-lg border border-slate-300 px-2 py-1 text-[11px] text-slate-700 hover:border-slate-500 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50"
                    >
                      {t("common.actions.cancel")}
                    </button>
                  ) : null}
                </div>

                {scanStatus.message ? <p className="mt-2 text-amber-700 dark:text-amber-200">{scanStatus.message}</p> : null}

                {candidates.length === 0 ? (
                  <p className="mt-2 text-slate-500 dark:text-slate-400">{t("devices.diagnostics.scan.noCandidates")}</p>
                ) : (
                  <div className="mt-2 space-y-2">
                    {candidates.map((candidate) => (
                      <div key={candidate.ip} className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-100 px-2.5 py-1.5 dark:bg-slate-900/60">
                        <div>
                          <p className="text-xs text-slate-800 dark:text-slate-100">
                            {candidate.ip}:{candidate.port}
                          </p>
                          <p className="text-[11px] text-slate-500 dark:text-slate-400">
                            {candidate.verified
                              ? t("devices.diagnostics.scan.serialVerified")
                              : candidate.serialNumber
                                ? t("devices.diagnostics.scan.serialNumber", { serial: candidate.serialNumber })
                                : t("devices.diagnostics.scan.unverified")}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => onUpdateIp(candidate.ip)}
                          disabled={scanLoading}
                          className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-[11px] text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-100 disabled:opacity-50"
                        >
                          {t("devices.diagnostics.scan.updateIp")}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

type ToolState = {
  status: "idle" | "running" | "ok" | "error";
  message?: string;
};

function DeviceToolsModal({
  open,
  device,
  onClose,
}: {
  open: boolean;
  device: Device;
  onClose: () => void;
}) {
  const { t } = useTranslation();
  const { push } = useToast();
  const { hasPermission } = useAuth();
  const canSyncUsers = hasPermission("DEVICES_USER_SYNC");
  const canEnrollFinger = hasPermission("DEVICES_ENROLL");
  const canDiagnose = hasPermission("DEVICES_DIAGNOSTICS");
  const canUnlock = hasPermission("DOOR_UNLOCK");
  const canClearLogs = hasPermission("DEVICES_CLEAR_LOGS");
  const [toolState, setToolState] = useState<Record<string, ToolState>>({});
  const [userId, setUserId] = useState("");
  const [userName, setUserName] = useState("");
  const [fingerId, setFingerId] = useState("0");
  const [logLimit, setLogLimit] = useState("50");
  const [unlockSeconds, setUnlockSeconds] = useState("3");
  const [users, setUsers] = useState<DeviceUserSummary[]>([]);
  const [logItems, setLogItems] = useState<DeviceAttendanceItem[]>([]);
  const [logCount, setLogCount] = useState<number | null>(null);
  const [deviceTime, setDeviceTimeValue] = useState<string | null>(null);

  const canUseTools =
    device.type === "FINGERPRINT" &&
    (device.connectionType === "ZKTECO_PULL_SDK" || device.connectionType === "NETWORK");
  const withModeSuffix = (mode?: string) => (mode ? t("devices.tools.modeSuffix", { mode }) : "");
  const totalOnDeviceText =
    logCount === null
      ? `${t("devices.tools.totalOnDevice", { count: 0 })} (${t("devices.tools.unknown")})`
      : t("devices.tools.totalOnDevice", { count: logCount });

  const updateToolState = (key: string, next: ToolState) => {
    setToolState((prev) => ({ ...prev, [key]: next }));
  };

  const runTool = async (key: string, action: () => Promise<string>) => {
    updateToolState(key, { status: "running" });
    try {
      const message = await action();
      updateToolState(key, { status: "ok", message });
    } catch (err) {
      updateToolState(key, { status: "error", message: err instanceof Error ? err.message : t("devices.tools.errors.requestFailed") });
    }
  };

  const requireUserId = (key: string) => {
    const trimmed = userId.trim();
    if (!trimmed) {
      updateToolState(key, { status: "error", message: t("devices.tools.errors.userIdRequired") });
      return null;
    }
    return trimmed;
  };

  const parseFingerId = (key: string) => {
    const trimmed = fingerId.trim();
    if (!trimmed) return undefined;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 0 || parsed > 9) {
      updateToolState(key, { status: "error", message: t("devices.tools.errors.fingerRange") });
      return null;
    }
    return parsed;
  };

  const parseUnlockSeconds = (key: string) => {
    const trimmed = unlockSeconds.trim();
    if (!trimmed) return 3;
    const parsed = Number(trimmed);
    if (!Number.isInteger(parsed) || parsed < 1 || parsed > 60) {
      updateToolState(key, { status: "error", message: t("devices.tools.errors.unlockRange") });
      return null;
    }
    return parsed;
  };

  const handleListUsers = () =>
    runTool("listUsers", async () => {
      const { data } = await listDeviceUsers(device.id);
      setUsers(data.items ?? []);
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.usersFound", { count: data.items?.length ?? 0, suffix });
    });

  const handleSyncUsers = () =>
    runTool("syncUsers", async () => {
      const { data } = await syncDeviceUsers(device.id);
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.usersSynced", {
        synced: data.synced,
        total: data.total,
        skipped: data.skipped,
        suffix,
      });
    });

  const handleUpsertUser = () => {
    const trimmedUserId = requireUserId("upsertUser");
    if (!trimmedUserId) return;
    const trimmedName = userName.trim();
    if (!trimmedName) {
      updateToolState("upsertUser", { status: "error", message: t("devices.tools.errors.nameRequired") });
      return;
    }
    runTool("upsertUser", async () => {
      const { data } = await upsertDeviceUser(device.id, { userId: trimmedUserId, name: trimmedName });
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.userSaved", { suffix });
    });
  };

  const handleDeleteUser = () => {
    const trimmedUserId = requireUserId("deleteUser");
    if (!trimmedUserId) return;
    runTool("deleteUser", async () => {
      const { data } = await deleteDeviceUser(device.id, { userId: trimmedUserId });
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.userDeleted", { suffix });
    });
  };

  const handleEnroll = () => {
    const trimmedUserId = requireUserId("enroll");
    if (!trimmedUserId) return;
    const parsedFinger = parseFingerId("enroll");
    if (parsedFinger === null) return;
    runTool("enroll", async () => {
      const { data } = await enrollDevice(device.id, {
        userId: trimmedUserId,
        ...(parsedFinger !== undefined ? { fingerId: parsedFinger } : {}),
      });
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.enrollStarted", { suffix });
    });
  };

  const handleGetTime = () =>
    runTool("getTime", async () => {
      const { data } = await getDeviceTime(device.id);
      setDeviceTimeValue(data.time);
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.timeLoaded", { suffix });
    });

  const handleSetTime = () =>
    runTool("setTime", async () => {
      const { data } = await setDeviceTime(device.id);
      setDeviceTimeValue(data.time);
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.timeUpdated", { suffix });
    });

  const handleUnlockDoor = () => {
    const seconds = parseUnlockSeconds("unlockDoor");
    if (seconds === null) return;
    runTool("unlockDoor", async () => {
      const { data } = await unlockDeviceDoor(device.id, { seconds });
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.doorUnlocked", { seconds: data.seconds, suffix });
    });
  };

  const handleFetchLogs = () =>
    runTool("fetchLogs", async () => {
      const parsedLimit = Number(logLimit);
      const limit = Number.isInteger(parsedLimit) && parsedLimit > 0 ? parsedLimit : undefined;
      const { data } = await fetchDeviceAttendanceLogs(device.id, limit ? { limit } : undefined);
      setLogItems(data.items ?? []);
      setLogCount(data.count ?? 0);
      const suffix = withModeSuffix(data.mode);
      return t("devices.tools.messages.logsFetched", { count: data.count ?? 0, suffix });
    });

  const handleClearLogs = () =>
    runTool("clearLogs", async () => {
      const { data } = await clearDeviceAttendanceLogs(device.id);
      setLogItems([]);
      setLogCount(0);
      const suffix = withModeSuffix(data.mode);
      return data.ok ? t("devices.tools.messages.logsCleared", { suffix }) : t("devices.tools.messages.clearFailed", { suffix });
    });

  useModalDismiss(onClose, open);
  useEffect(() => {
    if (open && !canUseTools) {
      push({ kind: "warning", title: t("devices.tools.notSupported") });
    }
  }, [canUseTools, open, push, t]);
  if (!open) return null;

  return (
    <div className="modal-overlay fixed inset-0 z-[60] flex items-start justify-center bg-black/60 px-4 pb-4 pt-0" onClick={onClose}>
      <div className="w-full max-w-5xl max-h-[calc(100vh-1rem)] overflow-hidden rounded-2xl border border-slate-800/80 bg-slate-950 p-4 sm:p-5 shadow-2xl shadow-black/40 flex flex-col" onClick={(event) => event.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-semibold text-white">{t("devices.tools.title")}</p>
            <p className="text-xs text-slate-400">{t("devices.tools.deviceLabel", { name: device.name })}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>

        <div className="mt-4 flex-1 min-h-0 overflow-y-auto pr-2">
          <div className="grid gap-3 lg:grid-cols-2">
            <div className="space-y-3">
              <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
                <p className="text-xs font-semibold text-slate-300">{t("devices.tools.userTools")}</p>
                <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                  <Field label={t("devices.tools.fields.userId")}>
                    <input value={userId} onChange={(e) => setUserId(e.target.value)} className="form-input" />
                  </Field>
                  <Field label={t("devices.tools.fields.userName")}>
                    <input value={userName} onChange={(e) => setUserName(e.target.value)} className="form-input" />
                  </Field>
                  <Field label={t("devices.tools.fields.fingerId")}>
                    <input value={fingerId} onChange={(e) => setFingerId(e.target.value)} className="form-input" />
                  </Field>
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleListUsers}
                      hidden={!canSyncUsers}
                      disabled={!canUseTools || toolState.listUsers?.status === "running"}
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white disabled:opacity-50"
                    >
                      {t("devices.tools.actions.listUsers")}
                    </button>
                    <ToolStatus state={toolState.listUsers} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSyncUsers}
                      hidden={!canSyncUsers}
                      disabled={!canUseTools || toolState.syncUsers?.status === "running"}
                      className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white disabled:opacity-50"
                    >
                      {t("devices.tools.actions.syncDb")}
                    </button>
                    <ToolStatus state={toolState.syncUsers} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleUpsertUser}
                      hidden={!canSyncUsers}
                      disabled={!canUseTools || toolState.upsertUser?.status === "running"}
                      className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1.5 text-xs text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-100 disabled:opacity-50"
                    >
                      {t("devices.tools.actions.saveUser")}
                    </button>
                    <ToolStatus state={toolState.upsertUser} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleDeleteUser}
                      hidden={!canSyncUsers}
                      disabled={!canUseTools || toolState.deleteUser?.status === "running"}
                      className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-500/20 dark:text-rose-100 disabled:opacity-50"
                    >
                      {t("devices.tools.actions.deleteUser")}
                    </button>
                    <ToolStatus state={toolState.deleteUser} />
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={handleEnroll}
                      hidden={!canEnrollFinger}
                      disabled={!canUseTools || toolState.enroll?.status === "running"}
                      className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1.5 text-xs text-brand-700 hover:bg-brand-500/20 dark:text-white disabled:opacity-50"
                    >
                      {t("devices.tools.actions.enrollFinger")}
                    </button>
                    <ToolStatus state={toolState.enroll} />
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-xs text-slate-200">
                  <p className="text-[11px] uppercase tracking-wide text-slate-400">{t("devices.tools.usersPreview")}</p>
                  {users.length === 0 ? (
                    <p className="mt-2 text-slate-400">{t("devices.tools.noUsers")}</p>
                  ) : (
                    <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                      {users.slice(0, 20).map((user) => (
                        <div key={`${user.userId}-${user.uid}`} className="flex items-center justify-between text-[11px] text-slate-200">
                          <span>{user.userId}</span>
                          <span className="text-slate-400">{user.name ?? t("devices.tools.notAvailable")}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-xs font-semibold text-slate-300">{t("devices.tools.deviceTime")}</p>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleGetTime}
                  hidden={!canDiagnose}
                  disabled={!canUseTools || toolState.getTime?.status === "running"}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white disabled:opacity-50"
                >
                  {t("devices.tools.actions.getTime")}
                </button>
                <ToolStatus state={toolState.getTime} />
                <button
                  type="button"
                  onClick={handleSetTime}
                  hidden={!canDiagnose}
                  disabled={!canUseTools || toolState.setTime?.status === "running"}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white disabled:opacity-50"
                >
                  {t("devices.tools.actions.setTime")}
                </button>
                <ToolStatus state={toolState.setTime} />
              </div>
              <p className="mt-3 text-xs text-slate-300">
                {t("devices.tools.currentDeviceTime", {
                  time: deviceTime ? new Date(deviceTime).toLocaleString() : t("devices.tools.notLoaded"),
                })}
              </p>
            </div>
          </div>

          <div className="space-y-3">
            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-xs font-semibold text-slate-300">{t("devices.tools.doorRelay")}</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <Field label={t("devices.tools.fields.unlockSeconds")}>
                  <input value={unlockSeconds} onChange={(e) => setUnlockSeconds(e.target.value)} className="form-input" />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleUnlockDoor}
                  hidden={!canUnlock}
                  disabled={!canUseTools || toolState.unlockDoor?.status === "running"}
                  className="rounded-lg border border-brand-500/40 bg-brand-500/10 px-2.5 py-1.5 text-xs text-brand-700 hover:bg-brand-500/20 dark:text-white disabled:opacity-50"
                >
                  {t("devices.tools.actions.unlockDoor")}
                </button>
                <ToolStatus state={toolState.unlockDoor} />
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-xs font-semibold text-slate-300">{t("devices.tools.attendanceLogs")}</p>
              <div className="mt-3 grid gap-2.5 sm:grid-cols-2">
                <Field label={t("devices.tools.fields.logLimit")}>
                  <input value={logLimit} onChange={(e) => setLogLimit(e.target.value)} className="form-input" />
                </Field>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleFetchLogs}
                  hidden={!canDiagnose}
                  disabled={!canUseTools || toolState.fetchLogs?.status === "running"}
                  className="rounded-lg border border-slate-700 px-2.5 py-1.5 text-xs text-slate-700 hover:border-slate-400 hover:text-slate-900 dark:text-slate-100 dark:hover:text-white disabled:opacity-50"
                >
                  {t("devices.tools.actions.fetchLogs")}
                </button>
                <ToolStatus state={toolState.fetchLogs} />
                <button
                  type="button"
                  onClick={handleClearLogs}
                  hidden={!canClearLogs}
                  disabled={!canUseTools || toolState.clearLogs?.status === "running"}
                  className="rounded-lg border border-rose-500/40 bg-rose-500/10 px-2.5 py-1.5 text-xs text-rose-700 hover:bg-rose-500/20 dark:text-rose-100 disabled:opacity-50"
                >
                  {t("devices.tools.actions.clearLogs")}
                </button>
                <ToolStatus state={toolState.clearLogs} />
              </div>
              <p className="mt-3 text-xs text-slate-300">{totalOnDeviceText}</p>
              <div className="mt-3 rounded-xl border border-slate-800/80 bg-slate-950/50 p-3 text-xs text-slate-200">
                <p className="text-[11px] uppercase tracking-wide text-slate-400">{t("devices.tools.logPreview")}</p>
                {logItems.length === 0 ? (
                  <p className="mt-2 text-slate-400">{t("devices.tools.noLogs")}</p>
                ) : (
                  <div className="mt-2 max-h-28 space-y-1 overflow-y-auto pr-1">
                    {logItems.slice(-15).map((item, idx) => (
                      <div key={`${item.externalUserId}-${item.timestamp}-${idx}`} className="flex items-center justify-between text-[11px]">
                        <span>{item.externalUserId}</span>
                        <span className="text-slate-400">{new Date(item.timestamp).toLocaleString()}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="rounded-xl border border-slate-800 bg-slate-900/40 p-3">
              <p className="text-xs font-semibold text-slate-300">{t("devices.tools.notSupportedYet.title")}</p>
              <ul className="mt-2 space-y-1 text-xs text-slate-400">
                <li>{t("devices.tools.notSupportedYet.items.renameUser")}</li>
                <li>{t("devices.tools.notSupportedYet.items.deleteSingleFinger")}</li>
                <li>{t("devices.tools.notSupportedYet.items.offlineQueue")}</li>
              </ul>
            </div>
          </div>
        </div>
        </div>

        <div className="mt-3 flex items-center justify-end">
          <CloseIconButton label={t("common.actions.close")} onClick={onClose} />
        </div>
      </div>
    </div>
  );
}

function ToolStatus({ state }: { state?: ToolState }) {
  const { t } = useTranslation();
  if (!state || state.status === "idle") return null;
  const tone =
    state.status === "running"
      ? "text-slate-600 dark:text-slate-300"
      : state.status === "ok"
        ? "text-emerald-700 dark:text-emerald-200"
        : "text-rose-700 dark:text-rose-200";
  const label =
    state.status === "running"
      ? t("devices.tools.status.running")
      : state.message ?? (state.status === "ok" ? t("devices.tools.status.done") : t("devices.tools.status.failed"));
  return <span className={`text-xs ${tone}`}>{label}</span>;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold text-slate-300">{label}</p>
      {children}
    </div>
  );
}

function ErrorText({ message }: { message?: string }) {
  if (!message) return null;
  return <p className="text-xs text-rose-700 dark:text-rose-300">{message}</p>;
}

function SkeletonCard() {
  return (
    <div className="space-y-3">
      {[1, 2].map((i) => (
        <div key={i} className="rounded-2xl border border-slate-800/80 bg-slate-950/60 p-3">
          <div className="h-4 w-40 animate-pulse rounded-full bg-slate-800" />
          <div className="mt-2.5 h-3.5 w-64 animate-pulse rounded-full bg-slate-900" />
          <div className="mt-3 grid gap-2 md:grid-cols-3">
            <div className="h-9 animate-pulse rounded-2xl bg-slate-900/80" />
            <div className="h-9 animate-pulse rounded-2xl bg-slate-900/80" />
            <div className="h-9 animate-pulse rounded-2xl bg-slate-900/80" />
          </div>
        </div>
      ))}
    </div>
  );
}

function getConfigDefaults(connectionType: DeviceConnectionType, config?: DeviceConfig) {
  const values = toConfigRecord(config);
  if (connectionType === "USB") {
    return {
      vendorId: configString(values.vendorId),
      productId: configString(values.productId),
      driver: configString(values.driver),
      timeoutMs: configNumber(values.timeoutMs, 3000),
    };
  }
  if (connectionType === "SERIAL") {
    return {
      comPort: configString(values.comPort),
      baudRate: configNumber(values.baudRate, 9600),
      parity: configString(values.parity),
      stopBits: configNumber(values.stopBits, 1),
      dataBits: configNumber(values.dataBits, 8),
      timeoutMs: configNumber(values.timeoutMs, 3000),
    };
  }
  return {
    ip: configString(values.ip),
    port: configNumber(values.port, 4370),
    password: configString(values.password),
    dns: configString(values.dns),
    gateway: configString(values.gateway),
    subnet: configString(values.subnet),
    protocol: configString(values.protocol),
    timeoutMs: configNumber(values.timeoutMs, 3000),
    pollIntervalMs: configNumber(values.pollIntervalMs, 5000),
    eventMode: isEventMode(values.eventMode) ? values.eventMode : "PULL",
    pushEnabled: typeof values.pushEnabled === "boolean" ? values.pushEnabled : false,
  };
}

function buildConfig(connectionType: DeviceConnectionType, config: Record<string, unknown>): DeviceConfig {
  if (connectionType === "USB") {
    return {
      vendorId: configString(config.vendorId),
      productId: configString(config.productId),
      driver: optionalString(config.driver),
      timeoutMs: optionalNumber(config.timeoutMs),
    };
  }
  if (connectionType === "SERIAL") {
    return {
      comPort: configString(config.comPort),
      baudRate: Number(config.baudRate) || 0,
      parity: optionalString(config.parity),
      stopBits: optionalNumber(config.stopBits),
      dataBits: optionalNumber(config.dataBits),
      timeoutMs: optionalNumber(config.timeoutMs),
    };
  }
  return {
    ip: configString(config.ip),
    port: Number(config.port) || 0,
    password: optionalString(config.password),
    dns: optionalString(config.dns),
    gateway: optionalString(config.gateway),
    subnet: optionalString(config.subnet),
    protocol: optionalString(config.protocol),
    timeoutMs: optionalNumber(config.timeoutMs),
    pollIntervalMs: optionalNumber(config.pollIntervalMs),
    eventMode: isEventMode(config.eventMode) ? config.eventMode : undefined,
    pushEnabled: Boolean(config.pushEnabled),
  };
}

function getAddressSummary(device: Device) {
  const cfg = toConfigRecord(device.config);
  if (device.connectionType === "USB") {
    return `${configString(cfg.vendorId, "VID")}:${configString(cfg.productId, "PID")}`;
  }
  if (device.connectionType === "SERIAL") {
    const baudRate = optionalNumber(cfg.baudRate);
    const baud = baudRate ? `@${baudRate}` : "";
    return `${configString(cfg.comPort, "COM")}${baud}`;
  }
  const portValue = optionalNumber(cfg.port);
  const port = portValue ? `:${portValue}` : "";
  return `${configString(cfg.ip, "host")}${port}`;
}

function toConfigRecord(config?: DeviceConfig): Record<string, unknown> {
  return config && typeof config === "object" && !Array.isArray(config)
    ? (config as Record<string, unknown>)
    : {};
}

function configString(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function configNumber(value: unknown, fallback: number) {
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value !== "" ? value : undefined;
}

function optionalNumber(value: unknown) {
  if (value === "" || value === undefined || value === null) return undefined;
  const parsed = typeof value === "number" ? value : Number(value);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function isEventMode(value: unknown): value is "PULL" | "PUSH" | "AUTO" {
  return value === "PULL" || value === "PUSH" || value === "AUTO";
}

function formatRelative(date: string, t: TFunction) {
  const d = new Date(date);
  if (Number.isNaN(d.getTime())) return t("devices.labels.never");
  const diff = Date.now() - d.getTime();
  const minutes = Math.round(diff / 60000);
  if (minutes < 1) return t("devices.time.justNow");
  if (minutes < 60) return t("devices.time.minutesAgo", { value: minutes });
  const hours = Math.round(minutes / 60);
  if (hours < 24) return t("devices.time.hoursAgo", { value: hours });
  const days = Math.round(hours / 24);
  return t("devices.time.daysAgo", { value: days });
}

function formatOperationalTime(value: string | null | undefined, locale: string, t: TFunction) {
  if (!value) return t("devices.labels.never");
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return t("devices.labels.never");
  const exact = new Intl.DateTimeFormat(resolveDateLocale(locale), {
    dateStyle: "short",
    timeStyle: "medium",
  }).format(date);
  return `${exact} · ${formatRelative(value, t)}`;
}

function statusTone(status: string) {
  switch (status) {
    case "reachable":
    case "open":
      return "text-emerald-700 dark:text-emerald-200";
    case "closed":
      return "text-amber-700 dark:text-amber-200";
    case "timeout":
      return "text-amber-700 dark:text-amber-300";
    case "unreachable":
    case "error":
    default:
      return "text-rose-700 dark:text-rose-200";
  }
}
