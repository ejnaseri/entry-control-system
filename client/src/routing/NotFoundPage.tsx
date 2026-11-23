import { useTranslation } from "react-i18next";

export function NotFoundPage() {
  const { t } = useTranslation();
  return (
    <div className="mx-auto flex min-h-[55vh] max-w-xl items-center justify-center px-4" data-testid="generic-not-found">
      <div className="theme-panel rounded-2xl border border-slate-300/30 p-6 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">404</p>
        <h1 className="mt-2 text-lg font-bold text-slate-950 dark:text-white">
          {t("common.notFound.title", { defaultValue: "Page not found" })}
        </h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          {t("common.notFound.body", { defaultValue: "The requested page is not available." })}
        </p>
      </div>
    </div>
  );
}
