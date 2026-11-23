import type { AppEdition, ParsedVersionIdentity, VersionIdentity } from "./version-identity.cjs";

export type BuildIdentity = Readonly<{
  schemaVersion: VersionIdentity["schemaVersion"];
  productId: VersionIdentity["productId"];
  productVersion: string;
  apiVersion: VersionIdentity["apiVersion"];
  licenseProtocolVersion: VersionIdentity["licenseProtocolVersion"];
  buildManifestVersion: VersionIdentity["buildManifestVersion"];
  nodeVersion: string;
  versionIdentitySha256: string;
  edition: AppEdition;
}>;

export class BuildIdentityError extends Error {
  readonly code: string;
}

export const BUILD_IDENTITY_FIELDS: readonly string[];
export function assertBuildIdentityMatchesVersion(
  value: unknown,
  parsedVersionIdentity: ParsedVersionIdentity,
  expectedEdition?: AppEdition,
  label?: string
): BuildIdentity;
export function createBuildIdentity(
  parsedVersionIdentity: ParsedVersionIdentity,
  editionSource: unknown
): BuildIdentity;
export function parseBuildIdentity(
  input: string | Buffer,
  parsedVersionIdentity: ParsedVersionIdentity,
  expectedEdition?: AppEdition,
  label?: string
): BuildIdentity;
export function serializeBuildIdentity(identity: BuildIdentity): Readonly<{
  canonicalJson: string;
  sha256: string;
  text: string;
}>;
