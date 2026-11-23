import { api } from "./client";

export type StaffDeviceStatus = "UNKNOWN" | "ONLINE" | "OFFLINE" | "ERROR";
export type StaffDeviceConfig = { ip: string; port: number; timeoutMs?: number; pollIntervalMs?: number; eventMode: "PULL"; pushEnabled: false };
export type StaffDevice = {
  id: string; name: string; type: "FINGERPRINT"; connectionType: "NETWORK" | "ZKTECO_PULL_SDK";
  enabled: boolean; status: StaffDeviceStatus; config: StaffDeviceConfig; model?: string | null; serialNumber?: string | null;
  lastSeenAt?: string | null; lastSuccessfulPollAt?: string | null; lastEventReceivedAt?: string | null;
  lastEventProcessedAt?: string | null; lastErrorAt?: string | null; lastErrorMessage?: string | null;
};
export type StaffDevicePayload = { name: string; type: "FINGERPRINT"; connectionType: "NETWORK" | "ZKTECO_PULL_SDK"; enabled: boolean; model?: string; serialNumber?: string; config: StaffDeviceConfig };
export type StaffDeviceRuntime = { id: string; connected: boolean; lastPollAt?: string; lastEventAt?: string; lastEventProcessedAt?: string; lastError?: string; lastErrorAt?: string };
export type StaffDeviceUser = { uid?: number; userId: string; name?: string };
export type StaffDeviceEvent = { id?: string; deviceId?: string; externalUserId?: string; timestamp?: string; authorized: boolean; attendanceRecorded?: boolean; doorAllowed?: boolean; doorOpened?: boolean; reason?: string | null; entryType?: string; memberName?: string; memberCode?: string };

export const listStaffDevices = (params?: { status?: StaffDeviceStatus; enabled?: boolean; search?: string }) => api.get<StaffDevice[]>("/api/v1/devices", { params });
export const getStaffDeviceStatuses = () => api.get<{ devices: StaffDeviceRuntime[] }>("/api/v1/devices/status");
export const listStaffDeviceEvents = (limit = 10) => api.get<{ items: StaffDeviceEvent[] }>("/api/v1/devices/events", { params: { limit } });
export const createStaffDevice = (payload: StaffDevicePayload) => api.post<StaffDevice>("/api/v1/devices", payload);
export const updateStaffDevice = (id: string, payload: StaffDevicePayload) => api.put<StaffDevice>(`/api/v1/devices/${id}`, payload);
export const enableStaffDevice = (id: string) => api.post<StaffDevice>(`/api/v1/devices/${id}/enable`);
export const disableStaffDevice = (id: string) => api.post<StaffDevice>(`/api/v1/devices/${id}/disable`);
export const testStaffDevice = (id: string) => api.post<{ ok: boolean; status: StaffDeviceStatus; message?: string; latencyMs?: number }>(`/api/v1/devices/${id}/test-connection`);
export const getStaffDeviceTime = (id: string) => api.get<{ time: string; mode?: string }>(`/api/v1/devices/${id}/time`);
export const setStaffDeviceTime = (id: string, timestamp?: string) => api.post<{ time: string; mode?: string }>(`/api/v1/devices/${id}/time`, timestamp ? { timestamp } : {});
export const listStaffDeviceUsers = (id: string) => api.get<{ items: StaffDeviceUser[]; mode?: string }>(`/api/v1/devices/${id}/users`);
export const syncStaffDeviceUsers = (id: string) => api.post<{ total: number; synced: number; skipped: number; mode?: string }>(`/api/v1/devices/${id}/users/sync`);
export const upsertStaffDeviceUser = (id: string, payload: { userId: string; name: string }) => api.post(`/api/v1/devices/${id}/users/upsert`, payload);
export const deleteStaffDeviceUser = (id: string, userId: string) => api.post(`/api/v1/devices/${id}/users/delete`, { userId, confirm: true });
export const enrollStaffDeviceEmployee = (id: string, payload: { userId: string; name: string; fingerId: number }) => api.post(`/api/v1/devices/${id}/enroll`, payload);
