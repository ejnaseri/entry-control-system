import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
} from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const requireProduction = createRequire(import.meta.url);
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const serverRoot = path.join(repositoryRoot, "server");
const serverSourceRoot = path.join(serverRoot, "src");
const sourceLicensingRoot = path.join(serverRoot, "src", "licensing");
const sourceCoreRoot = path.join(sourceLicensingRoot, "core", "v1");
const sourceNodeCryptoPath = path.join(sourceLicensingRoot, "adapters", "node-crypto.ts");
const distLicensingRoot = path.join(serverRoot, "dist", "licensing");
const distCoreRoot = path.join(distLicensingRoot, "core", "v1");
const distCoreIndexPath = path.join(distCoreRoot, "index.js");
const distProtocolPath = path.join(distCoreRoot, "protocol.js");
const distNodeCryptoPath = path.join(distLicensingRoot, "adapters", "node-crypto.js");
const protocolRoot = path.join(repositoryRoot, "licensing", "protocol", "v1");
const vectorRoot = path.join(repositoryRoot, "licensing", "vectors", "v1");

const EXPECTED_NODE_VERSION = "24.19.0";
const EXPECTED_PROTOCOL_MANIFEST_SHA256 =
  "512534732dce759da424ba0e8d8838c3d9c294e3faa02a4017212ce482523eab";
const EXPECTED_PROTOCOL_REGISTRY_SHA256 =
  "7fdd11c595f017ef2937203553e50594e1615b0ff97d922f488e57626a3d714c";
const EXPECTED_VECTOR_MANIFEST_SHA256 =
  "565a5efca1a1767a622a0d751a5937633018587f7cc463ce3e531ed9656fb99e";
const EXPECTED_VECTOR_INDEX_SHA256 =
  "b3c1a80cfdbbc80ffcb20403f9bd07419ff9f71bfe461a1b3c3ddb1d7dcbd597";
const EXPECTED_COUNTS = Object.freeze({
  keys: 18,
  positive: 41,
  signedPositive: 35,
  carrierPositive: 6,
  binaryNegative: 42,
  crossType: 90,
  malformedDescriptors: 224,
  malformedExpanded: 744,
  malformedDescriptorOnly: 702,
});
const MAXIMUM_JSON_BYTES = 4 * 1024 * 1024;
const MAXIMUM_VECTOR_BYTES = 2 * 1024 * 1024;
const WINDOWS = process.platform === "win32";

