import cors from "cors";
import express from "express";
import helmet from "helmet";
import { currentServerBuildIdentity, toPublicServerIdentity } from "./config/build-identity";
import { isFeatureEnabled } from "./config/capabilities";
import { env, runtimeOptionalFeatureFlags } from "./config/env";
import { errorHandler } from "./middlewares/error-handler";
import { notFoundHandler } from "./middlewares/not-found";
import { registerRoutes } from "./routes";
import { isEnabledMaintenanceProtectedHttpRequest, isHttpRequestEnabled } from "./routes/http-route-registry";

function buildAllowedOrigins() {
  return new Set(
    [
      "http://localhost:5173",
      "http://127.0.0.1:5173",
      "http://localhost:4173",
      "http://127.0.0.1:4173",
      env.CLIENT_ORIGIN,
    ].filter((origin): origin is string => Boolean(origin))
  );
}

export function createApp() {
  const app = express();
  const allowedOrigins = buildAllowedOrigins();
  const buildIdentity = currentServerBuildIdentity(env.APP_EDITION);

  app.use(helmet());
  app.use((req, res, next) => {
    if (
      isHttpRequestEnabled(env.APP_EDITION, {
        method: req.method,
        pathname: req.path,
        preflightMethod: req.get("access-control-request-method"),
        query: req.query,
      })
    ) {
      next();
      return;
    }
    notFoundHandler(req, res);
  });
  app.use(
    cors({
      credentials: true,
      exposedHeaders: ["Content-Disposition"],
      origin(origin, callback) {
        if (!origin || allowedOrigins.has(origin)) {
          callback(null, true);
          return;
        }
        callback(null, false);
      },
    })
  );
  app.use((req, res, next) => {
    if (!isEnabledMaintenanceProtectedHttpRequest(env.APP_EDITION, {
      method: req.method,
      pathname: req.path,
      preflightMethod: req.get("access-control-request-method"),
      query: req.query,
    })) {
      next();
      return;
    }
    const { restoreMaintenanceMiddleware } = require("./middlewares/restore-maintenance") as typeof import("./middlewares/restore-maintenance");
    restoreMaintenanceMiddleware(req, res, next);
  });
  if (isFeatureEnabled(env.APP_EDITION, "GENERIC_DEVICE_PUSH", runtimeOptionalFeatureFlags)) {
    app.use("/api/v1/devices/push-test", express.raw({ type: "*/*", limit: "5mb" }));
  }
  if (isFeatureEnabled(env.APP_EDITION, "ICLOCK_ADMS", runtimeOptionalFeatureFlags)) {
    const { iclockRouter } = require("./modules/devices/iclock.router") as typeof import("./modules/devices/iclock.router");
    app.use("/iclock", express.raw({ type: "*/*", limit: "5mb" }));
    app.use("/iclock", iclockRouter);
  }
  app.use(express.json({ limit: "5mb" }));
  app.use(express.urlencoded({ extended: true, limit: "5mb" }));

  app.get("/api", (_req, res) => {
    res.json(toPublicServerIdentity(buildIdentity));
  });

  registerRoutes(app, env.APP_EDITION);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
