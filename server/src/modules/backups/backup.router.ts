import { Router } from "express";
import type { NextFunction, Request, Response } from "express";
import { randomUUID } from "node:crypto";
import { mkdirSync } from "node:fs";
import { rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import multer from "multer";
import { AdminPermission } from "@prisma/client";
import { logger } from "../../config/logger";
import { requireAnyPermission, requirePermission } from "../../middlewares/auth";
import * as backupService from "./backup.service";
import {
  backupCreateSchema,
  backupExternalCopySchema,
  backupIdParamSchema,
  backupJobIdParamSchema,
  backupListQuerySchema,
  backupScheduleConfigSchema,
  backupScheduledRunNowSchema,
  backupStorageConfigSchema,
  operationRunIdParamSchema,
  restoreConfirmSchema,
  restoreJobIdParamSchema,
  restoreMaintenanceSchema,
  restorePrepareSchema,
} from "./backup.schemas";

const DEFAULT_BACKUP_IMPORT_UPLOAD_ROOT = path.join(os.tmpdir(), "atlasgym-backup-imports");

function getRequestMeta(req: Request) {
  const meta: { ipAddress?: string; userAgent?: string } = {};
  if (req.ip) meta.ipAddress = req.ip;
  const userAgent = req.get("user-agent");
  if (userAgent) meta.userAgent = userAgent;
  return meta;
}

function getContext(req: Request) {
  const auth = req.auth;
  if (!auth) {
    throw new Error("Admin auth context was not resolved");
  }
  return {
    actor: {
      id: auth.user.id,
      role: auth.user.role,
      sessionId: auth.session.id,
    },
    meta: getRequestMeta(req),
  };
}

export type BackupRouterService = Pick<
  typeof backupService,
  | "clearRestoreMaintenanceMode"
  | "confirmProductionRestoreHandoff"
  | "copyBackupToExternalDrive"
  | "createBackupSupportPackage"
  | "getBackupDetails"
  | "getBackupJob"
  | "getBackupScheduleStatus"
  | "getBackupSettings"
  | "getBackupStorageStatus"
  | "getOperationRun"
  | "getRestoreJob"
  | "getRestoreMaintenanceStatus"
  | "importBackupFiles"
  | "listBackups"
  | "listExternalBackupDrives"
  | "prepareProductionRestore"
  | "runBackupRestoreTest"
  | "runPostRestoreCheck"
  | "startManualBackup"
  | "startRestoreMaintenanceMode"
  | "startScheduledBackupNow"
  | "updateBackupScheduleConfig"
  | "updateBackupStorageRoot"
  | "useRecommendedBackupStorage"
  | "verifyBackup"
>;

export type BackupRouterOptions = {
  importFileSizeLimitBytes?: number;
  importUploadRoot?: string;
};

function isStrictlyInsideRoot(targetPath: string, rootPath: string) {
  const relative = path.relative(path.resolve(rootPath), path.resolve(targetPath));
  return relative !== "" && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

async function cleanupBackupImportUploads(files: Express.Multer.File[], uploadRoot: string) {
  await Promise.all(
    files.map(async (file) => {
      if (!isStrictlyInsideRoot(file.path, uploadRoot)) {
        logger.warn("Refusing to clean up backup import upload outside the configured upload root");
        return;
      }
      try {
        await rm(file.path, { force: true });
      } catch (error) {
        logger.warn("Unable to clean up temporary backup import upload", {
          message: error instanceof Error ? error.message : String(error),
        });
      }
    })
  );
}

export function createBackupRouter(
  service: BackupRouterService = backupService,
  options: BackupRouterOptions = {}
) {
  const backupRouter = Router();
  const backupImportUploadRoot = path.resolve(options.importUploadRoot ?? DEFAULT_BACKUP_IMPORT_UPLOAD_ROOT);
  const {
    clearRestoreMaintenanceMode,
    confirmProductionRestoreHandoff,
    copyBackupToExternalDrive,
    createBackupSupportPackage,
    getBackupDetails,
    getBackupJob,
    getBackupScheduleStatus,
    getBackupSettings,
    getBackupStorageStatus,
    getOperationRun,
    getRestoreJob,
    getRestoreMaintenanceStatus,
    importBackupFiles,
    listBackups,
    listExternalBackupDrives,
    prepareProductionRestore,
    runBackupRestoreTest,
    runPostRestoreCheck,
    startManualBackup,
    startRestoreMaintenanceMode,
    startScheduledBackupNow,
    updateBackupScheduleConfig,
    updateBackupStorageRoot,
    useRecommendedBackupStorage,
    verifyBackup,
  } = service;
  const backupImportUpload = multer({
    storage: multer.diskStorage({
      destination: (_req, _file, callback) => {
        try {
          mkdirSync(backupImportUploadRoot, { recursive: true });
          callback(null, backupImportUploadRoot);
        } catch (error) {
          callback(error instanceof Error ? error : new Error(String(error)), backupImportUploadRoot);
        }
      },
      filename: (_req, file, callback) => {
        const basename = file.originalname.replace(/\\/gu, "/").split("/").pop() ?? "backup";
        const extension = path.extname(basename).slice(0, 16);
        callback(null, `${Date.now()}-${randomUUID()}${extension}`);
      },
    }),
    limits: {
      files: 24,
      fileSize: options.importFileSizeLimitBytes ?? 25 * 1024 * 1024 * 1024,
    },
  });

  backupRouter.use(
    requireAnyPermission([
      AdminPermission.BACKUP_CREATE,
      AdminPermission.BACKUP_SETTINGS_MANAGE,
      AdminPermission.RESTORE_DATABASE,
    ])
  );

backupRouter.get("/settings", async (_req, res, next) => {
  try {
    res.json(await getBackupSettings());
  } catch (error) {
    next(error);
  }
});

backupRouter.get(
  "/schedule",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (_req, res, next) => {
    try {
      res.json(await getBackupScheduleStatus());
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.put(
  "/schedule",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = backupScheduleConfigSchema.parse(req.body ?? {});
      res.json(await updateBackupScheduleConfig(payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.get(
  "/storage",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (_req, res, next) => {
    try {
      res.json(await getBackupStorageStatus());
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/storage/recommended",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      res.json(await useRecommendedBackupStorage(getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.put(
  "/storage",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = backupStorageConfigSchema.parse(req.body ?? {});
      res.json(await updateBackupStorageRoot(payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/scheduled/run-now",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = backupScheduledRunNowSchema.parse(req.body ?? {});
      res.status(202).json(await startScheduledBackupNow(getContext(req), payload.frequency));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.get(
  "/external-drives",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (_req, res, next) => {
    try {
      res.json({ drives: await listExternalBackupDrives() });
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/external-copy",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = backupExternalCopySchema.parse(req.body ?? {});
      res.status(201).json(await copyBackupToExternalDrive(payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.get("/maintenance", async (_req, res, next) => {
  try {
    res.json(await getRestoreMaintenanceStatus());
  } catch (error) {
    next(error);
  }
});

backupRouter.post(
  "/maintenance/clear",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const payload = restoreMaintenanceSchema.parse(req.body ?? {});
      res.json(await clearRestoreMaintenanceMode(payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.get("/", async (req, res, next) => {
  try {
    const query = backupListQuerySchema.parse(req.query);
    res.json(await listBackups(query));
  } catch (error) {
    next(error);
  }
});

backupRouter.post(
  "/manual",
  requirePermission(AdminPermission.BACKUP_CREATE),
  async (req, res, next) => {
    try {
      const payload = backupCreateSchema.parse(req.body ?? {});
      const job = await startManualBackup(payload, getContext(req));
      res.status(202).json(job);
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/import",
  requirePermission(AdminPermission.BACKUP_CREATE),
  backupImportUpload.array("files", 24),
  async (req, res, next) => {
    const files = Array.isArray(req.files) ? req.files : [];
    try {
      const result = await importBackupFiles(
        files.map((file) => ({
          originalname: file.originalname,
          path: file.path,
          size: file.size,
        })),
        getContext(req)
      );
      await cleanupBackupImportUploads(files, backupImportUploadRoot);
      res.status(201).json(result);
    } catch (error) {
      await cleanupBackupImportUploads(files, backupImportUploadRoot);
      next(error);
    }
  }
);

backupRouter.get("/jobs/:id", async (req, res, next) => {
  try {
    const { id } = backupJobIdParamSchema.parse(req.params);
    res.json(await getBackupJob(id));
  } catch (error) {
    next(error);
  }
});

backupRouter.get("/operation-runs/:id", async (req, res, next) => {
  try {
    const { id } = operationRunIdParamSchema.parse(req.params);
    res.json(await getOperationRun(id));
  } catch (error) {
    next(error);
  }
});

backupRouter.get(
  "/restore-jobs/:id",
  requirePermission(AdminPermission.RESTORE_DATABASE),
  async (req, res, next) => {
    try {
      const { id } = restoreJobIdParamSchema.parse(req.params);
      res.json(await getRestoreJob(id));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/restore-jobs/:id/confirm",
  requirePermission(AdminPermission.RESTORE_DATABASE),
  async (req, res, next) => {
    try {
      const { id } = restoreJobIdParamSchema.parse(req.params);
      const payload = restoreConfirmSchema.parse(req.body ?? {});
      res.json(await confirmProductionRestoreHandoff(id, payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/restore-jobs/:id/maintenance/start",
  requirePermission(AdminPermission.RESTORE_DATABASE),
  async (req, res, next) => {
    try {
      const { id } = restoreJobIdParamSchema.parse(req.params);
      const payload = restoreMaintenanceSchema.parse(req.body ?? {});
      res.json(await startRestoreMaintenanceMode(id, payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.get("/:id", async (req, res, next) => {
  try {
    const { id } = backupIdParamSchema.parse(req.params);
    res.json(await getBackupDetails(id));
  } catch (error) {
    next(error);
  }
});

backupRouter.post(
  "/:id/support-package",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const { id } = backupIdParamSchema.parse(req.params);
      res.status(201).json(await createBackupSupportPackage(id, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/:id/verify",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const { id } = backupIdParamSchema.parse(req.params);
      res.json(await verifyBackup(id, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/:id/restore-test",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const { id } = backupIdParamSchema.parse(req.params);
      res.json(await runBackupRestoreTest(id, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/:id/post-restore-check",
  requirePermission(AdminPermission.BACKUP_SETTINGS_MANAGE),
  async (req, res, next) => {
    try {
      const { id } = backupIdParamSchema.parse(req.params);
      res.json(await runPostRestoreCheck(id, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

backupRouter.post(
  "/:id/restore/prepare",
  requirePermission(AdminPermission.RESTORE_DATABASE),
  async (req, res, next) => {
    try {
      const { id } = backupIdParamSchema.parse(req.params);
      const payload = restorePrepareSchema.parse(req.body ?? {});
      res.status(202).json(await prepareProductionRestore(id, payload, getContext(req)));
    } catch (error) {
      next(error);
    }
  }
);

  backupRouter.use((error: unknown, _req: Request, res: Response, next: NextFunction) => {
    if (!(error instanceof multer.MulterError)) {
      next(error);
      return;
    }
    const status = error.code === "LIMIT_FILE_SIZE" ? 413 : 400;
    logger.warn("Backup upload validation error", {
      code: error.code,
      field: error.field,
      status,
    });
    res.status(status).json({
      message: status === 413 ? "Uploaded file is too large" : "Uploaded files failed validation",
      details: {
        code: error.code,
        field: error.field,
      },
    });
  });

  return backupRouter;
}

export const backupRouter = createBackupRouter();
