import assert from "node:assert/strict";
import { spawn, type ChildProcessByStdio } from "node:child_process";
import { randomBytes } from "node:crypto";
import { access } from "node:fs/promises";
import path from "node:path";
import type { Readable } from "node:stream";
import pg from "pg";

const { Client } = pg;

const DATABASE_PREFIX = "atlasgym_backup_workflow_test_";
const DATABASE_NAME_PATTERN = /^atlasgym_backup_workflow_test_[a-z0-9_]+$/u;
const POSTGRES_IDENTIFIER_LIMIT_BYTES = 63;
const CONTROL_DATABASE_NAME = "postgres";
const SERVER_ROOT = path.resolve(__dirname, "../../..");
const WORKER_PATH = path.join(__dirname, "backup.workflow.failure.integration.test.js");
const MIGRATION_TIMEOUT_MS = 5 * 60 * 1000;
const WORKER_TIMEOUT_MS = 10 * 60 * 1000;
const DATABASE_QUERY_TIMEOUT_MS = 30 * 1000;
const CHILD_TERMINATION_TIMEOUT_MS = 15 * 1000;
const MAX_CAPTURED_OUTPUT_BYTES = 2 * 1024 * 1024;

const LOOPBACK_HOSTS = new Set(["localhost", "127.0.0.1", "::1", "[::1]"]);
const CONNECTION_OVERRIDE_QUERY_KEYS = new Set([
  "connectionstring",
  "database",
  "db",
  "dbname",
  "host",
  "hostaddr",
  "password",
  "port",
  "service",
  "servicefile",
  "user",
  "username",
]);
const CHILD_POSTGRES_DESTINATION_ENV_KEYS = [
  "PGDATABASE",
  "PGHOST",
  "PGHOSTADDR",
  "PGOPTIONS",
  "PGPORT",
  "PGSERVICE",
  "PGSERVICEFILE",
] as const;

type RunnerContext = {
  readonly controlUrl: URL;
  readonly targetUrl: URL;
  readonly databaseName: string;
  readonly prismaCliPath: string;
};

type CleanupState = {
  readonly controlUrl: URL;
  readonly databaseName: string;
  createdByThisProcess: boolean;
};

type CapturedOutput = {
  append: (chunk: Buffer | string) => void;
  read: () => string;
};

type TrackedChild = ChildProcessByStdio<null, Readable, Readable>;

class ChildExecutionError extends Error {
  readonly stdout: string;
  readonly stderr: string;

  constructor(message: string, stdout: string, stderr: string) {
    super(message);
    this.name = "ChildExecutionError";
    this.stdout = stdout;
    this.stderr = stderr;
  }
}

let activeChild: TrackedChild | null = null;
let activeTermination: Promise<void> | null = null;
let interruptedSignal: NodeJS.Signals | null = null;

function assertSafeDatabaseName(databaseName: string) {
  assert.match(databaseName, DATABASE_NAME_PATTERN, "Unsafe disposable database name");
  assert.ok(
    Buffer.byteLength(databaseName, "utf8") <= POSTGRES_IDENTIFIER_LIMIT_BYTES,
    "Disposable database name exceeds PostgreSQL's identifier limit"
  );
}

function quoteIdentifier(databaseName: string) {
  assertSafeDatabaseName(databaseName);
  return `"${databaseName.replaceAll('"', '""')}"`;
}

function generateDatabaseName() {
  const timestamp = new Date().toISOString().replace(/\D/gu, "").slice(0, 14);
  const randomSuffix = randomBytes(6).toString("hex");
  const databaseName = `${DATABASE_PREFIX}${timestamp}_${randomSuffix}`;
  assertSafeDatabaseName(databaseName);
  return databaseName;
}

