import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { rtlLanguages } from "../i18n/config";
import { CloseIconButton } from "./CloseIconButton";
import { ToastContext, type ToastKind, type ToastPayload } from "./ToastContext";

type ToastState = ToastPayload & { id: number };

export function ToastProvider({ children }: { children: ReactNode }) {
  const { i18n, t } = useTranslation();
  const [toast, setToast] = useState<ToastState | null>(null);
  const [visible, setVisible] = useState(false);
  const isRtl = rtlLanguages.includes(i18n.language.split("-")[0]);

  const push = useCallback((payload: ToastPayload) => {
    setToast({ id: Date.now(), ...payload });
    setVisible(true);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const hideTimer = setTimeout(() => setVisible(false), 3200);
    const removeTimer = setTimeout(() => setToast(null), 3600);
    return () => {
      clearTimeout(hideTimer);
      clearTimeout(removeTimer);
    };
  }, [toast]);

  const dismiss = () => {
    setVisible(false);
    setTimeout(() => setToast(null), 200);
  };

  const value = useMemo(() => ({ push }), [push]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastViewport toast={toast} visible={visible} isRtl={isRtl} closeLabel={t("common.actions.close")} onClose={dismiss} />
    </ToastContext.Provider>
  );
}

function ToastViewport({
  toast,
  visible,
  isRtl,
  closeLabel,
  onClose,
}: {
  toast: ToastState | null;
  visible: boolean;
  isRtl: boolean;
  closeLabel: string;
  onClose: () => void;
}) {
  if (!toast) return null;
  const toneStyles: Record<ToastKind, string> = {
    success:
      "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-500/40 dark:bg-emerald-500/15 dark:text-emerald-50",
    error: "border-rose-200 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-rose-50",
    warning:
      "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-500/40 dark:bg-amber-500/15 dark:text-amber-50",
    info: "border-slate-200 bg-slate-50 text-slate-900 dark:border-slate-500/40 dark:bg-slate-500/15 dark:text-slate-50",
  };
  const tone = toneStyles[toast.kind];
  const side = isRtl ? "left-4" : "right-4";
  const translate = isRtl ? "-translate-x-4" : "translate-x-4";
  return (
    <div
      className={`fixed top-24 z-50 w-[min(92vw,360px)] ${side} transition-all duration-300 ${
        visible ? "translate-x-0 opacity-100" : `${translate} opacity-0`
      }`}
    >
      <div className={`rounded-2xl border px-4 py-3 shadow-xl backdrop-blur ${tone}`}>
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold">{toast.title}</p>
            {toast.message ? <p className="mt-1 text-[11px] text-current/80">{toast.message}</p> : null}
          </div>
          <CloseIconButton label={closeLabel} size="sm" onClick={onClose} className="border-current/20 bg-transparent text-current/65 shadow-none hover:border-current/35 hover:bg-current/10 hover:text-current" />
        </div>
      </div>
    </div>
  );
}
