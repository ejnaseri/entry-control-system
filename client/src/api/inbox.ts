import { api } from "./client";

export type InboxCategory = "ALERT" | "DEVICE_FEED";
export type InboxSeverity = "INFO" | "WARNING" | "CRITICAL";
export type InboxItemType =
  | "MEMBERSHIP_EXPIRING"
  | "MEMBERSHIP_EXPIRED"
  | "SHIFT_ENDING_SOON"
  | "DEVICE_DISCONNECTED"
  | "DEVICE_DENIED"
  | "DEVICE_AUTHORIZED"
  | "SHIFT_VIOLATION"
  | "MULTIPLE_FAILED_ATTEMPTS";

export type InboxEntityType = "MEMBER" | "DEVICE" | "MEMBERSHIP" | "SHIFT";

export type InboxItem = {
  id: string;
  category: InboxCategory;
  type: InboxItemType;
  severity: InboxSeverity;
  title: string;
  body?: string | null;
  createdAt: string;
  readAt?: string | null;
  entityType?: InboxEntityType | null;
  entityId?: string | null;
  actionPath?: string | null;
  deviceId?: string | null;
  memberId?: string | null;
};

export type InboxListResponse = {
  items: InboxItem[];
  total: number;
  page: number;
  pageSize: number;
};

export type InboxListParams = {
  category?: InboxCategory;
  unreadOnly?: boolean;
  severity?: InboxSeverity;
  type?: InboxItemType;
  deviceId?: string;
  memberId?: string;
  from?: string;
  to?: string;
  search?: string;
  page?: number;
  pageSize?: number;
};

export type InboxReadAllPayload = {
  category?: InboxCategory;
  severity?: InboxSeverity;
  type?: InboxItemType;
  deviceId?: string;
  memberId?: string;
};

export type InboxReadBulkPayload = {
  ids: string[];
};

export type InboxUnreadCounts = {
  alerts: number;
  deviceFeed: number;
  total: number;
};

export async function listInboxItems(params: InboxListParams) {
  const res = await api.get<InboxListResponse>("/api/v1/inbox", { params });
  return res.data;
}

export async function markInboxItemRead(id: string) {
  const res = await api.post<InboxItem>(`/api/v1/inbox/${id}/read`);
  return res.data;
}

export async function markInboxReadAll(payload: InboxReadAllPayload) {
  const res = await api.post<{ updated: number }>("/api/v1/inbox/read-all", payload);
  return res.data;
}

export async function markInboxReadBulk(payload: InboxReadBulkPayload) {
  const res = await api.post<{ updatedCount: number }>("/api/v1/inbox/read-bulk", payload);
  return res.data;
}

export async function getInboxUnreadCounts() {
  const res = await api.get<InboxUnreadCounts>("/api/v1/inbox/unread-count");
  return res.data;
}
