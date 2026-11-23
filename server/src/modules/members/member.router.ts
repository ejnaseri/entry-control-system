import { Router } from "express";
import type { Request } from "express";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import {
  createMember,
  createMemberMembership,
  cancelMemberMembership,
  createMemberPayment,
  getMember,
  getMemberFullProfile,
  listMemberAttendance,
  listMemberMemberships,
  listMemberPayments,
  listMembers,
  removeMember,
  updateMember,
  assignMemberShifts,
  type MemberActionContext,
} from "./member.service";
import {
  listMembersQuerySchema,
  memberIdParamSchema,
  memberMembershipCancelParamSchema,
  memberMembershipCancelSchema,
  memberMembershipRenewSchema,
  memberPaymentCreateSchema,
  memberShiftAssignSchema,
  memberWizardSchema,
} from "./member.schemas";

export const memberRouter = Router();

function stripUndefinedDeep<T>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => stripUndefinedDeep(item)) as T;
  }
  if (value && typeof value === "object") {
    const cleaned = Object.entries(value as Record<string, unknown>)
      .filter(([, item]) => item !== undefined)
      .map(([key, item]) => [key, stripUndefinedDeep(item)]);
    return Object.fromEntries(cleaned) as T;
  }
  return value;
}

memberRouter.get("/", async (req, res, next) => {
  try {
    const query = listMembersQuerySchema.parse(req.query);
    const result = await listMembers(query);
    res.json(result);
  } catch (error) {
    next(error);
  }
});

memberRouter.post("/", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
  try {
    const payload = stripUndefinedDeep(memberWizardSchema.parse(req.body));
    const member = await createMember(payload as Parameters<typeof createMember>[0], getMemberActionContext(req));
    res.status(201).json(member);
  } catch (error) {
    next(error);
  }
});

memberRouter.get("/:id/memberships", async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const rows = await listMemberMemberships(id);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

memberRouter.post("/:id/memberships", requirePermission(AdminPermission.MEMBERSHIPS_WRITE), async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const payload = memberMembershipRenewSchema.parse(req.body);
    const membership = await createMemberMembership(id, payload, getMemberActionContext(req));
    res.status(201).json(membership);
  } catch (error) {
    next(error);
  }
});

memberRouter.post("/:id/memberships/:membershipId/cancel", requirePermission(AdminPermission.MEMBERSHIPS_CANCEL), async (req, res, next) => {
  try {
    const { id, membershipId } = memberMembershipCancelParamSchema.parse(req.params);
    const payload = memberMembershipCancelSchema.parse(req.body);
    const result = await cancelMemberMembership(id, membershipId, payload, getMemberActionContext(req));
    res.json(result);
  } catch (error) {
    next(error);
  }
});

memberRouter.get("/:id/payments", requirePermission(AdminPermission.PAYMENTS_RECORD), async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const rows = await listMemberPayments(id);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

memberRouter.post("/:id/payments", requirePermission(AdminPermission.PAYMENTS_RECORD), async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const payload = memberPaymentCreateSchema.parse(req.body);
    const payment = await createMemberPayment(id, payload, getMemberActionContext(req));
    res.status(201).json(payment);
  } catch (error) {
    next(error);
  }
});

memberRouter.get("/:id/attendance", async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const rows = await listMemberAttendance(id);
    res.json(rows);
  } catch (error) {
    next(error);
  }
});

memberRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const member = await getMember(id);
    res.json(member);
  } catch (error) {
    next(error);
  }
});

memberRouter.get("/:id/full", async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const profile = await getMemberFullProfile(id);
    res.json(profile);
  } catch (error) {
    next(error);
  }
});

memberRouter.put("/:id", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const payload = stripUndefinedDeep(memberWizardSchema.parse(req.body));
    const member = await updateMember(id, payload as Parameters<typeof updateMember>[1], getMemberActionContext(req));
    res.json(member);
  } catch (error) {
    next(error);
  }
});

function getMemberActionContext(req: Request): MemberActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: MemberActionContext["meta"] = {};
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

memberRouter.put("/:id/shifts", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    const payload = stripUndefinedDeep(memberShiftAssignSchema.parse(req.body));
    const member = await assignMemberShifts(
      id,
      payload as Parameters<typeof assignMemberShifts>[1],
      getMemberActionContext(req)
    );
    res.json(member);
  } catch (error) {
    next(error);
  }
});

memberRouter.delete("/:id", requirePermission(AdminPermission.MEMBERS_DELETE), async (req, res, next) => {
  try {
    const { id } = memberIdParamSchema.parse(req.params);
    await removeMember(id, getMemberActionContext(req));
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});