function parseSafeSourceDatabaseUrl(rawDatabaseUrl: string) {
  let databaseUrl: URL;
  try {
    databaseUrl = new URL(rawDatabaseUrl);
  } catch {
    throw new Error("DATABASE_URL must be a valid PostgreSQL URL");
  }

  if (databaseUrl.protocol !== "postgres:" && databaseUrl.protocol !== "postgresql:") {
    throw new Error("Backup workflow integration tests require a PostgreSQL DATABASE_URL");
  }
  if (databaseUrl.hash) {
    throw new Error("DATABASE_URL fragments are not allowed for this integration test");
  }

  const hostname = databaseUrl.hostname.toLowerCase();
  if (!LOOPBACK_HOSTS.has(hostname)) {
    throw new Error("Backup workflow integration tests only allow a loopback PostgreSQL host");
  }

  for (const key of databaseUrl.searchParams.keys()) {
    if (CONNECTION_OVERRIDE_QUERY_KEYS.has(key.toLowerCase())) {
      throw new Error(`DATABASE_URL query parameter '${key}' is not allowed for this integration test`);
    }
  }

  if (!databaseUrl.username) {
    throw new Error("DATABASE_URL must include an explicit PostgreSQL user");
  }

  let sourceDatabaseName: string;
  try {
    sourceDatabaseName = decodeURIComponent(databaseUrl.pathname.slice(1));
  } catch {
    throw new Error("DATABASE_URL contains an invalid encoded database name");
  }
  if (
    !sourceDatabaseName ||
    sourceDatabaseName.includes("/") ||
    sourceDatabaseName.includes("\\") ||
    sourceDatabaseName.includes("\0")
  ) {
    throw new Error("DATABASE_URL must contain one explicit database name");
  }
  if (sourceDatabaseName.toLowerCase().startsWith(DATABASE_PREFIX)) {
    throw new Error("The source DATABASE_URL must not already target a backup workflow test database");
  }

  const port = databaseUrl.port || "5432";
  const numericPort = Number(port);
  if (!Number.isInteger(numericPort) || numericPort < 1 || numericPort > 65535) {
    throw new Error("DATABASE_URL must use a valid PostgreSQL port");
  }
  databaseUrl.port = port;

  return databaseUrl;
}

function cloneUrlForDatabase(sourceUrl: URL, databaseName: string) {
  const clonedUrl = new URL(sourceUrl.href);
  clonedUrl.pathname = `/${databaseName}`;
  clonedUrl.hash = "";
  return clonedUrl;
}

async function prepareRunnerContext(): Promise<RunnerContext> {
  if (!process.env["DATABASE_URL"]) {
    try {
      process.loadEnvFile(path.join(SERVER_ROOT, ".env"));
    } catch {
      throw new Error("DATABASE_URL is missing and the server .env file could not be loaded");
    }
  }
  if (process.env["NODE_ENV"] === "production") {
    throw new Error("Backup workflow integration tests refuse to run with NODE_ENV=production");
  }

  const rawDatabaseUrl = process.env["DATABASE_URL"];
  if (!rawDatabaseUrl) {
    throw new Error("DATABASE_URL is required for backup workflow integration tests");
  }

  const sourceUrl = parseSafeSourceDatabaseUrl(rawDatabaseUrl);
  const databaseName = generateDatabaseName();
  const controlUrl = cloneUrlForDatabase(sourceUrl, CONTROL_DATABASE_NAME);
  const targetUrl = cloneUrlForDatabase(sourceUrl, databaseName);

  let prismaCliPath: string;
  try {
    prismaCliPath = require.resolve("prisma/build/index.js", { paths: [SERVER_ROOT] });
  } catch {
    throw new Error("The local Prisma CLI could not be resolved from server/node_modules");
  }

  try {
    await Promise.all([access(prismaCliPath), access(WORKER_PATH)]);
  } catch {
    throw new Error("The compiled Prisma CLI or backup workflow integration worker is missing");
  }

  return { controlUrl, targetUrl, databaseName, prismaCliPath };
}

function createControlClient(controlUrl: URL) {
  return new Client({
    application_name: "atlasgym_backup_workflow_integration_runner",
    connectionString: controlUrl.href,
    connectionTimeoutMillis: 10_000,
    query_timeout: DATABASE_QUERY_TIMEOUT_MS,
    statement_timeout: DATABASE_QUERY_TIMEOUT_MS,
  });
}

async function useControlClient<T>(controlUrl: URL, operation: (client: InstanceType<typeof Client>) => Promise<T>) {
  const client = createControlClient(controlUrl);
  let operationError: unknown;
  let result: T | undefined;

  try {
    await client.connect();
    const currentDatabase = await client.query<{ databaseName: string }>(
      'SELECT current_database() AS "databaseName"'
    );
    assert.equal(
      currentDatabase.rows[0]?.databaseName,
      CONTROL_DATABASE_NAME,
      "Control connection did not reach the dedicated postgres database"
    );
    result = await operation(client);
  } catch (error) {
    operationError = error;
  }

  let closeError: unknown;
  try {
    await client.end();
  } catch (error) {
    closeError = error;
  }

  if (operationError) {
    if (closeError) {
      throw new AggregateError([operationError, closeError], "PostgreSQL control operation and disconnect both failed");
    }
    throw operationError;
  }
  if (closeError) throw closeError;
  return result as T;
}

