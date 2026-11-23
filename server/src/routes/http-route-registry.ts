import { runtimeOptionalFeatureFlags, type AppEdition } from "../config/env";
import { isFeatureEnabled, type Capability } from "../config/capabilities";

export type HttpRouteLayer = "PUBLIC" | "AUTH" | "BUSINESS" | "SPECIAL";
export type HttpRouteBoundaryMatch = "EXACT" | "PREFIX" | "RESERVED_ONLY";

export type HttpRouteDefinition = Readonly<{
  id: string;
  path: string;
  capability: Capability | null;
  layer: HttpRouteLayer;
  boundaryMatch: HttpRouteBoundaryMatch;
}>;

const routeRegistry = [
  { id: "api-identity", path: "/api", capability: null, layer: "PUBLIC", boundaryMatch: "EXACT" },
  { id: "health", path: "/api/v1/health", capability: null, layer: "PUBLIC", boundaryMatch: "PREFIX" },
  { id: "auth", path: "/api/v1/auth", capability: "AUTH", layer: "AUTH", boundaryMatch: "PREFIX" },
  { id: "iclock", path: "/iclock", capability: "ICLOCK_ADMS", layer: "SPECIAL", boundaryMatch: "PREFIX" },
  {
    id: "device-push",
    path: "/api/v1/devices",
    capability: "GENERIC_DEVICE_PUSH",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "device-diagnostics",
    path: "/api/v1/devices",
    capability: "DEVICE_DIAGNOSTICS",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "device-door-control",
    path: "/api/v1/devices",
    capability: "DOOR_CONTROL",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  { id: "admin-users", path: "/api/v1/admin-users", capability: "ADMIN_USERS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "audit-logs", path: "/api/v1/audit-logs", capability: "AUDIT_LOGS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "members", path: "/api/v1/members", capability: "CUSTOMERS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "employees", path: "/api/v1/employees", capability: "EMPLOYEES", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  {
    id: "attendance-entry-logs",
    path: "/api/v1/attendance",
    capability: "ENTRY_LOGS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "attendance-daily",
    path: "/api/v1/attendance",
    capability: "ATTENDANCE_DAILY",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "membership-plans",
    path: "/api/v1/membership-plans",
    capability: "MEMBERSHIPS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  { id: "staff-groups", path: "/api/v1/staff-groups", capability: "STAFF_GROUPS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "shifts", path: "/api/v1/shifts", capability: "STAFF_GROUPS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "devices", path: "/api/v1/devices", capability: "DEVICES", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  {
    id: "dashboard-attendance",
    path: "/api/v1/dashboard",
    capability: "ATTENDANCE_DASHBOARD",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "dashboard-customers",
    path: "/api/v1/dashboard",
    capability: "CUSTOMERS",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  {
    id: "dashboard-financial",
    path: "/api/v1/dashboard",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "RESERVED_ONLY",
  },
  { id: "inbox", path: "/api/v1/inbox", capability: "INBOX", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "sounds", path: "/api/v1/sounds", capability: "SOUNDS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "backups", path: "/api/v1/backups", capability: "BACKUPS", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "payroll", path: "/api/v1/payroll", capability: "PAYROLL", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  { id: "expenses", path: "/api/v1/expenses", capability: "EXPENSES", layer: "BUSINESS", boundaryMatch: "PREFIX" },
  {
    id: "membership-report",
    path: "/api/v1/membership-report",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-attendance",
    path: "/api/v1/reports/attendance",
    capability: "ATTENDANCE_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-customer-activity",
    path: "/api/v1/reports/customer-activity",
    capability: "CUSTOMERS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-debt-aging",
    path: "/api/v1/reports/debt-aging",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-renewal-forecast",
    path: "/api/v1/reports/renewal-forecast",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-payroll-variance",
    path: "/api/v1/reports/payroll-variance",
    capability: "PAYROLL",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-attendance-compliance",
    path: "/api/v1/reports/attendance-compliance",
    capability: "ATTENDANCE_COMPLIANCE",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
  {
    id: "reports-cashflow",
    path: "/api/v1/reports/cashflow",
    capability: "FINANCIAL_REPORTS",
    layer: "BUSINESS",
    boundaryMatch: "PREFIX",
  },
] as const satisfies readonly HttpRouteDefinition[];

routeRegistry.forEach(Object.freeze);

export const HTTP_ROUTE_REGISTRY = Object.freeze(routeRegistry);
export type HttpRouteId = (typeof HTTP_ROUTE_REGISTRY)[number]["id"];

export type HttpRequestDescriptor = Readonly<{
  method: string;
  pathname: string;
  preflightMethod?: string | undefined;
  query?: Readonly<Record<string, unknown>> | undefined;
}>;

type ReservedRouteRule = Readonly<{
  capability: Capability;
  matches: (request: NormalizedHttpRequestDescriptor) => boolean;
}>;

type NormalizedHttpRequestDescriptor = Readonly<{
  method: string;
  pathname: string;
  query: Readonly<Record<string, unknown>>;
}>;

const DEVICE_PATH = "/api/v1/devices";
const ATTENDANCE_PATH = "/api/v1/attendance";
const DASHBOARD_PATH = "/api/v1/dashboard";

function hasMethod(request: NormalizedHttpRequestDescriptor, ...methods: string[]) {
  return methods.includes(request.method);
}

function matchesPath(pathname: string, pattern: RegExp) {
  return pattern.test(pathname);
}

const reservedRouteRules: readonly ReservedRouteRule[] = Object.freeze([
  Object.freeze({
    capability: "GENERIC_DEVICE_PUSH",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      hasMethod(request, "POST") &&
      (request.pathname === `${DEVICE_PATH}/push-test` || request.pathname === `${DEVICE_PATH}/events/push`),
  }),
  Object.freeze({
    capability: "DEVICE_DIAGNOSTICS",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      (hasMethod(request, "GET") &&
        (matchesPath(request.pathname, /^\/api\/v1\/devices\/scan\/[^/]+$/u) ||
          request.pathname === `${DEVICE_PATH}/raw-logs` ||
          request.pathname === `${DEVICE_PATH}/raw-logs/support-bundle` ||
          matchesPath(request.pathname, /^\/api\/v1\/devices\/[^/]+\/logs$/u))) ||
      (hasMethod(request, "POST") &&
        (matchesPath(request.pathname, /^\/api\/v1\/devices\/scan\/[^/]+\/cancel$/u) ||
          matchesPath(request.pathname, /^\/api\/v1\/devices\/[^/]+\/(?:diagnose|scan)$/u) ||
          matchesPath(request.pathname, /^\/api\/v1\/devices\/[^/]+\/logs\/clear$/u))),
  }),
  Object.freeze({
    capability: "DOOR_CONTROL",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      hasMethod(request, "POST") && matchesPath(request.pathname, /^\/api\/v1\/devices\/[^/]+\/unlock$/u),
  }),
  Object.freeze({
    capability: "ENTRY_LOGS",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      hasMethod(request, "GET") && request.pathname === ATTENDANCE_PATH,
  }),
  Object.freeze({
    capability: "ATTENDANCE_DAILY",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      (hasMethod(request, "POST") && request.pathname === `${ATTENDANCE_PATH}/manual`) ||
      (hasMethod(request, "GET") && request.pathname === `${ATTENDANCE_PATH}/daily`) ||
      (hasMethod(request, "POST", "DELETE") && request.pathname === `${ATTENDANCE_PATH}/justifications`),
  }),
  Object.freeze({
    capability: "FINANCIAL_REPORTS",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      hasMethod(request, "GET") &&
      (request.pathname === `${DASHBOARD_PATH}/reports-summary` ||
        (request.pathname === `${DASHBOARD_PATH}/details` &&
          ["debtors", "revenueToday"].includes(getQueryString(request.query["type"])))),
  }),
  Object.freeze({
    capability: "CUSTOMERS",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      hasMethod(request, "GET") &&
      request.pathname === `${DASHBOARD_PATH}/details` &&
      ["activeMembers", "expiringSoon"].includes(getQueryString(request.query["type"])),
  }),
  Object.freeze({
    capability: "ATTENDANCE_DASHBOARD",
    matches: (request: NormalizedHttpRequestDescriptor) =>
      hasMethod(request, "GET") &&
      (request.pathname === `${DASHBOARD_PATH}/summary` || request.pathname === `${DASHBOARD_PATH}/details`),
  }),
]);

function getQueryString(value: unknown): string {
  if (Array.isArray(value)) {
    return String(value[0] ?? "");
  }
  if (value === undefined || value === null || typeof value === "object") {
    return "";
  }
  return String(value);
}

function normalizePathname(pathname: string): string {
  const withoutQuery = pathname.split("?", 1)[0] ?? "/";
  const normalized = withoutQuery.length > 1 ? withoutQuery.replace(/\/+$/u, "") : withoutQuery;
  return (normalized || "/").toLowerCase();
}

function normalizeMethod(method: string, preflightMethod?: string): string {
  const requestedMethod = method.toUpperCase() === "OPTIONS" && preflightMethod ? preflightMethod : method;
  const normalized = requestedMethod.toUpperCase();
  return normalized === "HEAD" ? "GET" : normalized;
}

function normalizeRequest(request: HttpRequestDescriptor): NormalizedHttpRequestDescriptor {
  return {
    method: normalizeMethod(request.method, request.preflightMethod),
    pathname: normalizePathname(request.pathname),
    query: request.query ?? {},
  };
}

function pathMatchesDefinition(pathname: string, definition: HttpRouteDefinition): boolean {
  const routePath = definition.path.toLowerCase();
  if (definition.boundaryMatch === "EXACT") {
    return pathname === routePath;
  }
  if (definition.boundaryMatch === "RESERVED_ONLY") {
    return false;
  }
  return pathname === routePath || pathname.startsWith(`${routePath}/`);
}

function isDefinitionEnabled(edition: AppEdition, definition: HttpRouteDefinition): boolean {
  return definition.capability === null || isFeatureEnabled(edition, definition.capability, runtimeOptionalFeatureFlags);
}

function resolveReservedCapability(request: NormalizedHttpRequestDescriptor): Capability | undefined {
  return reservedRouteRules.find((rule) => rule.matches(request))?.capability;
}

export function getHttpRouteDefinition(id: HttpRouteId): (typeof HTTP_ROUTE_REGISTRY)[number] {
  const definition = HTTP_ROUTE_REGISTRY.find((route) => route.id === id);
  if (!definition) {
    throw new Error(`Unknown HTTP route id: ${id}`);
  }
  return definition;
}

export function getEnabledHttpRouteInventory(edition: AppEdition): readonly HttpRouteDefinition[] {
  return Object.freeze(HTTP_ROUTE_REGISTRY.filter((definition) => isDefinitionEnabled(edition, definition)));
}

export function isHttpRequestEnabled(edition: AppEdition, request: HttpRequestDescriptor): boolean {
  const normalized = normalizeRequest(request);
  const reservedCapability = resolveReservedCapability(normalized);
  if (reservedCapability) {
    return isFeatureEnabled(edition, reservedCapability, runtimeOptionalFeatureFlags);
  }
  return HTTP_ROUTE_REGISTRY.some(
    (definition) => isDefinitionEnabled(edition, definition) && pathMatchesDefinition(normalized.pathname, definition)
  );
}

export function isEnabledBusinessHttpRequest(edition: AppEdition, request: HttpRequestDescriptor): boolean {
  const normalized = normalizeRequest(request);
  const reservedCapability = resolveReservedCapability(normalized);
  if (reservedCapability) {
    return isFeatureEnabled(edition, reservedCapability, runtimeOptionalFeatureFlags);
  }
  return HTTP_ROUTE_REGISTRY.some(
    (definition) =>
      definition.layer === "BUSINESS" &&
      isDefinitionEnabled(edition, definition) &&
      pathMatchesDefinition(normalized.pathname, definition)
  );
}

export function isEnabledMaintenanceProtectedHttpRequest(
  edition: AppEdition,
  request: HttpRequestDescriptor
): boolean {
  const normalized = normalizeRequest(request);
  const reservedCapability = resolveReservedCapability(normalized);
  if (reservedCapability) {
    return isFeatureEnabled(edition, reservedCapability, runtimeOptionalFeatureFlags);
  }
  return HTTP_ROUTE_REGISTRY.some(
    (definition) =>
      (definition.layer === "BUSINESS" || definition.layer === "SPECIAL")
      && isDefinitionEnabled(edition, definition)
      && pathMatchesDefinition(normalized.pathname, definition)
  );
}
