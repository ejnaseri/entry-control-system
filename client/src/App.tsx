import { Suspense, useEffect } from "react";
import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { selectedRouteBundle } from "@app-route-manifest";
import { AuthProvider } from "./auth/AuthProvider";
import { RequireAuth, RequireFeature, RequirePermission } from "./auth/AuthRoutes";
import { useAuth } from "./auth/AuthContext";
import { AppLoadingOverlay } from "./components/AppLoadingOverlay";
import { GlobalLoadingProvider } from "./components/GlobalLoadingProvider";
import { ToastProvider } from "./components/ToastProvider";
import { CLIENT_BUILD_IDENTITY } from "./config/clientBuildIdentity";
import { PRODUCT_BRAND } from "@app-product-brand";
import { rtlLanguages } from "./i18n/config";
import { AuthEntryPage } from "./pages/auth/AuthEntryPage";
import { NotFoundPage } from "./routing/NotFoundPage";
import { RouteManifestProvider } from "./routing/RouteManifestContext";
import {
  assertRouteBundleEdition,
  findFirstAccessibleRoute,
  type AppRouteDefinition,
  type RouteNavigationSurface,
} from "./routing/routeManifest";

assertRouteBundleEdition(selectedRouteBundle, CLIENT_BUILD_IDENTITY.edition);

export default function App() {
  return (
    <ToastProvider>
      <GlobalLoadingProvider>
        <DocumentLanguageSync />
        <DocumentBrandSync />
        <BrowserRouter>
          <AuthProvider>
            <RouteManifestProvider bundle={selectedRouteBundle}>
              <div className="contents" data-route-manifest={selectedRouteBundle.id}>
                <Routes>
                  <Route path="/login" element={<AuthEntryPage />} />
                  <Route element={<RequireAuth />}>
                    <Route element={<SelectedLayout />}>
                      <Route index element={<ManifestRedirect surface="main" />} />
                      <Route path="/settings" element={<ManifestRedirect surface="settings" />} />
                      {selectedRouteBundle.routes.map((route) => (
                        <Route key={route.key} path={route.path} element={<ManifestRouteElement route={route} />} />
                      ))}
                      <Route path="*" element={<NotFoundPage />} />
                    </Route>
                  </Route>
                </Routes>
              </div>
            </RouteManifestProvider>
          </AuthProvider>
        </BrowserRouter>
      </GlobalLoadingProvider>
    </ToastProvider>
  );
}

function DocumentBrandSync() {
  useEffect(() => {
    document.title = PRODUCT_BRAND.name;
    const icon = document.querySelector<HTMLLinkElement>('link[rel="icon"]');
    if (icon) icon.href = PRODUCT_BRAND.iconHref;
  }, []);
  return null;
}

function SelectedLayout() {
  const Layout = selectedRouteBundle.layout;
  return (
    <Suspense fallback={<AppLoadingOverlay show message="Loading application" subtitle="Please wait" />}>
      <Layout />
    </Suspense>
  );
}

function ManifestRouteElement({ route }: { route: AppRouteDefinition }) {
  const Component = route.component;
  return (
    <RequireFeature feature={route.feature}>
      <RequirePermission anyOf={route.permissions}>
        <Suspense fallback={<AppLoadingOverlay show message="Loading page" subtitle="Please wait" />}>
          <Component />
        </Suspense>
      </RequirePermission>
    </RequireFeature>
  );
}

function ManifestRedirect({ surface }: { surface: RouteNavigationSurface }) {
  const { auth } = useAuth();
  const destination = findFirstAccessibleRoute(
    selectedRouteBundle.routes,
    surface,
    auth?.features ?? [],
    auth?.permissions ?? []
  );
  return destination ? <Navigate to={destination.path} replace /> : <NotFoundPage />;
}

function DocumentLanguageSync() {
  const { i18n } = useTranslation();

  useEffect(() => {
    const language = i18n.language.split("-")[0] || "en";
    document.documentElement.lang = language;
    document.documentElement.dir = rtlLanguages.includes(language) ? "rtl" : "ltr";
  }, [i18n.language]);

  return null;
}
