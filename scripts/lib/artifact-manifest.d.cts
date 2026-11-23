import type { AppEdition, ParsedVersionIdentity } from "./version-identity.cjs";
import type { BuildIdentity } from "./build-identity.cjs";

export class ArtifactManifestError extends Error {
  readonly code: string;
}

export const BUILD_IDENTITY_FILE: "build-identity.json";
export const MANIFEST_FILE: "build-manifest.json";
export const MANIFEST_HASH_FILE: "build-manifest.sha256";
export const VERSION_IDENTITY_FILE: "version.json";
export function createArtifactManifest(
  rootPath: string,
  parsedVersionIdentity: ParsedVersionIdentity,
  buildIdentity: BuildIdentity
): unknown;
export function serializeArtifactManifest(manifest: unknown): Readonly<{
  canonicalJson: string;
  text: string;
  sha256: string;
}>;
export function verifyArtifact(
  rootPath: string,
  parsedVersionIdentity: ParsedVersionIdentity,
  expectedEdition: AppEdition
): Readonly<{
  root: string;
  edition: AppEdition;
  buildIdentity: BuildIdentity;
  manifest: unknown;
  manifestSha256: string;
}>;
