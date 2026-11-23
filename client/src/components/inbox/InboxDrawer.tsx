import { useCallback, useEffect, useMemo, useRef, useState, type SVGProps } from "react";
import { useTranslation } from "react-i18next";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { listDevices } from "../../api/devices";
import {
  getInboxUnreadCounts,
  listInboxItems,
  markInboxItemRead,
  markInboxReadBulk,
  markInboxReadAll,
  type InboxItem,
  type InboxItemType,
  type InboxListParams,
  type InboxListResponse,
  type InboxUnreadCounts,
} from "../../api/inbox";
import { useModalDismiss } from "../../hooks/useModalDismiss";
import { useInbox } from "./InboxContext";
import { useToast } from "../ToastContext";
import { CloseIconButton } from "../CloseIconButton";
import { PaginationControls } from "../ui/PaginationControls";
import { ShamsiDateInput } from "../ui/ShamsiDateInput";
import { resolveDateLocale } from "../../shared/dateLocale";
import { useAuth } from "../../auth/AuthContext";

const PAGE_SIZE = 20;
const AUTO_READ_DELAY_MS = 1000;
const AUTO_READ_FLUSH_MS = 150;
const AUTO_READ_THRESHOLD = 0.6;

const ALERT_TYPES: Array<{ value: InboxItemType; labelKey: string }> = [
  { value: "MEMBERSHIP_EXPIRING", labelKey: "inbox.types.membershipExpiring" },
  { value: "MEMBERSHIP_EXPIRED", labelKey: "inbox.types.membershipExpired" },
  { value: "SHIFT_ENDING_SOON", labelKey: "inbox.types.shiftEndingSoon" },
  { value: "DEVICE_DISCONNECTED", labelKey: "inbox.types.deviceDisconnected" },
  { value: "SHIFT_VIOLATION", labelKey: "inbox.types.shiftViolation" },
  { value: "MULTIPLE_FAILED_ATTEMPTS", labelKey: "inbox.types.multipleFailedAttempts" },
  { value: "DEVICE_DENIED", labelKey: "inbox.types.deviceDenied" },
];

const ATTENDANCE_ALERT_TYPES = ALERT_TYPES.filter(({ value }) =>
  value === "SHIFT_ENDING_SOON"
  || value === "DEVICE_DISCONNECTED"
  || value === "MULTIPLE_FAILED_ATTEMPTS"
  || value === "DEVICE_DENIED"
);

const DEVICE_TYPES: Array<{ value: InboxItemType; labelKey: string }> = [
  { value: "DEVICE_AUTHORIZED", labelKey: "inbox.types.deviceAuthorized" },
  { value: "DEVICE_DENIED", labelKey: "inbox.types.deviceDenied" },
];

const SEVERITY_OPTIONS = [
  { value: "", labelKey: "inbox.severity.all" },
  { value: "INFO", labelKey: "inbox.severity.info" },
  { value: "WARNING", labelKey: "inbox.severity.warning" },
  { value: "CRITICAL", labelKey: "inbox.severity.critical" },
] as const;

const INBOX_TYPE_LABEL_KEYS: Record<InboxItemType, string> = {
  MEMBERSHIP_EXPIRING: "inbox.types.membershipExpiring",
  MEMBERSHIP_EXPIRED: "inbox.types.membershipExpired",
  SHIFT_ENDING_SOON: "inbox.types.shiftEndingSoon",
  DEVICE_DISCONNECTED: "inbox.types.deviceDisconnected",
  SHIFT_VIOLATION: "inbox.types.shiftViolation",
  MULTIPLE_FAILED_ATTEMPTS: "inbox.types.multipleFailedAttempts",
  DEVICE_DENIED: "inbox.types.deviceDenied",
  DEVICE_AUTHORIZED: "inbox.types.deviceAuthorized",
};

