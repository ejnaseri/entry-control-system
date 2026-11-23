import { NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  IconCalendarCheck,
  IconCashBanknote,
  IconChartBar,
  IconClipboardList,
  IconDatabaseExport,
  IconFingerprintScan,
  IconIdBadge,
  IconLayoutDashboard,
  IconLogout,
  IconReceipt2,
  IconSettings,
  IconUserCog,
  IconUsersGroup,
  IconVolume2,
} from "@tabler/icons-react";
import { PRODUCT_BRAND } from "@app-product-brand";
import { rtlLanguages } from "../i18n/config";
import { useAuth } from "../auth/AuthContext";
import { useRouteManifest } from "../routing/RouteManifestContext";
import {
  buildRouteBreadcrumbs,
  findAccessibleHeaderActions,
  findAccessibleNavigationRoutes,
  getRouteLabel,
  type RouteNavigationIcon,
} from "../routing/routeManifest";

type IconProps = React.SVGProps<SVGSVGElement>;
type LayoutNavItem = {
  key: string;
  to: string;
  labelKey: string;
  defaultLabel: string;
  icon: React.ComponentType<{ className?: string; stroke?: number }>;
  isSettings: boolean;
};

const navigationIcons: Record<RouteNavigationIcon, React.ComponentType<{ className?: string; stroke?: number }>> = {
  dashboard: IconLayoutDashboard,
  members: IconUsersGroup,
  attendance: IconCalendarCheck,
  "entry-logs": IconClipboardList,
  "membership-payments": IconIdBadge,
  payroll: IconCashBanknote,
  expenses: IconReceipt2,
  devices: IconFingerprintScan,
  reports: IconChartBar,
  "admin-users": IconUserCog,
  "audit-logs": IconClipboardList,
  "membership-plans": IconIdBadge,
  "staff-groups": IconUsersGroup,
  sounds: IconVolume2,
  backups: IconDatabaseExport,
};

export type SharedAppShellRenderContext = Readonly<{
  currentLanguage: string;
  isLight: boolean;
}>;

type SharedAppShellProps = Readonly<{
  headerExtras?: (context: SharedAppShellRenderContext) => ReactNode;
  overlay?: ReactNode;
}>;

