import { AdminPermission } from "@prisma/client";
import { Router, type Request } from "express";
import { requirePermission } from "../../middlewares/auth";
import { HttpError } from "../../middlewares/error-handler";
import {
  employeeArchiveSchema,
  employeeCreateSchema,
  employeeIdParamSchema,
  employeeShiftAssignmentSchema,
  employeeUpdateSchema,
  listEmployeesQuerySchema,
} from "./employee.schemas";
import {
  assignEmployeeShifts,
  createEmployee,
  getEmployee,
  listEmployeeAttendance,
  listEmployeeStaffGroupOptions,
  listEmployees,
  setEmployeeArchived,
  updateEmployee,
  type EmployeeActionContext,
} from "./employee.service";

export type EmployeeApi = Readonly<{
  listEmployees: typeof listEmployees;
  createEmployee: typeof createEmployee;
  getEmployee: typeof getEmployee;
  updateEmployee: typeof updateEmployee;
  assignEmployeeShifts: typeof assignEmployeeShifts;
  setEmployeeArchived: typeof setEmployeeArchived;
  listEmployeeAttendance: typeof listEmployeeAttendance;
  listEmployeeStaffGroupOptions: typeof listEmployeeStaffGroupOptions;
}>;

const defaultEmployeeApi: EmployeeApi = {
  listEmployees,
  createEmployee,
  getEmployee,
  updateEmployee,
  assignEmployeeShifts,
  setEmployeeArchived,
  listEmployeeAttendance,
  listEmployeeStaffGroupOptions,
};

export function createEmployeeRouter(api: EmployeeApi = defaultEmployeeApi) {
  const router = Router();

  router.get("/", async (req, res, next) => {
    try {
      res.json(await api.listEmployees(listEmployeesQuerySchema.parse(req.query)));
    } catch (error) {
      next(error);
    }
  });

  router.post("/", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
    try {
      const employee = await api.createEmployee(employeeCreateSchema.parse(req.body), getEmployeeActionContext(req));
      res.status(201).json(employee);
    } catch (error) {
      next(error);
    }
  });

  router.get("/options/staff-groups", async (_req, res, next) => {
    try {
      res.json(await api.listEmployeeStaffGroupOptions());
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id/attendance", async (req, res, next) => {
    try {
      const { id } = employeeIdParamSchema.parse(req.params);
      res.json(await api.listEmployeeAttendance(id));
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id/shifts", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
    try {
      const { id } = employeeIdParamSchema.parse(req.params);
      const input = employeeShiftAssignmentSchema.parse(req.body);
      res.json(await api.assignEmployeeShifts(id, input, getEmployeeActionContext(req)));
    } catch (error) {
      next(error);
    }
  });

  router.patch("/:id/archive", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
    try {
      const { id } = employeeIdParamSchema.parse(req.params);
      const input = employeeArchiveSchema.parse(req.body);
      res.json(await api.setEmployeeArchived(id, input, getEmployeeActionContext(req)));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const { id } = employeeIdParamSchema.parse(req.params);
      res.json(await api.getEmployee(id));
    } catch (error) {
      next(error);
    }
  });

  router.put("/:id", requirePermission(AdminPermission.MEMBERS_WRITE), async (req, res, next) => {
    try {
      const { id } = employeeIdParamSchema.parse(req.params);
      const input = employeeUpdateSchema.parse(req.body);
      res.json(await api.updateEmployee(id, input, getEmployeeActionContext(req)));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const employeeRouter = createEmployeeRouter();

function getEmployeeActionContext(req: Request): EmployeeActionContext {
  if (!req.auth) throw new HttpError(401, "Authentication required");
  return {
    actor: {
      id: req.auth.user.id,
      role: req.auth.user.role,
      sessionId: req.auth.session.id,
    },
    meta: {
      ...(req.ip ? { ipAddress: req.ip } : {}),
      ...(req.get("user-agent") ? { userAgent: req.get("user-agent")! } : {}),
    },
  };
}
