import { randomUUID } from "node:crypto";
import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  readdirSync,
  realpathSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const buildIdentityContract = require("./lib/build-identity.cjs");
const artifactContract = require("./lib/artifact-manifest.cjs");

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const serverRoot = path.join(repositoryRoot, "server");
const clientRoot = path.join(repositoryRoot, "client");
const releaseRoot = path.join(repositoryRoot, "release");
const parsedVersionIdentity = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));
const permittedNodeEnvironment = new Map([["NODE_DISABLE_COMPILE_CACHE", "1"]]);
for (const [key, value] of Object.entries(process.env)) {
  const normalizedKey = key.toUpperCase();
  // npm/npx sets NODE_EXE as launcher metadata. Node itself does not consume it,
  // and it is not propagated into the whitelisted child environment below.
  const isLauncherExecutable = normalizedKey === "NODE_EXE";
  if (
    normalizedKey.startsWith("NODE_")
    && value
    && !isLauncherExecutable
    && permittedNodeEnvironment.get(normalizedKey) !== value
  ) {
    throw new Error(`${key} must be unset for a reproducible release build.`);
  }
}

function normalizedPath(value) {
  return path.resolve(value).toLocaleLowerCase("en-US");
}

function isPathInside(parentPath, candidatePath) {
  const relative = path.relative(parentPath, candidatePath);
  return relative !== ""
    && !path.isAbsolute(relative)
    && relative !== ".."
    && !relative.startsWith(`..${path.sep}`);
}

function assertNoLinkedExistingAncestors(candidatePath) {
  let cursor = path.resolve(candidatePath);
  while (true) {
    if (existsSync(cursor) && lstatSync(cursor).isSymbolicLink()) {
      throw new Error(`Refusing build path with a symbolic-link or junction ancestor: ${cursor}`);
    }
    const parent = path.dirname(cursor);
    if (parent === cursor) return;
    cursor = parent;
  }
}

function parseArguments(argv) {
  let edition;
  let output;
  let sawEdition = false;
  let sawOutput = false;
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--edition") {
      if (sawEdition) throw new Error("Duplicate build argument: --edition");
      if (argv[index + 1] === undefined || argv[index + 1].startsWith("--")) {
        throw new Error("Build argument --edition requires a value.");
      }
      sawEdition = true;
      edition = argv[++index];
    } else if (argument === "--output") {
      if (sawOutput) throw new Error("Duplicate build argument: --output");
      if (argv[index + 1] === undefined || argv[index + 1].startsWith("--")) {
        throw new Error("Build argument --output requires a value.");
      }
      sawOutput = true;
      output = argv[++index];
    } else throw new Error(`Unknown build argument: ${argument}`);
  }
  return { edition: versionContract.parseBuildEdition(edition, parsedVersionIdentity.identity), output };
}

function assertSafeOutput(targetPath, edition) {
  const target = path.resolve(targetPath);
  const filesystemRoot = path.parse(target).root;
  assertNoLinkedExistingAncestors(path.dirname(target));
  if (existsSync(target) && lstatSync(target).isSymbolicLink()) {
    throw new Error(`Refusing symbolic-link or junction artifact output path: ${target}`);
  }
  const isInsideRepository = normalizedPath(target) === normalizedPath(repositoryRoot)
    || isPathInside(repositoryRoot, target);
  const isInsideRelease = isPathInside(releaseRoot, target);
  const ownedEditionTarget = path.join(releaseRoot, edition);
  const canReplace = normalizedPath(target) === normalizedPath(ownedEditionTarget);
  if (target === filesystemRoot || target === releaseRoot || (isInsideRepository && !isInsideRelease)) {
    throw new Error(`Refusing unsafe artifact output path: ${target}`);
  }
  if (isInsideRelease && !canReplace) {
    throw new Error(
      `Refusing repository release output outside the requested Edition path ${ownedEditionTarget}: ${target}`
    );
  }
  if (!canReplace && existsSync(target)) {
    throw new Error(`Refusing to replace an existing custom artifact output path: ${target}`);
  }
  return { target, canReplace };
}

function assertRealOutputPolicy(targetPath, canReplace) {
  const targetParent = path.dirname(targetPath);
  assertNoLinkedExistingAncestors(targetParent);
  const realRepositoryRoot = realpathSync.native(repositoryRoot);
  const realTargetParent = realpathSync.native(targetParent);
  const realCandidate = path.join(realTargetParent, path.basename(targetPath));
  const realReleaseRoot = existsSync(releaseRoot) ? realpathSync.native(releaseRoot) : null;
  const insideRealRepository = normalizedPath(realCandidate) === normalizedPath(realRepositoryRoot)
    || isPathInside(realRepositoryRoot, realCandidate);
  const insideRealRelease = realReleaseRoot !== null && isPathInside(realReleaseRoot, realCandidate);
  if (insideRealRepository && !insideRealRelease) {
    throw new Error(`Refusing artifact output whose resolved path enters repository source: ${targetPath}`);
  }
  if (canReplace && !insideRealRelease) {
    throw new Error(`Artifact output ownership changed after resolving its parent: ${targetPath}`);
  }
}