export function SharedAppShell({ headerExtras, overlay }: SharedAppShellProps) {
  const { t, i18n } = useTranslation();
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const routeBundle = useRouteManifest();
  const { auth, hasPermission, logout } = useAuth();
  const currentLanguage = i18n.language.split("-")[0];
  const isRtl = rtlLanguages.includes(currentLanguage);
  const [theme, setTheme] = useState<"dark" | "light">(() => {
    if (typeof window === "undefined") return "dark";
    try {
      const stored = localStorage.getItem("ecs-theme");
      if (stored === "light" || stored === "dark") return stored;
    } catch {
      // Ignore storage access errors.
    }
    return window.matchMedia?.("(prefers-color-scheme: light)")?.matches ? "light" : "dark";
  });
  const [languageOpen, setLanguageOpen] = useState(false);
  const [languageAnimating, setLanguageAnimating] = useState(false);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [settingsFlyoutOpen, setSettingsFlyoutOpen] = useState(false);
  const [settingsFlyoutPosition, setSettingsFlyoutPosition] = useState<{ top: number; anchorY: number; left?: number; right?: number } | null>(null);
  const settingsNavRef = useRef<HTMLDivElement | null>(null);
  const settingsFlyoutCloseTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);
  const isLight = theme === "light";
  const isDashboardRoute = location.pathname === "/" || location.pathname === "/dashboard";
  const showRouteHeader = PRODUCT_BRAND.edition === "FULL";

  const languages = [
    { code: "fa", label: "دری" },
    { code: "ps", label: "پښتو" },
    { code: "en", label: "English" },
  ];
  const sidebarWidth = sidebarCollapsed ? "2.75rem" : "11rem";
  const sidebarToggleOffset = `calc(${sidebarWidth} - 1rem)`;
  const features = auth?.features ?? [];
  const permissions = auth?.permissions ?? [];
  const visibleMainRoutes = findAccessibleNavigationRoutes(routeBundle.routes, "main", features, permissions);
  const visibleSettingsItems = findAccessibleNavigationRoutes(routeBundle.routes, "settings", features, permissions);
  const visibleHeaderActions = findAccessibleHeaderActions(routeBundle.routes, features, permissions);
  const breadcrumbs = buildRouteBreadcrumbs(routeBundle.routes, location.pathname, features, permissions);
  const currentRoute = breadcrumbs.at(-1) ?? null;
  const currentRouteLabel = currentRoute ? getRouteLabel(currentRoute) : null;
  const visibleNavItems: LayoutNavItem[] = [
    ...visibleMainRoutes.map((route) => ({
      key: route.key,
      to: route.path,
      labelKey: route.navigation!.labelKey,
      defaultLabel: route.navigation!.defaultLabel,
      icon: navigationIcons[route.navigation!.icon],
      isSettings: false,
    })),
    ...(visibleSettingsItems.length
      ? [{ key: "settings", to: "/settings", labelKey: "nav.settings", defaultLabel: "Settings", icon: IconSettings, isSettings: true }]
      : []),
  ];
  const currentUserName = auth?.user.fullName?.trim() || auth?.user.username || "";
  const currentUserRole = formatAdminRoleLabel(auth?.user.role);
  const currentUserInitials = getUserInitials(currentUserName, auth?.user.username);

  const handleLogout = async () => {
    await logout();
    queryClient.clear();
    navigate("/login", { replace: true });
  };

  const clearSettingsFlyoutCloseTimer = () => {
    if (settingsFlyoutCloseTimerRef.current) {
      clearTimeout(settingsFlyoutCloseTimerRef.current);
      settingsFlyoutCloseTimerRef.current = null;
    }
  };

  const updateSettingsFlyoutPosition = () => {
    const anchor = settingsNavRef.current;
    if (!anchor) return;
    setSettingsFlyoutPosition(
      calculateSettingsFlyoutPosition(anchor, visibleSettingsItems.length, isRtl, sidebarCollapsed),
    );
  };

  const openSettingsFlyout = () => {
    clearSettingsFlyoutCloseTimer();
    updateSettingsFlyoutPosition();
    setSettingsFlyoutOpen(true);
  };

  const scheduleSettingsFlyoutClose = () => {
    clearSettingsFlyoutCloseTimer();
    settingsFlyoutCloseTimerRef.current = setTimeout(() => {
      setSettingsFlyoutOpen(false);
    }, 140);
  };

  useEffect(() => {
    return () => {
      timersRef.current.forEach((timer) => clearTimeout(timer));
      timersRef.current = [];
      if (settingsFlyoutCloseTimerRef.current) {
        clearTimeout(settingsFlyoutCloseTimerRef.current);
        settingsFlyoutCloseTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!settingsFlyoutOpen) return;
    const update = () => {
      const anchor = settingsNavRef.current;
      if (!anchor) return;
      setSettingsFlyoutPosition(
        calculateSettingsFlyoutPosition(anchor, visibleSettingsItems.length, isRtl, sidebarCollapsed),
      );
    };
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => {
      window.removeEventListener("resize", update);
      window.removeEventListener("scroll", update, true);
    };
  }, [isRtl, settingsFlyoutOpen, sidebarCollapsed, visibleSettingsItems.length]);

  useEffect(() => {
    document.documentElement.classList.toggle("theme-light", isLight);
    try {
      localStorage.setItem("ecs-theme", theme);
    } catch {
      // Ignore storage access errors.
    }
  }, [isLight, theme]);

  const triggerLanguageTransition = (code: string) => {
    if (code === currentLanguage) {
      setLanguageOpen(false);
      return;
    }
    timersRef.current.forEach((timer) => clearTimeout(timer));
    timersRef.current = [];
    setLanguageOpen(false);
    setLanguageAnimating(true);
    const changeTimer = setTimeout(() => {
      void i18n.changeLanguage(code);
    }, 260);
    const endTimer = setTimeout(() => {
      setLanguageAnimating(false);
    }, 650);
    timersRef.current.push(changeTimer, endTimer);
  };

  const settingsFlyoutStyle: CSSProperties = settingsFlyoutPosition
    ? {
        top: settingsFlyoutPosition.top,
        "--settings-anchor-y": `${settingsFlyoutPosition.anchorY}px`,
        ...(settingsFlyoutPosition.left !== undefined ? { left: settingsFlyoutPosition.left } : {}),
        ...(settingsFlyoutPosition.right !== undefined ? { right: settingsFlyoutPosition.right } : {}),
      } as CSSProperties
    : {};

  return (
    <div
      className={`dashboard-shell ${languageAnimating ? "language-switch" : ""} ${isLight ? "theme-shell-light" : ""}`}
      data-edition={PRODUCT_BRAND.edition}
      data-testid="shared-app-shell"
      data-theme={theme}
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="flex h-screen overflow-hidden">
        <aside
          className={`theme-panel relative hidden flex-col border-r transition-all duration-300 lg:flex ${
            sidebarCollapsed ? "w-11" : "w-44"
          }`}
          style={{ background: sidebarCollapsed ? "var(--bg-sidebar)" : undefined }}
        >
          <div
            className={`flex items-center border-b border-slate-800/80 pb-3 pt-5 ${
              sidebarCollapsed ? "justify-center px-0" : "justify-center px-3"
            }`}
          >
            {sidebarCollapsed ? (
              <img
                src={PRODUCT_BRAND.iconHref}
                alt={PRODUCT_BRAND.name}
                className="block h-9 w-9 object-contain"
              />
            ) : (
              <img
                src={PRODUCT_BRAND.sidebarLogoSrc ?? PRODUCT_BRAND.logoSrc}
                alt={PRODUCT_BRAND.name}
                className="block h-auto w-full max-w-[150px] rounded-lg object-contain"
                style={
                  isLight
                    ? {
                        filter:
                          "drop-shadow(0 1px 1px rgba(15, 23, 42, 0.14)) drop-shadow(0 2px 4px rgba(8, 145, 178, 0.16)) drop-shadow(0 0 8px rgba(20, 184, 166, 0.18))",
                      }
                    : undefined
                }
              />
            )}
          </div>

          <button
            type="button"
            data-testid="sidebar-collapse-toggle"
            onClick={() => setSidebarCollapsed((prev) => !prev)}
            className="fixed top-1/2 z-30 hidden -translate-y-1/2 rounded-full border border-slate-700/80 bg-slate-900/90 p-1.5 text-slate-200 shadow-xl transition hover:border-brand-400/60 lg:block"
            style={isRtl ? { right: sidebarToggleOffset } : { left: sidebarToggleOffset }}
          >
            {sidebarCollapsed ? (
              isRtl ? <ArrowLeftIcon className="h-3.5 w-3.5" /> : <ArrowRightIcon className="h-3.5 w-3.5" />
            ) : isRtl ? (
              <ArrowRightIcon className="h-3.5 w-3.5" />
            ) : (
              <ArrowLeftIcon className="h-3.5 w-3.5" />
            )}
          </button>
          <nav className={`flex flex-1 flex-col space-y-1 overflow-y-auto py-3 ${sidebarCollapsed ? "items-center px-0" : "px-2"}`}>
            {visibleNavItems.map((item) => {
              const isSettingsItem = item.isSettings;
              return (
                <div
                  key={item.key}
                  ref={isSettingsItem ? settingsNavRef : undefined}
                  className={`w-full ${isSettingsItem ? "settings-nav-group" : ""}`}
                  onMouseEnter={isSettingsItem ? openSettingsFlyout : undefined}
                  onMouseLeave={isSettingsItem ? scheduleSettingsFlyoutClose : undefined}
                  onFocus={isSettingsItem ? openSettingsFlyout : undefined}
                  onBlur={isSettingsItem ? scheduleSettingsFlyoutClose : undefined}
                >
                  <NavLink
                    to={item.to}
                    data-testid={`main-nav-${item.key}`}
                    title={sidebarCollapsed ? t(item.labelKey, { defaultValue: item.defaultLabel }) : undefined}
                    className={({ isActive }) =>
                      [
                        "group flex w-full items-center gap-2.5 rounded-xl px-2.5 py-1 text-[12px] font-medium transition-all nav-pill",
                        sidebarCollapsed ? "justify-center px-0 nav-pill-collapsed" : "justify-start px-2.5",
                        isActive ? "nav-pill-active" : "nav-pill-idle",
                        isSettingsItem && settingsFlyoutOpen ? "nav-pill-flyout-open" : "",
                      ].join(" ")
                    }
                  >
                    <div
                      className={`flex h-8 w-8 items-center justify-center rounded-xl border nav-pill-icon ${
                        sidebarCollapsed ? "border-transparent" : ""
                      } ${isLight ? "text-brand-500" : "text-brand-300"}`}
                    >
                      <item.icon className="h-5 w-5" stroke={1.7} />
                    </div>
                    {!sidebarCollapsed && (
                      <span className="text-[12px]">{t(item.labelKey, { defaultValue: item.defaultLabel })}</span>
                    )}
                  </NavLink>

                </div>
              );
            })}
          </nav>
        </aside>

        {settingsFlyoutOpen && visibleSettingsItems.length ? (
          <div
            className="settings-subnav"
            data-side={isRtl ? "right" : "left"}
            role="menu"
            aria-label={t("nav.settings")}
            style={settingsFlyoutStyle}
            onMouseEnter={clearSettingsFlyoutCloseTimer}
            onMouseLeave={scheduleSettingsFlyoutClose}
            onFocus={clearSettingsFlyoutCloseTimer}
            onBlur={scheduleSettingsFlyoutClose}
          >
            {visibleSettingsItems.map((settingsItem) => {
              const navigation = settingsItem.navigation!;
              const SettingsItemIcon = navigationIcons[navigation.icon];
              const settingsLabel = t(navigation.labelKey, { defaultValue: navigation.defaultLabel });
              return (
                <NavLink
                  key={settingsItem.key}
                  to={settingsItem.path}
                  data-testid={`settings-nav-${settingsItem.key}`}
                  onClick={() => setSettingsFlyoutOpen(false)}
                  role="menuitem"
                  className={({ isActive }) =>
                    [
                      "settings-subnav-link",
                      isActive ? "settings-subnav-link-active" : "settings-subnav-link-idle",
                    ].join(" ")
                  }
                >
                  <span className="settings-subnav-icon" aria-hidden>
                    <SettingsItemIcon className="h-4 w-4" stroke={1.85} />
                  </span>
                  <span className="truncate">{settingsLabel}</span>
                </NavLink>
              );
            })}
          </div>
        ) : null}

        <main
          data-can-financial-export={hasPermission("FINANCIAL_EXPORT") ? "true" : "false"}
          className={`main-surface flex min-h-0 flex-1 flex-col overflow-y-auto ${isDashboardRoute ? "main-surface--dashboard" : ""}`}
        >
          <header
            className={`theme-panel sticky top-0 z-40 border-b px-4 py-2.5 backdrop-blur-xl ${
              isLight ? "border-slate-200 bg-white/85" : "border-slate-800/60 bg-slate-950/60"
            }`}
          >
            <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
              {showRouteHeader && currentRouteLabel ? (
                <div className="min-w-0" data-testid="route-header">
                  <nav
                    className="flex min-w-0 items-center gap-1.5 text-[11px] text-slate-500 dark:text-slate-400"
                    data-testid="route-breadcrumb"
                    aria-label={t("common.labels.breadcrumb", { defaultValue: "Breadcrumb" })}
                  >
                    {breadcrumbs.map((route, index) => {
                      const label = getRouteLabel(route);
                      const isCurrent = index === breadcrumbs.length - 1;
                      return (
                        <span key={route.key} className="flex min-w-0 items-center gap-1.5">
                          {index > 0 ? <span aria-hidden>/</span> : null}
                          {isCurrent ? (
                            <span className="truncate" aria-current="page">
                              {t(label.labelKey, { defaultValue: label.defaultLabel })}
                            </span>
                          ) : (
                            <NavLink className="truncate hover:text-brand-500" to={route.path}>
                              {t(label.labelKey, { defaultValue: label.defaultLabel })}
                            </NavLink>
                          )}
                        </span>
                      );
                    })}
                  </nav>
                  <h1 className="truncate text-sm font-bold text-slate-900 dark:text-slate-100" data-testid="route-header-title">
                    {t(currentRouteLabel.labelKey, { defaultValue: currentRouteLabel.defaultLabel })}
                  </h1>
                </div>
              ) : <div />}
              <div className="flex flex-col gap-2 md:flex-row md:items-center">
                <div className="relative">
                  <button
                    type="button"
                    data-testid="shared-language-toggle"
                    onClick={() => setLanguageOpen((prev) => !prev)}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${
                      isLight
                        ? "border-slate-200 bg-white/90 text-slate-700"
                        : "border-slate-800/80 bg-slate-900/50 text-slate-100"
                    } hover:border-brand-400`}
                  >
                    <GlobeIcon className={`h-3.5 w-3.5 ${isLight ? "text-brand-500" : "text-brand-300"}`} />
                    {languages.find((lang) => lang.code === currentLanguage)?.label ?? currentLanguage.toUpperCase()}
                  </button>
                  {languageOpen && (
                    <div className="submenu-panel absolute z-30 mt-1.5 w-40 rounded-xl border backdrop-blur">
                      {languages.map((lang) => (
                        <button
                          key={lang.code}
                          type="button"
                          data-testid={`shared-language-option-${lang.code}`}
                          onClick={() => triggerLanguageTransition(lang.code)}
                          className={`submenu-option flex w-full items-center justify-between rounded-lg text-start transition ${
                            currentLanguage === lang.code ? "is-selected" : ""
                          }`}
                        >
                          {lang.label}
                          {currentLanguage === lang.code ? (
                            <span className="submenu-check" aria-hidden>
                              &#10003;
                            </span>
                          ) : null}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
                <button
                  type="button"
                  data-testid="shared-theme-toggle"
                  onClick={() => setTheme((prev) => (prev === "dark" ? "light" : "dark"))}
                  className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1 text-xs ${
                    isLight
                      ? "border-slate-200 bg-white/90 text-slate-700"
                      : "border-slate-800/80 bg-slate-900/50 text-slate-100"
                  } hover:border-brand-400`}
                >
                  {isLight ? <MoonIcon className="h-3.5 w-3.5 text-brand-300" /> : <SunIcon className="h-3.5 w-3.5 text-amber-300" />}
                  {isLight ? t("theme.dark") : t("theme.light")}
                </button>
                {headerExtras?.({ currentLanguage, isLight })}
                {visibleHeaderActions.map((actionRoute) => {
                  const action = actionRoute.headerAction!;
                  return (
                    <NavLink
                    key={actionRoute.key}
                    to={actionRoute.path}
                    data-testid={`header-action-${actionRoute.key}`}
                    className="inline-flex items-center justify-center rounded-lg border border-brand-500/40 bg-brand-500/80 px-3 py-1 text-xs font-semibold !text-white shadow-lg shadow-brand-900/35 transition hover:bg-brand-500"
                  >
                    + {t(action.labelKey, { defaultValue: action.defaultLabel })}
                  </NavLink>
                  );
                })}
                <div className="user-account-pill" title={currentUserName}>
                  <span className="user-account-avatar" aria-hidden>
                    {currentUserInitials}
                  </span>
                  <span className="user-account-copy">
                    <span className="user-account-name">{currentUserName}</span>
                    <span className="user-account-role">{currentUserRole}</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="user-account-logout"
                    title={t("auth.actions.logout", { defaultValue: "Logout" })}
                    aria-label={t("auth.actions.logout", { defaultValue: "Logout" })}
                  >
                    <IconLogout className="h-4 w-4" stroke={1.8} />
                  </button>
                </div>
              </div>
            </div>
          </header>

          <section className={isDashboardRoute ? "dashboard-route-content flex-1" : "flex-1 space-y-6 px-4 py-6 sm:px-5"}>
            <Outlet />
          </section>
        </main>
      </div>
      {overlay}
    </div>
  );
}