export function InboxDrawer({ edition = "FULL" }: { edition?: "FULL" | "ATTENDANCE" }) {
  const { t, i18n } = useTranslation();
  const { push } = useToast();
  const { isOpen, activeTab, closeInbox, setActiveTab } = useInbox();
  const { hasPermission } = useAuth();
  const canViewDevices = hasPermission("DEVICES_VIEW");
  const alertTypeOptions = edition === "ATTENDANCE" ? ATTENDANCE_ALERT_TYPES : ALERT_TYPES;
  const [alertFilters, setAlertFilters] = useState({
    unreadOnly: false,
    severity: "",
    type: "",
    search: "",
  });
  const [deviceFilters, setDeviceFilters] = useState({
    unreadOnly: false,
    type: "",
    deviceId: "",
    from: "",
    to: "",
    search: "",
  });
  const [alertPage, setAlertPage] = useState(1);
  const [devicePage, setDevicePage] = useState(1);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const listContainerRef = useRef<HTMLDivElement | null>(null);
  const autoReadTimersRef = useRef<Map<string, number>>(new Map());
  const autoReadQueueRef = useRef<Set<string>>(new Set());
  const autoReadFlushRef = useRef<number | null>(null);

  const clearAutoReadQueue = useCallback(() => {
    for (const timer of autoReadTimersRef.current.values()) {
      window.clearTimeout(timer);
    }
    autoReadTimersRef.current.clear();
    autoReadQueueRef.current.clear();
    if (autoReadFlushRef.current !== null) {
      window.clearTimeout(autoReadFlushRef.current);
      autoReadFlushRef.current = null;
    }
  }, []);

  useModalDismiss(closeInbox, isOpen);

  const updateAlertFilters = (update: (current: typeof alertFilters) => typeof alertFilters) => {
    setAlertPage(1);
    setAlertFilters(update);
  };

  const updateDeviceFilters = (update: (current: typeof deviceFilters) => typeof deviceFilters) => {
    setDevicePage(1);
    setDeviceFilters(update);
  };

  const page = activeTab === "alerts" ? alertPage : devicePage;
  const filters = activeTab === "alerts" ? alertFilters : deviceFilters;

  const listParams: InboxListParams = useMemo(() => {
    const params: InboxListParams = {
      category: activeTab === "alerts" ? "ALERT" : "DEVICE_FEED",
      page,
      pageSize: PAGE_SIZE,
    };
    if (filters.unreadOnly) params.unreadOnly = true;
    if ("severity" in filters && filters.severity) params.severity = filters.severity as InboxListParams["severity"];
    if (filters.type) params.type = filters.type as InboxListParams["type"];
    if ("deviceId" in filters && filters.deviceId) params.deviceId = filters.deviceId;
    if ("from" in filters && filters.from) params.from = filters.from;
    if ("to" in filters && filters.to) params.to = filters.to;
    if (filters.search) params.search = filters.search;
    return params;
  }, [activeTab, filters, page]);

  const listQueryKey = ["inboxItems", activeTab, filters, page];

  const { data, isLoading, isFetching, error, refetch } = useQuery({
    queryKey: listQueryKey,
    queryFn: () => listInboxItems(listParams),
    enabled: isOpen,
    placeholderData: (previous) => previous,
  });

  useEffect(() => {
    if (error) {
      const message = error instanceof Error ? error.message : String(error);
      push({ kind: "error", title: message });
    }
  }, [error, push]);

  const { data: deviceOptions } = useQuery({
    queryKey: ["deviceList"],
    queryFn: () => listDevices().then((res) => res.data),
    enabled: isOpen && activeTab === "deviceFeed" && canViewDevices,
    staleTime: 60000,
  });

  const markReadMutation = useMutation({
    mutationFn: (id: string) => markInboxItemRead(id),
    onMutate: async (id) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous = queryClient.getQueryData<InboxListResponse>(listQueryKey);
      const previousCounts = queryClient.getQueryData<InboxUnreadCounts>(["inboxUnreadCounts"]);
      if (previous) {
        const nowIso = new Date().toISOString();
        const target = previous.items.find((item) => item.id === id);
        const items = previous.items.map((item) =>
          item.id === id ? { ...item, readAt: item.readAt ?? nowIso } : item
        );
        queryClient.setQueryData(listQueryKey, { ...previous, items });
        if (previousCounts && target && !target.readAt) {
          const nextCounts = { ...previousCounts };
          if (target.category === "ALERT") {
            nextCounts.alerts = Math.max(0, nextCounts.alerts - 1);
          } else {
            nextCounts.deviceFeed = Math.max(0, nextCounts.deviceFeed - 1);
          }
          nextCounts.total = Math.max(0, nextCounts.total - 1);
          queryClient.setQueryData(["inboxUnreadCounts"], nextCounts);
        }
      }
      return { previous, previousCounts };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKey, context.previous);
      }
      if (context?.previousCounts) {
        queryClient.setQueryData(["inboxUnreadCounts"], context.previousCounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxUnreadCounts"] });
    },
  });

  const markReadBulkMutation = useMutation({
    mutationFn: (ids: string[]) => markInboxReadBulk({ ids }),
    onMutate: async (ids) => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous = queryClient.getQueryData<InboxListResponse>(listQueryKey);
      const previousCounts = queryClient.getQueryData<InboxUnreadCounts>(["inboxUnreadCounts"]);
      if (previous) {
        const nowIso = new Date().toISOString();
        const idSet = new Set(ids);
        let markedCount = 0;
        let alertCount = 0;
        let deviceCount = 0;
        let items: InboxItem[] = [];

        if (filters.unreadOnly) {
          for (const item of previous.items) {
            if (idSet.has(item.id) && !item.readAt) {
              markedCount += 1;
              if (item.category === "ALERT") {
                alertCount += 1;
              } else {
                deviceCount += 1;
              }
              continue;
            }
            items.push(item);
          }
        } else {
          items = previous.items.map((item) => {
            if (idSet.has(item.id) && !item.readAt) {
              markedCount += 1;
              if (item.category === "ALERT") {
                alertCount += 1;
              } else {
                deviceCount += 1;
              }
              return { ...item, readAt: nowIso };
            }
            return item;
          });
        }

        const total = filters.unreadOnly ? Math.max(0, previous.total - markedCount) : previous.total;
        queryClient.setQueryData(listQueryKey, { ...previous, items, total });

        if (previousCounts && markedCount > 0) {
          const nextCounts = { ...previousCounts };
          nextCounts.alerts = Math.max(0, nextCounts.alerts - alertCount);
          nextCounts.deviceFeed = Math.max(0, nextCounts.deviceFeed - deviceCount);
          nextCounts.total = Math.max(0, nextCounts.total - markedCount);
          queryClient.setQueryData(["inboxUnreadCounts"], nextCounts);
        }
      }
      return { previous, previousCounts };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKey, context.previous);
      }
      if (context?.previousCounts) {
        queryClient.setQueryData(["inboxUnreadCounts"], context.previousCounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxUnreadCounts"] });
    },
  });

  const markAllMutation = useMutation({
    mutationFn: () =>
      markInboxReadAll({
        category: activeTab === "alerts" ? "ALERT" : "DEVICE_FEED",
      }),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: listQueryKey });
      const previous = queryClient.getQueryData<InboxListResponse>(listQueryKey);
      const previousCounts = queryClient.getQueryData<InboxUnreadCounts>(["inboxUnreadCounts"]);
      if (previous) {
        const nowIso = new Date().toISOString();
        const items = previous.items.map((item) => ({
          ...item,
          readAt: item.readAt ?? nowIso,
        }));
        queryClient.setQueryData(listQueryKey, { ...previous, items });
      }
      if (previousCounts) {
        const nextCounts = { ...previousCounts };
        if (activeTab === "alerts") {
          nextCounts.total = Math.max(0, nextCounts.total - nextCounts.alerts);
          nextCounts.alerts = 0;
        } else {
          nextCounts.total = Math.max(0, nextCounts.total - nextCounts.deviceFeed);
          nextCounts.deviceFeed = 0;
        }
        queryClient.setQueryData(["inboxUnreadCounts"], nextCounts);
      }
      return { previous, previousCounts };
    },
    onError: (_err, _id, context) => {
      if (context?.previous) {
        queryClient.setQueryData(listQueryKey, context.previous);
      }
      if (context?.previousCounts) {
        queryClient.setQueryData(["inboxUnreadCounts"], context.previousCounts);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["inboxUnreadCounts"] });
    },
  });

  useEffect(() => {
    if (!isOpen || activeTab !== "deviceFeed") {
      clearAutoReadQueue();
      return;
    }

    const container = listContainerRef.current;
    if (!container) return;

    const scheduleFlush = () => {
      if (autoReadFlushRef.current !== null) return;
      autoReadFlushRef.current = window.setTimeout(() => {
        autoReadFlushRef.current = null;
        const ids = Array.from(autoReadQueueRef.current);
        autoReadQueueRef.current.clear();
        if (ids.length > 0) {
          markReadBulkMutation.mutate(ids);
        }
      }, AUTO_READ_FLUSH_MS);
    };

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          const target = entry.target as HTMLElement;
          const id = target.dataset.inboxId;
          if (!id) return;
          const isUnread = target.dataset.unread === "true";
          if (!isUnread) {
            const pending = autoReadTimersRef.current.get(id);
            if (pending) {
              window.clearTimeout(pending);
              autoReadTimersRef.current.delete(id);
            }
            return;
          }
          if (entry.isIntersecting) {
            if (autoReadTimersRef.current.has(id)) return;
            const timer = window.setTimeout(() => {
              autoReadTimersRef.current.delete(id);
              autoReadQueueRef.current.add(id);
              scheduleFlush();
            }, AUTO_READ_DELAY_MS);
            autoReadTimersRef.current.set(id, timer);
            return;
          }
          const pending = autoReadTimersRef.current.get(id);
          if (pending) {
            window.clearTimeout(pending);
            autoReadTimersRef.current.delete(id);
          }
        });
      },
      { root: container, threshold: AUTO_READ_THRESHOLD }
    );

    const targets = container.querySelectorAll<HTMLElement>("[data-inbox-id]");
    targets.forEach((node) => observer.observe(node));

    return () => {
      observer.disconnect();
      clearAutoReadQueue();
    };
  }, [activeTab, clearAutoReadQueue, isOpen, markReadBulkMutation, data?.items, page]);

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;

  const handleOpen = (item: InboxItem) => {
    if (item.actionPath) {
      if (!item.readAt) {
        markReadMutation.mutate(item.id);
      }
      closeInbox();
      navigate(item.actionPath);
    }
  };

  const filterControlClass =
    "rounded-lg border border-slate-700/80 bg-slate-950/40 px-2 py-1 text-[11px] text-slate-100/90 shadow-inner shadow-black/30 placeholder:text-slate-500 transition focus:border-brand-400/70 focus:outline-none focus:ring-2 focus:ring-brand-500/20";

  if (!isOpen) return null;

  return (
    <div
      data-testid="inbox-drawer"
      className="fixed inset-0 z-40 flex justify-end bg-slate-950/45 p-3 backdrop-blur-[2px] sm:p-4"
      onClick={closeInbox}
    >
      <div
        className="flex h-full w-full max-w-md flex-col rounded-3xl border border-slate-800/80 bg-slate-950/90 bg-[radial-gradient(1200px_circle_at_top_right,_rgba(42,116,255,0.12),_transparent_55%)] p-4 shadow-2xl shadow-black/40 backdrop-blur-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex items-center justify-between rounded-2xl border border-slate-800/70 bg-slate-950/60 px-3 py-2">
          <div>
            <p className="text-base font-semibold text-white">{t("inbox.title")}</p>
            <p className="text-[11px] text-slate-400/90">{t("inbox.subtitle")}</p>
          </div>
          <CloseIconButton label={t("common.actions.close")} onClick={closeInbox} />
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-2">
          <button
            type="button"
            onClick={() => setActiveTab("alerts")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:shadow-[0_4px_10px_rgba(42,116,255,0.12)] ${
              activeTab === "alerts"
                ? "border-brand-400/60 bg-gradient-to-r from-brand-500/25 to-sky-400/10 text-white shadow-[0_0_0_1px_rgba(42,116,255,0.2)]"
                : "border-slate-700/80 text-[var(--text-secondary)] hover:bg-brand-500/12 hover:text-[var(--text-primary)]"
            }`}
          >
            {t("inbox.tabs.alerts")}
          </button>
          <button
            data-testid="inbox-device-feed-tab"
            type="button"
            onClick={() => setActiveTab("deviceFeed")}
            className={`rounded-full border px-3 py-1 text-xs font-semibold transition hover:shadow-[0_4px_10px_rgba(42,116,255,0.12)] ${
              activeTab === "deviceFeed"
                ? "border-brand-400/60 bg-gradient-to-r from-brand-500/25 to-sky-400/10 text-white shadow-[0_0_0_1px_rgba(42,116,255,0.2)]"
                : "border-slate-700/80 text-[var(--text-secondary)] hover:bg-brand-500/12 hover:text-[var(--text-primary)]"
            }`}
          >
            {t("inbox.tabs.deviceFeed")}
          </button>
          <button
            type="button"
            onClick={() => markAllMutation.mutate()}
            className="ml-auto rounded-full border border-slate-700/80 bg-[var(--bg-card)] px-3 py-1 text-xs font-semibold text-[var(--text-secondary)] transition hover:bg-brand-500/12 hover:text-[var(--text-primary)] hover:shadow-[0_4px_10px_rgba(42,116,255,0.12)]"
          >
            {t("inbox.actions.markAllRead")}
          </button>
        </div>

        {activeTab === "alerts" ? (
          <div className="relative z-20 mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 text-xs shadow-inner shadow-black/40 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={alertFilters.unreadOnly}
                  onChange={(event) =>
                    updateAlertFilters((prev) => ({ ...prev, unreadOnly: event.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-slate-600/80 bg-slate-900/60 accent-brand-500"
                />
                {t("inbox.filters.unreadOnly")}
              </label>
              <FilterSelectMenu
                containerClassName="min-w-[120px]"
                buttonClassName={filterControlClass}
                value={alertFilters.severity}
                options={SEVERITY_OPTIONS.map((option) => ({
                  value: option.value,
                  label: t(option.labelKey),
                }))}
                onChange={(value) => updateAlertFilters((prev) => ({ ...prev, severity: value }))}
              />
              <FilterSelectMenu
                testId="inbox-alert-type-filter"
                containerClassName="min-w-[140px]"
                buttonClassName={filterControlClass}
                value={alertFilters.type}
                options={[
                  { value: "", label: t("inbox.filters.allTypes") },
                  ...alertTypeOptions.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  })),
                ]}
                onChange={(value) => updateAlertFilters((prev) => ({ ...prev, type: value }))}
              />
              <input
                className={`${filterControlClass} flex-1`}
                placeholder={t("inbox.filters.searchAlerts")}
                value={alertFilters.search}
                onChange={(event) => updateAlertFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
          </div>
        ) : (
          <div className="relative z-20 mt-4 rounded-2xl border border-slate-800/70 bg-slate-950/60 p-3 text-xs shadow-inner shadow-black/40 backdrop-blur-sm">
            <div className="flex flex-wrap items-center gap-2">
              <label className="flex items-center gap-2 text-[11px] font-medium text-slate-300">
                <input
                  type="checkbox"
                  checked={deviceFilters.unreadOnly}
                  onChange={(event) =>
                    updateDeviceFilters((prev) => ({ ...prev, unreadOnly: event.target.checked }))
                  }
                  className="h-3.5 w-3.5 rounded border-slate-600/80 bg-slate-900/60 accent-brand-500"
                />
                {t("inbox.filters.unreadOnly")}
              </label>
              {canViewDevices ? (
                <FilterSelectMenu
                  containerClassName="min-w-[140px]"
                  buttonClassName={filterControlClass}
                  value={deviceFilters.deviceId}
                  options={[
                    { value: "", label: t("inbox.filters.allDevices") },
                    ...(deviceOptions ?? []).map((device) => ({
                      value: device.id,
                      label: device.name,
                    })),
                  ]}
                  onChange={(value) => updateDeviceFilters((prev) => ({ ...prev, deviceId: value }))}
                />
              ) : null}
              <FilterSelectMenu
                containerClassName="min-w-[120px]"
                buttonClassName={filterControlClass}
                value={deviceFilters.type}
                options={[
                  { value: "", label: t("inbox.filters.allEvents") },
                  ...DEVICE_TYPES.map((option) => ({
                    value: option.value,
                    label: t(option.labelKey),
                  })),
                ]}
                onChange={(value) => updateDeviceFilters((prev) => ({ ...prev, type: value }))}
              />
              <ShamsiDateInput
                locale={i18n.language}
                value={deviceFilters.from}
                onChange={(value) => updateDeviceFilters((prev) => ({ ...prev, from: value }))}
                inputClassName={filterControlClass}
                containerClassName="inbox-device-from min-w-[130px]"
              />
              <ShamsiDateInput
                locale={i18n.language}
                value={deviceFilters.to}
                onChange={(value) => updateDeviceFilters((prev) => ({ ...prev, to: value }))}
                inputClassName={filterControlClass}
                containerClassName="inbox-device-to min-w-[130px]"
              />
              <input
                data-testid="inbox-device-search"
                className={`${filterControlClass} flex-1`}
                placeholder={t("inbox.filters.searchDeviceFeed")}
                value={deviceFilters.search}
                onChange={(event) => updateDeviceFilters((prev) => ({ ...prev, search: event.target.value }))}
              />
            </div>
          </div>
        )}

        <div ref={listContainerRef} className="mt-4 flex-1 overflow-y-auto pr-1">
          {isLoading ? (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 text-[11px] text-slate-300">
              {t("inbox.states.loading")}
            </div>
          ) : error ? (
            <div
              data-testid="inbox-error-state"
              className="rounded-2xl border border-rose-500/30 bg-rose-500/10 p-4 text-[11px] text-rose-100"
            >
              <p>{t("inbox.states.error")}</p>
              <button
                type="button"
                disabled={isFetching}
                onClick={() => void refetch()}
                className="mt-3 rounded-full border border-rose-300/30 px-3 py-1 font-semibold text-rose-50 transition hover:bg-rose-400/10 disabled:cursor-wait disabled:opacity-60"
              >
                {t("inbox.actions.retry")}
              </button>
            </div>
          ) : data && data.items.length > 0 ? (
            <div className="space-y-3">
              {data.items.map((item) => (
                <InboxItemRow
                  key={item.id}
                  item={item}
                  locale={i18n.language}
                  onMarkRead={() => markReadMutation.mutate(item.id)}
                  onOpen={() => handleOpen(item)}
                />
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-slate-800/70 bg-slate-900/40 p-4 text-[11px] text-slate-300">
              {activeTab === "alerts" ? t("inbox.states.noAlerts") : t("inbox.states.noDeviceFeed")}
            </div>
          )}
        </div>

        <PaginationControls
          compact
          className="mt-3"
          page={page}
          pageSize={data?.pageSize ?? PAGE_SIZE}
          totalItems={data?.total ?? 0}
          totalPages={totalPages}
          onPageChange={(nextPage) =>
            activeTab === "alerts" ? setAlertPage(nextPage) : setDevicePage(nextPage)
          }
        />
      </div>
    </div>
  );
}

function InboxItemRow({
  item,
  locale,
  onMarkRead,
  onOpen,
}: {
  item: InboxItem;
  locale: string;
  onMarkRead: () => void;
  onOpen: () => void;
}) {
  const { t } = useTranslation();
  const isUnread = !item.readAt;
  const severityClass = getSeverityClass(item.severity);

  return (
    <div
      data-inbox-id={item.id}
      data-unread={isUnread ? "true" : "false"}
      className={`relative overflow-hidden rounded-2xl border p-3 transition duration-200 hover:border-slate-600/70 hover:bg-slate-900/60 ${
        isUnread
          ? "border-brand-500/40 bg-slate-900/70 shadow-[0_0_0_1px_rgba(42,116,255,0.18)] before:absolute before:inset-0 before:pointer-events-none before:bg-[radial-gradient(600px_circle_at_top_left,_rgba(42,116,255,0.12),_transparent_60%)]"
          : "border-slate-800/70 bg-slate-950/60"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            {isUnread && (
              <span
                className="h-2 w-2 rounded-full bg-brand-400 shadow-[0_0_8px_rgba(42,116,255,0.6)]"
                aria-hidden="true"
              />
            )}
            <p className={`text-sm ${isUnread ? "font-semibold text-white" : "text-slate-200"}`}>{item.title}</p>
          </div>
          {item.body && <p className="mt-1 text-[11px] text-slate-400">{item.body}</p>}
          <p className="mt-2 text-[10px] text-slate-500">
            {formatTimestamp(item.createdAt, locale)} | {formatTypeLabel(item.type, t)}
          </p>
        </div>
        <span
          className={`inbox-info-pill inbox-severity-${item.severity.toLowerCase()} rounded-full border px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${severityClass}${isUnread ? " is-unread" : ""}`}
        >
          {t(`inbox.severity.${item.severity.toLowerCase()}`)}
        </span>
      </div>
      <div className="mt-3 flex items-center gap-2">
        {item.actionPath && (
          <button
            type="button"
            onClick={onOpen}
            className="rounded-full border border-brand-400/60 bg-brand-500/10 px-2.5 py-0.5 text-[11px] font-semibold text-brand-200 transition hover:border-brand-300/70 hover:bg-brand-500/20"
          >
            {t("common.actions.open")}
          </button>
        )}
        {isUnread && (
          <button
            type="button"
            onClick={onMarkRead}
            className="rounded-full border border-slate-700/80 bg-slate-900/50 px-2.5 py-0.5 text-[11px] font-semibold text-slate-200 transition hover:border-slate-500/80 hover:bg-slate-800/70"
          >
            {t("inbox.actions.markRead")}
          </button>
        )}
      </div>
    </div>
  );
}

function formatTimestamp(value: string, locale = "en") {
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString(resolveDateLocale(locale));
}

function formatTypeLabel(type: InboxItemType, t: (key: string) => string) {
  const key = INBOX_TYPE_LABEL_KEYS[type];
  return key ? t(key) : t("inbox.types.unknown");
}

function getSeverityClass(severity: InboxItem["severity"]) {
  if (severity === "CRITICAL") {
    return "border-rose-500/50 bg-rose-500/10 text-rose-100";
  }
  if (severity === "WARNING") {
    return "border-amber-500/50 bg-amber-500/10 text-amber-100";
  }
  return "border-emerald-500/40 bg-emerald-500/10 text-emerald-100";
}

type SelectOption = {
  value: string;
  label: string;
};

function FilterSelectMenu({
  value,
  options,
  onChange,
  buttonClassName = "",
  containerClassName = "",
  testId,
}: {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  buttonClassName?: string;
  containerClassName?: string;
  testId?: string;
}) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement | null>(null);
  const selectedOption = options.find((option) => option.value === value);
  const fallbackLabel = value || options[0]?.label || "";
  const displayLabel = selectedOption?.label ?? fallbackLabel;

  useEffect(() => {
    if (!open) return;
    const handleClick = (event: MouseEvent) => {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClick);
      document.removeEventListener("keydown", handleKey);
    };
  }, [open]);

  return (
    <div ref={rootRef} className={`relative ${containerClassName}`}>
      <button
        data-testid={testId}
        type="button"
        className={`${buttonClassName} flex w-full cursor-pointer items-center justify-between gap-2 text-start hover:bg-brand-500/10`}
        onClick={() => setOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{displayLabel}</span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 text-slate-300/90 transition ${open ? "rotate-180" : ""}`}
        />
      </button>
      {open ? (
        <div className="submenu-panel absolute z-50 mt-1 w-full overflow-hidden rounded-xl border backdrop-blur">
          <div role="listbox" className="max-h-56 overflow-auto">
            {options.map((option) => {
              const isSelected = option.value === value;
              const optionKey = option.value === "" ? "all" : option.value;
              return (
                <button
                  key={optionKey}
                  type="button"
                  role="option"
                  aria-selected={isSelected}
                  className={`submenu-option flex w-full items-center justify-between rounded-lg text-start transition ${
                    isSelected ? "is-selected" : ""
                  }`}
                  onClick={() => {
                    if (option.value !== value) {
                      onChange(option.value);
                    }
                    setOpen(false);
                  }}
                >
                  <span className="truncate">{option.label}</span>
                  {isSelected ? <CheckIcon className="submenu-check h-3 w-3" /> : null}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
    </div>
  );
}

export function InboxBell() {
  const { t } = useTranslation();
  const { openInbox } = useInbox();
  const prevCountRef = useRef<number | null>(null);
  const { data } = useQuery({
    queryKey: ["inboxUnreadCounts"],
    queryFn: () => getInboxUnreadCounts(),
    refetchInterval: 20000,
  });

  const badgeCount = data?.alerts ?? data?.total ?? 0;

  useEffect(() => {
    const nextTotal = data?.total ?? 0;
    if (prevCountRef.current !== null && nextTotal > prevCountRef.current) {
      prevCountRef.current = nextTotal;
      return;
    }
    prevCountRef.current = nextTotal;
  }, [data?.total]);

  return (
    <button
      data-testid="inbox-open"
      type="button"
      onClick={() => openInbox("alerts")}
      className="relative inline-flex items-center justify-center rounded-lg border border-slate-800/80 bg-slate-900/50 px-2 py-1 text-xs text-slate-100"
      aria-label={t("inbox.actions.openInbox")}
    >
      <BellIcon className="h-3.5 w-3.5" />
      {badgeCount > 0 && (
        <span className="absolute -top-1 -end-1 rounded-full bg-rose-500 px-1.5 py-0.5 text-[10px] font-semibold text-white">
          {badgeCount > 99 ? "99+" : badgeCount}
        </span>
      )}
    </button>
  );
}

function BellIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M18 8a6 6 0 0 0-12 0c0 7-3 8-3 8h18s-3-1-3-8" />
      <path d="M13.73 21a2 2 0 0 1-3.46 0" />
    </svg>
  );
}

function ChevronDownIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M6 9l6 6 6-6" />
    </svg>
  );
}

function CheckIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" {...props}>
      <path d="M20 6l-11 11-5-5" />
    </svg>
  );
}


