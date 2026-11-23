import { createHash } from "node:crypto";
import {
  lstatSync,
  readdirSync,
  readFileSync,
} from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const protocolRoot = path.join(repositoryRoot, "licensing", "protocol", "v1");
const schemaRoot = path.join(protocolRoot, "schemas");
const corpusRoot = path.join(protocolRoot, "corpus");

const canonicalVersion = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));
versionContract.assertNodeVersion(canonicalVersion.identity);

const signedTypes = Object.freeze([
  ["activation-request", "INSTALLATION_DEVICE", 131072],
  ["lease-request", "INSTALLATION_DEVICE", 8192],
  ["key-delegation", "PROD_ROOT", 8192],
  ["key-denylist", "PROD_ROOT", 262144],
  ["entitlement", "OFFLINE_ENTITLEMENT", 16384],
  ["lease", "ONLINE_LEASE", 16384],
  ["offline-control", "OFFLINE_CONTROL", 8192],
  ["reactivation-authorization", "OFFLINE_CONTROL", 16384],
  ["recovery", "RECOVERY", 16384],
  ["time-correction", "RECOVERY", 8192],
]);

const featureValues = Object.freeze([
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
  "INBOX",
  "MEMBERSHIPS",
  "PAYROLL",
  "SOUNDS",
  "STAFF_GROUPS",
]);

const carrierSchemas = Object.freeze([
  "lease-challenge-carrier.cddl",
  "lease-response-carrier.cddl",
  "trust-bundle-carrier.cddl",
]);
const manifestName = "protocol-manifest.json";
const manifestHashName = "protocol-manifest.sha256";
const expectedProtocolManifestSha256 = "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab";
const expectedMalformedCaseCount = 224;
const maxTextBytes = 4 * 1024 * 1024;

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function exactKeys(value, expected, label) {
  assert(value && typeof value === "object" && !Array.isArray(value), `${label} must be an object.`);
  const actual = Object.keys(value).sort();
  const wanted = [...expected].sort();
  assert(
    actual.length === wanted.length && actual.every((key, index) => key === wanted[index]),
    `${label} fields differ; expected ${wanted.join(", ")}; received ${actual.join(", ")}.`
  );
}

function arraysEqual(actual, expected, label) {
  assert(Array.isArray(actual), `${label} must be an array.`);
  assert(
    actual.length === expected.length && actual.every((value, index) => value === expected[index]),
    `${label} must be exactly ${JSON.stringify(expected)}; received ${JSON.stringify(actual)}.`
  );
}

function jsonEqual(actual, expected, label) {
  assert(
    versionContract.canonicalizeJson(actual) === versionContract.canonicalizeJson(expected),
    `${label} drifted from the frozen v1 registry.`
  );
}

function isStrictlySortedUnique(values) {
  return values.every((value, index) => index === 0 || values[index - 1] < value);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function canonicalRelativePath(value, label) {
  assert(
    typeof value === "string"
      && value.length > 0
      && value.length <= 512
      && !value.includes("\\")
      && !value.includes(":")
      && !value.startsWith("/")
      && value === value.normalize("NFC"),
    `${label} is not a canonical relative path.`
  );
  assert(
    value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    `${label} contains a forbidden segment.`
  );
  return value;
}

function listFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const relativePath = path.relative(root, absolutePath).replaceAll("\\", "/");
      canonicalRelativePath(relativePath, `package path ${JSON.stringify(relativePath)}`);
      const stats = lstatSync(absolutePath);
      assert(!stats.isSymbolicLink(), `Protocol package links are forbidden: ${relativePath}.`);
      if (stats.isDirectory()) visit(absolutePath);
      else if (stats.isFile()) files.push({ absolutePath, relativePath, size: stats.size });
      else fail(`Unsupported package entry: ${relativePath}.`);
    }
  };
  visit(root);
  files.sort((left, right) => left.relativePath < right.relativePath ? -1 : left.relativePath > right.relativePath ? 1 : 0);
  const folded = new Set();
  for (const file of files) {
    const windowsName = file.relativePath.toLocaleLowerCase("en-US");
    assert(!folded.has(windowsName), `Windows case-insensitive path collision: ${file.relativePath}.`);
    folded.add(windowsName);
  }
  return files;
}

function readText(filePath, label, maximumBytes = maxTextBytes) {
  const stats = lstatSync(filePath);
  assert(stats.isFile() && !stats.isSymbolicLink(), `${label} must be a regular non-link file.`);
  assert(stats.size > 0 && stats.size <= maximumBytes, `${label} must be 1..${maximumBytes} bytes.`);
  const bytes = versionContract.readFileBounded(filePath, label, maximumBytes);
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${label} has a UTF-8 BOM.`);
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  assert(!text.includes("\r"), `${label} must use LF line endings.`);
  assert(text.endsWith("\n"), `${label} must end with one LF.`);
  assert(!/[ \t]+$/mu.test(text), `${label} contains trailing whitespace.`);
  return { bytes, text };
}

function readJson(relativePath, maximumBytes = maxTextBytes) {
  const absolutePath = path.join(protocolRoot, ...relativePath.split("/"));
  const { bytes, text } = readText(absolutePath, relativePath, maximumBytes);
  const value = versionContract.parseStrictJson(bytes, relativePath, maximumBytes);
  assert(text === `${JSON.stringify(value, null, 2)}\n`, `${relativePath} must use canonical pretty JSON formatting.`);
  return value;
}

function readRepositoryText(filePath, label, maximumBytes) {
  const bytes = versionContract.readFileBounded(filePath, label, maximumBytes);
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${label} has a UTF-8 BOM.`);
  return new TextDecoder("utf-8", { fatal: true }).decode(bytes);
}

function exactMedia(tokenType) {
  return `application/vnd.entry-control.${tokenType}+cbor;v=1`;
}

