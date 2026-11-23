import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { PRODUCT_BRAND as attendance } from "../src/config/attendanceProductBrand.ts";

assert.equal(attendance.edition, "ATTENDANCE");
assert.equal(attendance.name, "Entry Control Attendance");
assert.equal(attendance.iconHref, "/entrycontrol-attendance-icon.svg");
assert.match(attendance.sidebarLogoSrc ?? "", /atlas-attendance-logo\.png$/u);
assert.equal(JSON.stringify(attendance).includes("AtlasGym"), false);
assert.equal(JSON.stringify(attendance).includes("gym"), false);
for (const language of ["en", "fa", "ps"] as const) {
  assert.ok(attendance.authSetupSubtitle[language].length > 0);
  assert.ok(attendance.authPanelBody[language].length > 0);
}

const sharedShellSource = readFileSync(new URL("../src/layouts/SharedAppShell.tsx", import.meta.url), "utf8");
const fullShellAdapterSource = readFileSync(new URL("../src/layouts/FullShellAdapter.tsx", import.meta.url), "utf8");
const attendanceShellAdapterSource = readFileSync(new URL("../src/layouts/AttendanceShellAdapter.tsx", import.meta.url), "utf8");
const fullRouteManifestSource = readFileSync(new URL("../src/routing/fullRouteManifest.tsx", import.meta.url), "utf8");
const attendanceRouteManifestSource = readFileSync(new URL("../src/routing/attendanceRouteManifest.tsx", import.meta.url), "utf8");

assert.match(sharedShellSource, /from "@app-product-brand"/u);
assert.match(sharedShellSource, /PRODUCT_BRAND\.logoSrc/u);
assert.match(sharedShellSource, /PRODUCT_BRAND\.iconHref/u);
for (const forbiddenSharedDependency of [
  "../api/client",
  "../api/sounds",
  "../components/inbox",
  "../services/soundPlayer",
  "/ws/inbox",
  "AtlasGym",
  "atlasgym-",
]) {
  assert.equal(
    sharedShellSource.includes(forbiddenSharedDependency),
    false,
    `SharedAppShell must not depend on FULL-only ${forbiddenSharedDependency}`,
  );
}

for (const requiredFullDependency of [
  "../api/sounds",
  "../components/inbox/InboxContext",
  "../components/inbox/InboxDrawer",
  "../services/soundPlayer",
  "/ws/inbox",
]) {
  assert.equal(
    fullShellAdapterSource.includes(requiredFullDependency),
    true,
    `FullShellAdapter must retain ${requiredFullDependency}`,
  );
}
assert.match(fullRouteManifestSource, /layouts\/FullShellAdapter/u);
assert.doesNotMatch(fullRouteManifestSource, /layouts\/DashboardLayout/u);
assert.match(attendanceShellAdapterSource, /SharedAppShell/u);
assert.match(attendanceShellAdapterSource, /__ECS_ATTENDANCE_INBOX_CODE_READY__/u);
assert.match(attendanceShellAdapterSource, /lazy\(\(\) => import\("\.\/AttendanceInboxShell"\)/u);
assert.match(attendanceShellAdapterSource, /hasFeature\("INBOX"\)/u);
assert.match(attendanceShellAdapterSource, /hasPermission\("ATTENDANCE_VIEW"\)/u);
assert.doesNotMatch(attendanceShellAdapterSource, /FullShellAdapter|soundPlayer|WebSocket|\/ws\/inbox/u);
assert.match(attendanceRouteManifestSource, /layouts\/AttendanceShellAdapter/u);
assert.doesNotMatch(attendanceRouteManifestSource, /AttendanceRouteShell/u);

console.log("ok - product branding and SharedAppShell Edition adapter dependency boundaries are explicit");
