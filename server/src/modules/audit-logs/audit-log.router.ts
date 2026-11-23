import { AdminPermission } from "@prisma/client";
import { Router } from "express";
import { requirePermission } from "../../middlewares/auth";
import { auditLogIdParamSchema, auditLogListQuerySchema } from "./audit-log.schemas";
import { getAuditLogById, getAuditLogOptions, listAuditLogs } from "./audit-log.service";
import type { AppEdition } from "../../config/env";

export type AuditLogRouterApi = Readonly<{
  list: typeof listAuditLogs;
  options: typeof getAuditLogOptions;
  detail: typeof getAuditLogById;
}>;

const DEFAULT_API: AuditLogRouterApi = Object.freeze({
  list: listAuditLogs,
  options: getAuditLogOptions,
  detail: getAuditLogById,
});

export function createAuditLogRouter(edition: AppEdition, api: AuditLogRouterApi = DEFAULT_API) {
  const router = Router();
  router.use(requirePermission(AdminPermission.AUDIT_LOG_VIEW));

  router.get("/", async (req, res, next) => {
    try {
      const query = auditLogListQuerySchema.parse(req.query);
      res.json(await api.list(query, edition));
    } catch (error) {
      next(error);
    }
  });

  router.get("/options", async (_req, res, next) => {
    try {
      res.json(await api.options(edition));
    } catch (error) {
      next(error);
    }
  });

  router.get("/:id", async (req, res, next) => {
    try {
      const { id } = auditLogIdParamSchema.parse(req.params);
      res.json(await api.detail(id, edition));
    } catch (error) {
      next(error);
    }
  });

  return router;
}

export const auditLogRouter = createAuditLogRouter("FULL");