function getUserInitials(name?: string | null, fallback?: string | null) {
  const source = (name?.trim() || fallback?.trim() || "U").replace(/[_-]+/g, " ");
  const parts = source.split(/\s+/).filter(Boolean);
  if (!parts.length) return "U";
  const first = parts[0]?.[0] ?? "U";
  const second = parts.length > 1 ? parts[1]?.[0] : parts[0]?.[1];
  return `${first}${second ?? ""}`.toUpperCase();
}

function calculateSettingsFlyoutPosition(
  anchor: HTMLElement,
  itemCount: number,
  isRtl: boolean,
  sidebarCollapsed: boolean,
) {
  const rect = anchor.getBoundingClientRect();
  const panelWidth = 212;
  const itemHeight = 36;
  const panelPadding = 16;
  const estimatedPanelHeight = itemCount * itemHeight + panelPadding;
  const anchorCenterY = rect.top + rect.height / 2;
  const preferredTop = anchorCenterY - estimatedPanelHeight / 2;
  const top = Math.max(12, Math.min(preferredTop, window.innerHeight - estimatedPanelHeight - 12));
  const anchorY = Math.max(18, Math.min(anchorCenterY - top, estimatedPanelHeight - 18));
  const overlap = sidebarCollapsed ? -8 : 16;

  if (isRtl) {
    const right = Math.max(12, Math.min(window.innerWidth - rect.left - overlap, window.innerWidth - panelWidth - 12));
    return { top, anchorY, right };
  }

  const left = Math.max(12, Math.min(rect.right - overlap, window.innerWidth - panelWidth - 12));
  return { top, anchorY, left };
}

function formatAdminRoleLabel(role?: string | null) {
  if (!role) return "Signed in";
  return role
    .toLowerCase()
    .split("_")
    .map((part) => `${part.charAt(0).toUpperCase()}${part.slice(1)}`)
    .join(" ");
}

function GlobeIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
      <circle cx="12" cy="12" r="9" />
      <path d="M3 12h18M12 3a17 17 0 0 0 0 18M12 3a17 17 0 0 1 0 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeftIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
      <path d="M15 6l-6 6 6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowRightIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
      <path d="M9 6l6 6-6 6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function SunIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M5.64 5.64l1.41 1.41M16.95 16.95l1.41 1.41M3 12h2M19 12h2M5.64 18.36l1.41-1.41M16.95 7.05l1.41-1.41" />
    </svg>
  );
}

function MoonIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.4} {...props}>
      <path
        d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}


