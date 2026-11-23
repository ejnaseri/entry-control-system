import assert from "node:assert/strict";
import {
  ApplicationCompatibilityError,
  assertAuthStateCompatible,
  assertPublicIdentityCompatible,
  authHasAnyPermission,
  authHasFeature,
  authHasPermission,
  createClientBuildIdentity,
  normalizeAuthPayload,
  normalizePublicApiIdentity,
  type AppEdition,
  type AuthPayload,
} from "../src/auth/authState.ts";
import { FULL_TEST_IDENTITY } from "./auth-fixtures.ts";

const SESSION_EXPIRES_AT = "2026-08-09T12:00:00.000Z";

function makePayload(edition: AppEdition = "FULL"): AuthPayload {
  return {
    edition,
    features: ["AUTH", "CUSTOMERS", "AUTH"],
    permissions: ["SIGN_IN", "MEMBERS_VIEW"],
    user: {
      id: "admin-1",
      username: "owner",
      email: null,
      fullName: "Test Owner",
      role: "GYM_OWNER",
      isActive: true,
      isProtected: false,
      lastLoginAt: null,
      passwordChangedAt: null,
      createdAt: "2026-08-09T08:00:00.000Z",
      updatedAt: "2026-08-09T08:00:00.000Z",
    },
    session: {
      id: "session-1",
      createdAt: "2026-08-09T08:00:00.000Z",
      lastSeenAt: "2026-08-09T08:30:00.000Z",
      expiresAt: SESSION_EXPIRES_AT,
    },
    expiresAt: SESSION_EXPIRES_AT,
  };
}

for (const source of ["me", "login", "setup"] as const) {
  const payload = makePayload() as AuthPayload & {
    session: AuthPayload["session"] & { tokenHash: string };
  };
  payload.session.tokenHash = "must-not-reach-client-state";
  const state = normalizeAuthPayload(payload);
  assert.equal(state.edition, "FULL", `${source} should retain edition`);
  assert.deepEqual(state.features, ["AUTH", "CUSTOMERS"], `${source} should normalize features`);
  assert.deepEqual(state.permissions, ["SIGN_IN", "MEMBERS_VIEW"], `${source} should retain permissions`);
  assert.deepEqual(state.session, {
    id: "session-1",
    createdAt: "2026-08-09T08:00:00.000Z",
    lastSeenAt: "2026-08-09T08:30:00.000Z",
    expiresAt: SESSION_EXPIRES_AT,
  });
  assert.deepEqual(Object.keys(state.session).sort(), ["createdAt", "expiresAt", "id", "lastSeenAt"]);
  assert.equal("tokenHash" in state.session, false, `${source} should drop internal session fields`);
}

const fullState = normalizeAuthPayload(makePayload());
assert.equal(authHasFeature(fullState, "CUSTOMERS"), true);
assert.equal(authHasFeature(fullState, "PAYROLL"), false);
assert.equal(authHasPermission(fullState, "MEMBERS_VIEW"), true);
assert.equal(authHasPermission(fullState, "PAYROLL_MANAGE"), false);
assert.equal(authHasAnyPermission(fullState, ["PAYROLL_MANAGE", "SIGN_IN"]), true);
assert.equal(authHasFeature(null, "AUTH"), false);
assert.equal(authHasPermission(null, "SIGN_IN"), false);
assert.equal(authHasAnyPermission(null, ["SIGN_IN"]), false);

const expectedIdentity = createClientBuildIdentity(FULL_TEST_IDENTITY);
const publicIdentity = normalizePublicApiIdentity(FULL_TEST_IDENTITY);
assert.doesNotThrow(() => assertPublicIdentityCompatible(publicIdentity, expectedIdentity));
assert.doesNotThrow(() => assertAuthStateCompatible(fullState, publicIdentity));

assert.throws(
  () =>
    assertPublicIdentityCompatible(
      normalizePublicApiIdentity({ ...FULL_TEST_IDENTITY, edition: "ATTENDANCE" }),
      expectedIdentity
    ),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError &&
    error.code === "EDITION_MISMATCH" &&
    error.message.includes("expects FULL") &&
    error.message.includes("ATTENDANCE")
);

assert.throws(
  () =>
    assertPublicIdentityCompatible(
      normalizePublicApiIdentity({ ...FULL_TEST_IDENTITY, version: "2.0.0" }),
      expectedIdentity
    ),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError &&
    error.code === "VERSION_MISMATCH" &&
    error.message.includes("expects 1.0.0") &&
    error.message.includes("2.0.0")
);

assert.throws(
  () => assertAuthStateCompatible(normalizeAuthPayload(makePayload("ATTENDANCE")), publicIdentity),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError && error.code === "AUTH_EDITION_MISMATCH"
);

const badFeaturePayload = makePayload() as AuthPayload & { features: string[] };
badFeaturePayload.features = ["AUTH", "UNKNOWN_FEATURE"];
assert.throws(
  () => normalizeAuthPayload(badFeaturePayload as AuthPayload),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError && error.code === "INVALID_AUTH_PAYLOAD"
);

const badExpiryPayload = makePayload();
badExpiryPayload.expiresAt = "2026-08-09T13:00:00.000Z";
assert.throws(
  () => normalizeAuthPayload(badExpiryPayload),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError && error.code === "INVALID_AUTH_PAYLOAD"
);

assert.throws(
  () => createClientBuildIdentity({ ...FULL_TEST_IDENTITY, edition: "full" } as never),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError && error.code === "INVALID_BUILD_IDENTITY"
);

assert.throws(
  () => normalizePublicApiIdentity({ ...FULL_TEST_IDENTITY, version: "" }),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError && error.code === "INVALID_PUBLIC_IDENTITY"
);

assert.throws(
  () =>
    assertPublicIdentityCompatible(
      normalizePublicApiIdentity({ ...FULL_TEST_IDENTITY, versionIdentitySha256: "0".repeat(64) }),
      expectedIdentity
    ),
  (error: unknown) =>
    error instanceof ApplicationCompatibilityError && error.code === "BUILD_IDENTITY_MISMATCH"
);

console.log("ok - auth state normalization, independent helpers, and exact client/server compatibility");
