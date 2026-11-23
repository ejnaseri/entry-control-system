import { Router, type Request } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import type { AppEdition } from "../../shared/app-identity";
import {
  attendanceDailyQuerySchema,
  attendanceEntryLogsExportQuerySchema,
  attendanceJustificationDeleteSchema,
  attendanceJustificationSchema,
  attendanceListQuerySchema,
  attendanceManualCreateSchema,
} from "./attendance.schemas";
import {
  createManualAttendance,
  listAttendance,
  listAttendanceDeviceOptions,
  listDailyAttendance,
  removeAttendanceJustification,
  upsertAttendanceJustification,
  type AttendanceActionContext,
} from "./attendance.service";
import { exportAuditedAttendanceEntryLogs } from "./attendance-export.service";
import { getReportExportContext, sendReportExport } from "../reports/shared/report-export.audit";
import { getAttendanceDataScope, isStrictStaffAttendanceScope } from "./attendance-edition-scope";

export type AttendanceRouterApi = Readonly<{
  listAttendance: typeof listAttendance;
  exportAttendanceEntryLogs: typeof exportAuditedAttendanceEntryLogs;
  listAttendanceDeviceOptions: typeof listAttendanceDeviceOptions;
  createManualAttendance: typeof createManualAttendance;
  listDailyAttendance: typeof listDailyAttendance;
  upsertAttendanceJustification: typeof upsertAttendanceJustification;
  removeAttendanceJustification: typeof removeAttendanceJustification;
}>;

const defaultAttendanceRouterApi: AttendanceRouterApi = {
  listAttendance,
  exportAttendanceEntryLogs: exportAuditedAttendanceEntryLogs,
  listAttendanceDeviceOptions,
  createManualAttendance,
  listDailyAttendance,
  upsertAttendanceJustification,
  removeAttendanceJustification,
};

export function createEntryLogsRouter(
  edition: AppEdition,
  api: Pick<AttendanceRouterApi, "listAttendance" | "listAttendanceDeviceOptions" | "exportAttendanceEntryLogs"> = defaultAttendanceRouterApi
) {
  const router = Router();
  const scope = getAttendanceDataScope(edition);

  if (isStrictStaffAttendanceScope(scope)) {
    router.get("/export.csv", requirePermission(AdminPermission.ATTENDANCE_EXPORT), async (req, res, next) => {
      try {
        sendReportExport(res, await api.exportAttendanceEntryLogs(attendanceEntryLogsExportQuerySchema.parse(req.query), "CSV", scope, getReportExportContext(req)));
      } catch (error) {
        next(error);
      }
    });
    router.get("/export.xlsx", requirePermission(AdminPermission.ATTENDANCE_EXPORT), async (req, res, next) => {
      try {
        sendReportExport(res, await api.exportAttendanceEntryLogs(attendanceEntryLogsExportQuerySchema.parse(req.query), "XLSX", scope, getReportExportContext(req)));
      } catch (error) {
        next(error);
      }
    });
  }

  router.get("/", async (req, res, next) => {
    try {
      const query = attendanceListQuerySchema.parse(req.query);
      const result = await api.listAttendance(query, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.get("/options/devices", async (_req, res, next) => {
    try {
      res.json(await api.listAttendanceDeviceOptions());
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export function createAttendanceDailyRouter(
  edition: AppEdition,
  api: Omit<AttendanceRouterApi, "listAttendance" | "listAttendanceDeviceOptions"> = defaultAttendanceRouterApi
) {
  const router = Router();
  const scope = getAttendanceDataScope(edition);
  const manualCreateSchema = isStrictStaffAttendanceScope(scope)
    ? attendanceManualCreateSchema.strict()
    : attendanceManualCreateSchema;
  const justificationSchema = isStrictStaffAttendanceScope(scope)
    ? attendanceJustificationSchema.strict()
    : attendanceJustificationSchema;

  router.post("/manual", requirePermission(AdminPermission.ATTENDANCE_MANUAL), async (req, res, next) => {
    try {
      const payload = manualCreateSchema.parse(req.body);
      const row = await api.createManualAttendance(payload, getAttendanceActionContext(req), scope);
      res.status(201).json(row);
    } catch (error) {
      next(error);
    }
  });

  router.get("/daily", async (req, res, next) => {
    try {
      const query = attendanceDailyQuerySchema.parse(req.query);
      const result = await api.listDailyAttendance(query, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  router.post("/justifications", requirePermission(AdminPermission.ATTENDANCE_JUSTIFY), async (req, res, next) => {
    try {
      const payload = justificationSchema.parse(req.body);
      const record = await api.upsertAttendanceJustification(payload, getAttendanceActionContext(req), scope);
      res.status(201).json(record);
    } catch (error) {
      next(error);
    }
  });

  router.delete("/justifications", requirePermission(AdminPermission.ATTENDANCE_JUSTIFY), async (req, res, next) => {
    try {
      const query = attendanceJustificationDeleteSchema.parse(req.query);
      await api.removeAttendanceJustification(query, getAttendanceActionContext(req), scope);
      res.status(204).send();
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const entryLogsRouter = createEntryLogsRouter("FULL");
export const attendanceDailyRouter = createAttendanceDailyRouter("FULL");
export const attendanceRouter = Router();
attendanceRouter.use(entryLogsRouter);
attendanceRouter.use(attendanceDailyRouter);

function getAttendanceActionContext(req: Request): AttendanceActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: AttendanceActionContext["meta"] = {};
  if (req.ip) meta.ipAddress = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;

  return {
    actor: {
      id: auth.user.id,
      role: auth.user.role,
      sessionId: auth.session.id,
    },
    meta,
  };
}
