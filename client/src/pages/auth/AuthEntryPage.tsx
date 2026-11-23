import { useMemo, useState, type FormEvent } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { IconEye, IconEyeOff, IconLock, IconLogin2, IconMail, IconShieldLock, IconUser } from "@tabler/icons-react";
import { rtlLanguages } from "../../i18n/config";
import { AppLoadingOverlay } from "../../components/AppLoadingOverlay";
import { useAuth } from "../../auth/AuthContext";
import { isApiError } from "../../api/client";
import { PRODUCT_BRAND } from "@app-product-brand";

type LocationState = {
  from?: {
    pathname?: string;
    search?: string;
  };
};

export function AuthEntryPage() {
  const { t, i18n } = useTranslation();
  const { status, error: sessionError, refresh, login, setupOwner } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as LocationState | null;
  const currentLanguage = i18n.language.split("-")[0];
  const brandLanguage = currentLanguage === "fa" || currentLanguage === "ps" ? currentLanguage : "en";
  const isRtl = rtlLanguages.includes(currentLanguage);
  const mode = status === "setup-required" ? "setup" : "login";
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [email, setEmail] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  const nextPath = useMemo(() => {
    const path = state?.from?.pathname && state.from.pathname !== "/login" ? state.from.pathname : "/dashboard";
    return `${path}${state?.from?.search ?? ""}`;
  }, [state?.from?.pathname, state?.from?.search]);

  if (status === "checking") {
    return <AppLoadingOverlay show message={t("auth.loading", { defaultValue: "Checking session" })} subtitle={t("common.messages.loading")} dir={isRtl ? "rtl" : "ltr"} />;
  }

  if (status === "authenticated") {
    return <Navigate to={nextPath} replace />;
  }

  if (status === "incompatible") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white"
        dir={isRtl ? "rtl" : "ltr"}
        data-testid="application-incompatible"
      >
        <section className="w-full max-w-xl rounded-2xl border border-rose-300 bg-white p-6 text-center shadow-xl dark:border-rose-500/40 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-rose-600 dark:text-rose-300">
            {t("auth.compatibility.eyebrow", { defaultValue: "Application compatibility error" })}
          </p>
          <h1 className="mt-2 text-xl font-bold">
            {t("auth.compatibility.title", { defaultValue: "Client and server do not match" })}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300" data-testid="application-incompatible-message">
            {sessionError ??
              t("auth.compatibility.body", {
                defaultValue: "Install matching client and server builds, then restart the application.",
              })}
          </p>
        </section>
      </main>
    );
  }

  if (status === "unavailable") {
    return (
      <main
        className="flex min-h-screen items-center justify-center bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white"
        dir={isRtl ? "rtl" : "ltr"}
        data-testid="application-unavailable"
      >
        <section className="w-full max-w-xl rounded-2xl border border-amber-300 bg-white p-6 text-center shadow-xl dark:border-amber-500/40 dark:bg-slate-900">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-700 dark:text-amber-300">
            {t("auth.unavailable.eyebrow", { defaultValue: "Server identity unavailable" })}
          </p>
          <h1 className="mt-2 text-xl font-bold">
            {t("auth.unavailable.title", { defaultValue: "The application cannot verify this server" })}
          </h1>
          <p className="mt-3 text-sm leading-6 text-slate-600 dark:text-slate-300" data-testid="application-unavailable-message">
            {sessionError ??
              t("auth.unavailable.body", {
                defaultValue: "Check the server connection, then try again before signing in.",
              })}
          </p>
          <button
            type="button"
            onClick={() => void refresh()}
            className="mt-5 inline-flex h-10 items-center justify-center rounded-xl border border-amber-500 bg-amber-600 px-4 text-sm font-semibold text-white transition hover:bg-amber-500"
          >
            {t("common.actions.retry", { defaultValue: "Try again" })}
          </button>
        </section>
      </main>
    );
  }

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitError(null);
    setPending(true);
    try {
      if (mode === "setup") {
        await setupOwner({
          username,
          password,
          fullName,
          email,
        });
      } else {
        await login({ username, password });
      }
      navigate(nextPath, { replace: true });
    } catch (error) {
      setSubmitError(isApiError(error) || error instanceof Error ? error.message : t("auth.errors.failed", { defaultValue: "Authentication failed" }));
    } finally {
      setPending(false);
    }
  };

  const title =
    mode === "setup"
      ? t("auth.setup.title", { defaultValue: "Create owner account" })
      : t("auth.login.title", { defaultValue: "Sign in" });
  const subtitle =
    mode === "setup"
      ? PRODUCT_BRAND.edition === "ATTENDANCE"
        ? PRODUCT_BRAND.authSetupSubtitle[brandLanguage]
        : t("auth.setup.subtitle", { defaultValue: PRODUCT_BRAND.authSetupSubtitle[brandLanguage] })
      : t("auth.login.subtitle", { defaultValue: "Use your admin account to continue." });
  const buttonLabel =
    mode === "setup"
      ? t("auth.setup.submit", { defaultValue: "Create owner" })
      : t("auth.login.submit", { defaultValue: "Sign in" });

  return (
    <main
      className="min-h-screen bg-slate-100 px-4 py-8 text-slate-950 dark:bg-slate-950 dark:text-white"
      dir={isRtl ? "rtl" : "ltr"}
    >
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-5xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/60 dark:border-slate-800 dark:bg-slate-900 dark:shadow-slate-950/40 lg:grid-cols-[0.95fr_1.05fr]">
          <div className="flex min-h-[24rem] flex-col justify-between border-b border-slate-200 bg-slate-950 p-6 text-white dark:border-slate-800 lg:border-b-0 lg:border-e">
            <div>
              <img src={PRODUCT_BRAND.logoSrc} alt={PRODUCT_BRAND.name} className="h-24 w-44 rounded-lg object-contain object-start" />
              <p className="mt-6 max-w-sm text-sm leading-6 text-slate-300">
                {PRODUCT_BRAND.edition === "ATTENDANCE"
                  ? PRODUCT_BRAND.authPanelBody[brandLanguage]
                  : t("auth.panel.body", { defaultValue: PRODUCT_BRAND.authPanelBody[brandLanguage] })}
              </p>
            </div>
            <div className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-500/20 text-brand-200">
                  <IconShieldLock className="h-5 w-5" stroke={1.8} />
                </span>
                <div>
                  <p className="text-sm font-semibold">{t("auth.panel.title", { defaultValue: "Protected admin access" })}</p>
                  <p className="text-xs text-slate-400">
                    {t("auth.panel.subtitle", { defaultValue: "Your session is stored in a secure httpOnly cookie." })}
                  </p>
                </div>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col justify-center p-6 sm:p-8">
            <div className="mb-6">
              <p className="text-xs font-semibold uppercase tracking-wide text-brand-600 dark:text-brand-300">
                {mode === "setup"
                  ? t("auth.setup.eyebrow", { defaultValue: "First run" })
                  : t("auth.login.eyebrow", { defaultValue: "Admin session" })}
              </p>
              <h1 className="mt-2 text-2xl font-bold text-slate-950 dark:text-white">{title}</h1>
              <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">{subtitle}</p>
            </div>

            <div className="space-y-4">
              {mode === "setup" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("auth.fields.fullName", { defaultValue: "Full name" })}
                  </span>
                  <span className="relative block">
                    <IconUser className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={fullName}
                      onChange={(event) => setFullName(event.target.value)}
                      className="form-input h-11 w-full rounded-xl ps-10"
                      autoComplete="name"
                      maxLength={120}
                    />
                  </span>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("auth.fields.username", { defaultValue: "Username" })}
                </span>
                <span className="relative block">
                  <IconUser className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    className="form-input h-11 w-full rounded-xl ps-10"
                    autoComplete="username"
                    required
                    minLength={mode === "setup" ? 3 : 1}
                    maxLength={254}
                    autoFocus
                  />
                </span>
              </label>

              {mode === "setup" ? (
                <label className="block">
                  <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                    {t("auth.fields.email", { defaultValue: "Email" })}
                  </span>
                  <span className="relative block">
                    <IconMail className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={email}
                      onChange={(event) => setEmail(event.target.value)}
                      className="form-input h-11 w-full rounded-xl ps-10"
                      autoComplete="email"
                      type="email"
                      maxLength={254}
                    />
                  </span>
                </label>
              ) : null}

              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-slate-600 dark:text-slate-300">
                  {t("auth.fields.password", { defaultValue: "Password" })}
                </span>
                <span className="relative block">
                  <IconLock className="pointer-events-none absolute start-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                  <input
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    className="form-input h-11 w-full rounded-xl pe-10 ps-10"
                    autoComplete={mode === "setup" ? "new-password" : "current-password"}
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={mode === "setup" ? 10 : 1}
                    maxLength={256}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((value) => !value)}
                    className="absolute end-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                    aria-label={showPassword ? t("auth.fields.hidePassword", { defaultValue: "Hide password" }) : t("auth.fields.showPassword", { defaultValue: "Show password" })}
                  >
                    {showPassword ? <IconEyeOff className="h-4 w-4" /> : <IconEye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
            </div>

            {submitError || sessionError ? (
              <div className="mt-4 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100">
                {submitError ?? sessionError}
              </div>
            ) : null}

            <button
              type="submit"
              disabled={pending}
              className="mt-6 inline-flex h-11 items-center justify-center gap-2 rounded-xl border border-brand-500 bg-brand-600 px-4 text-sm font-semibold text-white shadow-lg shadow-brand-500/25 transition hover:bg-brand-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <IconLogin2 className="h-4 w-4" stroke={1.8} />
              {pending ? t("auth.actions.working", { defaultValue: "Please wait..." }) : buttonLabel}
            </button>
          </form>
        </section>
      </div>
    </main>
  );
}
