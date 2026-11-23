import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { existsSync, unlinkSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "path";

const require = createRequire(import.meta.url);
const buildIdentityContract = require("../scripts/lib/build-identity.cjs") as typeof import("../scripts/lib/build-identity.cjs");
const versionIdentityContract = require("../scripts/lib/version-identity.cjs") as typeof import("../scripts/lib/version-identity.cjs");
const repositoryRoot = resolve(__dirname, "..");
const canonicalVersion = versionIdentityContract.loadVersionIdentity(resolve(repositoryRoot, "version.json"));

export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, __dirname, "");
  const namedBuildEdition = process.env.ECS_BUILD_EDITION;
  const environmentEdition = process.env.VITE_APP_EDITION ?? env.VITE_APP_EDITION;
  if (command === "build" && namedBuildEdition === undefined) {
    throw new Error(
      "Client production builds require ECS_BUILD_EDITION from the root build:full or build:attendance command."
    );
  }
  if (
    namedBuildEdition !== undefined
    && environmentEdition !== undefined
    && namedBuildEdition !== environmentEdition
  ) {
    throw new Error(
      `Build Edition mismatch: ECS_BUILD_EDITION=${namedBuildEdition}, VITE_APP_EDITION=${environmentEdition}.`
    );
  }
  const buildIdentity = buildIdentityContract.createBuildIdentity(
    canonicalVersion,
    command === "build" ? namedBuildEdition : namedBuildEdition ?? environmentEdition
  );
  const clientBuildIdentity = {
    schemaVersion: buildIdentity.schemaVersion,
    productId: buildIdentity.productId,
    version: buildIdentity.productVersion,
    apiVersion: buildIdentity.apiVersion,
    licenseProtocolVersion: buildIdentity.licenseProtocolVersion,
    buildManifestVersion: buildIdentity.buildManifestVersion,
    versionIdentitySha256: buildIdentity.versionIdentitySha256,
    edition: buildIdentity.edition,
  };
  const selectedRouteManifest =
    buildIdentity.edition === "ATTENDANCE"
      ? "./src/routing/attendanceRouteManifest.tsx"
      : "./src/routing/fullRouteManifest.tsx";
  const selectedProductBrand =
    buildIdentity.edition === "ATTENDANCE"
      ? "./src/config/attendanceProductBrand.ts"
      : "./src/config/fullProductBrand.ts";
  const documentBrand = buildIdentity.edition === "ATTENDANCE"
    ? { title: "Entry Control Attendance", icon: "/entrycontrol-attendance-icon.svg" }
    : { title: "AtlasGym", icon: "/atlasgym-icon.svg" };
  const excludedPublicAssets = buildIdentity.edition === "ATTENDANCE"
    ? ["atlasgym-icon.svg", "favicon.ico"]
    : ["entrycontrol-attendance-icon.svg", "atlas-attendance-logo.png"];
  const attendanceInboxUiTestGate = process.env.ECS_ATTENDANCE_INBOX_UI_TEST;
  if (attendanceInboxUiTestGate !== undefined && attendanceInboxUiTestGate !== "0" && attendanceInboxUiTestGate !== "1") {
    throw new Error("ECS_ATTENDANCE_INBOX_UI_TEST must be 0 or 1 when provided.");
  }
  const attendanceInboxCodeReady = command === "serve" && attendanceInboxUiTestGate === "1";

  return {
    define: {
      __ECS_CLIENT_BUILD_IDENTITY__: JSON.stringify(clientBuildIdentity),
      __ECS_ATTENDANCE_INBOX_CODE_READY__: JSON.stringify(attendanceInboxCodeReady),
    },
    plugins: [
      react(),
      {
        name: "edition-product-brand",
        transformIndexHtml(html) {
          return html
            .replaceAll("__APP_TITLE__", documentBrand.title)
            .replaceAll("__APP_ICON__", documentBrand.icon);
        },
        writeBundle(options) {
          const outputDirectory = resolve(__dirname, options.dir ?? "dist");
          for (const excludedPublicAsset of excludedPublicAssets) {
            const excludedPath = resolve(outputDirectory, excludedPublicAsset);
            if (existsSync(excludedPath)) unlinkSync(excludedPath);
          }
        },
      },
    ],
    server: {
      fs: {
        allow: [".."],
      },
    },
    resolve: {
      alias: {
        "@shared": resolve(__dirname, "../server/src/shared"),
        "@app-route-manifest": resolve(__dirname, selectedRouteManifest),
        "@app-product-brand": resolve(__dirname, selectedProductBrand),
      },
    },
  };
});
