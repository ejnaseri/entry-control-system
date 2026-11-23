import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api/client";
import { InboxContext, type InboxTab } from "../components/inbox/InboxContext";
import { InboxBell, InboxDrawer } from "../components/inbox/InboxDrawer";
import { SharedAppShell } from "./SharedAppShell";

export function AttendanceInboxShell() {
  const queryClient = useQueryClient();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxTab>("alerts");

  useEffect(() => {
    const apiBase = api.defaults.baseURL ?? window.location.origin;
    const wsUrlObject = new URL("/ws/inbox", apiBase);
    wsUrlObject.protocol = wsUrlObject.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = wsUrlObject.toString();
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
    let disposed = false;

    const connect = () => {
      if (disposed) return;
      socket = new WebSocket(wsUrl);
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type !== "INBOX_ITEM_CREATED") return;
          window.dispatchEvent(new CustomEvent("inbox:new", { detail: payload.item }));
          queryClient.invalidateQueries({ queryKey: ["inboxUnreadCounts"] });
          queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
        } catch {
          // Ignore malformed messages.
        }
      });
      socket.addEventListener("close", () => {
        if (disposed || reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      });
    };

    connect();
    return () => {
      disposed = true;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);

  const openInbox = (tab?: InboxTab) => {
    if (tab) setInboxTab(tab);
    setInboxOpen(true);
  };

  return (
    <InboxContext.Provider
      value={{
        isOpen: inboxOpen,
        activeTab: inboxTab,
        openInbox,
        closeInbox: () => setInboxOpen(false),
        setActiveTab: setInboxTab,
      }}
    >
      <SharedAppShell headerExtras={() => <InboxBell />} overlay={<InboxDrawer edition="ATTENDANCE" />} />
    </InboxContext.Provider>
  );
}
