import type { ComponentType, LazyExoticComponent } from "react";
import type { AdminPermission } from "../api/auth";
import type { AppEdition, Capability } from "../auth/authState";

export const ROUTE_NAVIGATION_SURFACES = Object.freeze(["main", "settings"] as const);
export type RouteNavigationSurface = (typeof ROUTE_NAVIGATION_SURFACES)[number];

export const ROUTE_NAVIGATION_ICONS = Object.freeze([
  "dashboard",
  "members",
  "attendance",
  "entry-logs",
  "membership-payments",
  "payroll",
  "expenses",
  "devices",
  "reports",
  "admin-users",
  "audit-logs",
  "membership-plans",
  "staff-groups",
  "sounds",
  "backups",
] as const);
export type RouteNavigationIcon = (typeof ROUTE_NAVIGATION_ICONS)[number];

export type RouteLabel = Readonly<{
  labelKey: string;
  defaultLabel: string;
}>;

export type RouteNavigation = Readonly<{
  surface: RouteNavigationSurface;
  icon: RouteNavigationIcon;
}> & RouteLabel;

export type AppRouteDefinition = Readonly<{
  key: string;
  path: string;
  feature: Capability;
  permissions: readonly AdminPermission[];
  component: LazyExoticComponent<ComponentType>;
  title?: RouteLabel;
  navigation: RouteNavigation | null;
  parentKey?: string | null;
  headerAction?: RouteLabel | null;
  order: number;
}>;

export type AppRouteBundle = Readonly<{
  id: string;
  edition: AppEdition;
  layout: LazyExoticComponent<ComponentType>;
  routes: readonly AppRouteDefinition[];
}>;

export function defineRouteBundle(input: AppRouteBundle): AppRouteBundle {
  const keys = new Set<string>();
  const paths = new Set<string>();
  const routes = input.routes.map((route) => {
    if (!route.key.trim()) throw new Error("Route key is required");
    if (!route.path.startsWith("/")) throw new Error(`Route path must be absolute: ${route.path}`);
    if (keys.has(route.key)) throw new Error(`Duplicate route key: ${route.key}`);
    if (paths.has(route.path)) throw new Error(`Duplicate route path: ${route.path}`);
    if (!Number.isSafeInteger(route.order) || route.order < 0) {
      throw new Error(`Route order must be a non-negative integer: ${route.key}`);
    }
    if (route.permissions.length === 0) {
      throw new Error(`Route permissions are required: ${route.key}`);
    }
    const routeLabel = route.title ?? route.navigation;
    if (!routeLabel?.labelKey.trim() || !routeLabel.defaultLabel.trim()) {
      throw new Error(`Route title is required: ${route.key}`);
    }
    if (route.headerAction && (!route.headerAction.labelKey.trim() || !route.headerAction.defaultLabel.trim())) {
      throw new Error(`Route header action label is required: ${route.key}`);
    }
    keys.add(route.key);
    paths.add(route.path);
    return Object.freeze({
      ...route,
      permissions: Object.freeze([...route.permissions]),
      title: route.title ? Object.freeze({ ...route.title }) : undefined,
      navigation: route.navigation ? Object.freeze({ ...route.navigation }) : null,
      headerAction: route.headerAction ? Object.freeze({ ...route.headerAction }) : null,
    });
  });

  const routesByKey = new Map(routes.map((route) => [route.key, route]));
  for (const route of routes) {
    if (route.parentKey && !routesByKey.has(route.parentKey)) {
      throw new Error(`Unknown parent route ${route.parentKey}: ${route.key}`);
    }
    const visited = new Set([route.key]);
    let parentKey = route.parentKey;
    while (parentKey) {
      if (visited.has(parentKey)) throw new Error(`Circular route parent: ${route.key}`);
      visited.add(parentKey);
      parentKey = routesByKey.get(parentKey)?.parentKey ?? null;
    }
  }

  return Object.freeze({
    ...input,
    routes: Object.freeze(routes),
  });
}

