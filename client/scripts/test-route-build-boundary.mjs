import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(scriptDirectory, "..");
const argumentsList = process.argv.slice(2);
let explicitFullDist;
let explicitAttendanceDist;
for (let index = 0; index < argumentsList.length; index += 1) {
  if (argumentsList[index] === "--full-dir") explicitFullDist = argumentsList[++index];
  else if (argumentsList[index] === "--attendance-dir") explicitAttendanceDist = argumentsList[++index];
  else throw new Error(`Unknown route-boundary argument: ${argumentsList[index]}`);
}
if ((explicitFullDist === undefined) !== (explicitAttendanceDist === undefined)) {
  throw new Error("--full-dir and --attendance-dir must be provided together.");
}
const usesExplicitArtifacts = explicitFullDist !== undefined;
const fullDist = usesExplicitArtifacts ? path.resolve(clientRoot, explicitFullDist) : path.join(clientRoot, "dist");
const temporaryRoot = usesExplicitArtifacts ? null : mkdtempSync(path.join(tmpdir(), "ecs-route-build-"));
const attendanceDist = usesExplicitArtifacts
  ? path.resolve(clientRoot, explicitAttendanceDist)
  : path.join(temporaryRoot, "attendance");
const viteEntry = path.join(clientRoot, "node_modules", "vite", "bin", "vite.js");

function readJavaScript(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile() && entry.name.endsWith(".js")) files.push(target);
    }
  };
  visit(root);
  assert.ok(files.length > 0, `No JavaScript output found in ${root}`);
  return files.map((file) => readFileSync(file, "utf8")).join("\n");
}

function listRelativeFiles(root) {
  const files = [];
  const visit = (directory) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const target = path.join(directory, entry.name);
      if (entry.isDirectory()) visit(target);
      else if (entry.isFile()) files.push(path.relative(root, target).replaceAll("\\", "/"));
    }
  };
  visit(root);
  return files;
}

function requireMarkers(output, markers, label) {
  for (const marker of markers) {
    assert.ok(output.includes(marker), `${label} build is missing route marker: ${marker}`);
  }
}

try {
  const fullOutput = readJavaScript(fullDist);
  requireMarkers(
    fullOutput,
    ["FULL_ROUTE_MANIFEST", "/members", "/payments/memberships", "/reports/cashflow", "/settings/membership-plans"],
    "FULL"
  );
  const fullFiles = listRelativeFiles(fullDist);
  assert.equal(
    fullFiles.includes("entrycontrol-attendance-icon.svg"),
    false,
    "FULL build emitted the ATTENDANCE product icon"
  );

  if (!usesExplicitArtifacts) {
    const result = spawnSync(process.execPath, [viteEntry, "build", "--outDir", attendanceDist, "--emptyOutDir"], {
      cwd: clientRoot,
      env: {
        ...process.env,
        ECS_BUILD_EDITION: "ATTENDANCE",
        VITE_API_URL: "http://127.0.0.1:1",
        VITE_APP_EDITION: "ATTENDANCE",
      },
      shell: false,
      stdio: "inherit",
      windowsHide: true,
    });
    if (result.error) throw result.error;
    assert.equal(result.status, 0, "ATTENDANCE Vite build failed");
  }

  const attendanceOutput = readJavaScript(attendanceDist);
  requireMarkers(attendanceOutput, ["ATTENDANCE_ROUTE_MANIFEST", "/dashboard", "/employees", "/members", "/attendance", "/entry-logs", "/reports/attendance", "/devices", "/settings/admin-users", "/settings/audit-logs", "/settings/backups", "attendance-dashboard", "/api/v1/dashboard/summary", "attendance-report", "/api/v1/reports/attendance/options", "/api/v1/reports/attendance/export.csv", "/api/v1/reports/attendance/timecard", "/api/v1/attendance/export.csv", "/api/v1/attendance/export.xlsx", "/api/v1/audit-logs", "/api/v1/backups", "AUDIT_LOGS", "BACKUPS", "ATTENDANCE_EXPORT", "Present employee-days", "staff-daily-attendance", "staff-entry-logs", "monthly-timecard", "entry-control-attendance-monthly-timecard", "entry-control-attendance-entry-logs", "CSV تایم‌کارت", "د وخت‌کارت XLSX", "staff-devices", "attendance-admin-users", "audit-logs-page", "backups-page", "Entry Control Attendance"], "ATTENDANCE");
  const attendanceHtml = readFileSync(path.join(attendanceDist, "index.html"), "utf8");
  assert.ok(attendanceHtml.includes("<title>Entry Control Attendance</title>"), "ATTENDANCE HTML title did not use its product brand");
  assert.ok(attendanceHtml.includes("/entrycontrol-attendance-icon.svg"), "ATTENDANCE HTML icon did not use its product brand");
  assert.equal(attendanceHtml.includes("AtlasGym"), false, "ATTENDANCE HTML retained the FULL product name");
  assert.equal(
    listRelativeFiles(attendanceDist).some(
      (file) => /atlasgym-(?:icon|logo)/iu.test(file) || file.toLowerCase() === "favicon.ico"
    ),
    false,
    "ATTENDANCE build emitted a FULL product brand asset or legacy favicon"
  );
  for (const forbidden of [
    "FULL_ROUTE_MANIFEST",
    "DashboardHome",
    "AttendanceReportPage",
    "/api/v1/members",
    "MembersList",
    "MemberWizard",
    "attendance-daily-page",
    "attendance-daily-export-csv",
    "/payments",
    "/reports/cashflow",
    "/settings/membership-plans",
    "/api/v1/devices/raw-logs",
    "/api/v1/reports/attendance-compliance",
    "/api/v1/inbox",
    "/api/v1/sounds",
    "/ws/inbox",
    "/reports/attendance-compliance",
    "/settings/sounds",
    "/inbox",
    "/api/v1/devices/push-test",
    "/diagnose",
    "/logs/clear",
    "/unlock",
    "DeviceRawLogsModal",
  ]) {
    assert.equal(attendanceOutput.includes(forbidden), false, `ATTENDANCE build leaked excluded route: ${forbidden}`);
  }

  const attendanceFiles = listRelativeFiles(attendanceDist);
  for (const forbiddenChunk of [
    /AttendanceComplianceReportPage/iu,
    /SoundSettings/iu,
    /InboxDrawer/iu,
    /DeviceRawLogs/iu,
    /DashboardLayout/iu,
    /AttendanceRouteShell/iu,
    /FullShellAdapter/iu,
  ]) {
    assert.equal(
      attendanceFiles.some((file) => forbiddenChunk.test(file)),
      false,
      `ATTENDANCE build emitted an optional chunk matching ${forbiddenChunk}`
    );
  }

  console.log("ok - FULL routes remain and ATTENDANCE ships only selected Core surfaces without Customer/Finance or unselected Optional routes, requests, WebSocket markers, and chunks");
} finally {
  if (temporaryRoot !== null) rmSync(temporaryRoot, { recursive: true, force: true });
}
