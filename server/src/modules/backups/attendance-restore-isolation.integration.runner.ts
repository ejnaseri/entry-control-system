import assert from "node:assert/strict";
import { spawn, type ChildProcess } from "node:child_process";
import { randomBytes } from "node:crypto";
import { existsSync, readdirSync } from "node:fs";
import { access, mkdtemp, rm, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import pg from "pg";

const { Client } = pg;
const SERVER_ROOT = path.resolve(__dirname, "../../..");
const WORKER_PATH = path.join(__dirname, "attendance-restore-isolation.integration.worker.js");
const DATABASE_PREFIX = "ecs_att_restore_";
const DATABASE_NAME_PATTERN = /^ecs_att_restore_(?:src|dst)_[a-z0-9_]+$/u;
const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CONTROL_DATABASE = "postgres";
const CHILD_TIMEOUT_MS = 10 * 60 * 1000;
const MAX_OUTPUT_BYTES = 2 * 1024 * 1024;
const TEMP_PREFIX = "ecs-attendance-restore-isolation-";
const POSTGRES_TOOLS = ["pg_dump", "pg_restore"] as const;

type ToolName = (typeof POSTGRES_TOOLS)[number];
type WorkerMode = "seed" | "assert" | "assert-full";
type DatabaseState = { readonly name: string; readonly url: URL; created: boolean };
type Context = {
  readonly controlUrl: URL;
  readonly source: DatabaseState;
  readonly target: DatabaseState;
  readonly marker: string;
  readonly prismaCliPath: string;
  readonly workerPath: string;
  readonly pgDumpPath: string;
  readonly pgRestorePath: string;
  readonly temporaryRoot: string;
  readonly dumpPath: string;
};

let activeChild: ChildProcess | null = null;
let activeTermination: Promise<void> | null = null;
let interruptedSignal: NodeJS.Signals | null = null;

function assertSafeDatabaseName(name: string) {
  assert.match(name, DATABASE_NAME_PATTERN, "Unsafe disposable database name");
  assert.ok(Buffer.byteLength(name, "utf8") <= 63, "Disposable database name exceeds PostgreSQL's limit");
}

function quoteIdentifier(name: string) {
  assertSafeDatabaseName(name);
  return `"${name.replaceAll('"', '""')}"`;
}

function parseSafeDatabaseUrl(raw: string) {
  const url = new URL(raw);
  assert.ok(url.protocol === "postgres:" || url.protocol === "postgresql:", "Integration test requires PostgreSQL");
  assert.ok(LOOPBACK_HOSTS.has(url.hostname.toLowerCase()), "Integration test only allows loopback PostgreSQL");
  assert.ok(url.username, "DATABASE_URL must contain an explicit user");
  assert.ok(decodeURIComponent(url.pathname.replace(/^\/+/, "")), "DATABASE_URL must contain a database name");
  for (const key of url.searchParams.keys()) {
    assert.ok(!["host", "hostaddr", "port", "user", "username", "password", "database", "dbname", "service"].includes(key.toLowerCase()),
      `Unsafe DATABASE_URL connection override: ${key}`);
  }
  url.port ||= "5432";
  return url;
}

function databaseUrl(base: URL, name: string) {
  const url = new URL(base.href);
  url.pathname = `/${name}`;
  url.hash = "";
  return url;
}

function resolveTool(name: ToolName) {
  const overrideKey = name === "pg_dump" ? "ATLASGYM_PG_DUMP_PATH" : "ATLASGYM_PG_RESTORE_PATH";
  const override = process.env[overrideKey];
  if (override) return override;
  if (process.platform !== "win32") return name;
  for (const root of ["C:\\Program Files\\PostgreSQL", "C:\\Program Files (x86)\\PostgreSQL"]) {
    if (!existsSync(root)) continue;
    const versions = readdirSync(root, { withFileTypes: true })
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort((a, b) => b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" }));
    for (const version of versions) {
      const candidate = path.join(root, version, "bin", `${name}.exe`);
      if (existsSync(candidate)) return candidate;
    }
  }
  return name;
}

function assertSafeTemporaryRoot(root: string) {
  const resolved = path.resolve(root);
  const relative = path.relative(path.resolve(os.tmpdir()), resolved);
  assert.ok(relative && relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative));
  assert.ok(path.basename(resolved).startsWith(TEMP_PREFIX), "Unexpected integration temporary root");
}

async function prepareContext(): Promise<Context> {
  if (!process.env["DATABASE_URL"]) process.loadEnvFile(path.join(SERVER_ROOT, ".env"));
  assert.notEqual(process.env["NODE_ENV"], "production", "Integration test refuses NODE_ENV=production");
  const baseUrl = parseSafeDatabaseUrl(process.env["DATABASE_URL"] ?? "");
  const marker = `${Date.now().toString(36)}_${randomBytes(4).toString("hex")}`;
  const sourceName = `${DATABASE_PREFIX}src_${marker}`;
  const targetName = `${DATABASE_PREFIX}dst_${marker}`;
  assertSafeDatabaseName(sourceName);
  assertSafeDatabaseName(targetName);
  const prismaCliPath = require.resolve("prisma/build/index.js", { paths: [SERVER_ROOT] });
  const pgDumpPath = resolveTool("pg_dump");
  const pgRestorePath = resolveTool("pg_restore");
  await Promise.all([access(prismaCliPath), access(WORKER_PATH), access(pgDumpPath), access(pgRestorePath)]);
  const temporaryRoot = await mkdtemp(path.join(os.tmpdir(), TEMP_PREFIX));
  assertSafeTemporaryRoot(temporaryRoot);
  return {
    controlUrl: databaseUrl(baseUrl, CONTROL_DATABASE),
    source: { name: sourceName, url: databaseUrl(baseUrl, sourceName), created: false },
    target: { name: targetName, url: databaseUrl(baseUrl, targetName), created: false },
    marker,
    prismaCliPath,
    workerPath: WORKER_PATH,
    pgDumpPath,
    pgRestorePath,
    temporaryRoot,
    dumpPath: path.join(temporaryRoot, "full-source.dump"),
  };
}

function controlClient(controlUrl: URL) {
  return new Client({
    connectionString: controlUrl.href,
    application_name: "ecs_attendance_restore_isolation_runner",
    connectionTimeoutMillis: 10_000,
    query_timeout: 30_000,
    statement_timeout: 30_000,
  });
}

async function withControlClient<T>(controlUrl: URL, operation: (client: InstanceType<typeof Client>) => Promise<T>) {
  const client = controlClient(controlUrl);
  await client.connect();
  try {
    const current = await client.query<{ name: string }>('SELECT current_database() AS "name"');
    assert.equal(current.rows[0]?.name, CONTROL_DATABASE);
    return await operation(client);
  } finally {
    await client.end();
  }
}

async function createDatabase(controlUrl: URL, state: DatabaseState) {
  assertSafeDatabaseName(state.name);
  await withControlClient(controlUrl, async (client) => {
    const privilege = await client.query<{ allowed: boolean }>('SELECT (rolcreatedb OR rolsuper) AS "allowed" FROM pg_roles WHERE rolname=current_user');
    assert.equal(privilege.rows[0]?.allowed, true, "Local PostgreSQL role needs CREATEDB for restore integration tests");
    const collision = await client.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=$1) AS "exists"', [state.name]);
    assert.equal(collision.rows[0]?.exists, false, "Generated disposable database already exists");
    await client.query(`CREATE DATABASE ${quoteIdentifier(state.name)}`);
    state.created = true;
  });
}