function removeTreeWithoutFollowingLinks(targetPath) {
  const stats = lstatSync(targetPath);
  if (stats.isSymbolicLink() || stats.isFile()) {
    unlinkSync(targetPath);
    return;
  }
  if (!stats.isDirectory()) throw new Error(`Refusing unsupported build cleanup entry: ${targetPath}`);
  for (const entry of readdirSync(targetPath)) {
    removeTreeWithoutFollowingLinks(path.join(targetPath, entry));
  }
  rmdirSync(targetPath);
}

function removeOwnedDirectory(targetPath, parentPath, prefix) {
  const resolvedTarget = path.resolve(targetPath);
  const resolvedParent = path.resolve(parentPath);
  if (path.dirname(resolvedTarget) !== resolvedParent || !path.basename(resolvedTarget).startsWith(prefix)) {
    throw new Error(`Refusing to remove non-owned build directory: ${resolvedTarget}`);
  }
  if (!existsSync(resolvedTarget)) return;
  assertNoLinkedExistingAncestors(resolvedParent);
  if (lstatSync(resolvedTarget).isSymbolicLink()) {
    throw new Error(`Refusing to recursively remove linked build directory: ${resolvedTarget}`);
  }
  const realParent = realpathSync.native(resolvedParent);
  const realTarget = realpathSync.native(resolvedTarget);
  if (normalizedPath(path.dirname(realTarget)) !== normalizedPath(realParent)) {
    throw new Error(`Refusing build cleanup outside its resolved parent: ${resolvedTarget}`);
  }
  removeTreeWithoutFollowingLinks(resolvedTarget);
}

function sanitizedBuildEnvironment(edition) {
  const environment = {};
  const retainedHostKeys = new Set([
    "COMSPEC",
    "LOCALAPPDATA",
    "NUMBER_OF_PROCESSORS",
    "PATHEXT",
    "PROCESSOR_ARCHITECTURE",
    "SYSTEMROOT",
    "TEMP",
    "TMP",
    "TMPDIR",
    "WINDIR",
  ]);
  for (const [key, value] of Object.entries(process.env)) {
    if (value !== undefined && retainedHostKeys.has(key.toUpperCase())) environment[key] = value;
  }
  environment.ECS_BUILD_EDITION = edition;
  environment.APP_EDITION = edition;
  environment.NODE_ENV = "production";
  environment.VITE_API_URL = "";
  environment.CI = "1";
  environment.LANG = "C";
  environment.LC_ALL = "C";
  environment.NO_COLOR = "1";
  environment.NODE_DISABLE_COMPILE_CACHE = "1";
  environment.TZ = "UTC";
  return environment;
}

function runNodeStep(label, entryPath, args, workingDirectory, environment) {
  process.stdout.write(`[build:${environment.ECS_BUILD_EDITION.toLowerCase()}] ${label}\n`);
  const result = spawnSync(process.execPath, [entryPath, ...args], {
    cwd: workingDirectory,
    env: environment,
    shell: false,
    stdio: "inherit",
    windowsHide: true,
    timeout: 10 * 60 * 1000,
  });
  if (result.error) throw new Error(`${label} could not complete: ${result.error.message}`);
  if (result.status !== 0) {
    const detail = result.signal ? `signal ${result.signal}` : `exit ${String(result.status)}`;
    throw new Error(`${label} failed (${detail}).`);
  }
}

function writeJsonNormalized(targetPath, value) {
  writeFileSync(targetPath, `${JSON.stringify(value, null, 2)}\n`, { encoding: "utf8", flag: "wx" });
}

function copyTextNormalized(sourcePath, targetPath) {
  const text = readFileSync(sourcePath, "utf8").replaceAll("\r\n", "\n");
  writeFileSync(targetPath, text, { encoding: "utf8", flag: "wx" });
}

function assertPackageVersions() {
  for (const packagePath of [path.join(serverRoot, "package.json"), path.join(clientRoot, "package.json")]) {
    const packageDocument = JSON.parse(readFileSync(packagePath, "utf8"));
    if (packageDocument.version !== parsedVersionIdentity.identity.productVersion) {
      throw new Error(
        `${packagePath} version ${JSON.stringify(packageDocument.version)} does not mirror canonical productVersion ${parsedVersionIdentity.identity.productVersion}.`
      );
    }
  }
}

