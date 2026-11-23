import path from "path";
import { parseBuffer } from "music-metadata";
import { AuditActor, type AdminRole, type Prisma, type SoundSettings } from "@prisma/client";
import { prisma } from "../../lib/prisma";
import { HttpError } from "../../middlewares/error-handler";
import type { SoundSettingsInput } from "./sounds.schemas";

const MAX_FILE_SIZE = 200 * 1024;
const MAX_DURATION_MS = 2000;
const ALLOWED_MIME = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
]);
const ALLOWED_EXT = new Set([".mp3", ".wav"]);

const safeSoundAssetSelect = {
  id: true,
  name: true,
  mimeType: true,
  size: true,
  durationMs: true,
  createdAt: true,
} as const;

type SafeSoundAsset = Prisma.SoundAssetGetPayload<{ select: typeof safeSoundAssetSelect }>;

export type SoundActionContext = {
  actor: {
    id: string;
    role: AdminRole;
    sessionId?: string;
  };
  meta: {
    ipAddress?: string;
    userAgent?: string;
  };
};

type SoundAuditInput = {
  action: "sound.settings.updated" | "sound.asset.uploaded" | "sound.asset.deleted";
  targetType: "SoundSettings" | "SoundAsset";
  targetId: string;
  beforeData?: Prisma.InputJsonObject;
  afterData?: Prisma.InputJsonObject;
  metadata?: Prisma.InputJsonObject;
};

export async function listSoundAssets() {
  return prisma.soundAsset.findMany({
    orderBy: { createdAt: "desc" },
    select: safeSoundAssetSelect,
  });
}

export async function getSoundAsset(id: string) {
  return prisma.soundAsset.findUnique({ where: { id } });
}

export async function deleteSoundAsset(id: string, context: SoundActionContext) {
  return prisma.$transaction(async (tx) => {
    const asset = await tx.soundAsset.findUnique({
      where: { id },
      select: safeSoundAssetSelect,
    });
    if (!asset) {
      throw new HttpError(404, "Sound not found");
    }

    const settings = await tx.soundSettings.findUnique({ where: { id: "global" } });
    const settingsUpdate: Prisma.SoundSettingsUpdateInput = {};
    const clearedSettingFields: string[] = [];
    if (settings?.accessAllowedSoundId === id) {
      settingsUpdate.accessAllowedSound = { disconnect: true };
      clearedSettingFields.push("accessAllowedSoundId");
    }
    if (settings?.accessDeniedSoundId === id) {
      settingsUpdate.accessDeniedSound = { disconnect: true };
      clearedSettingFields.push("accessDeniedSoundId");
    }
    if (settings?.alertSoundId === id) {
      settingsUpdate.alertSound = { disconnect: true };
      clearedSettingFields.push("alertSoundId");
    }
    if (clearedSettingFields.length > 0) {
      await tx.soundSettings.update({ where: { id: "global" }, data: settingsUpdate });
    }

    await tx.soundAsset.delete({ where: { id } });
    await tx.auditLog.create({
      data: buildSoundAuditData(context, {
        action: "sound.asset.deleted",
        targetType: "SoundAsset",
        targetId: id,
        beforeData: toSoundAssetAuditJson(asset),
        afterData: { id, deleted: true },
        metadata: { clearedSettingFields },
      }),
    });
    return asset;
  });
}

export async function getSoundSettings() {
  const existing = await prisma.soundSettings.findUnique({ where: { id: "global" } });
  if (existing) return existing;
  return prisma.soundSettings.create({
    data: {
      id: "global",
    },
  });
}

export async function updateSoundSettings(payload: SoundSettingsInput, context: SoundActionContext) {
  const data = {
    ...(payload.enabled !== undefined ? { enabled: payload.enabled } : {}),
    ...(payload.accessAllowedSoundId !== undefined ? { accessAllowedSoundId: payload.accessAllowedSoundId } : {}),
    ...(payload.accessDeniedSoundId !== undefined ? { accessDeniedSoundId: payload.accessDeniedSoundId } : {}),
    ...(payload.alertSoundId !== undefined ? { alertSoundId: payload.alertSoundId } : {}),
    ...(payload.accessAllowedVolume !== undefined ? { accessAllowedVolume: payload.accessAllowedVolume } : {}),
    ...(payload.accessDeniedVolume !== undefined ? { accessDeniedVolume: payload.accessDeniedVolume } : {}),
    ...(payload.alertVolume !== undefined ? { alertVolume: payload.alertVolume } : {}),
  };
  return prisma.$transaction(async (tx) => {
    const before = await tx.soundSettings.findUnique({ where: { id: "global" } })
      ?? await tx.soundSettings.create({ data: { id: "global" } });
    const updated = await tx.soundSettings.update({
      where: { id: "global" },
      data,
    });
    await tx.auditLog.create({
      data: buildSoundAuditData(context, {
        action: "sound.settings.updated",
        targetType: "SoundSettings",
        targetId: updated.id,
        beforeData: toSoundSettingsAuditJson(before),
        afterData: toSoundSettingsAuditJson(updated),
        metadata: { changedFields: getSoundSettingsChangedFields(before, updated) },
      }),
    });
    return updated;
  });
}

