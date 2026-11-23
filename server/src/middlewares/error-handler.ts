import type { NextFunction, Request, Response } from "express";
import { Prisma } from "@prisma/client";
import { ZodError } from "zod";
import { logger } from "../config/logger";

export class HttpError extends Error {
  constructor(
    public status: number,
    message: string,
    public details?: Record<string, unknown>
  ) {
    super(message);
  }
}

export function errorHandler(err: Error, _req: Request, res: Response, _next: NextFunction) {
  if (err instanceof HttpError) {
    logger.warn("Handled HTTP error", { status: err.status, message: err.message, details: err.details });
    return res.status(err.status).json({
      message: err.message,
      details: err.details,
    });
  }

  if (err instanceof ZodError) {
    logger.warn("Validation error", { issues: err.issues });
    return res.status(400).json({
      message: "Validation failed",
      issues: err.issues,
    });
  }

  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    const target = err.meta?.["target"];
    const fields = Array.isArray(target) ? target.filter((field): field is string => typeof field === "string") : [];
    const fieldLabel = fields.length ? fields.map(formatUniqueFieldName).join(", ") : "unique field";
    logger.warn("Unique constraint error", { code: err.code, fields });
    return res.status(409).json({
      message: `A record already exists with the same ${fieldLabel}. Save was not completed.`,
      details: {
        code: err.code,
        fields,
      },
    });
  }

  logger.error("Unhandled error", { message: err.message, stack: err.stack });
  return res.status(500).json({
    message: "Unexpected server error",
  });
}

function formatUniqueFieldName(field: string) {
  return field.replace(/Id$/u, " ID").replace(/([a-z])([A-Z])/gu, "$1 $2").toLowerCase();
}