function promote(stagingPath, targetPath, canReplace) {
  const parent = path.dirname(targetPath);
  assertRealOutputPolicy(targetPath, canReplace);
  if (existsSync(targetPath) && lstatSync(targetPath).isSymbolicLink()) {
    throw new Error(`Refusing to promote over a symbolic-link or junction artifact path: ${targetPath}`);
  }
  const backupName = `${path.basename(targetPath)}.previous-${process.pid}-${randomUUID()}`;
  const backupPath = path.join(parent, backupName);
  let movedPrevious = false;
  if (existsSync(targetPath)) {
    if (!canReplace) {
      throw new Error(`Refusing to replace an existing custom artifact output path: ${targetPath}`);
    }
    renameSync(targetPath, backupPath);
    movedPrevious = true;
  }
  try {
    renameSync(stagingPath, targetPath);
  } catch (error) {
    if (movedPrevious && !existsSync(targetPath)) renameSync(backupPath, targetPath);
    throw error;
  }
  if (movedPrevious) removeOwnedDirectory(backupPath, parent, `${path.basename(targetPath)}.previous-`);
}

const { edition, output } = parseArguments(process.argv.slice(2));
versionContract.assertNodeVersion(parsedVersionIdentity.identity);
assertPackageVersions();

const outputPolicy = assertSafeOutput(
  output === undefined ? path.join(releaseRoot, edition) : path.resolve(repositoryRoot, output),
  edition
);
const targetPath = outputPolicy.target;
const targetParent = path.dirname(targetPath);
mkdirSync(targetParent, { recursive: true });
assertRealOutputPolicy(targetPath, outputPolicy.canReplace);
const stagingName = `${path.basename(targetPath)}.staging-${process.pid}-${randomUUID()}`;
const stagingPath = path.join(targetParent, stagingName);
removeOwnedDirectory(stagingPath, targetParent, `${path.basename(targetPath)}.staging-`);
mkdirSync(path.join(stagingPath, "server", "dist"), { recursive: true });
mkdirSync(path.join(stagingPath, "client"), { recursive: true });
mkdirSync(path.join(stagingPath, "scripts", "lib"), { recursive: true });

const environment = sanitizedBuildEnvironment(edition);
const serverTsc = path.join(serverRoot, "node_modules", "typescript", "bin", "tsc");
const clientTsc = path.join(clientRoot, "node_modules", "typescript", "bin", "tsc");
const viteEntry = path.join(clientRoot, "node_modules", "vite", "bin", "vite.js");

try {
  runNodeStep(
    "Server production TypeScript build",
    serverTsc,
    ["-p", "tsconfig.runtime.json", "--outDir", path.join(stagingPath, "server", "dist")],
    serverRoot,
    environment
  );
  runNodeStep("Client typecheck", clientTsc, ["-b", "--pretty", "false"], clientRoot, environment);
  runNodeStep(
    "Client production Vite build",
    viteEntry,
    ["build", "--outDir", path.join(stagingPath, "client"), "--emptyOutDir"],
    clientRoot,
    environment
  );

  const buildIdentity = buildIdentityContract.createBuildIdentity(parsedVersionIdentity, edition);
  writeJsonNormalized(path.join(stagingPath, "version.json"), parsedVersionIdentity.identity);
  writeFileSync(
    path.join(stagingPath, "build-identity.json"),
    buildIdentityContract.serializeBuildIdentity(buildIdentity).text,
    { encoding: "utf8", flag: "wx" }
  );

  for (const fileName of ["package.json", "package-lock.json"]) {
    writeJsonNormalized(
      path.join(stagingPath, "server", fileName),
      JSON.parse(readFileSync(path.join(serverRoot, fileName), "utf8"))
    );
  }
  for (const fileName of ["version-identity.cjs", "build-identity.cjs"]) {
    copyTextNormalized(
      path.join(scriptDirectory, "lib", fileName),
      path.join(stagingPath, "scripts", "lib", fileName)
    );
  }

  const manifest = artifactContract.createArtifactManifest(stagingPath, parsedVersionIdentity, buildIdentity);
  const serializedManifest = artifactContract.serializeArtifactManifest(manifest);
  writeFileSync(path.join(stagingPath, artifactContract.MANIFEST_FILE), serializedManifest.text, {
    encoding: "utf8",
    flag: "wx",
  });
  writeFileSync(
    path.join(stagingPath, artifactContract.MANIFEST_HASH_FILE),
    `${serializedManifest.sha256}  ${artifactContract.MANIFEST_FILE}\n`,
    { encoding: "utf8", flag: "wx" }
  );
  artifactContract.verifyArtifact(stagingPath, parsedVersionIdentity, edition);
  promote(stagingPath, targetPath, outputPolicy.canReplace);
  const verification = artifactContract.verifyArtifact(targetPath, parsedVersionIdentity, edition);
  process.stdout.write(
    `[build:${edition.toLowerCase()}] PASS ${targetPath}\n[build:${edition.toLowerCase()}] manifest sha256 ${verification.manifestSha256}\n`
  );
} finally {
  if (existsSync(stagingPath)) {
    removeOwnedDirectory(stagingPath, targetParent, `${path.basename(targetPath)}.staging-`);
  }
}
