import { Router, type Request } from "express";
import { HttpError } from "../../middlewares/error-handler";
import {
  createPayrollPayment,
  getPayrollOutstanding,
  getPayrollReport,
  getPayrollSummary,
  type PayrollActionContext,
} from "./payroll.service";
import { payrollOutstandingQuerySchema, payrollPaymentCreateSchema, payrollReportQuerySchema, payrollSummaryQuerySchema } from "./payroll.schemas";

export const payrollRouter = Router();

payrollRouter.get("/summary", async (req, res, next) => {
  try {
    const query = payrollSummaryQuerySchema.parse(req.query);
    const summary = await getPayrollSummary(query);
    res.json(summary);
  } catch (error) {
    next(error);
  }
});

payrollRouter.get("/report", async (req, res, next) => {
  try {
    const query = payrollReportQuerySchema.parse(req.query);
    const report = await getPayrollReport(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

payrollRouter.get("/outstanding", async (req, res, next) => {
  try {
    const query = payrollOutstandingQuerySchema.parse(req.query);
    const report = await getPayrollOutstanding(query);
    res.json(report);
  } catch (error) {
    next(error);
  }
});

payrollRouter.post("/payments", async (req, res, next) => {
  try {
    const payload = payrollPaymentCreateSchema.parse(req.body);
    const summary = await createPayrollPayment(payload, getPayrollActionContext(req));
    res.status(201).json(summary);
  } catch (error) {
    next(error);
  }
});

function getPayrollActionContext(req: Request): PayrollActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: PayrollActionContext["meta"] = {};
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
