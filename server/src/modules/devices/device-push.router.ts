import { Router } from "express";
import { handleDevicePush } from "./devicePush.service";

export const devicePushRouter = Router();

devicePushRouter.post("/push-test", (req, res) => {
  const timestamp = new Date().toISOString();
  const rawBody = req.body;
  const bodyForLog =
    Buffer.isBuffer(rawBody) || typeof rawBody === "string" ? rawBody : rawBody ? JSON.stringify(rawBody) : "";

  console.log("=== ZKTECO PUSH RECEIVED ===");
  console.log("headers:", req.headers);
  console.log("body (raw):", bodyForLog);
  console.log("from IP:", req.ip);
  console.log("timestamp:", timestamp);

  res.status(200).type("text").send("PUSH RECEIVED");
});

devicePushRouter.post("/events/push", async (req, res, next) => {
  try {
    const result = await handleDevicePush(req.body);
    res.status(202).json(result);
  } catch (error) {
    next(error);
  }
});