async function createDisposableDatabase(state: CleanupState) {
  assertSafeDatabaseName(state.databaseName);
  await useControlClient(state.controlUrl, async (client) => {
    const privilege = await client.query<{ canCreateDatabase: boolean }>(
      'SELECT (rolcreatedb OR rolsuper) AS "canCreateDatabase" FROM pg_roles WHERE rolname = current_user'
    );
    assert.equal(
      privilege.rows[0]?.canCreateDatabase,
      true,
      "The local PostgreSQL role must have CREATEDB privilege for this integration test"
    );

    const collision = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [state.databaseName]
    );
    assert.equal(collision.rows[0]?.exists, false, "Generated disposable database name already exists");

    await client.query(`CREATE DATABASE ${quoteIdentifier(state.databaseName)}`);
    state.createdByThisProcess = true;

    const created = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [state.databaseName]
    );
    assert.equal(created.rows[0]?.exists, true, "Disposable database creation could not be verified");
  });
}

function createCapturedOutput(): CapturedOutput {
  const chunks: Buffer[] = [];
  let capturedBytes = 0;
  let truncated = false;

  return {
    append: (chunk) => {
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      const remainingBytes = MAX_CAPTURED_OUTPUT_BYTES - capturedBytes;
      if (remainingBytes <= 0) {
        truncated = true;
        return;
      }
      const captured = buffer.subarray(0, remainingBytes);
      chunks.push(captured);
      capturedBytes += captured.length;
      if (captured.length < buffer.length) truncated = true;
    },
    read: () => {
      const output = Buffer.concat(chunks).toString("utf8");
      return truncated ? `${output}\n[output truncated]` : output;
    },
  };
}

function childHasExited(child: TrackedChild) {
  return child.exitCode !== null || child.signalCode !== null;
}

function waitForChildExit(child: TrackedChild, timeoutMs: number) {
  if (childHasExited(child)) return Promise.resolve();
  return new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      child.off("close", handleClose);
      reject(new Error("Timed out while waiting for a child process to exit"));
    }, timeoutMs);
    const handleClose = () => {
      clearTimeout(timeout);
      resolve();
    };
    child.once("close", handleClose);
  });
}

async function runWindowsTaskkill(pid: number) {
  const killer = spawn("taskkill.exe", ["/PID", String(pid), "/T", "/F"], {
    shell: false,
    stdio: "ignore",
    windowsHide: true,
  });
  await new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      killer.kill();
      reject(new Error("Timed out while terminating a Windows child-process tree"));
    }, CHILD_TERMINATION_TIMEOUT_MS);
    killer.once("error", (error) => {
      clearTimeout(timeout);
      reject(error);
    });
    killer.once("close", () => {
      clearTimeout(timeout);
      resolve();
    });
  });
}

async function terminateChildTree(child: TrackedChild) {
  if (childHasExited(child)) return;

  if (process.platform === "win32" && child.pid) {
    try {
      await runWindowsTaskkill(child.pid);
    } catch {
      if (!childHasExited(child)) child.kill();
    }
  } else {
    child.kill("SIGTERM");
  }

  try {
    await waitForChildExit(child, CHILD_TERMINATION_TIMEOUT_MS);
  } catch {
    if (!childHasExited(child)) child.kill("SIGKILL");
    await waitForChildExit(child, CHILD_TERMINATION_TIMEOUT_MS);
  }
}

function terminateActiveChild() {
  if (!activeChild || childHasExited(activeChild)) return Promise.resolve();
  if (activeTermination) return activeTermination;

  const childToTerminate = activeChild;
  activeTermination = terminateChildTree(childToTerminate).finally(() => {
    if (activeChild === childToTerminate && childHasExited(childToTerminate)) activeChild = null;
    activeTermination = null;
  });
  return activeTermination;
}

