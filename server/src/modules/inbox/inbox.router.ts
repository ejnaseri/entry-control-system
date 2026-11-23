import { Router } from "express";
import { AdminPermission, InboxScope } from "@prisma/client";
import type { AppEdition } from "../../config/env";
import { requirePermission } from "../../middlewares/auth";
import { inboxIdParamSchema, inboxListQuerySchema, inboxReadAllSchema, inboxReadBulkSchema } from "./inbox.schemas";
import { getUnreadCounts, listInboxItems, markInboxItemRead, markInboxItemsRead, markInboxItemsReadBulk } from "./inbox.service";
import { projectInboxItemForPermissions } from "./inbox.projection";

export function createInboxRouter(edition: AppEdition) {
  const inboxRouter = Router();
  const scope = edition === "ATTENDANCE" ? InboxScope.ATTENDANCE : InboxScope.FULL;
  const requiredPermission = edition === "ATTENDANCE"
    ? AdminPermission.ATTENDANCE_VIEW
    : AdminPermission.SIGN_IN;

  inboxRouter.use(requirePermission(requiredPermission));

  inboxRouter.get("/", async (req, res, next) => {
    try {
      const query = inboxListQuerySchema.parse(req.query);
      const result = await listInboxItems(query, scope);
      res.json({
        ...result,
        items: result.items.map((item) => projectInboxItemForPermissions(item, edition, req.auth?.permissions ?? [])),
      });
    } catch (error) {
      next(error);
    }
  });

  inboxRouter.get("/unread-count", async (_req, res, next) => {
    try {
      const counts = await getUnreadCounts(scope);
      res.json(counts);
    } catch (error) {
      next(error);
    }
  });

  inboxRouter.post("/read-all", async (req, res, next) => {
    try {
      const payload = inboxReadAllSchema.parse(req.body ?? {});
      const result = await markInboxItemsRead(payload, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  inboxRouter.post("/read-bulk", async (req, res, next) => {
    try {
      const payload = inboxReadBulkSchema.parse(req.body ?? {});
      const result = await markInboxItemsReadBulk(payload, scope);
      res.json(result);
    } catch (error) {
      next(error);
    }
  });

  inboxRouter.post("/:id/read", async (req, res, next) => {
    try {
      const { id } = inboxIdParamSchema.parse(req.params);
      const item = await markInboxItemRead(id, scope);
      res.json(projectInboxItemForPermissions(item, edition, req.auth?.permissions ?? []));
    } catch (error) {
      next(error);
    }
  });

  return inboxRouter;
}