export function canAccessRoute(
  route: AppRouteDefinition,
  features: readonly Capability[],
  permissions: readonly AdminPermission[]
): boolean {
  return features.includes(route.feature) && route.permissions.some((permission) => permissions.includes(permission));
}

export function findFirstAccessibleRoute(
  routes: readonly AppRouteDefinition[],
  surface: RouteNavigationSurface,
  features: readonly Capability[],
  permissions: readonly AdminPermission[]
): AppRouteDefinition | null {
  return (
    routes
      .filter((route) => route.navigation?.surface === surface && canAccessRoute(route, features, permissions))
      .sort((left, right) => left.order - right.order || left.path.localeCompare(right.path))[0] ?? null
  );
}

export function findAccessibleNavigationRoutes(
  routes: readonly AppRouteDefinition[],
  surface: RouteNavigationSurface,
  features: readonly Capability[],
  permissions: readonly AdminPermission[]
): AppRouteDefinition[] {
  return routes
    .filter((route) => route.navigation?.surface === surface && canAccessRoute(route, features, permissions))
    .sort((left, right) => left.order - right.order || left.path.localeCompare(right.path));
}

export function findAccessibleHeaderActions(
  routes: readonly AppRouteDefinition[],
  features: readonly Capability[],
  permissions: readonly AdminPermission[]
): AppRouteDefinition[] {
  return routes
    .filter((route) => route.headerAction && canAccessRoute(route, features, permissions))
    .sort((left, right) => left.order - right.order || left.path.localeCompare(right.path));
}

export function findMatchingRoute(
  routes: readonly AppRouteDefinition[],
  pathname: string
): AppRouteDefinition | null {
  const normalizedPath = normalizePath(pathname);
  return (
    routes
      .filter((route) => routePathMatches(route.path, normalizedPath))
      .sort((left, right) => routeSpecificity(right.path) - routeSpecificity(left.path) || left.order - right.order)[0] ??
    null
  );
}

export function buildRouteBreadcrumbs(
  routes: readonly AppRouteDefinition[],
  pathname: string,
  features: readonly Capability[],
  permissions: readonly AdminPermission[]
): AppRouteDefinition[] {
  const current = findMatchingRoute(routes, pathname);
  if (!current || !canAccessRoute(current, features, permissions)) return [];
  const routesByKey = new Map(routes.map((route) => [route.key, route]));
  const breadcrumbs: AppRouteDefinition[] = [current];
  let parentKey = current.parentKey;
  while (parentKey) {
    const parent = routesByKey.get(parentKey);
    if (!parent) break;
    if (canAccessRoute(parent, features, permissions)) breadcrumbs.unshift(parent);
    parentKey = parent.parentKey;
  }
  return breadcrumbs;
}

export function getRouteLabel(route: AppRouteDefinition): RouteLabel {
  const label = route.title ?? route.navigation;
  if (!label) throw new Error(`Route title is required: ${route.key}`);
  return label;
}

function normalizePath(pathname: string): string {
  const withoutQuery = pathname.split(/[?#]/u, 1)[0] || "/";
  if (withoutQuery === "/") return withoutQuery;
  return withoutQuery.replace(/\/+$/u, "");
}

function routePathMatches(routePath: string, pathname: string): boolean {
  const routeSegments = normalizePath(routePath).split("/").filter(Boolean);
  const pathSegments = pathname.split("/").filter(Boolean);
  if (routeSegments.length !== pathSegments.length) return false;
  return routeSegments.every((segment, index) => segment.startsWith(":") || segment === pathSegments[index]);
}

function routeSpecificity(routePath: string): number {
  return routePath
    .split("/")
    .filter(Boolean)
    .reduce((score, segment) => score + (segment.startsWith(":") ? 1 : 10), 0);
}

export function assertRouteBundleEdition(bundle: AppRouteBundle, edition: AppEdition): void {
  if (bundle.edition !== edition) {
    throw new Error(`Client route manifest mismatch: build=${edition}, manifest=${bundle.edition}`);
  }
}
