import {
  CAPABILITY_NAMES,
  type Capability as RegistryCapability,
} from "../../../server/src/shared/capability-contract.ts";
import {
  APP_EDITIONS,
  type AppEdition as SharedAppEdition,
} from "../../../server/src/shared/app-identity.ts";

export { APP_EDITIONS };

export type AppEdition = SharedAppEdition;

export const CAPABILITIES = CAPABILITY_NAMES;

export type Capability = RegistryCapability;

export type AdminRole =
  | "VENDOR_OWNER"
  | "GYM_OWNER"
  | "ADMIN"
  | "MANAGER"
  | "RECEPTION"
  | "ACCOUNTANT"
  | "DEVICE_OPERATOR"
  | "READ_ONLY_AUDITOR"
  | "STAFF"
  | "SUPER_ADMIN"
  | "OPERATOR";

export type AdminPermission =
  | "SIGN_IN"
  | "ADMIN_USERS_MANAGE"
  | "ROLES_MANAGE"
  | "MEMBERS_VIEW"
  | "MEMBERS_WRITE"
  | "MEMBERS_DELETE"
  | "MEMBERSHIPS_WRITE"
  | "MEMBERSHIPS_CANCEL"
  | "PAYMENTS_RECORD"
  | "PAYMENTS_REVERSE"
  | "FINANCIAL_REPORTS_VIEW"
  | "FINANCIAL_EXPORT"
  | "ATTENDANCE_EXPORT"
  | "EXPENSES_MANAGE"
  | "PAYROLL_MANAGE"
  | "ATTENDANCE_VIEW"
  | "ATTENDANCE_MANUAL"
  | "ATTENDANCE_JUSTIFY"
  | "DEVICES_VIEW"
  | "DEVICES_DIAGNOSTICS"
  | "DEVICES_USER_SYNC"
  | "DEVICES_ENROLL"
  | "DEVICES_CLEAR_LOGS"
  | "DOOR_UNLOCK"
  | "SOUND_SETTINGS_MANAGE"
  | "BACKUP_CREATE"
  | "BACKUP_SETTINGS_MANAGE"
  | "RESTORE_DATABASE"
  | "LICENSE_VIEW"
  | "LICENSE_ACTIVATE"
  | "AUDIT_LOG_VIEW"
  | "SYSTEM_SETTINGS_MANAGE";

export type AuthUser = {
  id: string;
  username: string;
  email: string | null;
  fullName: string | null;
  role: AdminRole;
  isActive: boolean;
  isProtected: boolean;
  lastLoginAt: string | null;
  passwordChangedAt: string | null;
  deactivatedAt?: string | null;
  vendorMaintenanceActivatedAt?: string | null;
  vendorMaintenanceExpiresAt?: string | null;
  vendorMaintenanceReason?: string | null;
  vendorMaintenanceActivatedById?: string | null;
  createdAt: string;
  updatedAt: string;
};

export type AuthSession = {
  id: string;
  createdAt: string;
  lastSeenAt: string;
  expiresAt: string;
};

export type AuthPayload = {
  edition: AppEdition;
  features: Capability[];
  permissions: AdminPermission[];
  user: AuthUser;
  session: AuthSession;
  expiresAt: string;
};

export type AuthState = {
  edition: AppEdition;
  features: readonly Capability[];
  permissions: readonly AdminPermission[];
  user: AuthUser;
  session: AuthSession;
};

export type PublicApiIdentityPayload = {
  name: string;
  schemaVersion: number;
  productId: string;
  version: string;
  apiVersion: string;
  licenseProtocolVersion: number;
  buildManifestVersion: number;
  versionIdentitySha256: string;
  edition: AppEdition;
};

export type PublicApiIdentity = Readonly<{
  name: string;
  schemaVersion: 1;
  productId: "ENTRY_CONTROL_SYSTEM";
  version: string;
  apiVersion: "v1";
  licenseProtocolVersion: 1;
  buildManifestVersion: 1;
  versionIdentitySha256: string;
  edition: AppEdition;
}>;

export type ClientBuildIdentity = Readonly<{
  schemaVersion: 1;
  productId: "ENTRY_CONTROL_SYSTEM";
  version: string;
  apiVersion: "v1";
  licenseProtocolVersion: 1;
  buildManifestVersion: 1;
  versionIdentitySha256: string;
  edition: AppEdition;
}>;