async function dropDatabase(controlUrl: URL, state: DatabaseState) {
  if (!state.created) return;
  assertSafeDatabaseName(state.name);
  await withControlClient(controlUrl, async (client) => {
    const exists = await client.query<{ exists: boolean }>('SELECT EXISTS(SELECT 1 FROM pg_database WHERE datname=$1) AS "exists"', [state.name]);
    if (!exists.rows[0]?.exists) {
      state.created = false;
      return;
    }
    await client.query(`ALTER DATABASE ${quoteIdentifier(state.name)} WITH ALLOW_CONNECTIONS false`);
    await client.query("SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname=$1 AND pid<>pg_backend_pid()", [state.name]);
    await client.query(`DROP DATABASE ${quoteIdentifier(state.name)}`);
    state.created = false;
  });
}

function postgresEnvironment(url: URL) {
  const environment: NodeJS.ProcessEnv = { ...process.env };
  environment["PGHOST"] = url.hostname;
  environment["PGPORT"] = url.port || "5432";
  environment["PGUSER"] = decodeURIComponent(url.username);
  environment["PGDATABASE"] = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (url.password) environment["PGPASSWORD"] = decodeURIComponent(url.password);
  else delete environment["PGPASSWORD"];
  delete environment["PGSERVICE"];
  delete environment["PGSERVICEFILE"];
  return environment;
}

