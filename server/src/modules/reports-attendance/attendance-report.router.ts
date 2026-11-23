import { AdminPermission } from "@prisma/client";
import { Router, type NextFunction, type Request, type RequestHandler, type Response } from "express";
import { requirePermission } from "../../middlewares/auth";
import {
  createAttendanceReportExportRouter,
  type AttendanceReportExportRouterApi,
} from "./attendance-report-export.router";
import {
  attendanceEditionReportDailyQuerySchema,
  attendanceEditionReportEvidenceQuerySchema,
  attendanceEditionReportMembersQuerySchema,
  attendanceEditionReportSummaryQuerySchema,
  attendanceMonthlyTimecardQuerySchema,
} from "./attendance-report.schemas";
import { getAttendanceMonthlyTimecard } from "./attendance-report-timecard.service";
import {
  getAttendanceEditionReportDaily,
  getAttendanceEditionReportEvidence,
  getAttendanceEditionReportMembers,
  getAttendanceEditionReportSummary,
  getAttendanceReportOptions,
} from "./attendance-report.service";

export type AttendanceReportRouterApi = Readonly<{
  getOptions: typeof getAttendanceReportOptions;
  getSummary: typeof getAttendanceEditionReportSummary;
  getDaily: typeof getAttendanceEditionReportDaily;
  getMembers: typeof getAttendanceEditionReportMembers;
  getEvidence: typeof getAttendanceEditionReportEvidence;
  getTimecard: typeof getAttendanceMonthlyTimecard;
}>;

const defaultApi: AttendanceReportRouterApi = Object.freeze({
  getOptions: getAttendanceReportOptions,
  getSummary: getAttendanceEditionReportSummary,
  getDaily: getAttendanceEditionReportDaily,
  getMembers: getAttendanceEditionReportMembers,
  getEvidence: getAttendanceEditionReportEvidence,
  getTimecard: getAttendanceMonthlyTimecard,
});

export function createAttendanceReportRouter(
  api: AttendanceReportRouterApi = defaultApi,
  exportApi?: AttendanceReportExportRouterApi
) {
  const router = Router();
  router.use(createAttendanceReportExportRouter(exportApi));
  router.use(requirePermission(AdminPermission.ATTENDANCE_VIEW));
  router.get("/options", asyncHandler(async (_req, res) => res.json(await api.getOptions())));
  router.get("/summary", asyncHandler(async (req, res) =>
    res.json(await api.getSummary(attendanceEditionReportSummaryQuerySchema.parse(req.query)))));
  router.get("/daily", asyncHandler(async (req, res) =>
    res.json(await api.getDaily(attendanceEditionReportDailyQuerySchema.parse(req.query)))));
  router.get("/members", asyncHandler(async (req, res) =>
    res.json(await api.getMembers(attendanceEditionReportMembersQuerySchema.parse(req.query)))));
  router.get("/evidence", asyncHandler(async (req, res) =>
    res.json(await api.getEvidence(attendanceEditionReportEvidenceQuerySchema.parse(req.query)))));
  router.get("/timecard", asyncHandler(async (req, res) =>
    res.json(await api.getTimecard(attendanceMonthlyTimecardQuerySchema.parse(req.query)))));
  return router;
}

function asyncHandler(handler: (req: Request, res: Response, next: NextFunction) => Promise<unknown>): RequestHandler {
  return async (req, res, next) => {
    try {
      await handler(req, res, next);
    } catch (error) {
      next(error);
    }
  };
}