function validateRegistry() {
  const registry = readJson("protocol-registry.json", 1024 * 1024);
  exactKeys(registry, [
    "buildCompatibility",
    "carriers",
    "features",
    "issuerPolicySeconds",
    "limits",
    "messageTypes",
    "offlineControlOrigins",
    "orderingRules",
    "productId",
    "protocolVersion",
    "reasonCodes",
    "requestResponseCompatibility",
    "schemaVersion",
    "securityProfile",
    "signerPurposes",
    "technicalLifetimesSeconds",
    "validityPolicy",
    "vendorEndpoints",
  ], "protocol registry");
  assert(registry.schemaVersion === 1, "Registry schemaVersion must be 1.");
  assert(registry.protocolVersion === canonicalVersion.identity.licenseProtocolVersion, "Protocol version drifted from version.json.");
  assert(registry.productId === canonicalVersion.identity.productId, "Registry productId drifted from version.json.");

  exactKeys(registry.securityProfile, [
    "cbor",
    "coseSign1",
    "crossTypeAcceptance",
    "ecdsa",
    "installationPublicKey",
    "payloadKeyIdMustEqualProtectedKid",
    "tpmEvidenceContext",
  ], "securityProfile");
  const { cbor, coseSign1, ecdsa, installationPublicKey, tpmEvidenceContext } = registry.securityProfile;
  exactKeys(cbor, [
    "payloadMapKeyType",
    "payloadMapsClosed",
    "profile",
    "rejectDuplicateMapKeys",
    "rejectFloats",
    "rejectIndefiniteLengthItems",
    "rejectMalformedUtf8",
    "rejectNonMinimalEncoding",
    "rejectNull",
    "rejectTrailingData",
    "rejectUnknownFields",
    "signedObjectTag",
    "signedObjectTagRequired",
  ], "securityProfile.cbor");
  exactKeys(coseSign1, [
    "algorithm",
    "algorithmCoseId",
    "curve",
    "digest",
    "externalAad",
    "payloadMode",
    "protectedHeaders",
    "protectedHeadersExact",
    "signatureBytes",
    "signatureEncoding",
    "unprotectedHeaders",
    "unprotectedHeadersExact",
  ], "securityProfile.coseSign1");
  exactKeys(ecdsa, ["lowSRequired", "p256HalfOrderHex", "p256OrderHex", "rBytes", "rRange", "sBytes", "sRange"], "securityProfile.ecdsa");
  exactKeys(installationPublicKey, ["algorithmOid", "curveOid", "encoding", "pointEncoding", "spkiDerBytes"], "securityProfile.installationPublicKey");
  exactKeys(tpmEvidenceContext, ["digest", "domain", "encoding", "orderedItems"], "securityProfile.tpmEvidenceContext");
  assert(cbor.profile === "RFC8949_CORE_DETERMINISTIC" && cbor.signedObjectTag === 18 && cbor.signedObjectTagRequired, "Deterministic tagged-CBOR profile drifted.");
  for (const field of [
    "payloadMapsClosed",
    "rejectDuplicateMapKeys",
    "rejectFloats",
    "rejectIndefiniteLengthItems",
    "rejectMalformedUtf8",
    "rejectNonMinimalEncoding",
    "rejectNull",
    "rejectTrailingData",
    "rejectUnknownFields",
  ]) assert(cbor[field] === true, `securityProfile.cbor.${field} must stay true.`);
  assert(coseSign1.algorithm === "ES256" && coseSign1.algorithmCoseId === -7, "COSE algorithm drifted.");
  assert(coseSign1.curve === "P-256" && coseSign1.digest === "SHA-256", "COSE curve/digest drifted.");
  assert(coseSign1.externalAad === "EMPTY_BYTE_STRING" && coseSign1.payloadMode === "EMBEDDED", "COSE payload/AAD drifted.");
  assert(coseSign1.signatureBytes === 64 && coseSign1.signatureEncoding === "IEEE_P1363_R_CONCAT_S", "COSE signature encoding drifted.");
  assert(coseSign1.protectedHeadersExact && coseSign1.unprotectedHeadersExact, "COSE headers must remain exact.");
  exactKeys(coseSign1.protectedHeaders, ["1", "3", "4"], "protectedHeaders");
  assert(coseSign1.protectedHeaders["1"] === -7 && Object.keys(coseSign1.unprotectedHeaders).length === 0, "COSE header values drifted.");
  assert(ecdsa.lowSRequired && ecdsa.rBytes === 32 && ecdsa.sBytes === 32, "Low-S fixed-width ECDSA drifted.");
  assert(installationPublicKey.spkiDerBytes === 91 && installationPublicKey.encoding === "RFC5480_SUBJECT_PUBLIC_KEY_INFO_DER", "SPKI encoding drifted.");
  jsonEqual(cbor, {
    profile: "RFC8949_CORE_DETERMINISTIC",
    signedObjectTag: 18,
    signedObjectTagRequired: true,
    payloadMapKeyType: "TEXT",
    payloadMapsClosed: true,
    rejectDuplicateMapKeys: true,
    rejectFloats: true,
    rejectIndefiniteLengthItems: true,
    rejectMalformedUtf8: true,
    rejectNonMinimalEncoding: true,
    rejectNull: true,
    rejectTrailingData: true,
    rejectUnknownFields: true,
  }, "CBOR profile");
  jsonEqual(coseSign1, {
    algorithm: "ES256",
    algorithmCoseId: -7,
    curve: "P-256",
    digest: "SHA-256",
    externalAad: "EMPTY_BYTE_STRING",
    payloadMode: "EMBEDDED",
    protectedHeaders: { "1": -7, "3": "EXACT_MESSAGE_MEDIA_TYPE", "4": "SIGNER_KEY_ID_BSTR_32" },
    protectedHeadersExact: true,
    signatureBytes: 64,
    signatureEncoding: "IEEE_P1363_R_CONCAT_S",
    unprotectedHeaders: {},
    unprotectedHeadersExact: true,
  }, "COSE_Sign1 profile");
  jsonEqual(ecdsa, {
    lowSRequired: true,
    p256OrderHex: "ffffffff00000000ffffffffffffffffbce6faada7179e84f3b9cac2fc632551",
    p256HalfOrderHex: "7fffffff800000007fffffffffffffffde737d56d38bcf4279dce5617e3192a8",
    rBytes: 32,
    rRange: "1..P256_ORDER_MINUS_1",
    sBytes: 32,
    sRange: "1..P256_HALF_ORDER",
  }, "ECDSA profile");
  jsonEqual(installationPublicKey, {
    algorithmOid: "1.2.840.10045.2.1",
    curveOid: "1.2.840.10045.3.1.7",
    encoding: "RFC5480_SUBJECT_PUBLIC_KEY_INFO_DER",
    pointEncoding: "UNCOMPRESSED",
    spkiDerBytes: 91,
  }, "installation public-key profile");
  jsonEqual(tpmEvidenceContext, {
    digest: "SHA-256",
    domain: "ENTRY_CONTROL_SYSTEM:LICENSE:TPM_ATTESTATION_CONTEXT:V1",
    encoding: "RFC8949_CORE_DETERMINISTIC_CBOR_ARRAY",
    orderedItems: [
      "domain-tstr",
      "requestId-bstr16",
      "requestNonce-bstr32",
      "installationId-bstr16",
      "deviceKeyId-bstr32",
      "versionIdentitySha256-bstr32",
      "buildIdentitySha256-bstr32",
      "buildManifestSha256-bstr32",
    ],
  }, "TPM evidence context");
  assert(registry.securityProfile.crossTypeAcceptance === "REJECT" && registry.securityProfile.payloadKeyIdMustEqualProtectedKid, "Domain/key binding drifted.");

  const endpoints = registry.vendorEndpoints;
  exactKeys(endpoints, [
    "aliasesAllowed",
    "leaseChallenge",
    "leaseIssuance",
    "pathComparison",
    "pathIncludesAuthority",
    "pathIncludesQuery",
    "pathNormalizationAllowed",
    "zeroRttAllowed",
  ], "vendorEndpoints");
  exactKeys(endpoints.leaseChallenge, ["aliases", "maxResponseBytes", "method", "path", "responseCarrierType", "responseMediaType", "responseSchema"], "vendorEndpoints.leaseChallenge");
  exactKeys(endpoints.leaseIssuance, ["aliases", "maxResponseBytes", "method", "path", "requestMediaType", "requestTokenType", "responseCarrierType", "responseMediaType", "responseSchema", "responseTokenType"], "vendorEndpoints.leaseIssuance");
  assert(endpoints.aliasesAllowed === false && endpoints.pathNormalizationAllowed === false && endpoints.zeroRttAllowed === false, "Vendor endpoint strictness drifted.");
  assert(endpoints.leaseChallenge.method === "POST" && endpoints.leaseChallenge.path === "/v1/licensing/lease-challenges", "Challenge endpoint drifted.");
  assert(endpoints.leaseIssuance.method === "POST" && endpoints.leaseIssuance.path === "/v1/licensing/leases", "Lease endpoint drifted.");
  arraysEqual(endpoints.leaseChallenge.aliases, [], "leaseChallenge.aliases");
  arraysEqual(endpoints.leaseIssuance.aliases, [], "leaseIssuance.aliases");
  jsonEqual(endpoints, {
    aliasesAllowed: false,
    leaseChallenge: {
      aliases: [],
      maxResponseBytes: 4096,
      method: "POST",
      path: "/v1/licensing/lease-challenges",
      responseCarrierType: "lease-challenge",
      responseMediaType: "application/vnd.entry-control.lease-challenge+cbor;v=1",
      responseSchema: "schemas/lease-challenge-carrier.cddl",
    },
    leaseIssuance: {
      aliases: [],
      maxResponseBytes: 524288,
      method: "POST",
      path: "/v1/licensing/leases",
      requestMediaType: exactMedia("lease-request"),
      requestTokenType: "lease-request",
      responseCarrierType: "lease-response",
      responseMediaType: "application/vnd.entry-control.lease-response+cbor;v=1",
      responseSchema: "schemas/lease-response-carrier.cddl",
      responseTokenType: "lease",
    },
    pathComparison: "EXACT_ASCII_BYTES",
    pathIncludesAuthority: false,
    pathIncludesQuery: false,
    pathNormalizationAllowed: false,
    zeroRttAllowed: false,
  }, "Vendor endpoints");

  exactKeys(registry.limits, [
    "counterMaximumDecimal",
    "counterMinimum",
    "denylistMaximumEntries",
    "displayTextMaximumUtf8Bytes",
    "featureMaximumItems",
    "featureMinimumItems",
    "hashBytes",
    "identifierBytes",
    "keyIdBytes",
    "nonceBytes",
    "signatureBytes",
    "spkiDerBytes",
    "timestampMaximum",
    "timestampMinimum",
    "trustBundleMaximumDelegations",
  ], "limits");
  jsonEqual(registry.limits, {
    counterMaximumDecimal: "9223372036854775807",
    counterMinimum: 0,
    denylistMaximumEntries: 4096,
    displayTextMaximumUtf8Bytes: 256,
    featureMaximumItems: 23,
    featureMinimumItems: 1,
    hashBytes: 32,
    identifierBytes: 16,
    keyIdBytes: 32,
    nonceBytes: 32,
    signatureBytes: 64,
    spkiDerBytes: 91,
    trustBundleMaximumDelegations: 64,
    timestampMaximum: 253402300799,
    timestampMinimum: 0,
  }, "primitive limits");
  exactKeys(registry.orderingRules, ["denylistEntries", "features", "trustBundleDelegations"], "orderingRules");
  jsonEqual(registry.orderingRules, {
    denylistEntries: { comparison: "UNSIGNED_BYTE_LEXICOGRAPHIC", duplicates: "REJECT", sortKey: "delegatedKeyId" },
    features: { comparison: "ASCII_CODE_POINT", duplicates: "REJECT" },
    trustBundleDelegations: { comparison: "UNSIGNED_BYTE_LEXICOGRAPHIC", duplicates: "REJECT", sortKey: "delegatedKeyId" },
  }, "ordering rules");

  const policy = registry.issuerPolicySeconds;
  exactKeys(policy, [
    "businessTermMaximum",
    "clockTolerance",
    "entitlementEnvelopeMaximum",
    "hybridCheckCadence",
    "hybridLeaseWindow",
    "hybridOfflineAllowance",
    "leaseEnvelopeMaximum",
    "postTermGrace",
    "sameBootTimeRecoveryRoundTripMaximum",
    "warningLead",
  ], "issuerPolicySeconds");
  exactKeys(policy.hybridCheckCadence, ["default", "maximum", "minimum"], "issuerPolicySeconds.hybridCheckCadence");
  exactKeys(policy.hybridLeaseWindow, ["minimumOperationalRemainingSecondsExclusive", "nextCheckAtFormula", "offlineUntilFormula", "shorteningPolicy"], "issuerPolicySeconds.hybridLeaseWindow");
  exactKeys(policy.hybridOfflineAllowance, ["default", "maximum", "minimum", "minimumAdditionalSecondsBeyondCadence"], "issuerPolicySeconds.hybridOfflineAllowance");
  exactKeys(policy.postTermGrace, ["default", "maximum", "minimum"], "issuerPolicySeconds.postTermGrace");
  exactKeys(policy.warningLead, ["default", "maximum", "minimum"], "issuerPolicySeconds.warningLead");
  assert(policy.businessTermMaximum === 31622400, "Business-term maximum drifted.");
  assert(policy.clockTolerance === 300, "Clock tolerance drifted.");
  assert(policy.entitlementEnvelopeMaximum === 35424000, "Entitlement envelope maximum drifted.");
  assert(policy.leaseEnvelopeMaximum === 2592000, "Lease envelope maximum drifted.");
  assert(policy.sameBootTimeRecoveryRoundTripMaximum === 300, "Time-Recovery RTT drifted.");
  assert(policy.hybridCheckCadence.default === 21600 && policy.hybridCheckCadence.minimum === 3600 && policy.hybridCheckCadence.maximum === 86400, "Hybrid cadence policy drifted.");
  assert(policy.hybridOfflineAllowance.default === 604800 && policy.hybridOfflineAllowance.minimum === 86400 && policy.hybridOfflineAllowance.maximum === 2592000, "Hybrid allowance policy drifted.");
  assert(policy.hybridOfflineAllowance.minimumAdditionalSecondsBeyondCadence === 300, "Hybrid retry margin drifted.");
  jsonEqual(policy.hybridLeaseWindow, {
    minimumOperationalRemainingSecondsExclusive: 300,
    nextCheckAtFormula: "min(serverTime+checkCadenceSeconds,offlineUntil-300)",
    offlineUntilFormula: "min(serverTime+parent.offlineAllowanceSeconds,entitlement.notAfter,entitlement.graceUntil)",
    shorteningPolicy: "PARENT_CAP_ONLY",
  }, "Hybrid Lease window policy");
  assert(policy.warningLead.default === 604800 && policy.warningLead.minimum === 0 && policy.warningLead.maximum === 2592000, "Warning policy drifted.");
  assert(policy.postTermGrace.default === 259200 && policy.postTermGrace.minimum === 0 && policy.postTermGrace.maximum === 604800, "Grace policy drifted.");

  jsonEqual(registry.technicalLifetimesSeconds, {
    "activation-request": { basis: "notAfter-issuedAt", maximum: 2592000 },
    entitlement: { basis: "notAfter-min(issuedAt,notBefore)", businessTermMaximum: 31622400, maximum: 35424000 },
    "key-delegation": { basis: "notAfter-min(issuedAt,notBefore)", maximum: 158112000 },
    "key-denylist": { acceptedStatePersistence: "INDEFINITE_AFTER_ACCEPTANCE", basis: "notAfter-min(issuedAt,notBefore)", importWindowMaximum: 31622400 },
    lease: { basis: "notAfter-min(issuedAt,notBefore)", maximum: 2592000 },
    "lease-request": { challengeMaximum: 300 },
    "offline-control": { basis: "notAfter-min(issuedAt,notBefore)", maximum: 2592000 },
    "reactivation-authorization": { basis: "notAfter-min(issuedAt,notBefore)", maximum: 604800 },
    recovery: { basis: "notAfter-min(issuedAt,notBefore)", maximum: 86400 },
    "time-correction": { basis: "notAfter-min(issuedAt,notBefore)", maximum: 86400 },
  }, "technical lifetimes");
  jsonEqual(registry.validityPolicy, {
    activationRequest: {
      envelopeStart: "issuedAt",
      futureIssuedAtToleranceSeconds: 300,
      issuedAtReference: "VENDOR_UTC",
      issuedAtMustPrecedeNotAfter: true,
      referenceMustPrecedeNotAfter: true,
    },
    delegatedToken: {
      issuedAtWithinDelegation: true,
      validityWindowWithinDelegation: true,
    },
    offlineControl: {
      effectiveAtRelation: "notBefore<=effectiveAt<notAfter",
    },
    timeCorrection: {
      correctedUtcMustBeAtLeastPreIncidentHighWater: true,
      issuedAtMaximumAboveCorrectedUtcSeconds: 300,
      issuedAtMustBeAtLeastPreIncidentHighWater: true,
      structuralWindowStillRequired: true,
      suspectWallClockAloneMayReject: false,
    },
    timeRecoveryLease: {
      issuedAtMustEqualServerTime: true,
      validityReference: "SIGNED_SERVER_TIME",
    },
    vendorSignedObject: {
      envelopeStart: "MIN_ISSUED_AT_NOT_BEFORE",
      futureIssuedAtToleranceSeconds: 300,
      issuedAtReference: "TRUSTED_NOW",
      issuedAtMustPrecedeNotAfter: true,
      notBeforeMustPrecedeNotAfter: true,
      trustedNowMustPrecedeNotAfterAtAdmission: true,
    },
  }, "validity policy");

  exactKeys(registry.features, [
    "editionAllowed",
    "editionDisallowedClaimPolicy",
    "effectiveIntersection",
    "encoding",
    "maximumItems",
    "minimumItems",
    "neverLicenseActivatable",
    "ordering",
    "rejectDuplicates",
    "rejectUnknown",
    "values",
  ], "features");
  exactKeys(registry.features.editionAllowed, ["ATTENDANCE", "FULL"], "features.editionAllowed");
  arraysEqual(registry.features.values, featureValues, "features.values");
  assert(isStrictlySortedUnique(registry.features.values), "Feature registry must remain ASCII-sorted and unique.");
  arraysEqual(registry.features.neverLicenseActivatable, ["GENERIC_DEVICE_PUSH", "ICLOCK_ADMS"], "features.neverLicenseActivatable");
  assert(registry.features.minimumItems === 1 && registry.features.maximumItems === 23 && registry.features.rejectDuplicates && registry.features.rejectUnknown, "Feature-set constraints drifted.");
  for (const edition of ["ATTENDANCE", "FULL"]) {
    const values = registry.features.editionAllowed[edition];
    assert(isStrictlySortedUnique(values), `${edition} Features must be sorted and unique.`);
    assert(values.every((value) => featureValues.includes(value)), `${edition} contains an unknown Feature.`);
  }
  for (const forbidden of ["CUSTOMERS", "CUSTOMER_PAYMENTS", "EXPENSES", "FINANCIAL_REPORTS", "MEMBERSHIPS", "PAYROLL"]) {
    assert(!registry.features.editionAllowed.ATTENDANCE.includes(forbidden), `ATTENDANCE cannot license ${forbidden}.`);
  }
  arraysEqual(registry.features.effectiveIntersection, [
    "SIGNED_ENTITLEMENT",
    "SELECTED_EDITION",
    "PHYSICALLY_PRESENT_ARTIFACT",
    "SERVER_CODE_READY_REGISTRY",
    "EXTERNAL_OPTIONAL_FLAG",
  ], "features.effectiveIntersection");
  arraysEqual(registry.features.editionAllowed.ATTENDANCE, [
    "ADMIN_USERS",
    "ATTENDANCE_COMPLIANCE",
    "ATTENDANCE_DAILY",
    "ATTENDANCE_DASHBOARD",
    "ATTENDANCE_EXPORT",
    "ATTENDANCE_REPORTS",
    "AUDIT_LOGS",
    "AUTH",
    "BACKUPS",
    "DEVICES",
    "DEVICE_DIAGNOSTICS",
    "DOOR_CONTROL",
    "EMPLOYEES",
    "ENTRY_LOGS",
    "INBOX",
    "SOUNDS",
    "STAFF_GROUPS",
  ], "features.editionAllowed.ATTENDANCE");
  arraysEqual(registry.features.editionAllowed.FULL, featureValues, "features.editionAllowed.FULL");
  assert(registry.features.editionDisallowedClaimPolicy === "REJECT_OBJECT", "Edition-disallowed Feature policy drifted.");
  assert(registry.features.encoding === "TEXT_ARRAY" && registry.features.ordering === "STRICT_ASCII_CODE_POINT", "Feature encoding/order drifted.");

  exactKeys(registry.buildCompatibility, [
    "buildMetadataAffectsPrecedence",
    "comparison",
    "exactRequestHashClaims",
    "hashClaimEncoding",
    "maximumMajorVersionInclusive",
    "minimumProductVersionEncoding",
    "minimumProductVersionInclusive",
  ], "buildCompatibility");
  assert(registry.buildCompatibility.comparison === "SEMVER_2_PRECEDENCE", "Build comparison must be SemVer 2 precedence.");
  assert(registry.buildCompatibility.minimumProductVersionInclusive === true, "minimumProductVersion must be inclusive.");
  assert(registry.buildCompatibility.maximumMajorVersionInclusive === true, "maximumMajorVersion must be inclusive.");
  assert(registry.buildCompatibility.buildMetadataAffectsPrecedence === false, "SemVer build metadata cannot affect precedence.");
  arraysEqual(registry.buildCompatibility.exactRequestHashClaims, [
    "versionIdentitySha256",
    "buildIdentitySha256",
    "buildManifestSha256",
  ], "buildCompatibility.exactRequestHashClaims");
  assert(registry.buildCompatibility.hashClaimEncoding === "BSTR_32" && registry.buildCompatibility.minimumProductVersionEncoding === "CANONICAL_SEMVER_TEXT", "Build claim encoding drifted.");

  const expectedReasonCodes = {
    control: [[0, "NONE"], [1, "COMMERCIAL"], [2, "CUSTOMER_REQUEST"], [3, "SECURITY"], [4, "POLICY"], [5, "ADMINISTRATIVE"]],
    keyDenylist: [[1, "KEY_COMPROMISE"], [2, "KEY_RETIRED"], [3, "KEY_MISISSUANCE"]],
    recovery: [[1, "STATE_CORRUPTION"], [2, "ANCHOR_REPAIR"], [3, "KEY_LOSS"], [4, "TPM_RESET"], [5, "HARDWARE_REPLACEMENT"], [6, "OS_REINSTALL"], [7, "TAMPER_REMEDIATED"]],
    timeCorrection: [[1, "CLOCK_ROLLBACK"], [2, "CLOCK_FORWARD"]],
  };
  exactKeys(registry.reasonCodes, ["control", "keyDenylist", "recovery", "timeCorrection"], "reasonCodes");
  for (const [scope, expected] of Object.entries(expectedReasonCodes)) {
    for (const [index, entry] of registry.reasonCodes[scope].entries()) {
      exactKeys(entry, scope === "control" && index === 0 ? ["code", "name", "scope"] : ["code", "name"], `reasonCodes.${scope}[${index}]`);
    }
    const actual = registry.reasonCodes[scope].map(({ code, name }) => [code, name]);
    assert(JSON.stringify(actual) === JSON.stringify(expected), `${scope} reason-code registry drifted.`);
  }
  assert(registry.reasonCodes.control[0].scope === "CONTROL_REVISION_0_OPERATIONAL_EFFECTIVE_AT_0_ONLY", "Control reason NONE scope drifted.");

  jsonEqual(registry.offlineControlOrigins, {
    REQUEST_BOUND: { requestBinding: "REQUIRED_CONTROL_ACTIVATION_REQUEST" },
    VENDOR_INITIATED: { requestBinding: "FORBIDDEN" },
  }, "Offline Control origins");
  const expectedCompatibility = [
    { requestTokenType: "activation-request", requestPurpose: "ACTIVATE", requestBoundResponseTokenTypes: ["entitlement"], responseConstraint: "INITIAL_ENTITLEMENT" },
    { requestTokenType: "activation-request", requestPurpose: "RENEW", requestBoundResponseTokenTypes: ["entitlement"], responseConstraint: "CHAINED_RENEWAL_ENTITLEMENT" },
    { requestTokenType: "activation-request", requestPurpose: "CONTROL", requestBoundResponseTokenTypes: ["offline-control"], responseConstraint: "REQUEST_BOUND_MATCHING_CONTROL" },
    { requestTokenType: "activation-request", requestPurpose: "RECOVER", requestBoundResponseTokenTypes: ["recovery"], responseConstraint: "CLEAR_OR_REPAIR_RECOVERY" },
    { requestTokenType: "activation-request", requestPurpose: "REBIND", requestBoundResponseTokenTypes: ["recovery"], responseConstraint: "DEVICE_REBIND_RECOVERY" },
    { requestTokenType: "activation-request", requestPurpose: "REACTIVATE", requestBoundResponseTokenTypes: ["reactivation-authorization", "entitlement"], responseConstraint: "ATOMIC_NEW_LINEAGE_PAIR" },
    { requestTokenType: "activation-request", requestPurpose: "TIME_CORRECT", requestBoundResponseTokenTypes: ["time-correction"], responseConstraint: "OFFLINE_TIME_CORRECTION" },
    {
      requestTokenType: "lease-request",
      requestPurpose: "CHECK_IN",
      requestBoundResponseTokenTypes: ["lease"],
      transportedAsyncTokenTypes: ["key-delegation", "key-denylist", "offline-control", "reactivation-authorization"],
      primaryResponseRequired: false,
      responseConstraint: "ORDINARY_HYBRID_LEASE",
    },
    {
      requestTokenType: "lease-request",
      requestPurpose: "TIME_RECOVERY",
      requestBoundResponseTokenTypes: ["lease"],
      transportedAsyncTokenTypes: ["offline-control", "reactivation-authorization"],
      forbiddenTransportedTokenTypes: ["key-delegation", "key-denylist"],
      primaryResponseRequired: true,
      responseConstraint: "SAME_BOOT_TIME_RECOVERY_LEASE",
    },
  ];
  assert(registry.requestResponseCompatibility.length === expectedCompatibility.length, "Request/response purpose matrix count drifted.");
  for (const [index, entry] of registry.requestResponseCompatibility.entries()) {
    exactKeys(entry, Object.keys(expectedCompatibility[index]), `requestResponseCompatibility[${index}]`);
  }
  jsonEqual(registry.requestResponseCompatibility, expectedCompatibility, "request/response purpose matrix");

  const expectedMessageTypes = [
    { registryOrder: 1, tokenType: "activation-request", mediaType: exactMedia("activation-request"), schema: "schemas/activation-request.cddl", signerPurpose: "INSTALLATION_DEVICE", carriers: ["ECSREQ_FILE"], maxEncodedBytes: 131072, lifetime: "activation-request" },
    { registryOrder: 2, tokenType: "lease-request", mediaType: exactMedia("lease-request"), schema: "schemas/lease-request.cddl", signerPurpose: "INSTALLATION_DEVICE", carriers: ["VENDOR_HTTPS_REQUEST"], maxEncodedBytes: 8192, http: { challengeMethod: "POST", challengePath: "/v1/licensing/lease-challenges", method: "POST", path: "/v1/licensing/leases" }, lifetime: "lease-request" },
    { registryOrder: 3, tokenType: "key-delegation", mediaType: exactMedia("key-delegation"), schema: "schemas/key-delegation.cddl", signerPurpose: "PROD_ROOT", carriers: ["ECSTRUST_FILE", "SIGNED_APPLICATION_UPDATE", "VENDOR_HTTPS_RESPONSE"], maxEncodedBytes: 8192, lifetime: "key-delegation" },
    { registryOrder: 4, tokenType: "key-denylist", mediaType: exactMedia("key-denylist"), schema: "schemas/key-denylist.cddl", signerPurpose: "PROD_ROOT", carriers: ["ECSTRUST_FILE", "SIGNED_APPLICATION_UPDATE", "VENDOR_HTTPS_RESPONSE"], maxEncodedBytes: 262144, maximumEntries: 4096, lifetime: "key-denylist" },
    { registryOrder: 5, tokenType: "entitlement", mediaType: exactMedia("entitlement"), schema: "schemas/entitlement.cddl", signerPurpose: "OFFLINE_ENTITLEMENT", carriers: ["ECSLIC_FILE"], maxEncodedBytes: 16384, lifetime: "entitlement" },
    { registryOrder: 6, tokenType: "lease", mediaType: exactMedia("lease"), schema: "schemas/lease.cddl", signerPurpose: "ONLINE_LEASE", carriers: ["VENDOR_HTTPS_RESPONSE"], maxEncodedBytes: 16384, httpResponseFor: "/v1/licensing/leases", lifetime: "lease" },
    { registryOrder: 7, tokenType: "offline-control", mediaType: exactMedia("offline-control"), schema: "schemas/offline-control.cddl", signerPurpose: "OFFLINE_CONTROL", carriers: ["ECSCTL_FILE", "VENDOR_HTTPS_RESPONSE"], maxEncodedBytes: 8192, lifetime: "offline-control" },
    { registryOrder: 8, tokenType: "reactivation-authorization", mediaType: exactMedia("reactivation-authorization"), schema: "schemas/reactivation-authorization.cddl", signerPurpose: "OFFLINE_CONTROL", carriers: ["ECSCTL_FILE", "VENDOR_HTTPS_RESPONSE"], maxEncodedBytes: 16384, lifetime: "reactivation-authorization" },
    { registryOrder: 9, tokenType: "recovery", mediaType: exactMedia("recovery"), schema: "schemas/recovery.cddl", signerPurpose: "RECOVERY", carriers: ["ECSREC_FILE"], maxEncodedBytes: 16384, lifetime: "recovery" },
    { registryOrder: 10, tokenType: "time-correction", mediaType: exactMedia("time-correction"), schema: "schemas/time-correction.cddl", signerPurpose: "RECOVERY", carriers: ["ECSREC_FILE"], maxEncodedBytes: 8192, lifetime: "time-correction" },
  ];
  jsonEqual(registry.messageTypes, expectedMessageTypes, "message-type registry");

  const expectedSigners = [
    { purpose: "INSTALLATION_DEVICE", authority: "INSTALLATION", maySign: ["activation-request", "lease-request"] },
    { purpose: "OFFLINE_CONTROL", authority: "VENDOR_OFFLINE", maySign: ["offline-control", "reactivation-authorization"] },
    { purpose: "OFFLINE_ENTITLEMENT", authority: "VENDOR_OFFLINE", maySign: ["entitlement"] },
    { purpose: "ONLINE_LEASE", authority: "VENDOR_ONLINE_HSM_KMS", maySign: ["lease"] },
    { purpose: "PROD_ROOT", authority: "VENDOR_OFFLINE_ROOT", maySign: ["key-delegation", "key-denylist"] },
    { purpose: "RECOVERY", authority: "VENDOR_SEPARATE_NORMALLY_OFFLINE", maySign: ["recovery", "time-correction"] },
  ];
  jsonEqual(registry.signerPurposes, expectedSigners, "signer-purpose registry");

  const expectedCarriers = [
    { id: "ECSCTL_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecsctl", kind: "FILE", tokenTypes: ["offline-control", "reactivation-authorization"] },
    { id: "ECSLIC_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecslic", kind: "FILE", tokenTypes: ["entitlement"] },
    { id: "ECSREC_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecsrec", kind: "FILE", tokenTypes: ["recovery", "time-correction"] },
    { id: "ECSREQ_FILE", direction: "INSTALLATION_TO_VENDOR", extension: ".ecsreq", kind: "FILE", tokenTypes: ["activation-request"] },
    { id: "ECSTRUST_FILE", direction: "VENDOR_TO_INSTALLATION", extension: ".ecstrust", kind: "FILE", maxEncodedBytes: 1048576, mediaType: "application/vnd.entry-control.trust-bundle+cbor;v=1", schema: "schemas/trust-bundle-carrier.cddl", tokenTypes: ["key-delegation", "key-denylist"] },
    { id: "SIGNED_APPLICATION_UPDATE", direction: "VENDOR_TO_INSTALLATION", kind: "SIGNED_UPDATE", tokenTypes: ["key-delegation", "key-denylist"] },
    { id: "VENDOR_HTTPS_REQUEST", direction: "INSTALLATION_TO_VENDOR", kind: "HTTPS_REQUEST", mediaType: exactMedia("lease-request"), tokenTypes: ["lease-request"] },
    { id: "VENDOR_HTTPS_RESPONSE", direction: "VENDOR_TO_INSTALLATION", kind: "HTTPS_RESPONSE", maxEncodedBytes: 524288, mediaType: "application/vnd.entry-control.lease-response+cbor;v=1", schema: "schemas/lease-response-carrier.cddl", tokenTypes: ["key-delegation", "key-denylist", "lease", "offline-control", "reactivation-authorization"] },
  ];
  jsonEqual(registry.carriers, expectedCarriers, "carrier registry");

  return registry;
}