function fail(message) {
  throw new Error(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function sha256(bytes) {
  return createHash("sha256").update(bytes).digest("hex");
}

function display(value) {
  try {
    return JSON.stringify(value, (_key, item) =>
      typeof item === "bigint" ? `${item}n` : item instanceof Uint8Array ? Buffer.from(item).toString("hex") : item,
    );
  } catch {
    return String(value);
  }
}

function isWithin(candidate, root) {
  const relative = path.relative(path.resolve(root), path.resolve(candidate));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
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
    `${label} is not a canonical relative path.`,
  );
  assert(
    value.split("/").every((segment) => segment.length > 0 && segment !== "." && segment !== ".."),
    `${label} contains a forbidden path segment.`,
  );
  return value;
}

function readRegularFile(filePath, label, maximumBytes) {
  const stats = lstatSync(filePath);
  assert(stats.isFile() && !stats.isSymbolicLink(), `${label} must be a regular non-link file.`);
  assert(stats.size > 0 && stats.size <= maximumBytes, `${label} must be 1..${maximumBytes} bytes.`);
  return readFileSync(filePath);
}

function parsePinnedJson(filePath, label, expectedDigest, maximumBytes = MAXIMUM_JSON_BYTES) {
  const bytes = readRegularFile(filePath, label, maximumBytes);
  assert(sha256(bytes) === expectedDigest, `${label} digest drifted from its external pin.`);
  assert(!(bytes[0] === 0xef && bytes[1] === 0xbb && bytes[2] === 0xbf), `${label} has a UTF-8 BOM.`);
  let text;
  try {
    text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  } catch (error) {
    fail(`${label} is not valid UTF-8: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    return { bytes, value: JSON.parse(text) };
  } catch (error) {
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
}

function runServerBuild() {
  process.stdout.write("[license-core-v1] Building the server TypeScript project...\n");
  const executable = WINDOWS ? (process.env.ComSpec || "cmd.exe") : "npm";
  const args = WINDOWS
    ? ["/d", "/s", "/c", "npm.cmd", "--prefix", serverRoot, "run", "build"]
    : ["--prefix", serverRoot, "run", "build"];
  const result = spawnSync(executable, args, {
    cwd: repositoryRoot,
    encoding: "utf8",
    env: process.env,
    maxBuffer: 64 * 1024 * 1024,
    timeout: 240_000,
    windowsHide: true,
  });
  if (result.error) fail(`Server build could not start: ${result.error.message}`);
  if (result.status !== 0) {
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    fail(`Server build exited with status ${result.status ?? "unknown"}.`);
  }
}

function listFiles(root, extensions) {
  assert(existsSync(root), `Required production directory is missing: ${path.relative(repositoryRoot, root)}.`);
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      const stats = lstatSync(absolutePath);
      assert(!stats.isSymbolicLink(), `Production links are forbidden: ${path.relative(repositoryRoot, absolutePath)}.`);
      if (stats.isDirectory()) visit(absolutePath);
      else if (stats.isFile() && extensions.has(path.extname(entry.name))) files.push(absolutePath);
    }
  };
  visit(root);
  return files.sort();
}

function moduleSpecifiers(source) {
  const specifiers = [];
  const patterns = [
    /\bfrom\s*["']([^"']+)["']/gu,
    /\bimport\s*["']([^"']+)["']/gu,
    /\b(?:import|require)\s*\(\s*["']([^"']+)["']\s*\)/gu,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) specifiers.push(match[1]);
  }
  return specifiers;
}

function scanProductionFile(filePath, boundary) {
  const label = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
  const bytes = readRegularFile(filePath, label, 2 * 1024 * 1024);
  const source = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const normalized = source.replaceAll("\\", "/");
  const forbiddenMarkers = [
    [/(?:^|["'`])(?:\.\.\/)*licensing\/vectors\/v1(?:\/|["'`])/imu, "Golden Vector package path"],
    [/(?:^|["'`])(?:\.\.\/)*(?:test-only|node-verifier)(?:\/|["'`])/imu, "test-only module path"],
    [/\b(?:generate-vectors|verify-vectors)\.mjs\b/iu, "fixture generator/verifier module"],
    [/(?:^|\/)fixtures\/(?:positive|negative)(?:\/|["'`])/imu, "Golden fixture path"],
    [/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/u, "embedded private key"],
    [/\b(?:createPrivateKey|generateKeyPair|generateKeyPairSync)\s*\(/u, "private-key API"],
    [/\b(?:privateKey|privateScalar|pkcs8)\b/iu, "private-key material identifier"],
  ];
  for (const [pattern, description] of forbiddenMarkers) {
    assert(!pattern.test(normalized), `${label} contains forbidden ${description}.`);
  }

  for (const specifier of moduleSpecifiers(source)) {
    assert(
      !/(?:^|\/)(?:licensing\/vectors|test-only|node-verifier|fixtures)(?:\/|$)/iu.test(specifier.replaceAll("\\", "/")),
      `${label} imports forbidden test/vector module ${JSON.stringify(specifier)}.`,
    );
    if (boundary === "portable-core") {
      assert(specifier.startsWith("."), `${label} portable core imports non-relative module ${JSON.stringify(specifier)}.`);
      assert(
        isWithin(path.resolve(path.dirname(filePath), specifier), path.extname(filePath) === ".ts" ? sourceCoreRoot : distCoreRoot),
        `${label} escapes the portable core through ${JSON.stringify(specifier)}.`,
      );
    } else if (specifier.startsWith("node:")) {
      assert(specifier === "node:crypto", `${label} imports unexpected Node module ${JSON.stringify(specifier)}.`);
    } else {
      assert(specifier.startsWith("."), `${label} imports unexpected package ${JSON.stringify(specifier)}.`);
      const allowedRoot = path.extname(filePath) === ".ts" ? sourceLicensingRoot : distLicensingRoot;
      assert(
        isWithin(path.resolve(path.dirname(filePath), specifier), allowedRoot),
        `${label} escapes the production licensing boundary through ${JSON.stringify(specifier)}.`,
      );
    }
  }
}

function scanProductionIsolation() {
  for (const filePath of listFiles(serverSourceRoot, new Set([".ts", ".js"]))) {
    const label = path.relative(repositoryRoot, filePath).replaceAll("\\", "/");
    const source = new TextDecoder("utf-8", { fatal: true }).decode(
      readRegularFile(filePath, label, 4 * 1024 * 1024),
    );
    const normalized = source.replaceAll("\\", "/");
    assert(
      !/(?:licensing\/vectors\/v1|test-only\/keys|node-verifier|generate-vectors\.mjs|verify-vectors\.mjs)/iu.test(normalized),
      `${label} references Golden/test-only licensing code or keys.`,
    );
    assert(!/-----BEGIN (?:EC |RSA )?PRIVATE KEY-----/u.test(source), `${label} embeds private-key PEM material.`);
    assert(!/\bTEST_ONLY_[A-Z0-9_]+\b/u.test(source), `${label} embeds a Golden test-key identifier.`);
  }

  for (const filePath of listFiles(sourceCoreRoot, new Set([".ts"]))) {
    scanProductionFile(filePath, "portable-core");
  }
  assert(existsSync(sourceNodeCryptoPath), "Production Node crypto adapter source is missing.");
  scanProductionFile(sourceNodeCryptoPath, "node-adapter");

  for (const filePath of listFiles(distCoreRoot, new Set([".js"]))) {
    scanProductionFile(filePath, "portable-core");
  }
  assert(existsSync(distNodeCryptoPath), "Compiled production Node crypto adapter is missing.");
  scanProductionFile(distNodeCryptoPath, "node-adapter");
}

function assertNoSigningExports(moduleValue, label) {
  const forbiddenName = /^(?:sign(?:$|Bytes|Data|Digest|Es256|Object|Payload)|createSigner|issue|issuer|generateKey|generateSigning|importPrivate|privateKey|secretKey)/u;
  for (const name of Object.keys(moduleValue)) {
    assert(!forbiddenName.test(name), `${label} exposes forbidden signing/private-key API ${JSON.stringify(name)}.`);
  }
}

function loadProductionApi() {
  const requiredFiles = [distCoreIndexPath, distProtocolPath, distNodeCryptoPath];
  const missing = requiredFiles.filter((filePath) => !existsSync(filePath));
  assert(
    missing.length === 0,
    [
      "Compiled licensing production contract is incomplete.",
      ...missing.map((filePath) => `Missing ${path.relative(repositoryRoot, filePath).replaceAll("\\", "/")}.`),
      "Required CommonJS exports: createLicenseVerifierV1 from core/v1/index.js and nodeCryptoV1 from adapters/node-crypto.js.",
    ].join(" "),
  );

  const cacheBefore = new Set(Object.keys(requireProduction.cache));
  const core = requireProduction(distCoreIndexPath);
  const protocol = requireProduction(distProtocolPath);
  const nodeAdapter = requireProduction(distNodeCryptoPath);
  assert(typeof core.createLicenseVerifierV1 === "function", "Production core must export createLicenseVerifierV1().");
  assert(
    typeof core.validateDelegationUpdateV1 === "function",
    "Production core must export validateDelegationUpdateV1() for immutable trust bootstrap.",
  );
  assert(nodeAdapter.nodeCryptoV1 && typeof nodeAdapter.nodeCryptoV1 === "object", "Node adapter must export nodeCryptoV1.");
  assertNoSigningExports(core, "Production core");
  assertNoSigningExports(nodeAdapter, "Production Node crypto adapter");

  const newlyLoaded = Object.keys(requireProduction.cache).filter((filePath) => !cacheBefore.has(filePath));
  for (const filePath of newlyLoaded) {
    assert(!isWithin(filePath, vectorRoot), `Production API loaded Golden Vector module ${filePath}.`);
    if (isWithin(filePath, repositoryRoot)) {
      assert(
        isWithin(filePath, distCoreRoot) || path.resolve(filePath) === path.resolve(distNodeCryptoPath),
        `Production API loaded a repository module outside its boundary: ${path.relative(repositoryRoot, filePath)}.`,
      );
    }
  }
  return { core, protocol, nodeCryptoV1: nodeAdapter.nodeCryptoV1, newlyLoaded };
}

function validateProtocolConstants(protocol) {
  const protocolManifestPath = path.join(protocolRoot, "protocol-manifest.json");
  const protocolSidecarPath = path.join(protocolRoot, "protocol-manifest.sha256");
  const registryPath = path.join(protocolRoot, "protocol-registry.json");
  const { value: registry } = parsePinnedJson(
    registryPath,
    "protocol-registry.json",
    EXPECTED_PROTOCOL_REGISTRY_SHA256,
  );
  parsePinnedJson(
    protocolManifestPath,
    "protocol-manifest.json",
    EXPECTED_PROTOCOL_MANIFEST_SHA256,
  );
  const sidecar = readRegularFile(protocolSidecarPath, "protocol-manifest.sha256", 128).toString("utf8");
  assert(sidecar === `${EXPECTED_PROTOCOL_MANIFEST_SHA256}\n`, "Protocol manifest sidecar drifted.");

  assert(protocol.PROTOCOL_VERSION === 1, "Production PROTOCOL_VERSION must be 1.");
  assert(protocol.PRODUCT_ID === "ENTRY_CONTROL_SYSTEM", "Production PRODUCT_ID drifted.");
  assert(
    protocol.PROTOCOL_MANIFEST_SHA256 === EXPECTED_PROTOCOL_MANIFEST_SHA256,
    "Production protocol-manifest hash constant drifted.",
  );
  assert(
    protocol.PROTOCOL_REGISTRY_SHA256 === EXPECTED_PROTOCOL_REGISTRY_SHA256,
    "Production protocol-registry hash constant drifted.",
  );
  assert(Array.isArray(protocol.SIGNED_OBJECTS), "Production SIGNED_OBJECTS registry is missing.");
  assert(protocol.SIGNED_OBJECTS.length === registry.messageTypes.length, "Production signed-object registry count drifted.");
  for (let index = 0; index < registry.messageTypes.length; index += 1) {
    const frozen = registry.messageTypes[index];
    const production = protocol.SIGNED_OBJECTS[index];
    for (const property of ["registryOrder", "tokenType", "mediaType", "schema", "signerPurpose", "maxEncodedBytes"]) {
      assert(
        production[property] === frozen[property],
        `Production signed-object registry ${frozen.tokenType}.${property} drifted.`,
      );
    }
    assert(
      display(production.carriers) === display(frozen.carriers),
      `Production signed-object registry ${frozen.tokenType}.carriers drifted.`,
    );
  }
  assert(Object.isFrozen(protocol.SIGNED_OBJECTS), "Production signed-object registry must be immutable.");
  assert(Array.isArray(protocol.CARRIER_CONTRACTS) && protocol.CARRIER_CONTRACTS.length === 3, "Production carrier registry must contain three v1 carriers.");
  const carrierContracts = new Map(protocol.CARRIER_CONTRACTS.map((item) => [item.carrierType, item]));
  const expectedCarriers = [
    ["lease-challenge", "application/vnd.entry-control.lease-challenge+cbor;v=1", 4_096],
    ["lease-response", "application/vnd.entry-control.lease-response+cbor;v=1", 524_288],
    ["trust-bundle", "application/vnd.entry-control.trust-bundle+cbor;v=1", 1_048_576],
  ];
  for (const [carrierType, mediaType, maximumBytes] of expectedCarriers) {
    const contract = carrierContracts.get(carrierType);
    assert(contract, `Production carrier registry is missing ${carrierType}.`);
    assert(contract.mediaType === mediaType, `Production ${carrierType} media type drifted.`);
    assert(contract.maxEncodedBytes === maximumBytes, `Production ${carrierType} byte limit drifted.`);
  }
  return registry;
}

function loadGoldenData() {
  const vectorManifestPath = path.join(vectorRoot, "vector-manifest.json");
  const vectorSidecarPath = path.join(vectorRoot, "vector-manifest.sha256");
  const { value: manifest } = parsePinnedJson(
    vectorManifestPath,
    "vector-manifest.json",
    EXPECTED_VECTOR_MANIFEST_SHA256,
  );
  const sidecar = readRegularFile(vectorSidecarPath, "vector-manifest.sha256", 128).toString("utf8");
  assert(sidecar === `${EXPECTED_VECTOR_MANIFEST_SHA256}\n`, "Golden Vector manifest sidecar drifted.");
  assert(manifest.packageKind === "NON_PRODUCTION_GOLDEN_VECTORS", "Golden package kind drifted.");
  assert(manifest.protocolVersion === 1 && manifest.productId === "ENTRY_CONTROL_SYSTEM", "Golden package identity drifted.");
  assert(
    manifest.protocolManifestSha256 === EXPECTED_PROTOCOL_MANIFEST_SHA256,
    "Golden package protocol pin drifted.",
  );
  assert(Array.isArray(manifest.files), "Golden Vector manifest files must be an array.");
  const manifestFiles = new Map();
  for (const entry of manifest.files) {
    canonicalRelativePath(entry.path, "vector-manifest file path");
    assert(!manifestFiles.has(entry.path), `Duplicate vector-manifest path ${entry.path}.`);
    assert(Number.isSafeInteger(entry.size) && entry.size > 0, `Invalid vector-manifest size for ${entry.path}.`);
    assert(/^[0-9a-f]{64}$/u.test(entry.sha256), `Invalid vector-manifest digest for ${entry.path}.`);
    manifestFiles.set(entry.path, entry);
  }

  const vectorRootReal = realpathSync.native(vectorRoot);
  const allowedDataPath = /^(?:vectors-index\.json|coverage\/(?:malformed-expanded|cross-type)\.json|fixtures\/(?:positive|negative)\/[a-z0-9-]+\.cbor|keys\/[a-z0-9-]+\.spki\.der)$/u;
  const readData = (relativePath, maximumBytes = MAXIMUM_VECTOR_BYTES) => {
    canonicalRelativePath(relativePath, "Golden data path");
    assert(allowedDataPath.test(relativePath), `Runner refuses non-data Golden path ${relativePath}.`);
    const manifestEntry = manifestFiles.get(relativePath);
    assert(manifestEntry, `Golden data path ${relativePath} is absent from vector-manifest.json.`);
    assert(manifestEntry.size <= maximumBytes, `${relativePath} exceeds the runner byte limit.`);
    const absolutePath = path.resolve(vectorRoot, ...relativePath.split("/"));
    assert(isWithin(absolutePath, vectorRoot), `Golden data path ${relativePath} escaped its package.`);
    const actualRealPath = realpathSync.native(absolutePath);
    assert(isWithin(actualRealPath, vectorRootReal), `Golden data path ${relativePath} resolves outside its package.`);
    const bytes = readRegularFile(absolutePath, relativePath, maximumBytes);
    assert(bytes.byteLength === manifestEntry.size, `Golden data size mismatch for ${relativePath}.`);
    assert(sha256(bytes) === manifestEntry.sha256, `Golden data digest mismatch for ${relativePath}.`);
    return bytes;
  };

  const indexBytes = readData("vectors-index.json", 1024 * 1024);
  assert(sha256(indexBytes) === EXPECTED_VECTOR_INDEX_SHA256, "Golden Vector index drifted from its external pin.");
  const index = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(indexBytes));
  assert(index.nonProductionOnly === true && index.protocolVersion === 1, "Golden Vector index identity drifted.");
  assert(index.protocolManifestSha256 === EXPECTED_PROTOCOL_MANIFEST_SHA256, "Golden Vector index protocol pin drifted.");
  assert(Array.isArray(index.keys) && index.keys.length === EXPECTED_COUNTS.keys, "Golden Vector key count drifted.");
  assert(Array.isArray(index.positive) && index.positive.length === EXPECTED_COUNTS.positive, "Golden positive count drifted.");
  assert(
    Array.isArray(index.criticalNegative) && index.criticalNegative.length === EXPECTED_COUNTS.binaryNegative,
    "Golden binary-negative count drifted.",
  );

  const malformedPath = canonicalRelativePath(index.descriptorCorpora.malformedPath, "malformed coverage path");
  const crossTypePath = canonicalRelativePath(index.descriptorCorpora.crossTypePath, "cross-type coverage path");
  const malformedBytes = readData(malformedPath);
  const crossTypeBytes = readData(crossTypePath);
  assert(sha256(malformedBytes) === index.descriptorCorpora.malformedSha256, "Malformed coverage digest disagrees with the index.");
  assert(sha256(crossTypeBytes) === index.descriptorCorpora.crossTypeSha256, "Cross-type coverage digest disagrees with the index.");
  const malformed = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(malformedBytes));
  const crossType = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(crossTypeBytes));
  assert(malformed.sourceDescriptorCount === EXPECTED_COUNTS.malformedDescriptors, "Malformed source descriptor count drifted.");
  assert(malformed.expectedRecordCount === EXPECTED_COUNTS.malformedExpanded, "Expanded malformed count drifted.");
  assert(Array.isArray(malformed.records) && malformed.records.length === EXPECTED_COUNTS.malformedExpanded, "Expanded malformed records drifted.");
  assert(crossType.expectedRecordCount === EXPECTED_COUNTS.crossType, "Cross-type expected count drifted.");
  assert(Array.isArray(crossType.records) && crossType.records.length === EXPECTED_COUNTS.crossType, "Cross-type records drifted.");

  return { index, malformed, crossType, readData };
}

function validateGoldenRelationships(golden) {
  const { index, malformed, crossType } = golden;
  const keyIds = new Set();
  for (const key of index.keys) {
    assert(!keyIds.has(key.keyId), `Duplicate Golden key id ${key.keyId}.`);
    keyIds.add(key.keyId);
    assert(/^[0-9a-f]{64}$/u.test(key.kidHex), `Invalid Golden kid for ${key.keyId}.`);
    assert(key.spkiSha256 === key.kidHex, `Golden SPKI/kid relation drifted for ${key.keyId}.`);
    assert(/^keys\/[a-z0-9-]+\.spki\.der$/u.test(key.spkiPath), `Golden key path is not public SPKI data: ${key.spkiPath}.`);
  }

  const positiveById = new Map();
  for (const vector of index.positive) {
    assert(!positiveById.has(vector.id), `Duplicate positive vector id ${vector.id}.`);
    positiveById.set(vector.id, vector);
    assert(vector.expected.decision === "ACCEPT" && vector.expected.stage === "COMPLETE", `${vector.id} is not an acceptance vector.`);
  }
  assert(
    index.positive.filter((item) => item.kind === "SIGNED_OBJECT").length === EXPECTED_COUNTS.signedPositive,
    "Signed positive count drifted.",
  );
  assert(
    index.positive.filter((item) => item.kind === "CARRIER").length === EXPECTED_COUNTS.carrierPositive,
    "Carrier positive count drifted.",
  );

  const negativeById = new Map();
  for (const vector of index.criticalNegative) {
    assert(!negativeById.has(vector.id), `Duplicate binary-negative vector id ${vector.id}.`);
    negativeById.set(vector.id, vector);
    assert(vector.expected.decision === "REJECT", `${vector.id} is not a rejection vector.`);
  }

  const binaryCoverage = malformed.records.filter((record) => record.binaryExecution === "BINARY_FIXTURE");
  const descriptorOnly = malformed.records.filter((record) => record.binaryExecution === "DEFERRED_TO_LIC_6_2_003");
  assert(binaryCoverage.length === EXPECTED_COUNTS.binaryNegative, "Malformed binary coverage count drifted.");
  assert(descriptorOnly.length === EXPECTED_COUNTS.malformedDescriptorOnly, "Malformed descriptor-only count drifted.");
  assert(binaryCoverage.length + descriptorOnly.length === malformed.records.length, "Malformed execution status is not exhaustive.");
  const linkedNegativeIds = new Set();
  for (const record of binaryCoverage) {
    const negative = negativeById.get(record.binaryNegativeId);
    assert(negative, `${record.id} links an unknown binary negative ${record.binaryNegativeId}.`);
    assert(!linkedNegativeIds.has(record.binaryNegativeId), `Binary negative ${record.binaryNegativeId} is linked more than once.`);
    linkedNegativeIds.add(record.binaryNegativeId);
    assert(record.tokenType === negative.tokenType, `${record.id} binary token type drifted.`);
    assert(record.expected.stage === negative.expected.stage, `${record.id} binary stage drifted.`);
    assert(record.expected.errorCode === negative.expected.errorCode, `${record.id} binary error code drifted.`);
  }
  assert(linkedNegativeIds.size === negativeById.size, "Not every binary negative is linked from malformed coverage.");

  const crossIds = new Set();
  for (const record of crossType.records) {
    assert(!crossIds.has(record.id), `Duplicate cross-type record ${record.id}.`);
    crossIds.add(record.id);
    const base = positiveById.get(record.basePositiveId);
    assert(base && base.kind === "SIGNED_OBJECT", `${record.id} has no signed positive base.`);
    assert(record.sourceType === base.tokenType && record.sourceType !== record.targetType, `${record.id} type relation drifted.`);
    assert(record.baseCosePath === base.path && record.baseCoseSha256 === base.sha256, `${record.id} base bytes drifted.`);
    assert(record.expected.stage === "DOMAIN" && record.expected.errorCode === "CROSS_TYPE_REJECTED", `${record.id} verdict drifted.`);
  }
  return { positiveById, descriptorOnly };
}

function loadTrustedKeys(index, readData) {
  const registrations = [];
  const roots = [];
  const trustedKeys = [];
  const keysById = new Map();
  const snapshots = [];
  for (const key of index.keys) {
    const spkiDer = new Uint8Array(readData(key.spkiPath, 1024));
    assert(spkiDer.byteLength === 91, `${key.keyId} SPKI must be exactly 91 bytes.`);
    assert(sha256(spkiDer) === key.kidHex, `${key.keyId} SPKI does not hash to its kid.`);
    if (key.trustClass === "UNKNOWN") continue;
    const kid = Uint8Array.from(Buffer.from(key.kidHex, "hex"));
    const registration = Object.freeze({
      kid,
      spkiDer,
      purpose: key.purpose,
      environment: key.environment,
    });
    registrations.push(registration);
    keysById.set(key.keyId, Object.freeze({ ...key, registration }));
    if (key.purpose === "PROD_ROOT") roots.push(registration);
    if (key.purpose === "INSTALLATION_DEVICE") trustedKeys.push(registration);
    snapshots.push({ keyId: key.keyId, kidSha256: sha256(kid), spkiSha256: sha256(spkiDer) });
  }
  assert(registrations.length === 17, "Exactly the unknown Golden signer must be omitted from test registrations.");
  assert(roots.length === 2, "Golden trust material must contain two environment-separated Roots.");
  assert(trustedKeys.length === 3, "Golden trust material must contain three installation-device keys.");
  return {
    registrations: Object.freeze(registrations),
    roots: Object.freeze(roots),
    trustedKeys: Object.freeze(trustedKeys),
    keysById,
    snapshots: Object.freeze(snapshots),
  };
}

async function loadTestIssuerAfterProductionIsolation() {
  const [{ TEST_ONLY_KEYS }, { issueTestOnlyCose }] = await Promise.all([
    import("../licensing/vectors/v1/test-only/keys.mjs"),
    import("../licensing/vectors/v1/lib/cose.mjs"),
  ]);
  return Object.freeze({ keys: TEST_ONLY_KEYS, issueTestOnlyCose });
}

function copyOptionalBytes(value) {
  return value instanceof Uint8Array ? new Uint8Array(value) : value;
}

function deterministicBytes(label, length) {
  return new Uint8Array(createHash("sha256").update(label, "utf8").digest().subarray(0, length));
}

async function bootstrapTrust(production, golden, trustedKeyData, testIssuer) {
  const rootKeys = trustedKeyData.roots.filter((key) => key.environment === "TEST");
  assert(rootKeys.length === 1, "Delegation bootstrap requires exactly one TEST production-root key.");
  const verifier = await Promise.resolve(production.core.createLicenseVerifierV1({
    crypto: production.nodeCryptoV1,
    environment: "TEST",
    roots: Object.freeze(rootKeys),
  }));
  assert(verifier && typeof verifier.verifySignedObject === "function", "Bootstrap verifier must expose verifySignedObject().");

  const vectors = golden.index.positive.filter((vector) => vector.tokenType === "key-delegation");
  assert(vectors.length === 4, "Golden corpus must contain four root-signed delegations.");
  const verified = [];
  for (const vector of vectors) {
    const encoded = new Uint8Array(golden.readData(vector.path));
    const before = sha256(encoded);
    const result = await Promise.resolve(verifier.verifySignedObject({
      expectedType: vector.tokenType,
      encoded,
    }));
    assert(sha256(encoded) === before, `${vector.id} input was mutated during trust bootstrap.`);
    assertAccepted(result, vector, before);
    const payload = result.value?.payload?.payload ?? result.value?.payload;
    assert(payload?.tokenType === "key-delegation", `${vector.id} did not expose its validated delegation payload.`);
    const tokenHash = resultDigest(result, "inputSha256");
    assert(tokenHash instanceof Uint8Array && tokenHash.byteLength === 32, `${vector.id} did not expose binary inputSha256.`);
    assert(result.signerKeyId instanceof Uint8Array && result.signerKeyId.byteLength === 32, `${vector.id} did not expose signerKeyId.`);
    verified.push({ vector, payload, tokenHash, rootKid: result.signerKeyId });
  }
  verified.sort((left, right) =>
    left.payload.delegationSerial < right.payload.delegationSerial
      ? -1
      : left.payload.delegationSerial > right.payload.delegationSerial
        ? 1
        : 0,
  );
  assert(
    verified.every((item, index) => item.payload.delegationSerial === BigInt(index + 1)),
    "Golden delegation serials must bootstrap in frozen order 1..4.",
  );

  const accepted = [];
  for (const item of verified) {
    const snapshot = production.core.validateDelegationUpdateV1({
      crypto: production.nodeCryptoV1,
      payload: item.payload,
      tokenHash: new Uint8Array(item.tokenHash),
      rootKid: new Uint8Array(item.rootKid),
      current: Object.freeze([...accepted]),
    });
    accepted.push(snapshot);
  }

  const verifiedTemplates = new Map(verified.map((item) => [item.payload.purpose, item.payload]));
  const testRootIssuer = testIssuer.keys.TEST_ONLY_PROD_ROOT_PRIMARY;
  const developmentRootIssuer = testIssuer.keys.TEST_ONLY_PROD_ROOT_WRONG_ENV;
  const developmentRoot = trustedKeyData.roots.filter((key) => key.environment === "DEVELOPMENT");
  assert(developmentRoot.length === 1, "Delegation bootstrap requires exactly one DEVELOPMENT Root.");
  const developmentVerifier = production.core.createLicenseVerifierV1({
    crypto: production.nodeCryptoV1,
    environment: "DEVELOPMENT",
    roots: developmentRoot,
  });

  const dynamicTargets = [...trustedKeyData.keysById.values()].filter(
    (key) =>
      !["PROD_ROOT", "INSTALLATION_DEVICE", "UNKNOWN"].includes(key.purpose) &&
      key.trustClass !== "TRUSTED",
  );
  const serialByEnvironment = new Map([["TEST", 5n], ["DEVELOPMENT", 1n]]);
  for (const target of dynamicTargets) {
    const template = verifiedTemplates.get(target.purpose);
    assert(template, `No verified Delegation payload template exists for ${target.purpose}.`);
    const serial = serialByEnvironment.get(target.environment);
    assert(serial !== undefined, `No Delegation serial sequence for ${target.environment}.`);
    serialByEnvironment.set(target.environment, serial + 1n);
    const issuerKey = target.environment === "TEST" ? testRootIssuer : developmentRootIssuer;
    const runtimePayload = {
      ...template,
      tokenId: deterministicBytes(`runtime-delegation:${target.keyId}`, 16),
      keyId: new Uint8Array(issuerKey.kid),
      delegatedKeyId: new Uint8Array(target.registration.kid),
      delegatedPublicKey: new Uint8Array(target.registration.spkiDer),
      purpose: target.purpose,
      environment: target.environment,
      delegationSerial: serial,
    };
    const issued = testIssuer.issueTestOnlyCose("key-delegation", runtimePayload, issuerKey);
    const environmentVerifier = target.environment === "TEST" ? verifier : developmentVerifier;
    const result = environmentVerifier.verifySignedObject({
      expectedType: "key-delegation",
      encoded: new Uint8Array(issued.coseBytes),
    });
    assert(result.ok, `Runtime Delegation for ${target.keyId} failed production verification: ${display(result)}.`);
    const snapshot = production.core.validateDelegationUpdateV1({
      crypto: production.nodeCryptoV1,
      payload: result.value.payload,
      tokenHash: result.digests.inputSha256,
      rootKid: result.signerKeyId,
      current: Object.freeze([...accepted]),
    });
    accepted.push(snapshot);
  }

  let denylist;
  const denylistVectors = golden.index.positive.filter((vector) => vector.tokenType === "key-denylist");
  assert(denylistVectors.length === 2, "Golden corpus must contain two Root-signed Denylists.");
  for (const vector of denylistVectors) {
    const encoded = new Uint8Array(golden.readData(vector.path));
    const before = sha256(encoded);
    const result = verifier.verifySignedObject({ expectedType: "key-denylist", encoded });
    assert(sha256(encoded) === before, `${vector.id} input was mutated during Denylist bootstrap.`);
    assertAccepted(result, vector, before);
    denylist = production.core.validateDenylistUpdateV1({
      payload: result.value.payload,
      tokenHash: result.digests.inputSha256,
      importedAt: result.value.payload.issuedAt,
      ...(denylist ? { current: denylist } : {}),
    });
  }
  assert(denylist?.deniedKeys.length === 4, "Final Golden Denylist must cumulatively deny four test keys.");
  return {
    positiveIds: new Set([...vectors, ...denylistVectors].map((vector) => vector.id)),
    delegations: Object.freeze(accepted),
    denylist,
  };
}

function asDigestHex(value) {
  if (typeof value === "string" && /^[0-9a-f]{64}$/iu.test(value)) return value.toLowerCase();
  if (value instanceof Uint8Array && value.byteLength === 32) return Buffer.from(value).toString("hex");
  return null;
}

function resultDigest(result, name) {
  return result?.digests?.[name]
    ?? result?.value?.digests?.[name]
    ?? result?.value?.[name]
    ?? result?.[name];
}

function assertPreflightResult(result, label) {
  assert(result.authoritativeStateChanged === false, `${label} did not prove zero authoritative state mutation.`);
  assert(result.requestConsumed === false, `${label} did not prove zero request consumption.`);
  if (result.value && typeof result.value === "object" && "authorization" in result.value) {
    assert(result.value.authorization === "PREFLIGHT_ONLY", `${label} escaped preflight authorization.`);
  }
}

function assertAccepted(result, vector, inputDigest) {
  assert(result && typeof result === "object" && result.ok === true, `${vector.id} was not accepted: ${display(result)}.`);
  assert(result.decision === "ACCEPT", `${vector.id} returned a non-ACCEPT decision.`);
  assert(result.stage === "COMPLETE", `${vector.id} did not reach COMPLETE.`);
  assertPreflightResult(result, vector.id);
  const actualInputDigest = asDigestHex(resultDigest(result, "inputSha256"));
  assert(actualInputDigest === inputDigest, `${vector.id} did not return its exact input SHA-256.`);

  if (vector.kind === "SIGNED_OBJECT") {
    const type = result.value?.type
      ?? result.value?.tokenType
      ?? result.value?.payload?.tokenType
      ?? result.value?.payload?.payload?.tokenType;
    assert(type === vector.tokenType, `${vector.id} returned signed type ${display(type)}.`);
    const digestFields = ["protectedSha256", "payloadSha256", "sigStructureSha256", "signatureSha256"];
    for (const field of digestFields) {
      const value = resultDigest(result, field);
      assert(asDigestHex(value) === vector[field], `${vector.id} ${field} is missing or drifted.`);
    }
    assert(
      asDigestHex(result.signerKeyId) === vector.signerKeyIdHex,
      `${vector.id} signer key id is missing or drifted.`,
    );
    assert(result.value.authorization === "PREFLIGHT_ONLY", `${vector.id} escaped preflight authorization.`);
  } else {
    const carrierType = result.value?.type
      ?? result.value?.carrierType
      ?? result.value?.carrier?.carrierType;
    assert(carrierType === vector.carrierType, `${vector.id} returned carrier type ${display(carrierType)}.`);
    assert(result.value.authority === "NONE_TRANSPORT_ONLY", `${vector.id} carrier gained authority.`);
  }
}

function assertRejected(result, expected, label) {
  assert(result && typeof result === "object" && result.ok === false, `${label} was not rejected: ${display(result)}.`);
  const stage = result.error?.stage ?? result.stage;
  const code = result.error?.code ?? result.error?.errorCode ?? result.errorCode;
  assert(stage === expected.stage, `${label} rejected at ${display(stage)}; expected ${expected.stage}.`);
  assert(code === expected.errorCode, `${label} returned ${display(code)}; expected ${expected.errorCode}.`);
  assert(result.decision === "REJECT", `${label} returned a non-REJECT decision.`);
  assert(result.digests && typeof result.digests === "object", `${label} omitted its digest envelope.`);
  assertPreflightResult(result, label);
}

async function executeCorpus(verifier, golden, preExecutedPositiveIds) {
  const failures = [];
  const counts = {
    positiveAttempted: preExecutedPositiveIds.size,
    positivePassed: preExecutedPositiveIds.size,
    binaryAttempted: 0,
    binaryPassed: 0,
    crossTypeAttempted: 0,
    crossTypePassed: 0,
  };
  const run = async (group, id, operation) => {
    counts[`${group}Attempted`] += 1;
    try {
      await operation();
      counts[`${group}Passed`] += 1;
    } catch (error) {
      failures.push(`${id}: ${error instanceof Error ? error.message : String(error)}`);
    }
  };

  for (const vector of golden.index.positive) {
    if (preExecutedPositiveIds.has(vector.id)) continue;
    await run("positive", vector.id, async () => {
      const encoded = new Uint8Array(golden.readData(vector.path));
      assert(encoded.byteLength === vector.bytes && sha256(encoded) === vector.sha256, `${vector.id} metadata drifted.`);
      const before = sha256(encoded);
      const result = vector.kind === "SIGNED_OBJECT"
        ? await Promise.resolve(verifier.verifySignedObject({
            expectedType: vector.tokenType,
            encoded,
          }))
        : await Promise.resolve(verifier.parseCarrier({
            carrierType: vector.carrierType,
            encoded,
          }));
      assert(sha256(encoded) === before, `${vector.id} input was mutated by production code.`);
      assertAccepted(result, vector, before);
    });
  }

  for (const vector of golden.index.criticalNegative) {
    await run("binary", vector.id, async () => {
      const encoded = new Uint8Array(golden.readData(vector.path));
      assert(encoded.byteLength === vector.bytes && sha256(encoded) === vector.sha256, `${vector.id} metadata drifted.`);
      const before = sha256(encoded);
      const result = await Promise.resolve(verifier.verifySignedObject({
        expectedType: vector.tokenType,
        encoded,
      }));
      assert(sha256(encoded) === before, `${vector.id} input was mutated by production code.`);
      assertRejected(result, vector.expected, vector.id);
    });
  }

  for (const record of golden.crossType.records) {
    await run("crossType", record.id, async () => {
      const encoded = new Uint8Array(golden.readData(record.baseCosePath));
      assert(sha256(encoded) === record.baseCoseSha256, `${record.id} base digest drifted.`);
      const before = sha256(encoded);
      const result = await Promise.resolve(verifier.verifySignedObject({
        expectedType: record.targetType,
        encoded,
        crossType: true,
      }));
      assert(sha256(encoded) === before, `${record.id} input was mutated by production code.`);
      assertRejected(result, record.expected, record.id);
    });
  }
  return { failures, counts };
}

function assertTrustedKeyInputsUnchanged(trustedKeyData) {
  for (let index = 0; index < trustedKeyData.registrations.length; index += 1) {
    const key = trustedKeyData.registrations[index];
    const snapshot = trustedKeyData.snapshots[index];
    assert(sha256(key.kid) === snapshot.kidSha256, `${snapshot.keyId} kid was mutated by production code.`);
    assert(sha256(key.spkiDer) === snapshot.spkiSha256, `${snapshot.keyId} SPKI was mutated by production code.`);
  }
}

function malformedAccounting(malformed) {
  const stages = ["PRE_DECODE", "CBOR_PARSE", "COSE_PARSE", "DOMAIN", "SCHEMA", "SIGNATURE", "TRUST", "CLAIMS", "STATE"];
  const binaryByStage = Object.fromEntries(stages.map((stage) => [stage, 0]));
  const descriptorByStage = Object.fromEntries(stages.map((stage) => [stage, 0]));
  const stateOwners = {
    "LIC-6.2-003": 0,
    "LIC-6.2-004": 0,
    "LIC-6.2-005": 0,
    "LIC-6.2-007": 0,
  };
  for (const record of malformed.records) {
    const target = record.binaryExecution === "BINARY_FIXTURE" ? binaryByStage : descriptorByStage;
    assert(record.expected.stage in target, `${record.id} has unknown stage ${record.expected.stage}.`);
    target[record.expected.stage] += 1;
    if (record.expected.stage === "STATE") {
      const owner = record.tokenType === "key-delegation" || record.tokenType === "key-denylist"
        ? "LIC-6.2-003"
        : record.tokenType === "time-correction"
          ? "LIC-6.2-005"
          : record.tokenType === "lease-request"
            ? "LIC-6.2-007"
            : "LIC-6.2-004";
      stateOwners[owner] += 1;
    }
  }
  assert(display(binaryByStage) === display({
    PRE_DECODE: 1,
    CBOR_PARSE: 7,
    COSE_PARSE: 14,
    DOMAIN: 4,
    SCHEMA: 0,
    SIGNATURE: 13,
    TRUST: 3,
    CLAIMS: 0,
    STATE: 0,
  }), "Binary malformed stage ledger drifted.");
  assert(display(descriptorByStage) === display({
    PRE_DECODE: 9,
    CBOR_PARSE: 108,
    COSE_PARSE: 136,
    DOMAIN: 46,
    SCHEMA: 137,
    SIGNATURE: 96,
    TRUST: 42,
    CLAIMS: 91,
    STATE: 37,
  }), "Descriptor-only malformed stage ledger drifted.");
  assert(display(stateOwners) === display({
    "LIC-6.2-003": 11,
    "LIC-6.2-004": 18,
    "LIC-6.2-005": 5,
    "LIC-6.2-007": 3,
  }), "STATE ownership ledger drifted.");
  return { stages, binaryByStage, descriptorByStage, stateOwners };
}

function printReport(loadResult, execution, accounting, descriptorExecution, activationProof) {
  const { counts, failures } = execution;
  process.stdout.write("\n[license-core-v1] Production execution\n");
  process.stdout.write(`  positives:       ${counts.positivePassed}/${counts.positiveAttempted} (35 signed + 6 carriers)\n`);
  process.stdout.write(`  binary negatives:${String(counts.binaryPassed).padStart(4)}/${counts.binaryAttempted}\n`);
  process.stdout.write(`  cross-type:      ${String(counts.crossTypePassed).padStart(4)}/${counts.crossTypeAttempted}\n`);
  process.stdout.write(`  compiled modules:${String(loadResult.newlyLoaded.length).padStart(4)} (production boundary only)\n`);
  process.stdout.write(`  activation PoP:  ${String(activationProof.passed).padStart(4)}/${activationProof.attempted}\n`);
  process.stdout.write("\n[license-core-v1] Frozen malformed corpus (744 records)\n");
  process.stdout.write("  stage          binary executed   descriptor-only corpus\n");
  for (const stage of accounting.stages) {
    process.stdout.write(
      `  ${stage.padEnd(14)}${String(accounting.binaryByStage[stage]).padStart(7)}${String(accounting.descriptorByStage[stage]).padStart(27)}\n`,
    );
  }
  process.stdout.write("  total              42                        702\n");
  process.stdout.write("\n[license-core-v1] Descriptor/preflight ownership\n");
  process.stdout.write("  LIC-6.2-003: 676 descriptors (665 non-STATE + 11 trust/delegation STATE)\n");
  process.stdout.write("  LIC-6.2-004:  18 STATE transition/admission records\n");
  process.stdout.write("  LIC-6.2-005:   5 trusted-time STATE records\n");
  process.stdout.write("  LIC-6.2-007:   3 lease challenge/request replay STATE records\n");
  process.stdout.write("  LIC-6.2-003 materializes and executes its 676 owned descriptors against production seams.\n");
  process.stdout.write("  Downstream owners must execute their remaining 26 STATE records around persistence, replay, and atomicity.\n");
  process.stdout.write("\n[license-core-v1] LIC-6.2-003 descriptor execution\n");
  for (const [stage, count] of Object.entries(descriptorExecution.counts)) {
    process.stdout.write(`  ${stage.padEnd(14)}${String(count.passed).padStart(4)}/${count.attempted}\n`);
  }
  if (failures.length > 0) {
    process.stderr.write(`\n[license-core-v1] ${failures.length} production corpus failure(s):\n`);
    for (const failure of failures) process.stderr.write(`  - ${failure}\n`);
  }
}

async function main() {
  assert(process.argv.length === 2, "Usage: node scripts/test-license-core-v1.mjs");
  const versionPath = path.join(repositoryRoot, "version.json");
  const version = JSON.parse(readRegularFile(versionPath, "version.json", 64 * 1024).toString("utf8"));
  assert(version.nodeVersion === EXPECTED_NODE_VERSION, "version.json Node pin drifted.");
  assert(
    process.versions.node === EXPECTED_NODE_VERSION,
    `License production-core gate requires Node ${EXPECTED_NODE_VERSION}; received ${process.versions.node}. Run npx.cmd --yes -p node@${EXPECTED_NODE_VERSION} -c "node scripts/test-license-core-v1.mjs".`,
  );

  runServerBuild();
  scanProductionIsolation();
  const production = loadProductionApi();
  validateProtocolConstants(production.protocol);
  const golden = loadGoldenData();
  validateGoldenRelationships(golden);
  const trustedKeyData = loadTrustedKeys(golden.index, golden.readData);
  const testIssuer = await loadTestIssuerAfterProductionIsolation();
  const bootstrapped = await bootstrapTrust(production, golden, trustedKeyData, testIssuer);
  const verifier = await Promise.resolve(production.core.createLicenseVerifierV1({
    crypto: production.nodeCryptoV1,
    environment: "TEST",
    roots: trustedKeyData.roots,
    trustedKeys: trustedKeyData.trustedKeys,
    delegations: bootstrapped.delegations,
    denylist: bootstrapped.denylist,
  }));
  assert(verifier && typeof verifier.verifySignedObject === "function", "Production verifier must expose verifySignedObject().");
  assert(typeof verifier.parseCarrier === "function", "Production verifier must expose parseCarrier().");
  assert(typeof verifier.verifyCarrier === "function", "Production verifier must expose verifyCarrier().");

  const execution = await executeCorpus(verifier, golden, bootstrapped.positiveIds);
  const { executeLic003DescriptorCorpus, executeActivationProofOfPossessionRegressions } =
    await import("./lib/license-core-descriptor-executor.mjs");
  const descriptorInput = {
    production,
    golden,
    verifier,
    trustConfiguration: {
      roots: trustedKeyData.roots,
      trustedKeys: trustedKeyData.trustedKeys,
      delegations: bootstrapped.delegations,
      denylist: bootstrapped.denylist,
    },
  };
  const descriptorExecution = await executeLic003DescriptorCorpus(descriptorInput);
  const activationProof = executeActivationProofOfPossessionRegressions(descriptorInput);
  const { executeContextVerificationRegressions } = await import("./lib/license-core-context-executor.mjs");
  const contextual = executeContextVerificationRegressions(descriptorInput);
  process.stdout.write(`\n[license-core-v1] Carrier/context regression: ${contextual.passed}/${contextual.attempted}\n`);
  for (const failure of contextual.failures) process.stderr.write(`  - ${failure}\n`);
  assertTrustedKeyInputsUnchanged(trustedKeyData);
  const accounting = malformedAccounting(golden.malformed);
  printReport(production, execution, accounting, descriptorExecution, activationProof);
  assert(execution.failures.length === 0, "Production parser/verifier did not match the Golden Vector corpus.");
  if (descriptorExecution.failures.length > 0) {
    for (const failure of descriptorExecution.failures) process.stderr.write(`  - ${failure}\n`);
  }
  assert(descriptorExecution.failures.length === 0, "LIC-6.2-003 descriptor execution failed.");
  assert(Object.values(descriptorExecution.counts).every((count) => count.attempted === count.passed), "LIC-6.2-003 descriptor coverage is incomplete.");
  if (activationProof.failures.length > 0) {
    for (const failure of activationProof.failures) process.stderr.write(`  - ${failure}\n`);
  }
  assert(activationProof.failures.length === 0 && activationProof.passed === 12, "Activation proof-of-possession regressions failed.");
  assert(contextual.failures.length === 0 && contextual.passed === contextual.attempted, "Carrier/context regressions failed.");
  process.stdout.write(
    `\n[license-core-v1] PASS - Node ${process.versions.node}; production graph imported no Golden issuer/private-key/test-verifier code.\n`,
  );
}

main().catch((error) => {
  process.stderr.write(`\n[license-core-v1] FAIL - ${error instanceof Error ? error.stack ?? error.message : String(error)}\n`);
  process.exitCode = 1;
});
