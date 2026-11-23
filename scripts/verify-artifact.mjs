import path from "node:path";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const versionContract = require("./lib/version-identity.cjs");
const artifactContract = require("./lib/artifact-manifest.cjs");
const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(scriptDirectory, "..");
const parsedVersionIdentity = versionContract.loadVersionIdentity(path.join(repositoryRoot, "version.json"));

let edition;
let artifact;
for (let index = 0; index < process.argv.slice(2).length; index += 1) {
  const args = process.argv.slice(2);
  if (args[index] === "--edition") edition = args[++index];
  else if (args[index] === "--artifact") artifact = args[++index];
  else throw new Error(`Unknown verifier argument: ${args[index]}`);
}

const expectedEdition = versionContract.parseBuildEdition(edition, parsedVersionIdentity.identity);
if (typeof artifact !== "string" || artifact.length === 0) throw new Error("--artifact is required.");
const result = artifactContract.verifyArtifact(path.resolve(repositoryRoot, artifact), parsedVersionIdentity, expectedEdition);
process.stdout.write(`PASS ${result.edition} artifact ${result.root}\nmanifest sha256 ${result.manifestSha256}\n`);
