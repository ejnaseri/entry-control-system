import { createContext, useContext } from "react";

export type ToastKind = "success" | "error" | "warning" | "info";

export type ToastPayload = {
  kind: ToastKind;
  title: string;
  message?: string;
};

type ToastContextValue = {
  push: (payload: ToastPayload) => void;
};

export const ToastContext = createContext<ToastContextValue | null>(null);

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) {
    throw new Error("useToast must be used within ToastProvider");
  }
  return context;
}
