import { createContext, useContext, type ReactNode } from "react";
import type { AppRouteBundle } from "./routeManifest";

const RouteManifestContext = createContext<AppRouteBundle | null>(null);

export function RouteManifestProvider({ bundle, children }: { bundle: AppRouteBundle; children: ReactNode }) {
  return <RouteManifestContext.Provider value={bundle}>{children}</RouteManifestContext.Provider>;
}

export function useRouteManifest(): AppRouteBundle {
  const bundle = useContext(RouteManifestContext);
  if (!bundle) throw new Error("RouteManifestProvider is required");
  return bundle;
}
