import assert from "node:assert/strict";
import {
  assertRouteBundleEdition,
  buildRouteBreadcrumbs,
  canAccessRoute,
  defineRouteBundle,
  findAccessibleHeaderActions,
  findAccessibleNavigationRoutes,
  findFirstAccessibleRoute,
  findMatchingRoute,
  getRouteLabel,
  type AppRouteDefinition,
} from "../src/routing/routeManifest.ts";

const fakeComponent = (() => null) as unknown as AppRouteDefinition["component"];

function route(overrides: Partial<AppRouteDefinition> = {}): AppRouteDefinition {
  return {
    key: "dashboard",
    path: "/dashboard",
    feature: "ATTENDANCE_DASHBOARD",
    permissions: ["ATTENDANCE_VIEW"],
    component: fakeComponent,
    navigation: { surface: "main", icon: "dashboard", labelKey: "nav.dashboard", defaultLabel: "Dashboard" },
    order: 10,
    ...overrides,
  };
}

const bundle = defineRouteBundle({
  id: "TEST_ROUTE_MANIFEST",
  edition: "FULL",
  layout: fakeComponent,
  routes: [
    route({ key: "later", path: "/later", order: 20 }),
    route({ key: "first", path: "/first", order: 10 }),
    route({
      key: "settings",
      path: "/settings/example",
      feature: "AUDIT_LOGS",
      permissions: ["AUDIT_LOG_VIEW"],
      navigation: { surface: "settings", icon: "audit-logs", labelKey: "settings.example", defaultLabel: "Example" },
      order: 5,
    }),
    route({
      key: "detail",
      path: "/first/:id",
      title: { labelKey: "detail.title", defaultLabel: "Details" },
      navigation: null,
      parentKey: "first",
      order: 30,
    }),
    route({
      key: "add",
      path: "/first/add",
      title: { labelKey: "add.title", defaultLabel: "Add" },
      navigation: null,
      parentKey: "first",
      headerAction: { labelKey: "add.action", defaultLabel: "Add item" },
      order: 31,
    }),
  ],
});

assert.equal(Object.isFrozen(bundle), true);
assert.equal(Object.isFrozen(bundle.routes), true);
assert.equal(Object.isFrozen(bundle.routes[0]?.permissions), true);
assert.equal(canAccessRoute(bundle.routes[0]!, ["ATTENDANCE_DASHBOARD"], ["ATTENDANCE_VIEW"]), true);
assert.equal(canAccessRoute(bundle.routes[0]!, ["AUTH"], ["ATTENDANCE_VIEW"]), false);
assert.equal(canAccessRoute(bundle.routes[0]!, ["ATTENDANCE_DASHBOARD"], ["SIGN_IN"]), false);
assert.equal(
  findFirstAccessibleRoute(bundle.routes, "main", ["ATTENDANCE_DASHBOARD"], ["ATTENDANCE_VIEW"])?.path,
  "/first"
);
assert.equal(findFirstAccessibleRoute(bundle.routes, "settings", ["AUTH"], ["SIGN_IN"]), null);
assert.equal(
  findFirstAccessibleRoute(bundle.routes, "settings", ["AUDIT_LOGS"], ["AUDIT_LOG_VIEW"])?.path,
  "/settings/example"
);
assert.deepEqual(
  findAccessibleNavigationRoutes(bundle.routes, "main", ["ATTENDANCE_DASHBOARD"], ["ATTENDANCE_VIEW"]).map(
    ({ key }) => key
  ),
  ["first", "later"]
);
assert.equal(findMatchingRoute(bundle.routes, "/first/member-1")?.key, "detail");
assert.equal(findMatchingRoute(bundle.routes, "/first/add")?.key, "add");
assert.deepEqual(
  buildRouteBreadcrumbs(bundle.routes, "/first/member-1", ["ATTENDANCE_DASHBOARD"], ["ATTENDANCE_VIEW"]).map(
    ({ key }) => key
  ),
  ["first", "detail"]
);
assert.deepEqual(buildRouteBreadcrumbs(bundle.routes, "/first/member-1", ["AUTH"], ["ATTENDANCE_VIEW"]), []);
assert.deepEqual(
  findAccessibleHeaderActions(bundle.routes, ["ATTENDANCE_DASHBOARD"], ["ATTENDANCE_VIEW"]).map(({ key }) => key),
  ["add"]
);
assert.equal(getRouteLabel(bundle.routes.find(({ key }) => key === "detail")!).defaultLabel, "Details");
assert.doesNotThrow(() => assertRouteBundleEdition(bundle, "FULL"));
assert.throws(() => assertRouteBundleEdition(bundle, "ATTENDANCE"), /route manifest mismatch/u);
assert.throws(
  () => defineRouteBundle({ ...bundle, routes: [route(), route({ key: "duplicate-path" })] }),
  /Duplicate route path/u
);
assert.throws(
  () => defineRouteBundle({ ...bundle, routes: [route({ permissions: [] })] }),
  /permissions are required/u
);
assert.throws(
  () => defineRouteBundle({ ...bundle, routes: [route({ path: "relative" })] }),
  /path must be absolute/u
);
assert.throws(
  () => defineRouteBundle({ ...bundle, routes: [route({ parentKey: "missing" })] }),
  /Unknown parent route/u
);

console.log("ok - typed route manifest validation, navigation, headers, breadcrumbs, redirects, and edition matching");