function workerEnvironment(context: Context, database: DatabaseState, mode: WorkerMode) {
  const attendanceTarget = mode === "assert";
  const environment: NodeJS.ProcessEnv = {
    ...process.env,
    APP_EDITION: attendanceTarget ? "ATTENDANCE" : "FULL",
    APP_TIMEZONE: mode === "seed" ? "UTC" : "Asia/Kabul",
    ATTENDANCE_AUTO_CHECKOUT_ENABLED: mode === "seed" ? "1" : "0",
    ATTENDANCE_POLICY: "TIME_CLOCK",
    ATTENDANCE_RESTORE_TEST_MARKER: context.marker,
    ATTENDANCE_RESTORE_TEST_MODE: mode,
    ATLASGYM_BACKUP_ROOT: context.temporaryRoot,
    DATABASE_URL: database.url.href,
    NODE_ENV: "test",
    PORT: "4000",
    TZ: mode === "seed" ? "Pacific/Honolulu" : "UTC",
  };
  delete environment["SHADOW_DATABASE_URL"];
  delete environment["APP_FEATURE_INBOX"];
  delete environment["APP_FEATURE_SOUNDS"];
  delete environment["APP_FEATURE_DEVICE_DIAGNOSTICS"];
  delete environment["APP_FEATURE_DOOR_CONTROL"];
  return environment;
}

function redact(value: string, urls: URL[]) {
  let result = value.replace(/postgres(?:ql)?:\/\/[^\s"'`<>]+/giu, "postgresql://***");
  for (const url of urls) {
    for (const credential of [url.username, url.password]) {
      if (!credential) continue;
      const decoded = decodeURIComponent(credential);
      if (decoded.length >= 3) result = result.replaceAll(decoded, "***");
    }
  }
  return result;
}

function childHasExited(child: ChildProcess) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForChildExit(child: ChildProcess, timeoutMs = 15_000) {
  if (childHasExited(child)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.off("close", onClose);
      reject(new Error("Timed out waiting for integration child to close"));
    }, timeoutMs);
    const onClose = () => {
      clearTimeout(timeout);
      resolve();
    };
    child.once("close", onClose);
  });
}

async function terminateChildProcess(child: ChildProcess) {
  if (childHasExited(child)) return;
  if (process.platform === "win32" && child.pid) {
    await new Promise<void>((resolve) => {
      const killer = spawn("taskkill.exe", ["/PID", String(child.pid), "/T", "/F"], { stdio: "ignore", windowsHide: true });
      killer.once("close", () => resolve());
      killer.once("error", () => {
        child.kill();
        resolve();
      });
    });
  } else child.kill("SIGTERM");
  try {
    await waitForChildExit(child);
  } catch {
    if (!childHasExited(child)) child.kill("SIGKILL");
    await waitForChildExit(child);
  }
}

async function terminateChild() {
  const child = activeChild;
  if (!child || childHasExited(child)) return;
  if (activeTermination) return activeTermination;
  activeTermination = terminateChildProcess(child).finally(() => {
    if (activeChild === child && childHasExited(child)) activeChild = null;
    activeTermination = null;
  });
  return activeTermination;
}

async function runChild(label: string, executable: string, args: string[], environment: NodeJS.ProcessEnv, urls: URL[]) {
  assert.equal(activeChild, null, "Only one integration child may run at once");
  const child = spawn(executable, args, {
    cwd: SERVER_ROOT,
    env: environment,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  activeChild = child;
  const stdout: Buffer[] = [];
  const stderr: Buffer[] = [];
  let stdoutBytes = 0;
  let stderrBytes = 0;
  child.stdout?.on("data", (chunk: Buffer) => {
    if (stdoutBytes < MAX_OUTPUT_BYTES) stdout.push(chunk.subarray(0, MAX_OUTPUT_BYTES - stdoutBytes));
    stdoutBytes += chunk.length;
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    if (stderrBytes < MAX_OUTPUT_BYTES) stderr.push(chunk.subarray(0, MAX_OUTPUT_BYTES - stderrBytes));
    stderrBytes += chunk.length;
  });
  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void terminateChild();
  }, CHILD_TIMEOUT_MS);
  const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).finally(() => {
    clearTimeout(timeout);
    if (activeChild === child) activeChild = null;
  });
  const out = Buffer.concat(stdout).toString("utf8");
  const errorOut = Buffer.concat(stderr).toString("utf8");
  if (out.trim()) console.log(redact(out.trim(), urls));
  if (errorOut.trim()) console.error(redact(errorOut.trim(), urls));
  assert.equal(timedOut, false, `${label} timed out`);
  assert.equal(outcome.code, 0, `${label} failed (${outcome.signal ?? outcome.code ?? "unknown"})`);
}

