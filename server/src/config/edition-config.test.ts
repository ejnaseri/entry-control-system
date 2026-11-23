import assert from "node:assert/strict";
import { spawnSync, type SpawnSyncReturns } from "node:child_process";
import path from "node:path";

const TEST_DATABASE_URL = "postgresql://edition_test:edition_test@127.0.0.1:1/edition_test";
const CONFIG_PROBE = "--probe-config";
const BOOTSTRAP_PROBE = "--probe-bootstrap";
const missingDotenvPath = path.join(__dirname, `.edition-config-test-missing-${process.pid}.env`);
const APP_ENV_KEYS = new Set([
  "NODE_ENV",
  "APP_EDITION",
  "APP_TIMEZONE",
  "ATTENDANCE_POLICY",
  "ATTENDANCE_AUTO_CHECKOUT_ENABLED",
  "APP_FEATURE_INBOX",
  "PORT",
  "DATABASE_URL",
  "LOG_LEVEL",
  "SHADOW_DATABASE_URL",
  "ZKTECO_HOST",
  "ZKTECO_PORT",
  "ZKTECO_PASS",
  "ZKTECO_POLL_INTERVAL_MS",
  "DOOR_RELAY_HOST",
  "DOOR_RELAY_PORT",
  "DOOR_RELAY_PATH",
  "DOOR_OPEN_SECONDS",
  "AUTH_COOKIE_NAME",
  "AUTH_SESSION_HOURS",
  "CLIENT_ORIGIN",
  "ATLASGYM_BACKUP_ROOT",
  "ATLASGYM_PG_DUMP_PATH",
  "ATLASGYM_CREATEDB_PATH",
  "ATLASGYM_DROPDB_PATH",
  "ATLASGYM_PG_RESTORE_PATH",
  "ATLASGYM_PSQL_PATH",
  "ATLASGYM_BACKUP_TIMEOUT_MS",
  "TZ",
]);

function clearAppEnv(target: NodeJS.ProcessEnv): void {
  for (const key of Object.keys(target)) {
    if (APP_ENV_KEYS.has(key.toUpperCase())) {
      delete target[key];
    }
  }
}

function buildChildEnv(
  appEdition: string | undefined,
  overrides: Readonly<Record<string, string | undefined>> = {}
): NodeJS.ProcessEnv {
  const childEnv: NodeJS.ProcessEnv = { ...process.env };
  clearAppEnv(childEnv);
  childEnv["NODE_ENV"] = "test";
  childEnv["DATABASE_URL"] = TEST_DATABASE_URL;
  childEnv["DOTENV_CONFIG_PATH"] = missingDotenvPath;
  childEnv["DOTENV_CONFIG_QUIET"] = "true";

  if (appEdition === undefined) {
    delete childEnv["APP_EDITION"];
  } else {
    childEnv["APP_EDITION"] = appEdition;
  }

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) delete childEnv[key];
    else childEnv[key] = value;
  }

  return childEnv;
}

function runProbe(
  probe: string,
  appEdition: string | undefined,
  overrides: Readonly<Record<string, string | undefined>> = {}
): SpawnSyncReturns<string> {
  return spawnSync(process.execPath, [__filename, probe], {
    cwd: __dirname,
    encoding: "utf8",
    env: buildChildEnv(appEdition, overrides),
    shell: false,
    timeout: 5_000,
    windowsHide: true,
  });
}

function describeProbe(result: SpawnSyncReturns<string>): string {
  return JSON.stringify({
    status: result.status,
    signal: result.signal,
    stdout: result.stdout,
    stderr: result.stderr,
    error: result.error?.message,
  });
}

function assertProbeCompleted(result: SpawnSyncReturns<string>, label: string): void {
  assert.equal(result.error, undefined, `${label} failed to complete: ${describeProbe(result)}`);
  assert.equal(result.signal, null, `${label} was terminated: ${describeProbe(result)}`);
}

function runConfigProbe(): void {
  const { env, runtimeOptionalFeatureFlags } = require("./env") as typeof import("./env");
  const { getEffectiveFeatures } = require("./capabilities") as typeof import("./capabilities");
  process.stdout.write(
    `CONFIG_OK:${env.APP_EDITION}:TIMEZONE=${env.APP_TIMEZONE}:NODE_TZ=${process.env["TZ"]}:POLICY=${env.ATTENDANCE_POLICY}:AUTO_CHECKOUT=${env.ATTENDANCE_AUTO_CHECKOUT_ENABLED}:INBOX=${env.APP_FEATURE_INBOX}:INBOX_BOOL=${runtimeOptionalFeatureFlags.APP_FEATURE_INBOX}:INBOX_EFFECTIVE=${getEffectiveFeatures(env.APP_EDITION, runtimeOptionalFeatureFlags).includes("INBOX")}`
  );
}

