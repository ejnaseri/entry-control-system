import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionIdentityContract = require("../../scripts/lib/version-identity.cjs");
const buildIdentityContract = require("../../scripts/lib/build-identity.cjs");
const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const canonicalVersion = versionIdentityContract.loadVersionIdentity(path.resolve(testDirectory, "../../version.json"));
const fullBuildIdentity = buildIdentityContract.createBuildIdentity(canonicalVersion, "FULL");

export const FULL_TEST_IDENTITY = Object.freeze({
  name: "EntryControl System API",
  schemaVersion: fullBuildIdentity.schemaVersion,
  productId: fullBuildIdentity.productId,
  version: fullBuildIdentity.productVersion,
  apiVersion: fullBuildIdentity.apiVersion,
  licenseProtocolVersion: fullBuildIdentity.licenseProtocolVersion,
  buildManifestVersion: fullBuildIdentity.buildManifestVersion,
  versionIdentitySha256: fullBuildIdentity.versionIdentitySha256,
  edition: fullBuildIdentity.edition,
} as const);

export const FULL_TEST_FEATURES = [
  "ADMIN_USERS",
  "ATTENDANCE_COMPLIANCE",
  "ATTENDANCE_DAILY",
  "ATTENDANCE_DASHBOARD",
  "ATTENDANCE_EXPORT",
  "ATTENDANCE_REPORTS",
  "AUDIT_LOGS",
  "AUTH",
  "BACKUPS",
  "CUSTOMERS",
  "CUSTOMER_PAYMENTS",
  "DEVICES",
  "DEVICE_DIAGNOSTICS",
  "DOOR_CONTROL",
  "EMPLOYEES",
  "ENTRY_LOGS",
  "EXPENSES",
  "FINANCIAL_REPORTS",
  "GENERIC_DEVICE_PUSH",
  "ICLOCK_ADMS",
  "INBOX",
  "MEMBERSHIPS",
  "PAYROLL",
  "SOUNDS",
  "STAFF_GROUPS",
] as const;