async function runChildProcess(input: {
  label: string;
  executable: string;
  args: string[];
  env: NodeJS.ProcessEnv;
  timeoutMs: number;
}) {
  assert.equal(activeChild, null, "Only one integration child process may run at a time");
  const stdout = createCapturedOutput();
  const stderr = createCapturedOutput();
  const child = spawn(input.executable, input.args, {
    cwd: SERVER_ROOT,
    env: input.env,
    shell: false,
    stdio: ["ignore", "pipe", "pipe"],
    windowsHide: true,
  });
  activeChild = child;
  child.stdout.on("data", (chunk: Buffer) => stdout.append(chunk));
  child.stderr.on("data", (chunk: Buffer) => stderr.append(chunk));

  let timedOut = false;
  const timeout = setTimeout(() => {
    timedOut = true;
    void terminateActiveChild().catch(() => undefined);
  }, input.timeoutMs);

  const outcome = await new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve, reject) => {
    child.once("error", reject);
    child.once("close", (code, signal) => resolve({ code, signal }));
  }).finally(() => {
    clearTimeout(timeout);
    if (activeChild === child) activeChild = null;
  });

  if (timedOut) {
    throw new ChildExecutionError(
      `${input.label} timed out after ${input.timeoutMs} ms`,
      stdout.read(),
      stderr.read()
    );
  }
  if (outcome.code !== 0) {
    const exitDescription = outcome.signal ? `signal ${outcome.signal}` : `exit code ${String(outcome.code)}`;
    throw new ChildExecutionError(`${input.label} failed with ${exitDescription}`, stdout.read(), stderr.read());
  }

  return { stdout: stdout.read(), stderr: stderr.read() };
}

function buildChildEnvironment(targetUrl: URL, databaseName: string) {
  const childEnvironment: NodeJS.ProcessEnv = {
    ...process.env,
    ATLASGYM_BACKUP_WORKFLOW_TEST_DATABASE: databaseName,
    DATABASE_URL: targetUrl.href,
    NODE_ENV: "test",
  };
  delete childEnvironment["SHADOW_DATABASE_URL"];
  for (const key of CHILD_POSTGRES_DESTINATION_ENV_KEYS) delete childEnvironment[key];
  return childEnvironment;
}

function throwIfInterrupted() {
  if (interruptedSignal) throw new Error(`Backup workflow integration test interrupted by ${interruptedSignal}`);
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/gu, "\\$&");
}

