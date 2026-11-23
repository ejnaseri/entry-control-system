import { Router } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import {
  getAttendanceDashboardDetails,
  getAttendanceDashboardSummary,
  type AttendanceDashboardDetailType,
} from "./attendance-dashboard.service";

export type AttendanceDashboardRouterApi = Readonly<{
  getSummary: typeof getAttendanceDashboardSummary;
  getDetails: typeof getAttendanceDashboardDetails;
}>;

const defaultApi: AttendanceDashboardRouterApi = Object.freeze({
  getSummary: getAttendanceDashboardSummary,
  getDetails: getAttendanceDashboardDetails,
});

const detailTypes = new Set<AttendanceDashboardDetailType>(["active-employees", "present", "inside-now", "late", "absent"]);

export function createAttendanceDashboardRouter(api: AttendanceDashboardRouterApi = defaultApi) {
  const router = Router();
  router.get("/summary", requirePermission(AdminPermission.ATTENDANCE_VIEW), async (_req, res, next) => {
    try {
      res.json(await api.getSummary());
    } catch (error) {
      next(error);
    }
  });
  router.get("/details", requirePermission(AdminPermission.ATTENDANCE_VIEW), async (req, res, next) => {
    try {
      const type = typeof req.query["type"] === "string" ? req.query["type"] : "";
      if (!detailTypes.has(type as AttendanceDashboardDetailType)) {
        throw new HttpError(400, "Invalid attendance dashboard details type");
      }
      const requestedLimit = typeof req.query["limit"] === "string" ? Number(req.query["limit"]) : 100;
      const limit = Number.isInteger(requestedLimit) ? Math.min(100, Math.max(1, requestedLimit)) : 100;
      res.json(await api.getDetails(type as AttendanceDashboardDetailType, limit));
    } catch (error) {
      next(error);
    }
  });
  return router;
}
