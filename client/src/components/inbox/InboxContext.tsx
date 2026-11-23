import { createContext, useContext } from "react";

export type InboxTab = "alerts" | "deviceFeed";

export type InboxContextValue = {
  isOpen: boolean;
  activeTab: InboxTab;
  openInbox: (tab?: InboxTab) => void;
  closeInbox: () => void;
  setActiveTab: (tab: InboxTab) => void;
};

export const InboxContext = createContext<InboxContextValue | undefined>(undefined);

export function useInbox() {
  const ctx = useContext(InboxContext);
  if (!ctx) {
    throw new Error("useInbox must be used within an InboxContext provider");
  }
  return ctx;
}
