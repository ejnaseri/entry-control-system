import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  getCurrentAuth,
  getSetupStatus,
  loginAdmin,
  logoutAdmin,
  setupGymOwner,
  type AdminPermission,
  type AuthState,
  type LoginInput,
  type SetupOwnerInput,
  type SetupStatus,
} from "../api/auth";
import { isApiError } from "../api/client";
import { getPublicApiIdentity } from "../api/identity";
import { CLIENT_BUILD_IDENTITY } from "../config/clientBuildIdentity";
import {
  ApplicationCompatibilityError,
  assertAuthStateCompatible,
  assertPublicIdentityCompatible,
  authHasAnyPermission,
  authHasFeature,
  authHasPermission,
  isApplicationCompatibilityError,
  type Capability,
  type ClientBuildIdentity,
  type PublicApiIdentity,
} from "./authState";
import { AuthContext, type AuthStatus } from "./AuthContext";

function getErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Request failed";
}

export function AuthProvider({
  children,
  expectedIdentity = CLIENT_BUILD_IDENTITY,
}: {
  children: ReactNode;
  expectedIdentity?: ClientBuildIdentity;
}) {
  const [status, setStatus] = useState<AuthStatus>("checking");
  const [auth, setAuth] = useState<AuthState | null>(null);
  const [identity, setIdentity] = useState<PublicApiIdentity | null>(null);
  const [setupStatus, setSetupStatus] = useState<SetupStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const refreshGeneration = useRef(0);
  const activeRefreshController = useRef<AbortController | null>(null);

  const markIncompatible = useCallback((compatibilityError: ApplicationCompatibilityError) => {
    setAuth(null);
    setStatus("incompatible");
    setError(compatibilityError.message);
  }, []);

  const runRefresh = useCallback(async () => {
    activeRefreshController.current?.abort();
    const controller = new AbortController();
    activeRefreshController.current = controller;
    const { signal } = controller;
    const generation = ++refreshGeneration.current;
    const isCurrent = () => generation === refreshGeneration.current && !signal.aborted;

    setStatus("checking");
    setAuth(null);
    setIdentity(null);
    setSetupStatus(null);
    setError(null);
    try {
      const nextIdentity = await getPublicApiIdentity(signal);
      if (!isCurrent()) return;
      setIdentity(nextIdentity);
      assertPublicIdentityCompatible(nextIdentity, expectedIdentity);

      const setup = await getSetupStatus(signal);
      if (!isCurrent()) return;
      setSetupStatus(setup);
      if (setup.setupRequired) {
        setStatus("setup-required");
        return;
      }

      try {
        const current = await getCurrentAuth(signal);
        if (!isCurrent()) return;
        assertAuthStateCompatible(current, nextIdentity);
        setAuth(current);
        setStatus("authenticated");
      } catch (currentError) {
        if (!isCurrent()) return;
        if (isApiError(currentError) && currentError.status === 401) {
          setStatus("unauthenticated");
          return;
        }
        throw currentError;
      }
    } catch (refreshError) {
      if (!isCurrent()) return;
      if (isApplicationCompatibilityError(refreshError)) {
        markIncompatible(refreshError);
        return;
      }
      setAuth(null);
      setStatus("unavailable");
      setError(getErrorMessage(refreshError));
    } finally {
      if (activeRefreshController.current === controller) {
        activeRefreshController.current = null;
      }
    }
  }, [expectedIdentity, markIncompatible]);

  const refresh = useCallback(() => runRefresh(), [runRefresh]);

  useEffect(() => {
    void runRefresh();
    return () => {
      activeRefreshController.current?.abort();
      activeRefreshController.current = null;
      refreshGeneration.current += 1;
    };
  }, [runRefresh]);

  useEffect(() => {
    const handleUnauthorized = () => {
      setAuth(null);
      setStatus((current) =>
        current === "checking" ||
        current === "setup-required" ||
        current === "incompatible" ||
        current === "unavailable"
          ? current
          : "unauthenticated"
      );
    };
    window.addEventListener("auth:unauthorized", handleUnauthorized);
    return () => window.removeEventListener("auth:unauthorized", handleUnauthorized);
  }, []);

  const acceptAuthState = useCallback(
    (nextAuth: AuthState) => {
      if (!identity) {
        throw new ApplicationCompatibilityError(
          "INVALID_PUBLIC_IDENTITY",
          "Public API identity has not been verified. Reload the application before signing in."
        );
      }
      assertAuthStateCompatible(nextAuth, identity);
      setAuth(nextAuth);
      setStatus("authenticated");
    },
    [identity]
  );

  const login = useCallback(
    async (input: LoginInput) => {
      setError(null);
      try {
        const nextAuth = await loginAdmin(input);
        acceptAuthState(nextAuth);
      } catch (loginError) {
        if (isApplicationCompatibilityError(loginError)) {
          markIncompatible(loginError);
        }
        throw loginError;
      }
    },
    [acceptAuthState, markIncompatible]
  );

  const setupOwner = useCallback(
    async (input: SetupOwnerInput) => {
      setError(null);
      try {
        const nextAuth = await setupGymOwner(input);
        acceptAuthState(nextAuth);
        setSetupStatus((previous) =>
          previous
            ? {
                ...previous,
                setupRequired: false,
                hasGymOwner: true,
                activeAdminCount: Math.max(previous.activeAdminCount, 1),
              }
            : previous
        );
      } catch (setupError) {
        if (isApplicationCompatibilityError(setupError)) {
          markIncompatible(setupError);
        }
        throw setupError;
      }
    },
    [acceptAuthState, markIncompatible]
  );

  const logout = useCallback(async () => {
    try {
      await logoutAdmin();
    } finally {
      setAuth(null);
      setError(null);
      setStatus("unauthenticated");
    }
  }, []);

  const hasFeature = useCallback((feature: Capability) => authHasFeature(auth, feature), [auth]);

  const hasPermission = useCallback(
    (permission: AdminPermission) => authHasPermission(auth, permission),
    [auth]
  );

  const hasAnyPermission = useCallback(
    (permissions: readonly AdminPermission[]) => authHasAnyPermission(auth, permissions),
    [auth]
  );

  const value = useMemo(
    () => ({
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
      hasAnyPermission,
    }),
    [
      auth,
      error,
      hasAnyPermission,
      hasFeature,
      hasPermission,
      identity,
      login,
      logout,
      refresh,
      setupOwner,
      setupStatus,
      status,
    ]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