export async function createSoundAsset(file: Express.Multer.File, context: SoundActionContext) {
  if (!file) {
    throw new HttpError(400, "No file uploaded");
  }
  if (file.size > MAX_FILE_SIZE) {
    throw new HttpError(400, "File too large");
  }
  const ext = path.extname(file.originalname).toLowerCase();
  if (!ALLOWED_EXT.has(ext)) {
    throw new HttpError(400, "Invalid file extension");
  }
  if (!ALLOWED_MIME.has(file.mimetype)) {
    throw new HttpError(400, "Invalid file type");
  }

  if (!hasValidSignature(file.buffer, ext)) {
    throw new HttpError(400, "Invalid file signature");
  }

  const metadata = await parseBuffer(file.buffer, file.mimetype);
  const durationSec = metadata.format.duration ?? 0;
  const durationMs = Math.round(durationSec * 1000);
  if (!durationMs || durationMs > MAX_DURATION_MS) {
    throw new HttpError(400, "Invalid audio duration");
  }

  const name = sanitizeFileName(file.originalname);
  const fileData = new Uint8Array(file.buffer);
  return prisma.$transaction(async (tx) => {
    const created = await tx.soundAsset.create({
      data: {
        name,
        mimeType: file.mimetype,
        size: file.size,
        durationMs,
        data: fileData,
      },
      select: safeSoundAssetSelect,
    });
    await tx.auditLog.create({
      data: buildSoundAuditData(context, {
        action: "sound.asset.uploaded",
        targetType: "SoundAsset",
        targetId: created.id,
        afterData: toSoundAssetAuditJson(created),
      }),
    });
    return created;
  });
}

function buildSoundAuditData(
  context: SoundActionContext,
  input: SoundAuditInput
): Prisma.AuditLogUncheckedCreateInput {
  const data: Prisma.AuditLogUncheckedCreateInput = {
    actorType: AuditActor.ADMIN,
    actorId: context.actor.id,
    actorRole: context.actor.role,
    action: input.action,
    targetType: input.targetType,
    targetId: input.targetId,
    success: true,
  };
  if (context.actor.sessionId) data.sessionId = context.actor.sessionId;
  if (context.meta.ipAddress) data.ipAddress = context.meta.ipAddress;
  if (context.meta.userAgent) data.userAgent = context.meta.userAgent;
  if (input.beforeData) data.beforeData = input.beforeData;
  if (input.afterData) data.afterData = input.afterData;
  if (input.metadata) data.metadata = input.metadata;
  return data;
}

function toSoundAssetAuditJson(asset: SafeSoundAsset): Prisma.InputJsonObject {
  return {
    id: asset.id,
    name: asset.name,
    mimeType: asset.mimeType,
    size: asset.size,
    durationMs: asset.durationMs,
    createdAt: asset.createdAt.toISOString(),
  };
}

function toSoundSettingsAuditJson(settings: SoundSettings): Prisma.InputJsonObject {
  return {
    id: settings.id,
    enabled: settings.enabled,
    accessAllowedSoundId: settings.accessAllowedSoundId ?? "",
    accessDeniedSoundId: settings.accessDeniedSoundId ?? "",
    alertSoundId: settings.alertSoundId ?? "",
    accessAllowedVolume: settings.accessAllowedVolume,
    accessDeniedVolume: settings.accessDeniedVolume,
    alertVolume: settings.alertVolume,
  };
}

function getSoundSettingsChangedFields(before: SoundSettings, after: SoundSettings) {
  const values: Array<[string, unknown, unknown]> = [
    ["enabled", before.enabled, after.enabled],
    ["accessAllowedSoundId", before.accessAllowedSoundId, after.accessAllowedSoundId],
    ["accessDeniedSoundId", before.accessDeniedSoundId, after.accessDeniedSoundId],
    ["alertSoundId", before.alertSoundId, after.alertSoundId],
    ["accessAllowedVolume", before.accessAllowedVolume, after.accessAllowedVolume],
    ["accessDeniedVolume", before.accessDeniedVolume, after.accessDeniedVolume],
    ["alertVolume", before.alertVolume, after.alertVolume],
  ];
  return values
    .filter(([, beforeValue, afterValue]) => beforeValue !== afterValue)
    .map(([field]) => field);
}

function sanitizeFileName(value: string) {
  return value.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 64) || "sound";
}

function hasValidSignature(buffer: Buffer, ext: string) {
  if (ext === ".wav") {
    return buffer.slice(0, 4).toString("ascii") === "RIFF" && buffer.slice(8, 12).toString("ascii") === "WAVE";
  }
  if (ext === ".mp3") {
    const head = buffer.slice(0, 3).toString("ascii");
    if (head === "ID3") return true;
    const first = buffer[0];
    const second = buffer[1];
    if (first === undefined || second === undefined) return false;
    return first === 0xff && (second & 0xe0) === 0xe0;
  }
  return false;
}
