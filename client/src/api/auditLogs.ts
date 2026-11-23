import { api } from "./client";
import type { AdminRole } from "./auth";

export type AuditActorType = "SYSTEM" | "ADMIN" | "MEMBER";

export type AuditLogActor = {
  id: string;
  username: string;
  fullName: string | null;
  role: AdminRole;
  isActive: boolean;
};

export type AuditLogItem = {
  id: string;
  actorType: AuditActorType;
  actorId: string | null;
  actorRole: AdminRole | null;
  actor: AuditLogActor | null;
  action: string;
  targetType: string | null;
  targetId: string | null;
  success: boolean;
  ipAddress: string | null;
  createdAt: string;
  hasDetails: boolean;
};

export type AuditLogDetail = AuditLogItem & {
  userAgent: string | null;
  sessionId: string | null;
  requestId: string | null;
  beforeData: unknown;
  afterData: unknown;
  metadata: unknown;
};

export type AuditLogListResponse = {
  items: AuditLogItem[];
  page: number;
  pageSize: number;
  total: number;
  summary: {
    total: number;
    successful: number;
    failed: number;
  };
};

export type AuditLogOptions = {
  actions: string[];
  targetTypes: string[];
  actors: AuditLogActor[];
  actorTypes: AuditActorType[];
  actorRoles: AdminRole[];
};

export type AuditLogListParams = {
  page?: number;
  pageSize?: number;
  from?: string;
  to?: string;
  actorId?: string;
  actorType?: AuditActorType;
  actorRole?: AdminRole;
  action?: string;
  targetType?: string;
  success?: boolean;
  search?: string;
};

export async function listAuditLogs(params: AuditLogListParams) {
  const response = await api.get<AuditLogListResponse>("/api/v1/audit-logs", { params });
  return response.data;
}

export async function getAuditLogOptions() {
  const response = await api.get<AuditLogOptions>("/api/v1/audit-logs/options");
  return response.data;
}

export async function getAuditLog(id: string) {
  const response = await api.get<AuditLogDetail>(`/api/v1/audit-logs/${id}`);
  return response.data;
}
