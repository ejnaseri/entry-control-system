import { api } from "./client";

export type DeviceType = "FINGERPRINT" | "RELAY" | "GATE" | "CAMERA" | "OTHER";
export type DeviceConnectionType = "NETWORK" | "USB" | "SERIAL" | "ZKTECO_PULL_SDK";
export type DeviceStatus = "UNKNOWN" | "ONLINE" | "OFFLINE" | "ERROR";
export type DeviceRawLogStatus = "PENDING" | "PROCESSED" | "SKIPPED_DUPLICATE" | "SKIPPED_INVALID" | "FAILED";

export type DeviceEventItem = {
  id?: string;
  deviceId?: string;
  externalUserId?: string;
  timestamp?: string;
  recordedAt?: string;
  recordId?: number;
  /** On newly emitted strict TIME_CLOCK events this aliases an accepted attendance record. */
  authorized: boolean;
  reason?: string | null;
  entryType?: string;
  memberName?: string;
  memberCode?: string;
  attendanceRecorded?: boolean;
  doorAllowed?: boolean;
  doorOpened?: boolean;
};

export type DeviceUserSummary = {
  uid?: number;
  userId: string;
  name?: string;
};

export type DeviceAttendanceItem = {
  externalUserId: string;
  timestamp: string;
  eventType: string;
  recordId?: number;
};

export type NetworkDeviceConfig = {
  ip: string;
  port: number;
  dns?: string;
  gateway?: string;
  subnet?: string;
  timeoutMs?: number;
  protocol?: string;
  eventMode?: "PULL" | "PUSH" | "AUTO";
  pushEnabled?: boolean;
};

export type UsbDeviceConfig = {
  vendorId: string;
  productId: string;
  driver?: string;
  timeoutMs?: number;
};

export type SerialDeviceConfig = {
  comPort: string;
  baudRate: number;
  parity?: string;
  stopBits?: number;
  dataBits?: number;
  timeoutMs?: number;
};

export type DeviceConfig = NetworkDeviceConfig | UsbDeviceConfig | SerialDeviceConfig | Record<string, unknown>;

export type DevicePayload = {
  name: string;
  type: DeviceType;
  connectionType: DeviceConnectionType;
  enabled: boolean;
  config: DeviceConfig;
  model?: string | null;
  serialNumber?: string | null;
};

