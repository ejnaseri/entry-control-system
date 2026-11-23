import { AdminPermission, AuditActor, DeviceRawLogStatus, Prisma } from "@prisma/client";
import { Router } from "express";
import type { AppEdition } from "../../shared/app-identity";
import { requirePermission } from "../../middlewares/auth";
import { prisma } from "../../lib/prisma";
import { cancelDeviceScan, diagnoseDeviceConnectivity, getDeviceScan, startDeviceScan } from "./deviceDiagnostics";
import {
  deviceIdParamSchema,
  deviceLogsQuerySchema,
  deviceRawLogSupportBundleQuerySchema,
  deviceRawLogsQuerySchema,
} from "./device.schemas";
import { buildDeviceRawLogWhere } from "./deviceRawLogFilters";
import { createDeviceSupportBundle } from "./deviceSupportBundle.service";
import { runAuditedDeviceCommand } from "./deviceCommandAudit.service";
import { getDeviceActionContext, summarizeRawLogPayload } from "./device-router.shared";
import {
  getDeviceDataScope,
  type DeviceDataScope,
} from "./device-edition-scope";

type DeviceManagerModule = typeof import("./deviceManager");

function loadDeviceManager(): DeviceManagerModule {
  return require("./deviceManager") as DeviceManagerModule;
}

export function createDeviceDiagnosticsRouter(edition: AppEdition) {
  return createDeviceDiagnosticsRouterForScope(getDeviceDataScope(edition));
}