async function runBootstrapProbe(): Promise<void> {
  const { bootstrap } = require("../bootstrap") as typeof import("../bootstrap");
  const { env } = require("./env") as typeof import("./env");
  let runtimeCalls = 0;
  let receivedEdition: string | null = null;
  let bootstrapError: unknown;

  try {
    await bootstrap((edition) => {
      receivedEdition = edition;
      runtimeCalls += 1;
    });
  } catch (error) {
    bootstrapError = error;
  }

  const forbiddenRuntimeModules = [
    path.resolve(__dirname, "../app.js"),
    path.resolve(__dirname, "../lib/prisma.js"),
    path.resolve(__dirname, "../modules/backups/backup.service.js"),
    path.resolve(__dirname, "../modules/devices/deviceManager.js"),
    path.resolve(__dirname, "../modules/inbox/inbox.jobs.js"),
    path.resolve(__dirname, "../modules/inbox/inbox.ws.js"),
  ];
  const loadedRuntimeModules = forbiddenRuntimeModules.filter((modulePath) => require.cache[modulePath] !== undefined);
  assert.deepEqual(loadedRuntimeModules, [], `Bootstrap probe loaded runtime modules: ${loadedRuntimeModules.join(", ")}`);

  if (bootstrapError) {
    throw bootstrapError;
  }

  assert.equal(receivedEdition, env.APP_EDITION, "Bootstrap must pass the parsed edition to the runtime");
  process.stdout.write(`BOOTSTRAP_OK:RUNTIME_CALLS=${runtimeCalls}:EDITION=${receivedEdition}`);
}

function testParseEnvDirectly(): void {
  clearAppEnv(process.env);
  process.env["NODE_ENV"] = "test";
  process.env["DATABASE_URL"] = TEST_DATABASE_URL;
  process.env["APP_EDITION"] = "FULL";
  process.env["DOTENV_CONFIG_PATH"] = missingDotenvPath;
  process.env["DOTENV_CONFIG_QUIET"] = "true";

  const { parseEnv } = require("./env") as typeof import("./env");

  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL }).APP_EDITION, "FULL");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL }).APP_TIMEZONE, "Asia/Kabul");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL }).ATTENDANCE_POLICY, "TIME_CLOCK");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL }).ATTENDANCE_AUTO_CHECKOUT_ENABLED, "0");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL }).APP_FEATURE_INBOX, "0");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_EDITION: "FULL" }).APP_EDITION, "FULL");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_EDITION: "ATTENDANCE" }).APP_EDITION, "ATTENDANCE");
  for (const appTimezone of ["Asia/Kabul", "UTC", "Europe/London", "America/New_York"]) {
    assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_TIMEZONE: appTimezone }).APP_TIMEZONE, appTimezone);
  }
  assert.equal(
    parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_EDITION: "ATTENDANCE", ATTENDANCE_POLICY: "TIME_CLOCK" })
      .ATTENDANCE_POLICY,
    "TIME_CLOCK"
  );
  assert.equal(
    parseEnv({ DATABASE_URL: TEST_DATABASE_URL, ATTENDANCE_AUTO_CHECKOUT_ENABLED: "0" })
      .ATTENDANCE_AUTO_CHECKOUT_ENABLED,
    "0"
  );
  assert.equal(
    parseEnv({ DATABASE_URL: TEST_DATABASE_URL, ATTENDANCE_AUTO_CHECKOUT_ENABLED: "1" })
      .ATTENDANCE_AUTO_CHECKOUT_ENABLED,
    "1"
  );
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_FEATURE_INBOX: "0" }).APP_FEATURE_INBOX, "0");
  assert.equal(parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_FEATURE_INBOX: "1" }).APP_FEATURE_INBOX, "1");
  assert.throws(
    () => parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_EDITION: "attendance" }),
    (error: unknown) => error instanceof Error && error.message.includes("APP_EDITION")
  );
  for (const attendancePolicy of ["", "time_clock", "TIME_CLOCK ", "ACCESS_CONTROL", "UNKNOWN"]) {
    assert.throws(
      () => parseEnv({ DATABASE_URL: TEST_DATABASE_URL, ATTENDANCE_POLICY: attendancePolicy }),
      (error: unknown) => error instanceof Error && error.message.includes("ATTENDANCE_POLICY")
    );
  }
  for (const appTimezone of ["", " ", "Asia/Kabul ", "Not/AZone", "+04:30", "Kabul"]) {
    assert.throws(
      () => parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_TIMEZONE: appTimezone }),
      (error: unknown) => error instanceof Error && error.message.includes("APP_TIMEZONE")
    );
  }
  for (const autoCheckoutSetting of ["", "true", "false", "00", "01", "2", "0 ", " 1"]) {
    assert.throws(
      () => parseEnv({ DATABASE_URL: TEST_DATABASE_URL, ATTENDANCE_AUTO_CHECKOUT_ENABLED: autoCheckoutSetting }),
      (error: unknown) => error instanceof Error && error.message.includes("ATTENDANCE_AUTO_CHECKOUT_ENABLED")
    );
  }
  for (const inboxSetting of ["", "true", "false", "00", "01", "2", "0 ", " 1"]) {
    assert.throws(
      () => parseEnv({ DATABASE_URL: TEST_DATABASE_URL, APP_FEATURE_INBOX: inboxSetting }),
      (error: unknown) => error instanceof Error && error.message.includes("APP_FEATURE_INBOX")
    );
  }
}

