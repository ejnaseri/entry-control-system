import { createContext, useContext, useEffect, useLayoutEffect, useRef } from "react";

export type GlobalLoadingOptions = {
  message?: string;
  subtitle?: string;
  delayMs?: number;
  minDurationMs?: number;
};

export type GlobalLoadingContextValue = {
  startLoading: (options?: GlobalLoadingOptions) => string;
  updateLoading: (id: string, options?: GlobalLoadingOptions) => void;
  stopLoading: (id: string) => void;
};

export const GlobalLoadingContext = createContext<GlobalLoadingContextValue | null>(null);

export function useGlobalLoadingController() {
  const context = useContext(GlobalLoadingContext);
  if (!context) {
    throw new Error("useGlobalLoadingController must be used within GlobalLoadingProvider");
  }
  return context;
}

export function useGlobalLoading(show: boolean, options?: GlobalLoadingOptions) {
  const { startLoading, updateLoading, stopLoading } = useGlobalLoadingController();
  const activeIdRef = useRef<string | null>(null);
  const optionsRef = useRef<GlobalLoadingOptions | undefined>(options);
  const delayMs = options?.delayMs;
  const message = options?.message;
  const minDurationMs = options?.minDurationMs;
  const subtitle = options?.subtitle;

  useLayoutEffect(() => {
    optionsRef.current = { delayMs, message, minDurationMs, subtitle };
  }, [delayMs, message, minDurationMs, subtitle]);

  useLayoutEffect(() => {
    if (!show) return undefined;
    const id = startLoading(optionsRef.current);
    activeIdRef.current = id;
    return () => {
      stopLoading(id);
      if (activeIdRef.current === id) {
        activeIdRef.current = null;
      }
    };
  }, [show, startLoading, stopLoading]);

  useEffect(() => {
    if (!show || !activeIdRef.current) return;
    updateLoading(activeIdRef.current, optionsRef.current);
  }, [delayMs, message, minDurationMs, show, subtitle, updateLoading]);
}
