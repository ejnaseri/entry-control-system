import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { useTranslation } from "react-i18next";
import { rtlLanguages } from "../i18n/config";
import { AppLoadingOverlay } from "./AppLoadingOverlay";
import { GlobalLoadingContext, type GlobalLoadingOptions } from "./GlobalLoadingContext";

type LoadingEntry = GlobalLoadingOptions & {
  id: string;
};

const DEFAULT_DELAY_MS = 160;
const DEFAULT_MIN_DURATION_MS = 260;

export function GlobalLoadingProvider({ children }: { children: ReactNode }) {
  const { t, i18n } = useTranslation();
  const [entries, setEntries] = useState<LoadingEntry[]>([]);
  const [visible, setVisible] = useState(false);
  const idRef = useRef(0);
  const visibleSinceRef = useRef<number | null>(null);
  const minDurationRef = useRef(DEFAULT_MIN_DURATION_MS);

  const startLoading = useCallback((options?: GlobalLoadingOptions) => {
    const id = `global-loading-${idRef.current}`;
    idRef.current += 1;
    setEntries((current) => [...current, { id, ...options }]);
    return id;
  }, []);

  const updateLoading = useCallback((id: string, options?: GlobalLoadingOptions) => {
    setEntries((current) => current.map((entry) => (entry.id === id ? { ...entry, ...options } : entry)));
  }, []);

  const stopLoading = useCallback((id: string) => {
    setEntries((current) => current.filter((entry) => entry.id !== id));
  }, []);

  const activeEntry = entries.at(-1) ?? null;
  const hasActiveEntry = Boolean(activeEntry);
  const currentLanguage = i18n.language.split("-")[0];
  const dir = rtlLanguages.includes(currentLanguage) ? "rtl" : "ltr";

  useLayoutEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;

    if (hasActiveEntry && !visible) {
      const delay = activeEntry?.delayMs ?? DEFAULT_DELAY_MS;
      const showOverlay = () => {
        minDurationRef.current = activeEntry?.minDurationMs ?? DEFAULT_MIN_DURATION_MS;
        visibleSinceRef.current = Date.now();
        setVisible(true);
      };

      if (delay <= 0) {
        showOverlay();
      } else {
        timer = setTimeout(showOverlay, delay);
      }
    }

    if (!hasActiveEntry && visible) {
      const visibleSince = visibleSinceRef.current ?? Date.now();
      const elapsed = Date.now() - visibleSince;
      const remaining = Math.max(0, minDurationRef.current - elapsed);
      timer = setTimeout(() => {
        visibleSinceRef.current = null;
        setVisible(false);
      }, remaining);
    }

    return () => {
      if (timer) clearTimeout(timer);
    };
  }, [activeEntry?.delayMs, activeEntry?.minDurationMs, hasActiveEntry, visible]);

  useEffect(() => {
    if (!visible) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  const value = useMemo(
    () => ({
      startLoading,
      updateLoading,
      stopLoading,
    }),
    [startLoading, stopLoading, updateLoading]
  );

  return (
    <GlobalLoadingContext.Provider value={value}>
      {children}
      <AppLoadingOverlay
        show={visible}
        message={activeEntry?.message ?? t("common.messages.loading")}
        subtitle={activeEntry?.subtitle}
        dir={dir}
      />
    </GlobalLoadingContext.Provider>
  );
}