export function createDeviceDiagnosticsRouterForScope(scope: DeviceDataScope) {
  const router = Router();

  router.get(
    "/scan/:scanId",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    (req, res, next) => {
      try {
        const scanId = req.params["scanId"];
        if (!scanId) {
          res.status(400).json({ message: "Scan id is required" });
          return;
        }
        res.json(getDeviceScan(scanId));
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/scan/:scanId/cancel",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    async (req, res, next) => {
      try {
        const scanId = req.params["scanId"];
        if (!scanId) {
          res.status(400).json({ message: "Scan id is required" });
          return;
        }
        const current = getDeviceScan(scanId);
        const result = await runAuditedDeviceCommand({
          action: "device.scan.cancelled",
          targetId: current.deviceId,
          context: getDeviceActionContext(req),
          execute: () => cancelDeviceScan(scanId),
          summarize: (cancelled) => ({
            success: cancelled.status === "cancelled",
            metadata: {
              outcome: cancelled.status.toUpperCase(),
              scanId: cancelled.scanId,
              totalTargets: cancelled.total,
              completedTargets: cancelled.completed,
              foundCount: cancelled.found,
            },
          }),
          failureMetadata: { scanId },
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/raw-logs",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    async (req, res, next) => {
      try {
        const query = deviceRawLogsQuerySchema.parse(req.query);
        const where = buildDeviceRawLogWhere(query);
        if (!where) {
          res.status(400).json({ message: "Invalid raw log date filter" });
          return;
        }

        const skip = (query.page - 1) * query.limit;
        const rawLogStatuses = Object.values(DeviceRawLogStatus);
        const [total, items] = await prisma.$transaction([
          prisma.deviceRawLog.count({ where }),
          prisma.deviceRawLog.findMany({
            where,
            orderBy: [{ createdAt: "desc" }, { id: "desc" }],
            skip,
            take: query.limit,
            select: {
              id: true,
              deviceId: true,
              recordedAt: true,
              dataHash: true,
              payload: true,
              status: true,
              processError: true,
              processedAt: true,
              createdAt: true,
              device: { select: { id: true, name: true, status: true } },
              attendance: {
                select: {
                  id: true,
                  entryType: true,
                  isAuthorized: true,
                  reason: true,
                  recordedAt: true,
                  deviceUser: { select: { externalId: true } },
                  member: {
                    select: {
                      id: true,
                      code: true,
                      firstName: true,
                      lastName: true,
                      memberType: true,
                    },
                  },
                },
              },
            },
          }),
        ]);

        const statusCountValues = await prisma.$transaction(
          rawLogStatuses.map((status) => prisma.deviceRawLog.count({ where: { ...where, status } }))
        );
        const statusCounts = rawLogStatuses.reduce<Record<DeviceRawLogStatus, number>>((acc, status, index) => {
          acc[status] = statusCountValues[index] ?? 0;
          return acc;
        }, {} as Record<DeviceRawLogStatus, number>);

        res.json({
          items: items.map((item) => {
            const payloadSummary = summarizeRawLogPayload(item.payload);
            const member = item.attendance?.member;
            return {
              id: item.id,
              deviceId: item.deviceId,
              deviceName: item.device.name,
              deviceStatus: item.device.status,
              recordedAt: item.recordedAt,
              createdAt: item.createdAt,
              processedAt: item.processedAt,
              status: item.status,
              processError: item.processError,
              dataHash: item.dataHash,
              externalUserId:
                payloadSummary.externalUserId ?? item.attendance?.deviceUser?.externalId?.toString() ?? null,
              eventType: payloadSummary.eventType ?? null,
              recordId: payloadSummary.recordId ?? null,
              payload: item.payload,
              attendance: item.attendance
                ? {
                    id: item.attendance.id,
                    entryType: item.attendance.entryType,
                    isAuthorized: item.attendance.isAuthorized,
                    reason: item.attendance.reason,
                    recordedAt: item.attendance.recordedAt,
                    member: member
                      ? {
                          id: member.id,
                          code: member.code,
                          firstName: member.firstName,
                          lastName: member.lastName,
                          memberType: member.memberType,
                        }
                      : null,
                  }
                : null,
            };
          }),
          meta: {
            page: query.page,
            limit: query.limit,
            total,
            totalPages: Math.max(1, Math.ceil(total / query.limit)),
          },
          statusCounts,
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/raw-logs/support-bundle",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    async (req, res, next) => {
      try {
        const query = deviceRawLogSupportBundleQuerySchema.parse(req.query);
        const result = await createDeviceSupportBundle(query);
        const auth = req.auth;
        if (!auth) throw new Error("Admin auth context was not resolved");

        const auditData: Prisma.AuditLogUncheckedCreateInput = {
          actorType: AuditActor.ADMIN,
          actorId: auth.user.id,
          actorRole: auth.user.role,
          sessionId: auth.session.id,
          action: "devices.raw_logs.support_bundle_exported",
          targetType: "DeviceRawLog",
          success: true,
          metadata: {
            language: query.language,
            totalMatched: result.totalMatched,
            exportedCount: result.exportedCount,
            truncated: result.truncated,
            deviceCount: result.deviceCount,
            limit: query.limit,
            ...(query.deviceId ? { deviceId: query.deviceId } : {}),
            ...(query.status ? { status: query.status } : {}),
            ...(query.from ? { from: query.from } : {}),
            ...(query.to ? { to: query.to } : {}),
            ...(query.search ? { searchApplied: true } : {}),
          },
        };
        if (req.ip) auditData.ipAddress = req.ip;
        const userAgent = req.get("user-agent");
        if (userAgent) auditData.userAgent = userAgent;
        await prisma.auditLog.create({ data: auditData });

        res.setHeader("Cache-Control", "no-store");
        res.setHeader("Content-Type", "application/zip");
        res.setHeader("Content-Disposition", `attachment; filename="${result.filename}"`);
        res.setHeader("Content-Length", String(result.buffer.length));
        res.send(result.buffer);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/diagnose",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const result = await runAuditedDeviceCommand({
          action: "device.diagnosed",
          targetId: id,
          context: getDeviceActionContext(req),
          execute: () => diagnoseDeviceConnectivity(id),
          summarize: (diagnostics) => ({
            success: true,
            metadata: {
              outcome: "COMPLETED",
              targetHost: diagnostics.target.host,
              targetPort: diagnostics.target.port,
              pingStatus: diagnostics.ping.status,
              tcpPortStatus: diagnostics.tcpPort.status,
              ...(typeof diagnostics.subnetMatch.matched === "boolean"
                ? { subnetMatched: diagnostics.subnetMatch.matched }
                : {}),
              networkIssueCount: diagnostics.networkIssues.length,
              criticalIssueCount: diagnostics.networkIssues.filter((issue) => issue.severity === "critical").length,
              recommendationCount: diagnostics.recommendations.length,
              scanTargetCount: diagnostics.scanTargets.length,
            },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/scan",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const result = await runAuditedDeviceCommand({
          action: "device.scan.started",
          targetId: id,
          context: getDeviceActionContext(req),
          execute: () => startDeviceScan(id),
          summarize: (scan) => ({
            success: scan.status !== "failed",
            metadata: {
              outcome: scan.status.toUpperCase(),
              scanId: scan.scanId,
              totalTargets: scan.total,
              subnetCount: scan.subnets.length,
              skippedSubnetCount: scan.skippedSubnets.length,
            },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  router.get(
    "/:id/logs",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_DIAGNOSTICS),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const { limit } = deviceLogsQuerySchema.parse(req.query);
        const result = await loadDeviceManager().fetchDeviceAttendanceLogs(id, limit, scope);
        res.json({
          ...result,
          items: result.items.map((item) => ({ ...item, timestamp: item.timestamp.toISOString() })),
        });
      } catch (error) {
        next(error);
      }
    }
  );

  router.post(
    "/:id/logs/clear",
    requirePermission(AdminPermission.DEVICES_VIEW),
    requirePermission(AdminPermission.DEVICES_CLEAR_LOGS),
    async (req, res, next) => {
      try {
        const { id } = deviceIdParamSchema.parse(req.params);
        const result = await runAuditedDeviceCommand({
          action: "device.logs.cleared",
          targetId: id,
          context: getDeviceActionContext(req),
          execute: () => loadDeviceManager().clearDeviceAttendanceLogs(id, scope),
          summarize: (commandResult) => ({
            success: commandResult.ok,
            metadata: {
              outcome: commandResult.ok ? "CLEARED" : "FAILED",
              mode: commandResult.mode,
            },
          }),
        });
        res.json(result);
      } catch (error) {
        next(error);
      }
    }
  );

  return router;
}
