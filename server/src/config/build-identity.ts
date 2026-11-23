import { existsSync } from "node:fs";
import path from "node:path";
import buildIdentityContract = require("../../../scripts/lib/build-identity.cjs");
import versionIdentityContract = require("../../../scripts/lib/version-identity.cjs");
import type { AppEdition } from "../shared/app-identity";

const distributionRoot = path.resolve(__dirname, "../../..");
const canonicalVersionPath = path.join(distributionRoot, "version.json");
const artifactBuildIdentityPath = path.join(distributionRoot, "build-identity.json");

export const CANONICAL_VERSION_IDENTITY = versionIdentityContract.loadVersionIdentity(canonicalVersionPath);

const artifactBuildIdentity = existsSync(artifactBuildIdentityPath)
  ? buildIdentityContract.parseBuildIdentity(
      versionIdentityContract.readFileBounded(
        artifactBuildIdentityPath,
        artifactBuildIdentityPath,
        versionIdentityContract.MAX_IDENTITY_BYTES
      ),
      CANONICAL_VERSION_IDENTITY,
      undefined,
      artifactBuildIdentityPath
    )
  : null;

export type ServerBuildIdentity = buildIdentityContract.BuildIdentity;

export type PublicServerIdentity = Readonly<{
  name: "EntryControl System API";
  schemaVersion: 1;
  productId: "ENTRY_CONTROL_SYSTEM";
  version: string;
  apiVersion: "v1";
  licenseProtocolVersion: 1;
  buildManifestVersion: 1;
  versionIdentitySha256: string;
  edition: AppEdition;
}>;

export function toPublicServerIdentity(buildIdentity: ServerBuildIdentity): PublicServerIdentity {
  return Object.freeze({
    name: "EntryControl System API",
    schemaVersion: buildIdentity.schemaVersion,
    productId: buildIdentity.productId,
    version: buildIdentity.productVersion,
    apiVersion: buildIdentity.apiVersion,
    licenseProtocolVersion: buildIdentity.licenseProtocolVersion,
    buildManifestVersion: buildIdentity.buildManifestVersion,
    versionIdentitySha256: buildIdentity.versionIdentitySha256,
    edition: buildIdentity.edition,
  });
}

export function canonicalPublicServerIdentity(edition: AppEdition): PublicServerIdentity {
  return toPublicServerIdentity(buildIdentityContract.createBuildIdentity(CANONICAL_VERSION_IDENTITY, edition));
}

export function resolveServerBuildIdentity(
  runtimeEdition: AppEdition,
  options: Readonly<{
    nodeEnv: "development" | "test" | "production";
    rawRuntimeEdition: string | undefined;
    actualNodeVersion?: string;
  }>
): ServerBuildIdentity {
  if (!artifactBuildIdentity) {
    if (options.nodeEnv === "production") {
      throw new Error(
        `Production startup requires ${artifactBuildIdentityPath}; use the root build:full or build:attendance command.`
      );
    }
    return buildIdentityContract.createBuildIdentity(CANONICAL_VERSION_IDENTITY, runtimeEdition);
  }

  if (options.rawRuntimeEdition === undefined) {
    throw new Error("Packaged startup requires an explicit APP_EDITION matching build-identity.json.");
  }
  if (runtimeEdition !== artifactBuildIdentity.edition) {
    throw new Error(
      `Packaged Edition mismatch: APP_EDITION=${runtimeEdition}, artifact=${artifactBuildIdentity.edition}.`
    );
  }
  versionIdentityContract.assertNodeVersion(
    CANONICAL_VERSION_IDENTITY.identity,
    options.actualNodeVersion ?? process.versions.node
  );
  return artifactBuildIdentity;
}

export function currentServerBuildIdentity(runtimeEdition: AppEdition): ServerBuildIdentity {
  return resolveServerBuildIdentity(runtimeEdition, {
    nodeEnv: process.env["NODE_ENV"] === "production" ? "production" : process.env["NODE_ENV"] === "test" ? "test" : "development",
    rawRuntimeEdition: process.env["APP_EDITION"],
  });
}