export type CompatibilityErrorCode =
  | "INVALID_BUILD_IDENTITY"
  | "INVALID_PUBLIC_IDENTITY"
  | "INVALID_AUTH_PAYLOAD"
  | "EDITION_MISMATCH"
  | "VERSION_MISMATCH"
  | "BUILD_IDENTITY_MISMATCH"
  | "AUTH_EDITION_MISMATCH";

export class ApplicationCompatibilityError extends Error {
  readonly code: CompatibilityErrorCode;

  constructor(code: CompatibilityErrorCode, message: string) {
    super(message);
    this.name = "ApplicationCompatibilityError";
    this.code = code;
  }
}

const appEditionSet = new Set<string>(APP_EDITIONS);
const capabilitySet = new Set<string>(CAPABILITIES);
const semverPattern = /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-((?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*)(?:\.(?:0|[1-9]\d*|\d*[A-Za-z-][0-9A-Za-z-]*))*))?(?:\+([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/u;
const sha256Pattern = /^[0-9a-f]{64}$/u;

function normalizeEdition(value: unknown, code: CompatibilityErrorCode, source: string): AppEdition {
  if (typeof value !== "string" || !appEditionSet.has(value)) {
    throw new ApplicationCompatibilityError(code, `${source} edition is invalid.`);
  }
  return value as AppEdition;
}

function normalizeVersion(value: unknown, code: CompatibilityErrorCode, source: string): string {
  if (typeof value !== "string" || value.length > 64 || !semverPattern.test(value)) {
    throw new ApplicationCompatibilityError(code, `${source} version is invalid.`);
  }
  return value;
}

function normalizeFixedIdentityFields(
  payload: Omit<PublicApiIdentityPayload, "name">,
  code: CompatibilityErrorCode,
  source: string
): Omit<ClientBuildIdentity, "edition" | "version"> {
  if (
    payload.schemaVersion !== 1
    || payload.productId !== "ENTRY_CONTROL_SYSTEM"
    || payload.apiVersion !== "v1"
    || payload.licenseProtocolVersion !== 1
    || payload.buildManifestVersion !== 1
    || typeof payload.versionIdentitySha256 !== "string"
    || !sha256Pattern.test(payload.versionIdentitySha256)
  ) {
    throw new ApplicationCompatibilityError(code, `${source} canonical identity is invalid.`);
  }
  return {
    schemaVersion: 1,
    productId: "ENTRY_CONTROL_SYSTEM",
    apiVersion: "v1",
    licenseProtocolVersion: 1,
    buildManifestVersion: 1,
    versionIdentitySha256: payload.versionIdentitySha256,
  };
}

function normalizeFeatures(value: unknown): readonly Capability[] {
  if (!Array.isArray(value)) {
    throw new ApplicationCompatibilityError("INVALID_AUTH_PAYLOAD", "Authentication features are invalid.");
  }

  const features = value.map((feature) => {
    if (typeof feature !== "string" || !capabilitySet.has(feature)) {
      throw new ApplicationCompatibilityError(
        "INVALID_AUTH_PAYLOAD",
        `Authentication response contains an unknown feature: ${String(feature)}.`
      );
    }
    return feature as Capability;
  });

  return Object.freeze([...new Set(features)]);
}

function normalizeSession(payload: AuthPayload): AuthSession {
  const session = payload.session as AuthSession | null | undefined;
  if (
    !session ||
    typeof session.id !== "string" ||
    typeof session.createdAt !== "string" ||
    typeof session.lastSeenAt !== "string" ||
    typeof session.expiresAt !== "string" ||
    typeof payload.expiresAt !== "string"
  ) {
    throw new ApplicationCompatibilityError("INVALID_AUTH_PAYLOAD", "Authentication session is incomplete.");
  }
  if (payload.expiresAt !== session.expiresAt) {
    throw new ApplicationCompatibilityError(
      "INVALID_AUTH_PAYLOAD",
      "Authentication session expiry does not match its compatibility alias."
    );
  }
  return {
    id: session.id,
    createdAt: session.createdAt,
    lastSeenAt: session.lastSeenAt,
    expiresAt: session.expiresAt,
  };
}

export function normalizeAuthPayload(payload: AuthPayload): AuthState {
  if (!payload || typeof payload !== "object" || !payload.user || !Array.isArray(payload.permissions)) {
    throw new ApplicationCompatibilityError("INVALID_AUTH_PAYLOAD", "Authentication response is incomplete.");
  }

  return {
    edition: normalizeEdition(payload.edition, "INVALID_AUTH_PAYLOAD", "Authentication response"),
    features: normalizeFeatures(payload.features),
    permissions: Object.freeze([...payload.permissions]),
    user: payload.user,
    session: normalizeSession(payload),
  };
}

export function normalizePublicApiIdentity(payload: PublicApiIdentityPayload): PublicApiIdentity {
  if (!payload || typeof payload !== "object" || typeof payload.name !== "string" || payload.name.trim().length === 0) {
    throw new ApplicationCompatibilityError("INVALID_PUBLIC_IDENTITY", "Public API identity is incomplete.");
  }

  return Object.freeze({
    name: payload.name.trim(),
    ...normalizeFixedIdentityFields(payload, "INVALID_PUBLIC_IDENTITY", "Public API"),
    version: normalizeVersion(payload.version, "INVALID_PUBLIC_IDENTITY", "Public API"),
    edition: normalizeEdition(payload.edition, "INVALID_PUBLIC_IDENTITY", "Public API"),
  });
}

export function createClientBuildIdentity(payload: Omit<PublicApiIdentityPayload, "name">): ClientBuildIdentity {
  if (!payload || typeof payload !== "object") {
    throw new ApplicationCompatibilityError("INVALID_BUILD_IDENTITY", "Client build identity is incomplete.");
  }
  return Object.freeze({
    ...normalizeFixedIdentityFields(payload, "INVALID_BUILD_IDENTITY", "Client build"),
    edition: normalizeEdition(payload.edition, "INVALID_BUILD_IDENTITY", "Client build"),
    version: normalizeVersion(payload.version, "INVALID_BUILD_IDENTITY", "Client build"),
  });
}

export function assertPublicIdentityCompatible(
  identity: PublicApiIdentity,
  expected: ClientBuildIdentity
): void {
  if (identity.edition !== expected.edition) {
    throw new ApplicationCompatibilityError(
      "EDITION_MISMATCH",
      `Application edition mismatch: this client expects ${expected.edition}, but the server is ${identity.edition}. Install matching client and server builds.`
    );
  }
  if (identity.version !== expected.version) {
    throw new ApplicationCompatibilityError(
      "VERSION_MISMATCH",
      `Application version mismatch: this client expects ${expected.version}, but the server is ${identity.version}. Install matching client and server builds.`
    );
  }
  for (const field of [
    "schemaVersion",
    "productId",
    "apiVersion",
    "licenseProtocolVersion",
    "buildManifestVersion",
    "versionIdentitySha256",
  ] as const) {
    if (identity[field] !== expected[field]) {
      throw new ApplicationCompatibilityError(
        "BUILD_IDENTITY_MISMATCH",
        `Application build identity mismatch at ${field}. Install matching client and server builds.`
      );
    }
  }
}

export function assertAuthStateCompatible(auth: AuthState, identity: PublicApiIdentity): void {
  if (auth.edition !== identity.edition) {
    throw new ApplicationCompatibilityError(
      "AUTH_EDITION_MISMATCH",
      `Authentication edition mismatch: public API is ${identity.edition}, but the authentication response is ${auth.edition}.`
    );
  }
}

export function isApplicationCompatibilityError(error: unknown): error is ApplicationCompatibilityError {
  return error instanceof ApplicationCompatibilityError;
}

export function authHasFeature(auth: AuthState | null, feature: Capability): boolean {
  return Boolean(auth?.features.includes(feature));
}

export function authHasPermission(auth: AuthState | null, permission: AdminPermission): boolean {
  return Boolean(auth?.permissions.includes(permission));
}

export function authHasAnyPermission(auth: AuthState | null, permissions: readonly AdminPermission[]): boolean {
  return permissions.some((permission) => authHasPermission(auth, permission));
}
