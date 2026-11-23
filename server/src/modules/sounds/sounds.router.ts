import { Router } from "express";
import type { Request } from "express";
import multer from "multer";
import { AdminPermission } from "@prisma/client";
import { requirePermission } from "../../middlewares/auth";
import { soundSettingsSchema } from "./sounds.schemas";
import {
  createSoundAsset,
  deleteSoundAsset,
  getSoundAsset,
  getSoundSettings,
  listSoundAssets,
  updateSoundSettings,
  type SoundActionContext,
} from "./sounds.service";
import { HttpError } from "../../middlewares/error-handler";

export const soundsRouter = Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 200 * 1024 },
});

soundsRouter.use(requirePermission(AdminPermission.SIGN_IN));

soundsRouter.get("/", async (_req, res, next) => {
  try {
    const assets = await listSoundAssets();
    res.json(assets);
  } catch (error) {
    next(error);
  }
});

soundsRouter.get("/settings", async (_req, res, next) => {
  try {
    const settings = await getSoundSettings();
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

soundsRouter.put("/settings", requirePermission(AdminPermission.SOUND_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const payload = soundSettingsSchema.parse(req.body ?? {});
    const settings = await updateSoundSettings(payload, getSoundActionContext(req));
    res.json(settings);
  } catch (error) {
    next(error);
  }
});

soundsRouter.post("/upload", requirePermission(AdminPermission.SOUND_SETTINGS_MANAGE), upload.single("file"), async (req, res, next) => {
  try {
    if (!req.file) throw new HttpError(400, "File required");
    const asset = await createSoundAsset(req.file, getSoundActionContext(req));
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

soundsRouter.get("/:id", async (req, res, next) => {
  try {
    const asset = await getSoundAsset(req.params.id);
    if (!asset) throw new HttpError(404, "Sound not found");
    res.setHeader("Content-Type", asset.mimeType);
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.setHeader("Cross-Origin-Resource-Policy", "cross-origin");
    res.send(asset.data);
  } catch (error) {
    next(error);
  }
});

soundsRouter.delete("/:id", requirePermission(AdminPermission.SOUND_SETTINGS_MANAGE), async (req, res, next) => {
  try {
    const id = req.params["id"];
    if (!id) {
      throw new HttpError(400, "Sound id is required");
    }
    const asset = await deleteSoundAsset(id, getSoundActionContext(req));
    res.json(asset);
  } catch (error) {
    next(error);
  }
});

function getSoundActionContext(req: Request): SoundActionContext {
  const auth = req.auth;
  if (!auth) {
    throw new HttpError(401, "Authentication required");
  }

  const meta: SoundActionContext["meta"] = {};
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
