import { AuditActor, Prisma } from "@prisma/client";
import { logger } from "../../config/logger";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { DeviceActionContext } from "./device.service";

export type DeviceCommandAuditAction =
  | "device.diagnosed"
  | "device.scan.started"
  | "device.scan.cancelled"
  | "device.tested"
  | "device.connection_tested"
  | "device.enrollment.started"
  | "device.users.synced"
  | "device.user.upserted"
  | "device.user.deleted"
  | "device.time.updated"
  | "device.door.unlocked"
  | "device.logs.cleared";

type DeviceCommandAuditSummary = {
  success: boolean;
  metadata?: Prisma.InputJsonObject;
};

type AuditedDeviceCommandInput<Result> = {
  action: DeviceCommandAuditAction;
  targetId: string;
  context: DeviceActionContext;
  execute: () => Result | Promise<Result>;
  summarize: (result: Result) => DeviceCommandAuditSummary;
  failureMetadata?: Prisma.InputJsonObject;
};

export async function runAuditedDeviceCommand<Result>(input: AuditedDeviceCommandInput<Result>): Promise<Result> {
  let result: Result;
  try {
    result = await input.execute();
  } catch (error) {
    await writeDeviceCommandAudit({
      action: input.action,
      targetId: input.targetId,
      context: input.context,
      success: false,
      metadata: {
        ...(input.failureMetadata ?? {}),
        outcome: "ERROR",
        errorType: error instanceof HttpError ? "HTTP_ERROR" : "COMMAND_ERROR",
        httpStatus: error instanceof HttpError ? error.status : 500,
      },
    }).catch((auditError) => {
      logger.error("Failed to record failed device command audit", {
        action: input.action,
        targetId: input.targetId,
        message: auditError instanceof Error ? auditError.message : "Unknown audit error",
      });
    });
    throw error;
  }

  const summary = input.summarize(result);
  await writeDeviceCommandAudit({
    action: input.action,
    targetId: input.targetId,
    context: input.context,
    success: summary.success,
    ...(summary.metadata ? { metadata: summary.metadata } : {}),
  });
  return result;
}

async function writeDeviceCommandAudit(input: {
  action: DeviceCommandAuditAction;
  targetId: string;
  context: DeviceActionContext;
  success: boolean;
  metadata?: Prisma.InputJsonObject;
}) {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: input.context.actor.id,
    actorRole: input.context.actor.role,
    action: input.action,
    targetType: "Device",
    targetId: input.targetId,
    success: input.success,
  };
  if (input.context.actor.sessionId) data.sessionId = input.context.actor.sessionId;
  if (input.context.meta.ipAddress) data.ipAddress = input.context.meta.ipAddress;
  if (input.context.meta.userAgent) data.userAgent = input.context.meta.userAgent;
  if (input.metadata) data.metadata = input.metadata;
  await prisma.auditLog.create({ data });
}