function testConfigChildProcesses(): void {
  const validScenarios: Array<{ appEdition: string | undefined; expected: "FULL" | "ATTENDANCE"; label: string }> = [
    { appEdition: undefined, expected: "FULL", label: "missing APP_EDITION" },
    { appEdition: "FULL", expected: "FULL", label: "explicit FULL" },
    { appEdition: "ATTENDANCE", expected: "ATTENDANCE", label: "explicit ATTENDANCE" },
  ];

  for (const scenario of validScenarios) {
    const result = runProbe(CONFIG_PROBE, scenario.appEdition);
    assertProbeCompleted(result, scenario.label);
    assert.equal(result.status, 0, `${scenario.label} should parse: ${describeProbe(result)}`);
    assert.match(result.stdout, new RegExp(`CONFIG_OK:${scenario.expected}`, "u"));
    assert.match(result.stdout, /TIMEZONE=Asia\/Kabul:NODE_TZ=Asia\/Kabul/u);
    assert.match(result.stdout, /POLICY=TIME_CLOCK/u);
    assert.match(result.stdout, /AUTO_CHECKOUT=0/u);
    assert.match(result.stdout, /INBOX=0:INBOX_BOOL=false:INBOX_EFFECTIVE=(?:true|false)/u);
  }

  const explicitPolicyResult = runProbe(CONFIG_PROBE, "ATTENDANCE", { ATTENDANCE_POLICY: "TIME_CLOCK" });
  assertProbeCompleted(explicitPolicyResult, "explicit TIME_CLOCK policy");
  assert.equal(explicitPolicyResult.status, 0, describeProbe(explicitPolicyResult));
  assert.match(explicitPolicyResult.stdout, /CONFIG_OK:ATTENDANCE:.*POLICY=TIME_CLOCK/u);

  for (const appTimezone of ["UTC", "Europe/London", "America/New_York"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", { APP_TIMEZONE: appTimezone, TZ: "Pacific/Honolulu" });
    assertProbeCompleted(result, `explicit APP_TIMEZONE=${appTimezone}`);
    assert.equal(result.status, 0, describeProbe(result));
    assert.match(result.stdout, new RegExp(`TIMEZONE=${appTimezone.replace("/", "\\/")}:NODE_TZ=${appTimezone.replace("/", "\\/")}`, "u"));
  }

  for (const autoCheckoutSetting of ["0", "1"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", {
      ATTENDANCE_AUTO_CHECKOUT_ENABLED: autoCheckoutSetting,
    });
    assertProbeCompleted(result, `explicit auto-checkout setting ${autoCheckoutSetting}`);
    assert.equal(result.status, 0, describeProbe(result));
    assert.match(result.stdout, new RegExp(`AUTO_CHECKOUT=${autoCheckoutSetting}`, "u"));
  }

  for (const inboxSetting of ["0", "1"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", { APP_FEATURE_INBOX: inboxSetting });
    assertProbeCompleted(result, `explicit Inbox setting ${inboxSetting}`);
    assert.equal(result.status, 0, describeProbe(result));
    assert.match(
      result.stdout,
      new RegExp(`INBOX=${inboxSetting}:INBOX_BOOL=${inboxSetting === "1" ? "true" : "false"}:INBOX_EFFECTIVE=false`, "u")
    );
  }

  const fullInboxResult = runProbe(CONFIG_PROBE, "FULL", { APP_FEATURE_INBOX: "0" });
  assertProbeCompleted(fullInboxResult, "FULL Inbox compatibility");
  assert.equal(fullInboxResult.status, 0, describeProbe(fullInboxResult));
  assert.match(fullInboxResult.stdout, /INBOX=0:INBOX_BOOL=false:INBOX_EFFECTIVE=true/u);

  for (const appEdition of ["", "full", "attendance", "FULL ", "UNKNOWN"]) {
    const result = runProbe(CONFIG_PROBE, appEdition);
    assertProbeCompleted(result, `invalid APP_EDITION=${JSON.stringify(appEdition)}`);
    assert.notEqual(result.status, 0, `APP_EDITION=${JSON.stringify(appEdition)} should fail`);
    assert.doesNotMatch(result.stdout, /CONFIG_OK:/u);
    assert.match(result.stderr, /APP_EDITION/u);
  }

  for (const attendancePolicy of ["", "time_clock", "TIME_CLOCK ", "ACCESS_CONTROL", "UNKNOWN"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", { ATTENDANCE_POLICY: attendancePolicy });
    assertProbeCompleted(result, `invalid ATTENDANCE_POLICY=${JSON.stringify(attendancePolicy)}`);
    assert.notEqual(result.status, 0, `ATTENDANCE_POLICY=${JSON.stringify(attendancePolicy)} should fail`);
    assert.doesNotMatch(result.stdout, /CONFIG_OK:/u);
    assert.match(result.stderr, /ATTENDANCE_POLICY/u);
  }

  for (const appTimezone of ["", " ", "Asia/Kabul ", "Not/AZone", "+04:30", "Kabul"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", { APP_TIMEZONE: appTimezone });
    assertProbeCompleted(result, `invalid APP_TIMEZONE=${JSON.stringify(appTimezone)}`);
    assert.notEqual(result.status, 0, `APP_TIMEZONE=${JSON.stringify(appTimezone)} should fail`);
    assert.doesNotMatch(result.stdout, /CONFIG_OK:/u);
    assert.match(result.stderr, /APP_TIMEZONE/u);
  }

  for (const autoCheckoutSetting of ["", "true", "false", "00", "01", "2", "0 ", " 1"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", {
      ATTENDANCE_AUTO_CHECKOUT_ENABLED: autoCheckoutSetting,
    });
    assertProbeCompleted(result, `invalid auto-checkout setting ${JSON.stringify(autoCheckoutSetting)}`);
    assert.notEqual(result.status, 0, `auto-checkout setting ${JSON.stringify(autoCheckoutSetting)} should fail`);
    assert.doesNotMatch(result.stdout, /CONFIG_OK:/u);
    assert.match(result.stderr, /ATTENDANCE_AUTO_CHECKOUT_ENABLED/u);
  }

  for (const inboxSetting of ["", "true", "false", "00", "01", "2", "0 ", " 1"]) {
    const result = runProbe(CONFIG_PROBE, "ATTENDANCE", { APP_FEATURE_INBOX: inboxSetting });
    assertProbeCompleted(result, `invalid Inbox setting ${JSON.stringify(inboxSetting)}`);
    assert.notEqual(result.status, 0, `APP_FEATURE_INBOX=${JSON.stringify(inboxSetting)} should fail`);
    assert.doesNotMatch(result.stdout, /CONFIG_OK:/u);
    assert.match(result.stderr, /APP_FEATURE_INBOX/u);
  }
}

function testBootstrapChildProcesses(): void {
  const fullResult = runProbe(BOOTSTRAP_PROBE, "FULL");
  assertProbeCompleted(fullResult, "FULL bootstrap admission");
  assert.equal(fullResult.status, 0, `FULL should reach the runtime: ${describeProbe(fullResult)}`);
  assert.match(fullResult.stdout, /BOOTSTRAP_OK:RUNTIME_CALLS=1:EDITION=FULL/u);

  const attendanceResult = runProbe(BOOTSTRAP_PROBE, "ATTENDANCE");
  assertProbeCompleted(attendanceResult, "ATTENDANCE bootstrap admission");
  assert.equal(attendanceResult.status, 0, `ATTENDANCE should reach the gated runtime: ${describeProbe(attendanceResult)}`);
  assert.match(attendanceResult.stdout, /BOOTSTRAP_OK:RUNTIME_CALLS=1:EDITION=ATTENDANCE/u);

  const invalidResult = runProbe(BOOTSTRAP_PROBE, "full");
  assertProbeCompleted(invalidResult, "invalid bootstrap config");
  assert.notEqual(invalidResult.status, 0, "Invalid config should fail before bootstrap");
  assert.doesNotMatch(invalidResult.stdout, /BOOTSTRAP_OK|RUNTIME_CALLS/u);
  assert.match(invalidResult.stderr, /APP_EDITION/u);

  const invalidPolicyResult = runProbe(BOOTSTRAP_PROBE, "ATTENDANCE", {
    ATTENDANCE_POLICY: "ACCESS_CONTROL",
  });
  assertProbeCompleted(invalidPolicyResult, "invalid attendance policy bootstrap config");
  assert.notEqual(invalidPolicyResult.status, 0, "Invalid policy should fail before bootstrap");
  assert.doesNotMatch(invalidPolicyResult.stdout, /BOOTSTRAP_OK|RUNTIME_CALLS/u);
  assert.match(invalidPolicyResult.stderr, /ATTENDANCE_POLICY/u);

  const invalidTimezoneResult = runProbe(BOOTSTRAP_PROBE, "ATTENDANCE", {
    APP_TIMEZONE: "Not/AZone",
  });
  assertProbeCompleted(invalidTimezoneResult, "invalid application timezone bootstrap config");
  assert.notEqual(invalidTimezoneResult.status, 0, "Invalid timezone should fail before bootstrap");
  assert.doesNotMatch(invalidTimezoneResult.stdout, /BOOTSTRAP_OK|RUNTIME_CALLS/u);
  assert.match(invalidTimezoneResult.stderr, /APP_TIMEZONE/u);

  const invalidAutoCheckoutResult = runProbe(BOOTSTRAP_PROBE, "ATTENDANCE", {
    ATTENDANCE_AUTO_CHECKOUT_ENABLED: "true",
  });
  assertProbeCompleted(invalidAutoCheckoutResult, "invalid auto-checkout bootstrap config");
  assert.notEqual(invalidAutoCheckoutResult.status, 0, "Invalid auto-checkout setting should fail before bootstrap");
  assert.doesNotMatch(invalidAutoCheckoutResult.stdout, /BOOTSTRAP_OK|RUNTIME_CALLS/u);
  assert.match(invalidAutoCheckoutResult.stderr, /ATTENDANCE_AUTO_CHECKOUT_ENABLED/u);

  const inboxNotReadyResult = runProbe(BOOTSTRAP_PROBE, "ATTENDANCE", { APP_FEATURE_INBOX: "1" });
  assertProbeCompleted(inboxNotReadyResult, "Inbox enabled before code-ready gate");
  assert.equal(inboxNotReadyResult.status, 0, describeProbe(inboxNotReadyResult));
  assert.match(inboxNotReadyResult.stdout, /BOOTSTRAP_OK:RUNTIME_CALLS=1:EDITION=ATTENDANCE/u);

  const invalidInboxResult = runProbe(BOOTSTRAP_PROBE, "ATTENDANCE", { APP_FEATURE_INBOX: "true" });
  assertProbeCompleted(invalidInboxResult, "invalid Inbox bootstrap config");
  assert.notEqual(invalidInboxResult.status, 0, "Invalid Inbox setting should fail before bootstrap");
  assert.doesNotMatch(invalidInboxResult.stdout, /BOOTSTRAP_OK|RUNTIME_CALLS/u);
  assert.match(invalidInboxResult.stderr, /APP_FEATURE_INBOX/u);
}

function runSuite(): void {
  testParseEnvDirectly();
  testConfigChildProcesses();
  testBootstrapChildProcesses();
  console.log("ok - edition/timezone/attendance/Inbox external config and gated startup admission");
}

async function main(): Promise<void> {
  const probe = process.argv[2];
  if (probe === CONFIG_PROBE) {
    runConfigProbe();
    return;
  }
  if (probe === BOOTSTRAP_PROBE) {
    await runBootstrapProbe();
    return;
  }
  if (probe !== undefined) {
    throw new Error(`Unknown probe: ${probe}`);
  }
  runSuite();
}

main().catch((error: unknown) => {
  const message = error instanceof Error ? error.stack ?? error.message : String(error);
  process.stderr.write(`${message}\n`);
  process.exitCode = 1;
});