export type Device = DevicePayload & {
  id: string;
  status: DeviceStatus;
  lastSeenAt?: string | null;
  lastSuccessfulPollAt?: string | null;
  lastEventReceivedAt?: string | null;
  lastEventProcessedAt?: string | null;
  lastErrorAt?: string | null;
  lastErrorMessage?: string | null;
  lastAttendanceRecordId?: number | null;
  lastAttendanceAt?: string | null;
  lastPushAt?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

export type DeviceFilter = {
  type?: DeviceType;
  connectionType?: DeviceConnectionType;
  status?: DeviceStatus;
  enabled?: boolean;
  search?: string;
};

export type DeviceHeartbeat = {
  id: string;
  connected: boolean;
  lastPollAt?: string;
  lastEventAt?: string;
  lastEventProcessedAt?: string;
  lastError?: string;
  lastErrorAt?: string;
};

export type DeviceRawLogItem = {
  id: string;
  deviceId: string;
  deviceName: string;
  deviceStatus: DeviceStatus;
  recordedAt: string;
  createdAt: string;
  processedAt?: string | null;
  status: DeviceRawLogStatus;
  processError?: string | null;
  dataHash: string;
  externalUserId?: string | null;
  eventType?: string | null;
  recordId?: number | string | null;
  payload: unknown;
  attendance?: {
    id: string;
    entryType: string;
    isAuthorized: boolean;
    reason?: string | null;
    recordedAt: string;
    member?: {
      id: string;
      code: string;
      firstName: string;
      lastName: string;
      memberType: string;
    } | null;
  } | null;
};

export type DeviceRawLogQuery = {
  page?: number;
  limit?: number;
  deviceId?: string;
  status?: DeviceRawLogStatus | "";
  from?: string;
  to?: string;
  search?: string;
};

export type DeviceRawLogSupportBundleQuery = Omit<DeviceRawLogQuery, "page" | "limit"> & {
  limit?: number;
  language?: "en" | "fa" | "ps";
};

export type DeviceRawLogsResponse = {
  items: DeviceRawLogItem[];
  meta: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
  statusCounts: Record<DeviceRawLogStatus, number>;
};

export type DeviceDiagnostics = {
  deviceId: string;
  target: {
    host: string;
    port: number;
    resolvedIp?: string;
    isIpv4: boolean;
    warning?: string;
  };
  localInterfaces: {
    name: string;
    address: string;
    netmask: string;
    cidr: string;
    network: string;
    prefix: number;
    addressState?: string;
    isDuplicate?: boolean;
    isLinkLocal?: boolean;
  }[];
  subnetMatch: {
    matched: boolean | null;
    matchedInterfaces: string[];
    expectedSubnet?: { network: string; netmask: string; cidr: string };
  };
  ping: {
    status: "reachable" | "unreachable" | "timeout" | "error";
    latencyMs?: number;
    message?: string;
  };
  tcpPort: {
    status: "open" | "closed" | "timeout" | "error";
    latencyMs?: number;
    message?: string;
  };
  networkIssues: {
    code:
      | "LOCAL_IP_DUPLICATE"
      | "DEVICE_IP_CONFLICT"
      | "LINK_LOCAL_ADDRESS"
      | "SUBNET_MISMATCH"
      | "DEVICE_UNREACHABLE";
    severity: "warning" | "critical";
    title: string;
    detail: string;
    recommendation: string;
    interfaceName?: string;
    address?: string;
  }[];
  recommendations: string[];
  scanTargets: {
    network: string;
    netmask: string;
    cidr: string;
    reason: string;
    hostCount: number;
    tooLarge?: boolean;
  }[];
};

export type DeviceScanStatus = {
  scanId: string;
  deviceId: string;
  status: "running" | "complete" | "cancelled" | "failed";
  startedAt: string;
  finishedAt?: string;
  total: number;
  completed: number;
  found: number;
  candidates: {
    ip: string;
    port: number;
    latencyMs?: number;
    verified?: boolean;
    serialNumber?: string;
  }[];
  subnets: {
    network: string;
    netmask: string;
    cidr: string;
    reason: string;
    hostCount: number;
    tooLarge?: boolean;
  }[];
  skippedSubnets: {
    network: string;
    netmask: string;
    cidr: string;
    reason: string;
    hostCount: number;
    tooLarge?: boolean;
  }[];
  message?: string;
};

export async function listDevices(params?: DeviceFilter) {
  return api.get<Device[]>("/api/v1/devices", { params });
}

export async function getDevice(id: string) {
  return api.get<Device>(`/api/v1/devices/${id}`);
}

export async function createDevice(payload: DevicePayload) {
  return api.post<Device>("/api/v1/devices", payload);
}

export async function updateDevice(id: string, payload: DevicePayload) {
  return api.put<Device>(`/api/v1/devices/${id}`, payload);
}

export async function testDevice(id: string) {
  return api.post<{ ok: boolean; status: DeviceStatus; message?: string; latencyMs?: number }>(
    `/api/v1/devices/${id}/test-connection`
  );
}

export async function enrollDevice(id: string, payload: { userId: string; fingerId?: number; name?: string }) {
  return api.post<{ ok: boolean; mode?: "active" | "temporary"; message?: string }>(
    `/api/v1/devices/${id}/enroll`,
    payload
  );
}

export async function listDeviceUsers(id: string) {
  return api.get<{ items: DeviceUserSummary[]; mode?: "active" | "temporary" }>(`/api/v1/devices/${id}/users`);
}

export async function syncDeviceUsers(id: string) {
  return api.post<{ total: number; synced: number; skipped: number; mode?: "active" | "temporary" }>(
    `/api/v1/devices/${id}/users/sync`
  );
}

export async function upsertDeviceUser(id: string, payload: { userId: string; name: string }) {
  return api.post<{ ok: boolean; mode?: "active" | "temporary" }>(`/api/v1/devices/${id}/users/upsert`, payload);
}

export async function deleteDeviceUser(id: string, payload: { userId: string }) {
  return api.post<{ ok: boolean; mode?: "active" | "temporary" }>(`/api/v1/devices/${id}/users/delete`, payload);
}

export async function getDeviceTime(id: string) {
  return api.get<{ time: string; mode?: "active" | "temporary" }>(`/api/v1/devices/${id}/time`);
}

export async function setDeviceTime(id: string, payload?: { timestamp?: string }) {
  return api.post<{ time: string; mode?: "active" | "temporary" }>(`/api/v1/devices/${id}/time`, payload ?? {});
}

export async function unlockDeviceDoor(id: string, payload?: { seconds?: number }) {
  return api.post<{ ok: boolean; seconds: number; mode?: "active" | "temporary" }>(
    `/api/v1/devices/${id}/unlock`,
    payload ?? {}
  );
}

export async function fetchDeviceAttendanceLogs(id: string, params?: { limit?: number }) {
  return api.get<{ count: number; items: DeviceAttendanceItem[]; mode?: "active" | "temporary" }>(
    `/api/v1/devices/${id}/logs`,
    { params }
  );
}

export async function clearDeviceAttendanceLogs(id: string) {
  return api.post<{ ok: boolean; mode?: "active" | "temporary" }>(`/api/v1/devices/${id}/logs/clear`);
}

export async function suggestDeviceUserId(id: string) {
  return api.get<{ userId: string }>(`/api/v1/devices/${id}/suggest-user-id`);
}

export async function getDeviceStatus() {
  const res = await api.get<{ devices: DeviceHeartbeat[] }>("/api/v1/devices/status");
  return res.data.devices;
}

export async function listDeviceRawLogs(params?: DeviceRawLogQuery) {
  const res = await api.get<DeviceRawLogsResponse>("/api/v1/devices/raw-logs", { params });
  return res.data;
}

export async function downloadDeviceRawLogSupportBundle(params?: DeviceRawLogSupportBundleQuery) {
  const res = await api.get<Blob>("/api/v1/devices/raw-logs/support-bundle", {
    params,
    responseType: "blob",
  });
  const disposition = res.headers["content-disposition"];
  const filenameMatch = typeof disposition === "string" ? disposition.match(/filename="?([^";]+)"?/iu) : null;
  return {
    blob: res.data,
    filename: filenameMatch?.[1] ?? `atlasgym-device-support-${new Date().toISOString().slice(0, 10)}.zip`,
  };
}

