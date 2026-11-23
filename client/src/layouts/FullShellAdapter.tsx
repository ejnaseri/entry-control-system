import { Fragment, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { IconVolume2 } from "@tabler/icons-react";
import { api } from "../api/client";
import { getSoundSettings } from "../api/sounds";
import { InboxContext, type InboxTab } from "../components/inbox/InboxContext";
import { InboxBell, InboxDrawer } from "../components/inbox/InboxDrawer";
import { soundPlayer } from "../services/soundPlayer";
import { SharedAppShell, type SharedAppShellRenderContext } from "./SharedAppShell";

export function FullShellAdapter() {
  const queryClient = useQueryClient();
  const [inboxOpen, setInboxOpen] = useState(false);
  const [inboxTab, setInboxTab] = useState<InboxTab>("alerts");
  const [soundStatus, setSoundStatus] = useState(() => soundPlayer.getStatus());

  const openInbox = (tab?: InboxTab) => {
    if (tab) setInboxTab(tab);
    setInboxOpen(true);
  };
  const closeInbox = () => setInboxOpen(false);

  useEffect(() => {
    let active = true;
    getSoundSettings()
      .then((settings) => {
        if (!active) return;
        soundPlayer.setSettings(settings);
      })
      .catch((error) => {
        console.warn("[AtlasGym sound] settings load failed", error);
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => soundPlayer.subscribe(setSoundStatus), []);

  useEffect(() => {
    const refresh = () => {
      getSoundSettings()
        .then((settings) => {
          soundPlayer.setSettings(settings);
        })
        .catch((error) => {
          console.warn("[AtlasGym sound] settings refresh failed", error);
        });
    };
    window.addEventListener("sound:refresh", refresh as EventListener);
    return () => window.removeEventListener("sound:refresh", refresh as EventListener);
  }, []);

  useEffect(() => {
    const apiBase = api.defaults.baseURL ?? window.location.origin;
    const wsUrlObject = new URL("/ws/inbox", apiBase);
    wsUrlObject.protocol = wsUrlObject.protocol === "https:" ? "wss:" : "ws:";
    const wsUrl = wsUrlObject.toString();
    let socket: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | null = null;

    const connect = () => {
      socket = new WebSocket(wsUrl);
      socket.addEventListener("message", (event) => {
        try {
          const payload = JSON.parse(event.data);
          if (payload?.type === "INBOX_ITEM_CREATED") {
            soundPlayer.playInboxItem(payload.item);
            window.dispatchEvent(new CustomEvent("inbox:new", { detail: payload.item }));
            queryClient.invalidateQueries({ queryKey: ["inboxUnreadCounts"] });
            queryClient.invalidateQueries({ queryKey: ["inboxItems"] });
          }
        } catch {
          // Ignore malformed messages.
        }
      });
      socket.addEventListener("close", () => {
        if (reconnectTimer) return;
        reconnectTimer = setTimeout(() => {
          reconnectTimer = null;
          connect();
        }, 3000);
      });
    };

    connect();

    return () => {
      if (reconnectTimer) clearTimeout(reconnectTimer);
      socket?.close();
    };
  }, [queryClient]);

  const renderFullHeaderExtras = ({ currentLanguage, isLight }: SharedAppShellRenderContext) => {
    const soundUnlockLabel =
      currentLanguage === "fa"
        ? "فعال‌سازی صدا"
        : currentLanguage === "ps"
          ? "غږ فعالول"
          : "Enable sound";

    return (
      <Fragment>
        {soundStatus.enabled && soundStatus.awaitingUserGesture ? (
          <button
            type="button"
            onClick={() => {
              void soundPlayer.enableFromUserGesture();
            }}
            className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs font-semibold transition ${
              isLight
                ? "border-amber-200 bg-amber-50 text-amber-800 hover:border-amber-300 hover:bg-amber-100"
                : "border-amber-400/35 bg-amber-400/10 text-amber-100 hover:border-amber-300/60 hover:bg-amber-400/15"
            }`}
            title={soundUnlockLabel}
            aria-label={soundUnlockLabel}
          >
            <IconVolume2 className="h-3.5 w-3.5" stroke={1.8} />
            <span>{soundUnlockLabel}</span>
          </button>
        ) : null}
        <InboxBell />
      </Fragment>
    );
  };

  return (
    <InboxContext.Provider value={{ isOpen: inboxOpen, activeTab: inboxTab, openInbox, closeInbox, setActiveTab: setInboxTab }}>
      <SharedAppShell headerExtras={renderFullHeaderExtras} overlay={<InboxDrawer />} />
    </InboxContext.Provider>
  );
}
