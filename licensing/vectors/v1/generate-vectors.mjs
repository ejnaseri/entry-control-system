#!/usr/bin/env node
// TEST_ONLY_DO_NOT_TRUST: deterministic non-production fixture generator.

import { existsSync, lstatSync, mkdirSync, readFileSync, readdirSync, realpathSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { assertCborOrderingSelfTest, buildVectorArtifacts } from "./lib/build-vectors.mjs";

const packageRoot = path.dirname(fileURLToPath(import.meta.url));
const repositoryRoot = path.resolve(packageRoot, "..", "..", "..");

function fail(message) {
  console.error(`not ok - ${message}`);
  process.exitCode = 1;
}

function parseArguments(args) {
  if (args.length === 1 && args[0] === "--check") return { mode: "check", output: packageRoot };
  if (args.length === 2 && ["--generate", "--output"].includes(args[0])) {
    return { mode: "generate", output: path.resolve(args[1]) };
  }
  throw new Error("Usage: generate-vectors.mjs --check | (--generate|--output) <directory>");
}

function compareArtifacts(artifacts, outputRoot) {
  const differences = [];
  for (const [relativePath, expected] of artifacts) {
    const absolutePath = path.join(outputRoot, ...relativePath.split("/"));
    if (!existsSync(absolutePath)) differences.push(`${relativePath}: missing`);
    else {
      const stats = lstatSync(absolutePath);
      if (!stats.isFile() || stats.isSymbolicLink()) differences.push(`${relativePath}: not a regular non-link file`);
      else if (stats.size !== expected.length || !readFileSync(absolutePath).equals(expected)) differences.push(`${relativePath}: byte mismatch`);
    }
  }
  return differences;
}

function pathContains(parent, child) {
  const relative = path.relative(path.resolve(parent), path.resolve(child));
  return relative === "" || (!relative.startsWith("..") && !path.isAbsolute(relative));
}

function assertNoLinkedExistingComponents(target) {
  const resolved = path.resolve(target);
  const parsed = path.parse(resolved);
  let current = parsed.root;
  for (const segment of resolved.slice(parsed.root.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    if (!existsSync(current)) break;
    const stats = lstatSync(current);
    if (stats.isSymbolicLink()) throw new Error(`Output path contains a link/reparse component: ${current}`);
    if (!stats.isDirectory() && current !== resolved) throw new Error(`Output path parent is not a directory: ${current}`);
  }
}

function prepareDisposableOutput(outputRoot) {
  const resolved = path.resolve(outputRoot);
  if (pathContains(repositoryRoot, resolved) || pathContains(resolved, repositoryRoot)
      || pathContains(packageRoot, resolved) || pathContains(resolved, packageRoot)) {
    throw new Error("Generation output must be outside and unrelated to the repository/package tree.");
  }
  assertNoLinkedExistingComponents(resolved);
  if (existsSync(resolved)) {
    const stats = lstatSync(resolved);
    if (!stats.isDirectory() || stats.isSymbolicLink()) throw new Error("Generation output must be a regular directory.");
    if (readdirSync(resolved).length !== 0) throw new Error("Generation output must be fresh or empty.");
  } else {
    mkdirSync(resolved, { recursive: true });
  }
  assertNoLinkedExistingComponents(resolved);
  const canonical = realpathSync.native(resolved);
  if (pathContains(repositoryRoot, canonical) || pathContains(canonical, repositoryRoot)) {
    throw new Error("Generation output resolves into or above the repository.");
  }
  return resolved;
}

function writeArtifacts(artifacts, outputRoot) {
  for (const [relativePath, bytes] of artifacts) {
    const absolutePath = path.join(outputRoot, ...relativePath.split("/"));
    mkdirSync(path.dirname(absolutePath), { recursive: true });
    writeFileSync(absolutePath, bytes, { flag: "wx" });
  }
}

try {
  const options = parseArguments(process.argv.slice(2));
  assertCborOrderingSelfTest();
  const { artifacts, index } = buildVectorArtifacts(repositoryRoot);
  if (options.mode === "check") {
    const differences = compareArtifacts(artifacts, options.output);
    if (differences.length) throw new Error(`deterministic regeneration differs:\n${differences.join("\n")}`);
    console.log(`ok - ${artifacts.size} generated files are byte-identical (${index.positive.length} positive, ${index.criticalNegative.length} critical negative, 744 malformed, 90 cross-type)`);
  } else {
    const output = prepareDisposableOutput(options.output);
    writeArtifacts(artifacts, output);
    console.log(`ok - generated ${artifacts.size} deterministic files under ${output}`);
  }
} catch (error) {
  fail(error instanceof Error ? (error.stack ?? error.message) : String(error));
}