function validateCddl(registry) {
  const actualNames = readdirSync(schemaRoot).sort();
  const expectedNames = [...signedTypes.map(([tokenType]) => `${tokenType}.cddl`), ...carrierSchemas].sort();
  arraysEqual(actualNames, expectedNames, "CDDL file inventory");

  for (const [tokenType] of signedTypes) {
    const fileName = `${tokenType}.cddl`;
    const { text } = readText(path.join(schemaRoot, fileName), `schemas/${fileName}`, 128 * 1024);
    assert(text.includes(`${tokenType} = #6.18([`), `${fileName} must have a mandatory tag-18 root.`);
    assert(text.includes(`protected: bstr .cbor ${tokenType}-protected`), `${fileName} must embed its protected map.`);
    assert(text.includes("unprotected: {}"), `${fileName} must require an empty unprotected map.`);
    assert(text.includes("payload: bstr .cbor"), `${fileName} must require an embedded typed payload.`);
    assert(text.includes("signature: bstr .size 64"), `${fileName} must require a raw 64-byte signature.`);
    assert(text.includes(`3: "${exactMedia(tokenType)}"`), `${fileName} media type drifted.`);
    assert(text.includes(`"protocolVersion": 1`) && text.includes(`"tokenType": "${tokenType}"`), `${fileName} payload domain drifted.`);
    assert(text.includes(`"keyId": key-id`), `${fileName} must carry signer keyId.`);
    assert(!/^\s*(?:import|include)\b/mu.test(text), `${fileName} must be self-contained.`);
    assert(!/\bany\b/u.test(text), `${fileName} cannot contain an open any-type escape.`);
    assert(!text.includes("#6.18([\n  protected: bstr,"), `${fileName} protected map must be typed.`);
    const protectedMatch = text.match(new RegExp(`${tokenType}-protected = \\{([\\s\\S]*?)\\n\\}`));
    assert(protectedMatch, `${fileName} protected-map rule is missing.`);
    const labels = [...protectedMatch[1].matchAll(/^\s*(\d+):/gmu)].map((match) => Number(match[1]));
    arraysEqual(labels, [1, 3, 4], `${fileName} protected header labels`);
  }

  for (const fileName of carrierSchemas) {
    const { text } = readText(path.join(schemaRoot, fileName), `schemas/${fileName}`, 128 * 1024);
    const rootName = fileName.slice(0, -".cddl".length);
    assert(text.includes(`${rootName} =`), `${fileName} root rule is missing.`);
    assert(!/^\s*(?:import|include)\b/mu.test(text), `${fileName} must be self-contained.`);
    assert(!/\bany\b/u.test(text), `${fileName} cannot contain an open any-type escape.`);
  }

  for (const tokenType of ["entitlement", "lease", "reactivation-authorization", "recovery"]) {
    const text = readText(path.join(schemaRoot, `${tokenType}.cddl`), `schemas/${tokenType}.cddl`, 128 * 1024).text;
    const featureBlock = text.match(/feature =([\s\S]*?)\n\nedition =/u);
    assert(featureBlock, `${tokenType}.cddl Feature rule is missing.`);
    const values = [...featureBlock[1].matchAll(/"([A-Z][A-Z0-9_]*)"/gu)].map((match) => match[1]);
    arraysEqual(values, featureValues, `${tokenType}.cddl Feature values`);
  }

  const entitlement = readText(path.join(schemaRoot, "entitlement.cddl"), "schemas/entitlement.cddl", 128 * 1024).text;
  assert(entitlement.includes(`"minimumProductVersion": semver-text`), "Entitlement minimumProductVersion is missing.");
  assert(entitlement.includes(`"maximumMajorVersion":`), "Entitlement maximumMajorVersion is missing.");
  assert(entitlement.includes(`"offlineAllowanceSeconds": 86400..2592000`), "Entitlement Hybrid allowance range drifted.");
  assert(entitlement.includes(`"checkCadenceSeconds": 3600..86400`), "Entitlement Hybrid cadence range drifted.");
  assert(entitlement.includes(`"timeRecoveryRttSeconds": 300`), "Entitlement Time-Recovery RTT drifted.");
  assert(entitlement.includes(`"clockToleranceSeconds": 300`), "Entitlement clock tolerance drifted.");

  const leaseRequest = readText(path.join(schemaRoot, "lease-request.cddl"), "schemas/lease-request.cddl", 128 * 1024).text;
  assert(leaseRequest.includes(`"httpMethod": "POST"`) && leaseRequest.includes(`"httpPath": "/v1/licensing/leases"`), "Signed Lease method/path drifted.");
  for (const claim of registry.buildCompatibility.exactRequestHashClaims) {
    assert(leaseRequest.includes(`"${claim}": sha-256`), `Lease request is missing ${claim}.`);
  }
  assert(leaseRequest.includes(`? "bindingRecoveryTokenId": opaque-id`), "Lease request must carry the conditional durable Rebind reference.");

  const initialControlTuple = [
    `"controlRevision" => 0,`,
    `"controlState" => "OPERATIONAL",`,
    `"controlEffectiveAt" => 0,`,
    `"controlReasonCode" => 0`,
  ].join("\n  ");
  const advancedLeaseRequestControlTuple = [
    `"controlRevision" => positive-counter,`,
    `"controlState" => control-state,`,
    `"controlEffectiveAt" => utc-second,`,
    `"controlReasonCode" => 1..5`,
  ].join("\n  ");
  assert(leaseRequest.includes(initialControlTuple) && leaseRequest.includes(advancedLeaseRequestControlTuple), "Lease-request Control tuple invariant drifted.");

  const lease = readText(path.join(schemaRoot, "lease.cddl"), "schemas/lease.cddl", 128 * 1024).text;
  const advancedLeaseControlTuple = [
    `"controlRevision" => positive-counter,`,
    `"controlState" => lease-control-state,`,
    `"controlEffectiveAt" => utc-second,`,
    `"controlReasonCode" => 1..5`,
  ].join("\n  ");
  assert(lease.includes(initialControlTuple) && lease.includes(advancedLeaseControlTuple), "Lease Control tuple invariant drifted.");
  assert(lease.includes(`? "bindingRecoveryTokenId": opaque-id`), "Lease must carry the conditional durable Rebind reference.");

  const activationRequest = readText(path.join(schemaRoot, "activation-request.cddl"), "schemas/activation-request.cddl", 128 * 1024).text;
  for (const purpose of ["ACTIVATE", "RENEW", "CONTROL", "RECOVER", "REBIND", "REACTIVATE", "TIME_CORRECT"]) {
    assert(activationRequest.includes(`"requestPurpose": "${purpose}"`), `Activation request purpose ${purpose} is missing.`);
  }
  assert(activationRequest.includes(`"controlAction": control-action`) && activationRequest.includes(`control-reason-code = 1..5`), "CONTROL request action/reason contract drifted.");
  assert(activationRequest.includes(`"entitlementTokenId": opaque-id`) && !activationRequest.includes("previousTokenId"), "RENEW must have one unambiguous predecessor reference.");
  assert(activationRequest.includes(`"oldDeviceKeyId": key-id`), "REBIND request old-device reference is missing.");
  assert(activationRequest.includes([`"controlRevision" => 0,`, `"controlState" => "OPERATIONAL"`].join("\n  "))
    && activationRequest.includes([`"controlRevision" => positive-counter,`, `"controlState" => control-state`].join("\n  ")),
  "Activation-request current Control snapshot invariant drifted.");

  const offlineControl = readText(path.join(schemaRoot, "offline-control.cddl"), "schemas/offline-control.cddl", 128 * 1024).text;
  assert(offlineControl.includes(`"origin" => "VENDOR_INITIATED"`) && offlineControl.includes(`"origin" => "REQUEST_BOUND"`), "Offline Control origin union drifted.");
  assert(offlineControl.includes(`"requestId": opaque-id`) && offlineControl.includes(`"requestHash": sha-256`), "Request-bound Offline Control binding is incomplete.");
  assert(offlineControl.includes(`control-action = "SUSPEND" / "UNSUSPEND" / "REVOKE"`) && offlineControl.includes(`control-reason-code = 1..5`), "Offline Control action/reason domain drifted.");

  const leaseResponse = readText(path.join(schemaRoot, "lease-response-carrier.cddl"), "schemas/lease-response-carrier.cddl", 128 * 1024).text;
  assert(leaseResponse.includes("lease-response-with-lease /") && leaseResponse.includes("lease-response-control-only /") && leaseResponse.includes("lease-response-reactivation-only"), "Lease response carrier branches drifted.");
  assert(leaseResponse.includes(`"lease": lease-bytes`) && leaseResponse.includes(`? "trustBundle": online-trust-bundle-bytes`), "Lease response embedded-object contract drifted.");
  assert(leaseResponse.includes(`"delegations": [1*64 key-delegation-bytes]`) && leaseResponse.includes(`"denylist": key-denylist-bytes`), "Online trust carrier bounds drifted.");

  const trustBundle = readText(path.join(schemaRoot, "trust-bundle-carrier.cddl"), "schemas/trust-bundle-carrier.cddl", 128 * 1024).text;
  assert(trustBundle.includes(`"delegations": [1*64 key-delegation-bytes]`) && trustBundle.includes(`"denylist": key-denylist-bytes`), "Trust-bundle exact contents drifted.");
}