export async function enableDevice(id: string) {
  return api.post<Device>(`/api/v1/devices/${id}/enable`);
}

export async function disableDevice(id: string) {
  return api.post<Device>(`/api/v1/devices/${id}/disable`);
}

export async function getDeviceRuntimeStatus(id: string) {
  const res = await api.get<DeviceHeartbeat>(`/api/v1/devices/${id}/runtime-status`);
  return res.data;
}

export async function diagnoseDevice(id: string) {
  return api.post<DeviceDiagnostics>(`/api/v1/devices/${id}/diagnose`);
}

export async function startDeviceScan(id: string) {
  return api.post<DeviceScanStatus>(`/api/v1/devices/${id}/scan`);
}

export async function getDeviceScan(scanId: string) {
  const res = await api.get<DeviceScanStatus>(`/api/v1/devices/scan/${scanId}`);
  return res.data;
}

export async function cancelDeviceScan(scanId: string) {
  const res = await api.post<DeviceScanStatus>(`/api/v1/devices/scan/${scanId}/cancel`);
  return res.data;
}

export async function getDeviceEvents(limit = 10) {
  const res = await api.get<{ items: DeviceEventItem[] }>("/api/v1/devices/events", { params: { limit } });
  return res.data.items;
}

export function createDeviceEventStream(onEvent: (ev: DeviceEventItem) => void) {
  const source = new EventSource(`${api.defaults.baseURL}/api/v1/devices/events/stream`, { withCredentials: true });
  source.onmessage = (msg) => {
    try {
      const parsed = JSON.parse(msg.data);
      const normalized: DeviceEventItem = {
        ...parsed,
        authorized: parsed.authorized ?? parsed.isAuthorized ?? false,
        timestamp: parsed.timestamp ?? parsed.recordedAt,
      };
      onEvent(normalized);
    } catch (e) {
      console.error("Failed to parse event", e);
    }
  };
  return () => source.close();
}
