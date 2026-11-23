export type AppEdition = "FULL" | "ATTENDANCE";

export type VersionIdentity = Readonly<{
  schemaVersion: 1;
  productId: "ENTRY_CONTROL_SYSTEM";
  productVersion: string;
  apiVersion: "v1";
  licenseProtocolVersion: 1;
  buildManifestVersion: 1;
  supportedEditions: readonly ["FULL", "ATTENDANCE"];
  nodeVersion: string;
}>;

export type ParsedVersionIdentity = Readonly<{
  identity: VersionIdentity;
  canonicalJson: string;
  sha256: string;
}>;

export class VersionIdentityError extends Error {
  readonly code: string;
}

export const MAX_IDENTITY_BYTES: number;
export const SEMVER_PATTERN: RegExp;
export const SHA256_PATTERN: RegExp;
export const SUPPORTED_EDITIONS: readonly ["FULL", "ATTENDANCE"];
export function assertNodeVersion(identity: VersionIdentity, actualVersion?: string): void;
export function assertSha256(value: unknown, field?: string): string;
export function canonicalizeJson(value: unknown): string;
export function deepFreeze<T>(value: T): Readonly<T>;
export function loadVersionIdentity(filePath: string): ParsedVersionIdentity;
export function parseBuildEdition(value: unknown, identity: VersionIdentity, label?: string): AppEdition;
export function readFileBounded(filePath: string, label?: string, maxBytes?: number): Buffer;
export function parseStrictJson(input: string | Buffer, label?: string, maxBytes?: number): unknown;
export function parseVersionIdentity(input: string | Buffer, label?: string): ParsedVersionIdentity;
export function parseVersionIdentityValue(value: unknown, label?: string): VersionIdentity;
export function sha256Hex(value: string | Buffer): string;
