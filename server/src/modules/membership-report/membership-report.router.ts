import { Router } from "express";
import type { Request } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import { membershipReportQuerySchema } from "./membership-report.schemas";
import {
  getAuditedMembershipReportCsv,
  getMembershipReport,
  type MembershipReportExportContext,
} from "./membership-report.service";

export const membershipReportRouter = Router();

membershipReportRouter.get("/export.csv", requirePermission(AdminPermission.FINANCIAL_EXPORT), async (req, res, next) => {
  try {
    const query = membershipReportQuerySchema.parse(req.query);
    const { csv } = await getAuditedMembershipReportCsv(
      query,
      getMembershipReportExportContext(req)
    );
    const stamp = new Date().toISOString().replace(/[:T]/g, "-").slice(0, 19);
    const filename = `membership-report-${stamp}.csv`;

    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.status(200).send(csv);
  } catch (error) {
    next(error);
  }
});

function getMembershipReportExportContext(req: Request): MembershipReportExportContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: MembershipReportExportContext["meta"] = {};
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

membershipReportRouter.get("/", async (req, res, next) => {
  try {
    const query = membershipReportQuerySchema.parse(req.query);
    const report = await getMembershipReport(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});