function redactOutput(output: string, urls: URL[]) {
  let redacted = output
    .replace(/postgres(?:ql)?:\/\/[^\s"'`<>]+/giu, "postgresql://***")
    .replace(/(DATABASE_URL\s*[=:]\s*)[^\s]+/giu, "$1***")
    .replace(/(password authentication failed for user\s+)["'][^"']+["']/giu, '$1"***"')
    .replace(/((?:password|user(?:name)?)\s*[=:]\s*)(?:"[^"]*"|'[^']*'|[^\s,;]+)/giu, "$1***");

  for (const url of urls) {
    const credentialValues = [url.username, url.password];
    for (const credential of credentialValues) {
      if (!credential) continue;
      const candidates = new Set([credential]);
      try {
        candidates.add(decodeURIComponent(credential));
      } catch {
        // The URL parser already validated the encoding; keep the encoded form only.
      }
      for (const candidate of candidates) {
        if (candidate.length >= 3) redacted = redacted.replace(new RegExp(escapeRegExp(candidate), "gu"), "***");
      }
    }
  }
  return redacted;
}

function printCapturedOutput(output: { stdout: string; stderr: string }, urls: URL[]) {
  const stdout = redactOutput(output.stdout, urls).trim();
  const stderr = redactOutput(output.stderr, urls).trim();
  if (stdout) console.log(stdout);
  if (stderr) console.error(stderr);
}

function formatError(error: unknown, urls: URL[]): string {
  if (error instanceof ChildExecutionError) {
    const details = [error.message, error.stdout, error.stderr].filter(Boolean).join("\n");
    return redactOutput(details, urls).trim();
  }
  if (error instanceof AggregateError) {
    const nested: string[] = error.errors.map((nestedError) => formatError(nestedError, urls)).filter(Boolean);
    return redactOutput([error.message, ...nested].join("\n"), urls).trim();
  }
  const message = error instanceof Error ? error.message : String(error);
  return redactOutput(message, urls).trim();
}

async function cleanupDisposableDatabase(state: CleanupState) {
  await terminateActiveChild();
  if (!state.createdByThisProcess) return;

  assertSafeDatabaseName(state.databaseName);
  await useControlClient(state.controlUrl, async (client) => {
    const exists = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [state.databaseName]
    );
    if (!exists.rows[0]?.exists) {
      state.createdByThisProcess = false;
      return;
    }

    await client.query(`ALTER DATABASE ${quoteIdentifier(state.databaseName)} WITH ALLOW_CONNECTIONS false`);
    await client.query(
      "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = $1 AND pid <> pg_backend_pid()",
      [state.databaseName]
    );
    await client.query(`DROP DATABASE ${quoteIdentifier(state.databaseName)}`);

    const remaining = await client.query<{ exists: boolean }>(
      "SELECT EXISTS (SELECT 1 FROM pg_database WHERE datname = $1) AS exists",
      [state.databaseName]
    );
    assert.equal(remaining.rows[0]?.exists, false, "Disposable database still exists after cleanup");
    state.createdByThisProcess = false;
  });
}

function handleSignal(signal: NodeJS.Signals) {
  if (interruptedSignal) return;
  interruptedSignal = signal;
  console.error(`Received ${signal}; stopping the active integration-test child before database cleanup.`);
  void terminateActiveChild().catch(() => undefined);
}

async function run() {
  let context: RunnerContext | null = null;
  let cleanupState: CleanupState | null = null;
  let primaryError: unknown;
  let cleanupError: unknown;

  process.once("SIGINT", handleSignal);
  process.once("SIGTERM", handleSignal);

  try {
    context = await prepareRunnerContext();
    cleanupState = {
      controlUrl: context.controlUrl,
      databaseName: context.databaseName,
      createdByThisProcess: false,
    };

    throwIfInterrupted();
    console.log(`Creating disposable PostgreSQL database ${context.databaseName}.`);
    await createDisposableDatabase(cleanupState);

    throwIfInterrupted();
    const childEnvironment = buildChildEnvironment(context.targetUrl, context.databaseName);
    console.log("Applying Prisma migrations to the disposable database.");
    const migrationOutput = await runChildProcess({
      label: "Prisma migrate deploy",
      executable: process.execPath,
      args: [context.prismaCliPath, "migrate", "deploy"],
      env: childEnvironment,
      timeoutMs: MIGRATION_TIMEOUT_MS,
    });
    printCapturedOutput(migrationOutput, [context.controlUrl, context.targetUrl]);

    throwIfInterrupted();
    console.log("Running the compiled backup workflow failure integration worker.");
    const workerOutput = await runChildProcess({
      label: "Backup workflow failure integration worker",
      executable: process.execPath,
      args: [WORKER_PATH],
      env: childEnvironment,
      timeoutMs: WORKER_TIMEOUT_MS,
    });
    printCapturedOutput(workerOutput, [context.controlUrl, context.targetUrl]);
    throwIfInterrupted();
  } catch (error) {
    primaryError = error;
  }

  try {
    if (cleanupState) await cleanupDisposableDatabase(cleanupState);
  } catch (error) {
    cleanupError = error;
  } finally {
    process.off("SIGINT", handleSignal);
    process.off("SIGTERM", handleSignal);
  }

  if (interruptedSignal && !primaryError) {
    primaryError = new Error(`Backup workflow integration test interrupted by ${interruptedSignal}`);
  }

  const sensitiveUrls = context ? [context.controlUrl, context.targetUrl] : [];
  if (primaryError) {
    console.error(`Backup workflow integration test failed:\n${formatError(primaryError, sensitiveUrls)}`);
  }
  if (cleanupError) {
    console.error(`Disposable database cleanup also failed:\n${formatError(cleanupError, sensitiveUrls)}`);
  }
  if (cleanupState?.createdByThisProcess) {
    console.error(`Disposable database may require manual cleanup: ${cleanupState.databaseName}`);
  }

  if (primaryError || cleanupError) {
    process.exitCode = interruptedSignal === "SIGINT" ? 130 : interruptedSignal === "SIGTERM" ? 143 : 1;
    return;
  }

  assert.ok(context);
  console.log(`Backup workflow integration test passed; disposable database ${context.databaseName} was removed.`);
}

void run().catch((error) => {
  console.error(`Backup workflow integration runner failed unexpectedly: ${formatError(error, [])}`);
  process.exitCode = 1;
});
