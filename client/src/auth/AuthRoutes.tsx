import type { ReactNode } from "react";
import { Navigate, Outlet, useLocation } from "react-router-dom";
import { useTranslation } from "react-i18next";
import type { AdminPermission } from "../api/auth";
import { AppLoadingOverlay } from "../components/AppLoadingOverlay";
import { NotFoundPage } from "../routing/NotFoundPage";
import type { Capability } from "./authState";
import { useAuth } from "./AuthContext";

export function RequireAuth() {
  const location = useLocation();
  const { status } = useAuth();

  if (status === "checking") {
    return <AppLoadingOverlay show message="Checking session" subtitle="Please wait" />;
  }

  if (status !== "authenticated") {
    return <Navigate to="/login" replace state={{ from: location }} />;
  }

  return <Outlet />;
}

export function RequireFeature({ feature, children }: { feature: Capability; children: ReactNode }) {
  const { hasFeature } = useAuth();
  if (!hasFeature(feature)) {
    return <NotFoundPage />;
  }
  return <>{children}</>;
}

export function RequirePermission({ anyOf, children }: { anyOf: readonly AdminPermission[]; children: ReactNode }) {
  const { hasAnyPermission } = useAuth();
  if (!hasAnyPermission(anyOf)) {
    return <ForbiddenPage />;
  }
  return <>{children}</>;
}

function ForbiddenPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4">
      <div className="theme-panel rounded-2xl border border-amber-300/40 bg-amber-50/80 p-5 text-center text-amber-950 shadow-sm dark:border-amber-400/30 dark:bg-amber-500/10 dark:text-amber-100">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-200">
          {t("auth.forbidden.eyebrow", { defaultValue: "Permission required" })}
        </p>
        <h1 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
          {t("auth.forbidden.title", { defaultValue: "You do not have access to this section" })}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t("auth.forbidden.body", { defaultValue: "Ask the owner to enable the required permission for your account." })}
        </p>
      </div>
    </div>
  );
}