function validateMalformedCorpus(registry) {
  const corpus = readJson("corpus/malformed-cases.json");
  exactKeys(corpus, ["cases", "corpusKind", "expectedCaseCount", "protocolVersion", "schemaVersion", "signedTypes"], "malformed corpus");
  assert(corpus.schemaVersion === 1 && corpus.protocolVersion === 1, "Malformed corpus version drifted.");
  assert(corpus.corpusKind === "descriptor-based-negative-corpus", "Malformed corpus kind drifted.");
  assert(corpus.expectedCaseCount === expectedMalformedCaseCount && corpus.cases.length === expectedMalformedCaseCount, `Malformed corpus must contain exactly ${expectedMalformedCaseCount} descriptors.`);
  arraysEqual(corpus.signedTypes.map(({ name }) => name), signedTypes.map(([name]) => name), "malformed signed types");
  for (const [index, entry] of corpus.signedTypes.entries()) {
    exactKeys(entry, ["maximumCoseBytes", "mediaType", "name"], `malformed signedTypes[${index}]`);
    assert(entry.mediaType === registry.messageTypes[index].mediaType, `${entry.name} malformed media drifted.`);
    assert(entry.maximumCoseBytes === registry.messageTypes[index].maxEncodedBytes, `${entry.name} malformed byte cap drifted.`);
  }

  const registryOrder = new Map(signedTypes.map(([name], index) => [name, index]));
  const fieldsByType = new Map(signedTypes.map(([tokenType]) => {
    const text = readText(path.join(schemaRoot, `${tokenType}.cddl`), `schemas/${tokenType}.cddl`, 128 * 1024).text;
    const fields = new Set([...text.matchAll(/^\s*(?:\?\s*)?"([A-Za-z][A-Za-z0-9]*)"\s*(?::|=>)/gmu)].map((match) => match[1]));
    return [tokenType, fields];
  }));
  const pathRoot = (value) => {
    assert(typeof value === "string" && value.length > 0, "Corpus target path must be a non-empty string.");
    const withoutPayload = value.startsWith("payload.") ? value.slice("payload.".length) : value;
    return withoutPayload.split(/[.[]/u)[0];
  };
  const assertKnownPayloadPath = (tokenType, value, label) => {
    const root = pathRoot(value);
    assert(fieldsByType.get(tokenType).has(root), `${label} references missing ${tokenType} payload field ${root}.`);
  };
  const allowedStages = new Set(["PRE_DECODE", "CBOR_PARSE", "COSE_PARSE", "SCHEMA", "DOMAIN", "SIGNATURE", "TRUST", "CLAIMS", "STATE"]);
  const existingFieldOperations = new Set([
    "duplicatePayloadMapKey",
    "orderDeniedKeysAgainstUnsignedByteLexicographicOrder",
    "removeConditionalField",
    "removePayloadField",
    "replaceConditionalField",
    "replaceControlTupleField",
    "replaceNestedHash",
    "replacePayloadField",
    "setPayloadField",
    "setPayloadFieldBelowSealedHighWater",
    "tagPayloadClaim",
  ]);
  const ids = new Set();
  const requiredCategories = ["missing-required", "unknown-field", "wrong-type", "oversize"];
  for (const descriptor of corpus.cases) {
    exactKeys(descriptor, ["category", "expected", "id", "mutation", "types"], descriptor.id ?? "malformed descriptor");
    assert(typeof descriptor.id === "string" && /^MAL_[A-Z0-9_]+$/u.test(descriptor.id), `Invalid malformed descriptor ID ${descriptor.id}.`);
    assert(!ids.has(descriptor.id), `Duplicate malformed descriptor ID ${descriptor.id}.`);
    ids.add(descriptor.id);
    assert(Array.isArray(descriptor.types) && descriptor.types.length > 0, `${descriptor.id} must target at least one type.`);
    assert(descriptor.types.every((type) => signedTypes.some(([name]) => name === type)), `${descriptor.id} targets an unknown type.`);
    assert(new Set(descriptor.types).size === descriptor.types.length, `${descriptor.id} repeats a target type.`);
    assert(descriptor.types.every((type, index) => index === 0 || registryOrder.get(descriptor.types[index - 1]) < registryOrder.get(type)), `${descriptor.id} target types must follow registry order.`);
    assert(typeof descriptor.category === "string" && /^[a-z][a-z0-9-]*$/u.test(descriptor.category), `${descriptor.id} category is invalid.`);
    assert(descriptor.mutation && !Array.isArray(descriptor.mutation) && typeof descriptor.mutation.operation === "string" && /^[a-z][A-Za-z0-9]+$/u.test(descriptor.mutation.operation), `${descriptor.id} mutation is incomplete.`);
    exactKeys(descriptor.expected, ["authoritativeStateChanged", "decision", "errorCode", "requestConsumed", "stage"], `${descriptor.id}.expected`);
    assert(descriptor.expected?.decision === "REJECT", `${descriptor.id} must reject.`);
    assert(allowedStages.has(descriptor.expected.stage), `${descriptor.id} has unknown rejection stage ${descriptor.expected.stage}.`);
    assert(typeof descriptor.expected.errorCode === "string" && /^[A-Z][A-Z0-9_]*$/u.test(descriptor.expected.errorCode), `${descriptor.id} has an invalid stable error code.`);
    assert(descriptor.expected.authoritativeStateChanged === false, `${descriptor.id} must not change state.`);
    assert(descriptor.expected.requestConsumed === false, `${descriptor.id} must not consume a request.`);

    if (typeof descriptor.mutation.field === "string") {
      if (descriptor.mutation.operation === "addPayloadField") {
        for (const tokenType of descriptor.types) {
          assert(!fieldsByType.get(tokenType).has(pathRoot(descriptor.mutation.field)), `${descriptor.id} addPayloadField target already exists in ${tokenType}.`);
        }
      } else if (descriptor.mutation.operation === "addNestedField") {
        for (const tokenType of descriptor.types) assertKnownPayloadPath(tokenType, descriptor.mutation.path, descriptor.id);
      } else if (existingFieldOperations.has(descriptor.mutation.operation)) {
        for (const tokenType of descriptor.types) assertKnownPayloadPath(tokenType, descriptor.mutation.field, descriptor.id);
      }
    }
    for (const mapName of ["targetByType", "targetPathByType"]) {
      const targetMap = descriptor.mutation[mapName];
      if (!targetMap) continue;
      exactKeys(targetMap, descriptor.types, `${descriptor.id}.${mapName}`);
      for (const tokenType of descriptor.types) {
        const target = targetMap[tokenType];
        const targetPath = typeof target === "string" ? target : target?.path;
        assertKnownPayloadPath(tokenType, targetPath, `${descriptor.id}.${mapName}.${tokenType}`);
      }
    }
  }
  for (const [tokenType] of signedTypes) {
    for (const category of requiredCategories) {
      const matches = corpus.cases.filter((entry) => entry.types.length === 1 && entry.types[0] === tokenType && entry.category === category);
      assert(matches.length === 1, `${tokenType} needs exactly one explicit ${category} descriptor.`);
    }
  }
  for (const category of ["cbor", "cose", "crypto", "binding", "policy", "replay", "rollback", "atomicity", "lifecycle", "time", "transition"]) {
    assert(corpus.cases.some((entry) => entry.category === category), `Malformed corpus is missing ${category} coverage.`);
  }
  const requiredClosureCases = new Map([
    ["MAL_COMMON_WRONG_PURPOSE_SIGNER", ["TRUST", "WRONG_SIGNING_KEY_PURPOSE"]],
    ["MAL_COMMON_DENIED_SIGNER", ["TRUST", "SIGNING_KEY_DENIED"]],
    ["MAL_COMMON_EXPIRED_DELEGATION", ["TRUST", "SIGNING_KEY_DELEGATION_EXPIRED"]],
    ["MAL_COMMON_WRONG_ENVIRONMENT", ["TRUST", "SIGNING_KEY_ENVIRONMENT_MISMATCH"]],
    ["MAL_COMMON_UNKNOWN_SIGNER", ["SIGNATURE", "UNKNOWN_SIGNING_KEY"]],
    ["MAL_ACTIVATION_REQUEST_CONTROL_REASON_ZERO", ["SCHEMA", "CONTROL_REASON_CODE_INVALID"]],
    ["MAL_ACTIVATION_REQUEST_CONTROL_REVISION_ZERO_NON_OPERATIONAL", ["SCHEMA", "INVALID_CONTROL_SNAPSHOT"]],
    ["MAL_LEASE_CONTROL_REASON_ZERO_NON_INITIAL_TUPLE", ["SCHEMA", "INVALID_CONTROL_TUPLE"]],
    ["MAL_LEASE_REQUEST_CONTROL_REASON_ZERO_WITH_POSITIVE_REVISION", ["SCHEMA", "INVALID_CONTROL_TUPLE"]],
    ["MAL_LEASE_OFFLINE_UNTIL_BELOW_EXACT_MINIMUM", ["CLAIMS", "LEASE_OFFLINE_UNTIL_FORMULA_MISMATCH"]],
    ["MAL_LEASE_OPERATIONAL_REMAINING_WINDOW_AT_TOLERANCE", ["CLAIMS", "LEASE_OPERATIONAL_WINDOW_TOO_SHORT"]],
    ["MAL_LEASE_RESPONSE_TIME_RECOVERY_PRIMARY_LEASE_MISSING", ["CLAIMS", "TIME_RECOVERY_PRIMARY_LEASE_REQUIRED"]],
    ["MAL_LEASE_RESPONSE_TIME_RECOVERY_TRUST_BUNDLE_FORBIDDEN", ["CLAIMS", "TIME_RECOVERY_TRUST_UPDATE_FORBIDDEN"]],
    ["MAL_TIME_CORRECTION_ISSUED_AT_ABOVE_CORRECTED_UTC_TOLERANCE", ["CLAIMS", "TIME_CORRECTION_ISSUED_AT_AFTER_CORRECTED_TOLERANCE"]],
    ["MAL_TIME_RECOVERY_LEASE_ISSUED_AT_SERVER_TIME_MISMATCH", ["CLAIMS", "TIME_RECOVERY_ISSUED_AT_SERVER_TIME_MISMATCH"]],
    ["MAL_ACTIVATION_REQUEST_VENDOR_UTC_AT_NOT_AFTER", ["CLAIMS", "ACTIVATION_REQUEST_EXPIRED"]],
    ["MAL_ORDINARY_VENDOR_TOKEN_TRUSTED_NOW_AT_NOT_AFTER", ["CLAIMS", "TOKEN_EXPIRED_AT_ADMISSION"]],
  ]);
  for (const [id, [stage, errorCode]] of requiredClosureCases) {
    const descriptor = corpus.cases.find((entry) => entry.id === id);
    assert(descriptor, `Required closure descriptor ${id} is missing.`);
    assert(descriptor.expected.stage === stage && descriptor.expected.errorCode === errorCode, `${id} rejection contract drifted.`);
  }
  const delegatedVendorTokenTypes = ["entitlement", "lease", "offline-control", "reactivation-authorization", "recovery", "time-correction"];
  // LIC-CHG-0011: registration metadata is not an activation PoP input.
  const registeredSignerTypes = signedTypes.map(([type]) => type).filter((type) => type !== "activation-request");
  for (const id of ["MAL_COMMON_UNKNOWN_SIGNER", "MAL_COMMON_WRONG_PURPOSE_SIGNER", "MAL_COMMON_WRONG_ENVIRONMENT", "MAL_COMMON_KEY_ID_SPKI_COLLISION"]) {
    const descriptor = corpus.cases.find((entry) => entry.id === id);
    arraysEqual(descriptor?.types, registeredSignerTypes, `${id} registered signer applicability`);
  }
  const recoveryWrongType = corpus.cases.find((entry) => entry.id === "MAL_RECOVERY_WRONG_TYPE");
  jsonEqual(recoveryWrongType?.mutation, {
    operation: "replacePayloadField", field: "expectedStateGeneration", valueDescriptor: "text",
  }, "Recovery wrong-type erratum");
  assert(recoveryWrongType.expected.stage === "SCHEMA" && recoveryWrongType.expected.errorCode === "WRONG_FIELD_TYPE", "Recovery text rejection drifted.");
  const negativeCounter = corpus.cases.find((entry) => entry.id === "MAL_COMMON_NEGATIVE_COUNTER");
  assert(negativeCounter?.types.includes("recovery") && negativeCounter.expected.errorCode === "COUNTER_OUT_OF_RANGE", "Recovery negative-counter coverage must remain.");
  assert(corpus.cases.reduce((count, entry) => count + entry.types.length, 0) === 744, "Erratum malformed expansion count must remain 744.");
  for (const id of ["MAL_COMMON_DENIED_SIGNER", "MAL_COMMON_EXPIRED_DELEGATION"]) {
    const descriptor = corpus.cases.find((entry) => entry.id === id);
    arraysEqual(descriptor?.types, delegatedVendorTokenTypes, `${id} applicable delegated-token types`);
  }
  const unsortedSet = corpus.cases.find((entry) => entry.id === "MAL_COMMON_UNSORTED_SET");
  arraysEqual(unsortedSet?.types, ["entitlement", "lease", "reactivation-authorization", "recovery"], "MAL_COMMON_UNSORTED_SET applicable Feature-set types");
  assert(!Object.hasOwn(unsortedSet.mutation.targetPathByType, "key-denylist"), "Generic unsorted-set case must not conflict with the dedicated Denylist ordering contract.");
  const denylistOrder = corpus.cases.find((entry) => entry.id === "MAL_KEY_DENYLIST_ENTRY_UNSIGNED_BYTE_ORDER");
  arraysEqual(denylistOrder?.types, ["key-denylist"], "dedicated Denylist ordering types");
  assert(denylistOrder.expected.stage === "CLAIMS" && denylistOrder.expected.errorCode === "DENYLIST_ENTRY_ORDER_INVALID", "Dedicated Denylist ordering contract drifted.");
  const structurallyRejectedCaseIds = [
    "MAL_ACTIVATION_REQUEST_TPM_EVIDENCE_MISSING",
    "MAL_ACTIVATION_REQUEST_TPM_EVIDENCE_ON_SOFTWARE",
    "MAL_ACTIVATION_REQUEST_PURPOSE_FIELDS_MISSING",
    "MAL_ACTIVATION_REQUEST_PURPOSE_FIELDS_LEAK",
    "MAL_LEASE_REQUEST_METHOD_NOT_POST",
    "MAL_LEASE_REQUEST_PATH_TRAILING_SLASH",
    "MAL_LEASE_REQUEST_PATH_QUERY",
    "MAL_LEASE_REQUEST_TIME_RECOVERY_INCIDENT_MISSING",
    "MAL_KEY_DELEGATION_WRONG_CURVE",
    "MAL_KEY_DELEGATION_PURPOSE_LIMIT_TOO_WIDE",
    "MAL_ENTITLEMENT_WARNING_OUT_OF_RANGE",
    "MAL_ENTITLEMENT_GRACE_OUT_OF_RANGE",
    "MAL_ENTITLEMENT_HYBRID_POLICY_MISSING",
    "MAL_ENTITLEMENT_OFFLINE_HAS_HYBRID_POLICY",
    "MAL_ENTITLEMENT_CADENCE_OUT_OF_RANGE",
    "MAL_ENTITLEMENT_ALLOWANCE_OUT_OF_RANGE",
    "MAL_LEASE_TERMINAL_REVOKE_BY_ONLINE_KEY",
    "MAL_RECOVERY_REBIND_FIELDS_MISSING",
    "MAL_RECOVERY_NON_REBIND_HAS_DEVICE_OVERRIDE",
    "MAL_ACTIVATION_REQUEST_CONTROL_ACTION_MISSING",
    "MAL_ACTIVATION_REQUEST_CONTROL_ACTION_INVALID",
    "MAL_OFFLINE_CONTROL_REQUEST_BOUND_BINDING_MISSING",
    "MAL_OFFLINE_CONTROL_VENDOR_INITIATED_BINDING_LEAK",
  ];
  for (const id of structurallyRejectedCaseIds) {
    const descriptor = corpus.cases.find((entry) => entry.id === id);
    assert(descriptor?.expected.stage === "SCHEMA", `${id} must stop at the exact CDDL schema stage.`);
  }
  const stageCounts = Object.fromEntries([...allowedStages].map((stage) => [stage, corpus.cases.filter((entry) => entry.expected.stage === stage).length]));
  jsonEqual(stageCounts, {
    PRE_DECODE: 10,
    CBOR_PARSE: 12,
    COSE_PARSE: 15,
    SCHEMA: 71,
    DOMAIN: 5,
    SIGNATURE: 11,
    TRUST: 6,
    CLAIMS: 64,
    STATE: 30,
  }, "malformed rejection-stage histogram");
  return corpus.cases.length;
}

function validateCrossTypeCorpus(registry) {
  const corpus = readJson("corpus/cross-type-cases.json");
  exactKeys(corpus, ["cases", "corpusKind", "expectedOrderedPairCount", "protocolVersion", "schemaVersion", "signedTypeCount", "signedTypes"], "cross-type corpus");
  assert(corpus.schemaVersion === 1 && corpus.protocolVersion === 1, "Cross-type corpus version drifted.");
  assert(corpus.signedTypeCount === signedTypes.length && corpus.expectedOrderedPairCount === 90 && corpus.cases.length === 90, "Cross-type corpus must contain exactly 90 ordered pairs.");
  arraysEqual(corpus.signedTypes.map(({ name }) => name), signedTypes.map(([name]) => name), "cross-type signed types");
  for (const [index, entry] of corpus.signedTypes.entries()) {
    exactKeys(entry, ["mediaType", "name"], `cross-type signedTypes[${index}]`);
    assert(entry.mediaType === exactMedia(entry.name), `${entry.name} cross-type media drifted.`);
  }
  const mediaByType = new Map(registry.messageTypes.map((entry) => [entry.tokenType, entry.mediaType]));
  const expectedPairs = new Set();
  for (const [source] of signedTypes) for (const [target] of signedTypes) if (source !== target) expectedPairs.add(`${source}->${target}`);
  const ids = new Set();
  for (const descriptor of corpus.cases) {
    exactKeys(descriptor, ["expected", "id", "mutation", "sourceMediaType", "sourceType", "targetMediaType", "targetType"], descriptor.id ?? "cross-type descriptor");
    assert(typeof descriptor.id === "string" && /^CROSS_[A-Z0-9_]+$/u.test(descriptor.id), `Invalid cross-type descriptor ID ${descriptor.id}.`);
    exactKeys(descriptor.mutation, ["operation", "preserveSourceCoseBytes"], `${descriptor.id}.mutation`);
    exactKeys(descriptor.expected, ["authoritativeStateChanged", "decision", "errorCode", "requestConsumed", "stage"], `${descriptor.id}.expected`);
    const pair = `${descriptor.sourceType}->${descriptor.targetType}`;
    assert(expectedPairs.delete(pair), `Duplicate, self or unknown cross-type pair ${pair}.`);
    assert(!ids.has(descriptor.id), `Duplicate cross-type descriptor ID ${descriptor.id}.`);
    ids.add(descriptor.id);
    assert(descriptor.sourceMediaType === mediaByType.get(descriptor.sourceType), `${pair} source media drifted.`);
    assert(descriptor.targetMediaType === mediaByType.get(descriptor.targetType), `${pair} target media drifted.`);
    assert(descriptor.mutation?.operation === "verifyValidSignedObjectUnderDifferentTypeContract" && descriptor.mutation.preserveSourceCoseBytes === true, `${pair} must preserve source bytes.`);
    assert(descriptor.expected?.decision === "REJECT" && descriptor.expected.stage === "DOMAIN" && descriptor.expected.errorCode === "CROSS_TYPE_REJECTED", `${pair} must reject as cross-type.`);
    assert(descriptor.expected.authoritativeStateChanged === false && descriptor.expected.requestConsumed === false, `${pair} must be side-effect free.`);
  }
  assert(expectedPairs.size === 0, `Cross-type corpus is missing: ${[...expectedPairs].join(", ")}.`);
  return corpus.cases.length;
}

function validatePackageSafetyAndManifest() {
  const files = listFiles(protocolRoot);
  const forbiddenExtensions = new Set([".bin", ".cbor", ".der", ".hex", ".key", ".pem", ".pfx", ".p12"]);
  const permittedExtensions = new Set([".cddl", ".json", ".md", ".sha256"]);
  for (const file of files) {
    const extension = path.extname(file.relativePath).toLocaleLowerCase("en-US");
    assert(permittedExtensions.has(extension), `Unexpected protocol package file type: ${file.relativePath}.`);
    assert(!forbiddenExtensions.has(extension), `Binary/key fixture is forbidden: ${file.relativePath}.`);
    if (extension !== ".sha256") {
      const { text } = readText(file.absolutePath, file.relativePath, maxTextBytes);
      assert(!/-----BEGIN (?:EC |RSA |ENCRYPTED )?PRIVATE KEY-----/u.test(text), `Private-key PEM material is forbidden: ${file.relativePath}.`);
      assert(!/-----BEGIN PKCS12-----/u.test(text), `PKCS#12 material is forbidden: ${file.relativePath}.`);
    }
  }

  const manifest = readJson(manifestName, 1024 * 1024);
  exactKeys(manifest, ["files", "manifestVersion", "productId", "protocolVersion"], "protocol manifest");
  assert(manifest.manifestVersion === 1 && manifest.protocolVersion === 1 && manifest.productId === "ENTRY_CONTROL_SYSTEM", "Protocol manifest identity drifted.");
  assert(Array.isArray(manifest.files) && manifest.files.length > 0, "Protocol manifest files are empty.");
  const closure = files.filter(({ relativePath }) => relativePath !== manifestName && relativePath !== manifestHashName);
  assert(manifest.files.length === closure.length, "Protocol manifest closure count drifted.");
  let previous = "";
  for (const [index, entry] of manifest.files.entries()) {
    exactKeys(entry, ["path", "sha256", "size"], `protocol manifest files[${index}]`);
    canonicalRelativePath(entry.path, `protocol manifest files[${index}].path`);
    assert(previous === "" || previous < entry.path, "Protocol manifest paths must be strictly sorted.");
    previous = entry.path;
    const actual = closure[index];
    assert(entry.path === actual.relativePath, `Protocol manifest path mismatch at ${entry.path}.`);
    assert(Number.isSafeInteger(entry.size) && entry.size === actual.size, `${entry.path} manifest size mismatch.`);
    assert(/^[0-9a-f]{64}$/u.test(entry.sha256), `${entry.path} manifest digest is invalid.`);
    assert(entry.sha256 === sha256(readFileSync(actual.absolutePath)), `${entry.path} manifest digest mismatch.`);
  }

  const manifestBytes = readFileSync(path.join(protocolRoot, manifestName));
  const manifestDigest = sha256(manifestBytes);
  const sidecar = readText(path.join(protocolRoot, manifestHashName), manifestHashName, 128).text;
  assert(manifestDigest === expectedProtocolManifestSha256, "Protocol manifest drifted from the repository-external v1 digest pin.");
  assert(sidecar === `${expectedProtocolManifestSha256}\n`, "Protocol manifest sidecar mismatch.");
  return closure.length;
}

function validateRepositoryIntegration() {
  const attributes = readRepositoryText(path.join(repositoryRoot, ".gitattributes"), ".gitattributes", 64 * 1024);
  assert(attributes.split(/\r?\n/u).includes("/licensing/protocol/v1/** text eol=lf"), "Protocol package must be pinned to LF in .gitattributes for stable hashes.");
  const rootPackage = versionContract.parseStrictJson(
    versionContract.readFileBounded(path.join(repositoryRoot, "package.json"), "package.json", 1024 * 1024),
    "package.json",
    1024 * 1024
  );
  assert(rootPackage.scripts?.["test:license-protocol-v1"] === "node scripts/test-license-protocol-v1.mjs", "Root protocol test script is not registered.");
  const licensingDesign = readRepositoryText(path.join(repositoryRoot, "docs", "licensing", "design", "LICENSING_DESIGN.md"), "docs/licensing/design/LICENSING_DESIGN.md", 2 * 1024 * 1024);
  assert(licensingDesign.includes("`LIC-6.2-001`") && licensingDesign.includes("`licensing/protocol/v1`"), "Canonical design does not link the frozen package.");
  const protocolChecklistLine = licensingDesign.split(/\r?\n/u).find((line) => line.startsWith("| `LIC-6.2-001` |"));
  assert(protocolChecklistLine?.includes("| `[x]` |") && protocolChecklistLine.includes(expectedProtocolManifestSha256), "Canonical checklist has not closed the externally pinned protocol package.");
  assert(licensingDesign.includes("`LIC-EV-0007`") && licensingDesign.includes("**Blocked candidate — not closure evidence.**"), "Canonical evidence must retain the blocked candidate.");
  assert(licensingDesign.includes("`LIC-EV-0008`") && licensingDesign.includes("**Passed after remediation and independent rerun.**"), "Canonical final remediation evidence is missing.");
  assert(licensingDesign.includes(expectedProtocolManifestSha256), "Canonical evidence does not pin the final protocol digest.");

  const packaging = readRepositoryText(path.join(repositoryRoot, "docs", "operations", "PACKAGING_DECISIONS.md"), "docs/operations/PACKAGING_DECISIONS.md", 1024 * 1024);
  assert(packaging.includes("`LIC-6.2-001` protocol freeze passed") && packaging.includes(expectedProtocolManifestSha256), "Packaging mirror is stale.");
  const security = readRepositoryText(path.join(repositoryRoot, "docs", "architecture", "security-design.md"), "docs/architecture/security-design.md", 2 * 1024 * 1024);
  assert(security.includes("224 malformed descriptors") && security.includes("independent reviewer closure"), "Security mirror is stale.");
  const projectChecklist = readRepositoryText(path.join(repositoryRoot, "docs", "project", "PROJECT_CHECKLIST.md"), "docs/project/PROJECT_CHECKLIST.md", 4 * 1024 * 1024);
  assert(projectChecklist.includes("Phase 6.2.001 Licensing protocol v1 final closure") && projectChecklist.includes(expectedProtocolManifestSha256), "Project checklist final closure mirror is stale.");
  assert(projectChecklist.includes("**Blocked after the candidate gate passed**"), "Project checklist lost the blocked-candidate history.");
  const attendanceChecklist = readRepositoryText(path.join(repositoryRoot, "docs", "project", "ATTENDANCE_EDITION_CHECKLIST.md"), "docs/project/ATTENDANCE_EDITION_CHECKLIST.md", 4 * 1024 * 1024);
  assert(attendanceChecklist.includes("Phase 6.2.001 — Licensing protocol v1 final closure") && attendanceChecklist.includes(expectedProtocolManifestSha256), "Attendance checklist final closure mirror is stale.");
  assert(attendanceChecklist.includes("Phase 6.2.001 — Licensing protocol v1 candidate review"), "Attendance checklist lost the blocked-candidate history.");
  const rootReadme = readRepositoryText(path.join(repositoryRoot, "README.md"), "README.md", 1024 * 1024);
  assert(rootReadme.includes("licensing/protocol/v1"), "Root README does not link the protocol package.");
}

const registry = validateRegistry();
process.stdout.write("ok - exact protocol registry, issuer policy, Feature/build and signer boundaries\n");
validateCddl(registry);
process.stdout.write(`ok - ${signedTypes.length} self-contained signed CDDL schemas and ${carrierSchemas.length} closed carrier schemas\n`);
const malformedCount = validateMalformedCorpus(registry);
const crossTypeCount = validateCrossTypeCorpus(registry);
process.stdout.write(`ok - ${malformedCount} malformed descriptors and ${crossTypeCount} complete ordered cross-type rejects\n`);
const closureCount = validatePackageSafetyAndManifest();
process.stdout.write(`ok - closed ${closureCount}-file protocol package manifest with no key/binary fixtures\n`);
validateRepositoryIntegration();
process.stdout.write(`\n[license-protocol-v1] PASS - Node ${process.versions.node}; protocol ${registry.protocolVersion}; schema/corpus package only.\n`);
