import { StrictMode, useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { AuthProvider } from "../src/auth/AuthProvider";
import { useAuth } from "../src/auth/AuthContext";
import { createClientBuildIdentity } from "../src/auth/authState";
import { CLIENT_BUILD_IDENTITY } from "../src/config/clientBuildIdentity";
import { AuthEntryPage } from "../src/pages/auth/AuthEntryPage";
import "../src/i18n/config";

const query = new URLSearchParams(window.location.search);
const expectedEdition = query.get("edition") === "ATTENDANCE" ? "ATTENDANCE" : "FULL";
const expectedIdentity = createClientBuildIdentity({
  ...CLIENT_BUILD_IDENTITY,
  edition: expectedEdition,
});

function AuthStateProbe() {
  const {
    status,
    auth,
    identity,
    setupStatus,
    error,
    refresh,
    login,
    setupOwner,
    logout,
    hasFeature,
    hasPermission,
  } = useAuth();
  const [actionError, setActionError] = useState("");
  const [unauthorizedEvents, setUnauthorizedEvents] = useState(0);

  useEffect(() => {
    const handleUnauthorized = () => {
      setUnauthorizedEvents((current) => current + 1);
    };

    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const run = (action: () => Promise<void>) => {
    setActionError("");
    void action().catch((actionFailure: unknown) => {
      setActionError(actionFailure instanceof Error ? actionFailure.message : String(actionFailure));
    });
  };

  return (
    <main>
      <div data-testid="status">{status}</div>
      <div data-testid="identity-edition">{identity?.edition ?? "-"}</div>
      <div data-testid="identity-version">{identity?.version ?? "-"}</div>
      <div data-testid="auth-edition">{auth?.edition ?? "-"}</div>
      <div data-testid="auth-features">{auth?.features.join(",") ?? "-"}</div>
      <div data-testid="auth-permissions">{auth?.permissions.join(",") ?? "-"}</div>
      <div data-testid="auth-user">{auth?.user.username ?? "-"}</div>
      <div data-testid="session-id">{auth?.session.id ?? "-"}</div>
      <div data-testid="session-expires-at">{auth?.session.expiresAt ?? "-"}</div>
      <div data-testid="setup-required">{String(setupStatus?.setupRequired ?? false)}</div>
      <div data-testid="has-auth-feature">{String(hasFeature("AUTH"))}</div>
      <div data-testid="has-customers-feature">{String(hasFeature("CUSTOMERS"))}</div>
      <div data-testid="has-sign-in-permission">{String(hasPermission("SIGN_IN"))}</div>
      <div data-testid="has-members-permission">{String(hasPermission("MEMBERS_VIEW"))}</div>
      <div data-testid="provider-error">{error ?? ""}</div>
      <div data-testid="action-error">{actionError}</div>
      <div data-testid="unauthorized-events">{unauthorizedEvents}</div>
      <button type="button" data-testid="refresh" onClick={() => run(refresh)}>
        Refresh
      </button>
      <button type="button" data-testid="login" onClick={() => run(() => login({ username: "owner", password: "login-secret" }))}>
        Login
      </button>
      <button
        type="button"
        data-testid="setup"
        onClick={() =>
          run(() =>
            setupOwner({
              username: "first-owner",
              password: "setup-secret",
              fullName: "First Owner",
              email: "owner@example.test",
            })
          )
        }
      >
        Setup
      </button>
      <button type="button" data-testid="logout" onClick={() => run(logout)}>
        Logout
      </button>
    </main>
  );
}

const child = query.get("entry") === "1" ? (
  <MemoryRouter initialEntries={["/login"]}>
    <AuthEntryPage />
  </MemoryRouter>
) : (
  <AuthStateProbe />
);

const application = (
  <AuthProvider expectedIdentity={expectedIdentity}>
    {child}
  </AuthProvider>
);

createRoot(document.getElementById("root") as HTMLElement).render(
  query.get("strict") === "1" ? <StrictMode>{application}</StrictMode> : application
);