function throwIfInterrupted() {
  if (interruptedSignal) throw new Error(`Attendance restore integration test interrupted by ${interruptedSignal}`);
}

async function runSuite(context: Context) {
  const fullRegression = process.argv.includes("--full-regression");
  const targetMode: WorkerMode = fullRegression ? "assert-full" : "assert";
  const urls = [context.controlUrl, context.source.url, context.target.url];
  await createDatabase(context.controlUrl, context.source);
  throwIfInterrupted();
  console.log("Applying Prisma migrations to the disposable FULL source database.");
  await runChild("Prisma migrate deploy", process.execPath, [context.prismaCliPath, "migrate", "deploy"], workerEnvironment(context, context.source, "seed"), urls);
  throwIfInterrupted();
  console.log("Seeding Customer, Membership, Payment, Finance, Staff, Device, Inbox, and Audit fixtures.");
  await runChild("FULL fixture worker", process.execPath, [context.workerPath], workerEnvironment(context, context.source, "seed"), urls);
  throwIfInterrupted();
  console.log("Creating a real PostgreSQL custom-format FULL dump.");
  await runChild("pg_dump", context.pgDumpPath, ["--format=custom", "--no-owner", "--no-privileges", "--file", context.dumpPath], postgresEnvironment(context.source.url), urls);
  const dump = await stat(context.dumpPath);
  assert.ok(dump.isFile() && dump.size > 0, "pg_dump did not create a non-empty artifact");
  throwIfInterrupted();
  await createDatabase(context.controlUrl, context.target);
  console.log("Restoring the FULL dump into the disposable target database.");
  await runChild("pg_restore", context.pgRestorePath, ["--exit-on-error", "--no-owner", "--no-privileges", "--dbname", context.target.name, context.dumpPath], postgresEnvironment(context.target.url), urls);
  throwIfInterrupted();
  console.log(
    fullRegression
      ? "Starting the restored database under APP_EDITION=FULL and checking operational compatibility."
      : "Starting the restored database under APP_EDITION=ATTENDANCE and checking isolation."
  );
  await runChild(
    fullRegression ? "FULL restore-regression worker" : "Attendance restore-isolation worker",
    process.execPath,
    [context.workerPath],
    workerEnvironment(context, context.target, targetMode),
    urls
  );
}

async function cleanup(context: Context | null) {
  await terminateChild();
  if (!context) return;
  const errors: unknown[] = [];
  for (const database of [context.target, context.source]) {
    try {
      await dropDatabase(context.controlUrl, database);
    } catch (error) {
      errors.push(error);
    }
  }
  try {
    assertSafeTemporaryRoot(context.temporaryRoot);
    await rm(context.temporaryRoot, { recursive: true, force: true });
  } catch (error) {
    errors.push(error);
  }
  if (errors.length) throw new AggregateError(errors, "Attendance restore integration cleanup failed");
}

function handleSignal(signal: NodeJS.Signals) {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  void terminateChild();
}

async function main() {
  let context: Context | null = null;
  let primaryError: unknown;
  let cleanupError: unknown;
  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);
  try {
    context = await prepareContext();
    await runSuite(context);
  } catch (error) {
    primaryError = error;
  }
  try {
    await cleanup(context);
  } catch (error) {
    cleanupError = error;
  } finally {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  }
  if (primaryError) console.error(primaryError);
  if (cleanupError) console.error(cleanupError);
  if (primaryError || cleanupError) {
    process.exitCode = interruptedSignal === "SIGINT" ? 130 : interruptedSignal === "SIGTERM" ? 143 : 1;
    return;
  }
  assert.ok(context);
  console.log(
    `${process.argv.includes("--full-regression") ? "FULL restore regression" : "Attendance restore isolation/config"} suite passed; ${context.source.name}, ${context.target.name}, and dump artifacts were removed.`
  );
}

void main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
