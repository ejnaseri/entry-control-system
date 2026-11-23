import { expect, test, type Page, type Route } from "@playwright/test";
import { FULL_TEST_IDENTITY } from "./auth-fixtures";

const API_ROUTE = /^https?:\/\/[^/]+\/api(?:\/|$)/;
const NOW = "2026-08-09T08:00:00.000Z";
const EXPIRES_AT = "2026-08-09T20:00:00.000Z";

type ApiRequest = {
  method: string;
  path: string;
  body: unknown;
};

type ApiResponse = {
  status?: number;
  body?: unknown;
  afterFulfill?: () => void;
};

type ApiHandler = (request: ApiRequest) => ApiResponse | Promise<ApiResponse>;

function publicIdentity(overrides: Partial<Omit<typeof FULL_TEST_IDENTITY, "name">> = {}) {
  return {
    ...FULL_TEST_IDENTITY,
    ...overrides,
  };
}

function authPayload(edition: "FULL" | "ATTENDANCE" = "FULL") {
  return {
    edition,
    features: edition === "ATTENDANCE" ? ["AUTH"] : ["AUTH", "CUSTOMERS"],
    permissions: edition === "ATTENDANCE" ? ["SIGN_IN"] : ["SIGN_IN", "MEMBERS_VIEW"],
    user: {
      id: "admin-1",
      username: "owner",
      email: null,
      fullName: "Test Owner",
      role: "GYM_OWNER",
      isActive: true,
      isProtected: false,
      lastLoginAt: NOW,
      passwordChangedAt: NOW,
      createdAt: NOW,
      updatedAt: NOW,
    },
    session: {
      id: "session-1",
      createdAt: NOW,
      lastSeenAt: NOW,
      expiresAt: EXPIRES_AT,
    },
    expiresAt: EXPIRES_AT,
  };
}

function setupStatus(setupRequired: boolean) {
  return {
    setupRequired,
    activeAdminCount: setupRequired ? 0 : 1,
    hasGymOwner: !setupRequired,
    hasVendorOwner: false,
  };
}

test("ME bootstrap stores identity, edition, features and clears them on logout", async ({ page }) => {
  const { requests } = await openHarness(page, ({ method, path }) => {
    if (method === "GET" && path === "/api") return { body: publicIdentity() };
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
    if (method === "GET" && path === "/api/v1/auth/me") return { body: authPayload() };
    if (method === "POST" && path === "/api/v1/auth/logout") return { status: 204 };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("authenticated");
  await expect(page.getByTestId("identity-edition")).toHaveText("FULL");
  await expect(page.getByTestId("identity-version")).toHaveText("1.0.0");
  await expect(page.getByTestId("auth-edition")).toHaveText("FULL");
  await expect(page.getByTestId("auth-features")).toHaveText("AUTH,CUSTOMERS");
  await expect(page.getByTestId("session-id")).toHaveText("session-1");
  await expect(page.getByTestId("session-expires-at")).toHaveText(EXPIRES_AT);
  await expect(page.getByTestId("has-customers-feature")).toHaveText("true");
  await expect(page.getByTestId("has-members-permission")).toHaveText("true");
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
    "GET /api",
    "GET /api/v1/auth/setup-status",
    "GET /api/v1/auth/me",
  ]);

  await page.getByTestId("logout").click();
  await expect(page.getByTestId("status")).toHaveText("unauthenticated");
  await expect(page.getByTestId("auth-edition")).toHaveText("-");
  await expect(page.getByTestId("has-customers-feature")).toHaveText("false");
  await expect(page.getByTestId("has-members-permission")).toHaveText("false");
  await expect(page.getByTestId("identity-edition")).toHaveText("FULL");
});

test("LOGIN uses the POST response without a hidden ME refresh", async ({ page }) => {
  const { requests } = await openHarness(page, ({ method, path }) => {
    if (method === "GET" && path === "/api") return { body: publicIdentity() };
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
    if (method === "GET" && path === "/api/v1/auth/me") return { status: 401, body: { message: "Authentication required" } };
    if (method === "POST" && path === "/api/v1/auth/login") return { body: authPayload() };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("unauthenticated");
  await page.getByTestId("login").click();
  await expect(page.getByTestId("status")).toHaveText("authenticated");
  await expect(page.getByTestId("auth-features")).toHaveText("AUTH,CUSTOMERS");
  expect(requests.filter(({ path }) => path === "/api/v1/auth/me")).toHaveLength(1);
  expect(requests.filter(({ path }) => path === "/api/v1/auth/login")).toHaveLength(1);
  expect(requests.find(({ path }) => path === "/api/v1/auth/login")?.body).toEqual({
    username: "owner",
    password: "login-secret",
  });
});

test("SETUP uses the POST response and never performs a hidden ME request", async ({ page }) => {
  const { requests } = await openHarness(page, ({ method, path }) => {
    if (method === "GET" && path === "/api") return { body: publicIdentity() };
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(true) };
    if (method === "POST" && path === "/api/v1/auth/setup") return { body: authPayload() };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("setup-required");
  await expect(page.getByTestId("setup-required")).toHaveText("true");
  expect(requests.filter(({ path }) => path === "/api/v1/auth/me")).toHaveLength(0);

  await page.getByTestId("setup").click();
  await expect(page.getByTestId("status")).toHaveText("authenticated");
  await expect(page.getByTestId("setup-required")).toHaveText("false");
  expect(requests.filter(({ path }) => path === "/api/v1/auth/me")).toHaveLength(0);
  expect(requests.find(({ path }) => path === "/api/v1/auth/setup")?.body).toEqual({
    username: "first-owner",
    password: "setup-secret",
    fullName: "First Owner",
    email: "owner@example.test",
  });
});

test("logout failure still clears auth state while retaining public identity", async ({ page }) => {
  await openHarness(page, ({ method, path }) => {
    if (method === "GET" && path === "/api") return { body: publicIdentity() };
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
    if (method === "GET" && path === "/api/v1/auth/me") return { body: authPayload() };
    if (method === "POST" && path === "/api/v1/auth/logout") return { status: 500, body: { message: "Logout failed" } };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("authenticated");
  await page.getByTestId("logout").click();
  await expect(page.getByTestId("status")).toHaveText("unauthenticated");
  await expect(page.getByTestId("auth-user")).toHaveText("-");
  await expect(page.getByTestId("identity-edition")).toHaveText("FULL");
  await expect(page.getByTestId("action-error")).toContainText("Logout failed");
});

test("ATTENDANCE identity and auth envelope bootstrap successfully", async ({ page }) => {
  const { requests } = await openHarness(
    page,
    ({ method, path }) => {
      if (method === "GET" && path === "/api") return { body: publicIdentity({ edition: "ATTENDANCE" }) };
      if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
      if (method === "GET" && path === "/api/v1/auth/me") return { body: authPayload("ATTENDANCE") };
      throw new Error(`Unexpected API request: ${method} ${path}`);
    },
    { edition: "ATTENDANCE" }
  );

  await expect(page.getByTestId("status")).toHaveText("authenticated");
  await expect(page.getByTestId("identity-edition")).toHaveText("ATTENDANCE");
  await expect(page.getByTestId("auth-edition")).toHaveText("ATTENDANCE");
  await expect(page.getByTestId("auth-features")).toHaveText("AUTH");
  await expect(page.getByTestId("has-auth-feature")).toHaveText("true");
  await expect(page.getByTestId("has-customers-feature")).toHaveText("false");
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
    "GET /api",
    "GET /api/v1/auth/setup-status",
    "GET /api/v1/auth/me",
  ]);
});

test("identity request failure blocks auth requests until a successful retry", async ({ page }) => {
  let identityAttempts = 0;
  const { requests } = await openHarness(page, ({ method, path }) => {
    if (method === "GET" && path === "/api") {
      identityAttempts += 1;
      return identityAttempts === 1
        ? { status: 401, body: { message: "Identity unavailable" } }
        : { body: publicIdentity() };
    }
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
    if (method === "GET" && path === "/api/v1/auth/me") return { body: authPayload() };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("unavailable");
  await expect(page.getByTestId("provider-error")).toContainText("Identity unavailable");
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(["GET /api"]);

  await page.getByTestId("refresh").click();
  await expect(page.getByTestId("status")).toHaveText("authenticated");
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
    "GET /api",
    "GET /api",
    "GET /api/v1/auth/setup-status",
    "GET /api/v1/auth/me",
  ]);
});

test("a stale ME 401 cannot overwrite a newer authenticated refresh", async ({ page }) => {
  let meAttempts = 0;
  let releaseStaleMe: (() => void) | undefined;
  let markStaleFulfillComplete: (() => void) | undefined;
  const staleMeGate = new Promise<void>((resolve) => {
    releaseStaleMe = resolve;
  });
  const staleFulfillComplete = new Promise<void>((resolve) => {
    markStaleFulfillComplete = resolve;
  });

  await openHarness(page, async ({ method, path }) => {
    if (method === "GET" && path === "/api") return { body: publicIdentity() };
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
    if (method === "GET" && path === "/api/v1/auth/me") {
      meAttempts += 1;
      if (meAttempts === 2) {
        await staleMeGate;
        return {
          status: 401,
          body: { message: "Stale session" },
          afterFulfill: markStaleFulfillComplete,
        };
      }
      return { body: authPayload() };
    }
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("authenticated");
  const refreshButton = page.getByTestId("refresh");
  await refreshButton.dispatchEvent("click");
  await expect.poll(() => meAttempts).toBe(2);
  await refreshButton.dispatchEvent("click");
  await expect(page.getByTestId("status")).toHaveText("authenticated");
  releaseStaleMe?.();
  await staleFulfillComplete;
  await page.evaluate(
    () => new Promise<void>((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())))
  );
  await expect(page.getByTestId("status")).toHaveText("authenticated");
  await expect(page.getByTestId("identity-edition")).toHaveText("FULL");
  await expect(page.getByTestId("unauthorized-events")).toHaveText("0");
  expect(meAttempts).toBe(3);
});

for (const mismatch of [
  {
    label: "edition",
    identity: publicIdentity({ edition: "ATTENDANCE" }),
    expectedMessage: "expects FULL, but the server is ATTENDANCE",
  },
  {
    label: "version",
    identity: publicIdentity({ version: "2.0.0" }),
    expectedMessage: "expects 1.0.0, but the server is 2.0.0",
  },
  {
    label: "canonical build identity",
    identity: publicIdentity({ versionIdentitySha256: "0".repeat(64) }),
    expectedMessage: "build identity mismatch at versionIdentitySha256",
  },
] as const) {
  test(`public ${mismatch.label} mismatch blocks downstream auth requests`, async ({ page }) => {
    const { requests } = await openHarness(page, ({ method, path }) => {
      if (method === "GET" && path === "/api") return { body: mismatch.identity };
      throw new Error(`Mismatch must block downstream request: ${method} ${path}`);
    });

    await expect(page.getByTestId("status")).toHaveText("incompatible");
    await expect(page.getByTestId("provider-error")).toContainText(mismatch.expectedMessage);
    expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(["GET /api"]);
  });
}

test("auth envelope edition mismatch is rejected before authentication", async ({ page }) => {
  const { requests } = await openHarness(page, ({ method, path }) => {
    if (method === "GET" && path === "/api") return { body: publicIdentity() };
    if (method === "GET" && path === "/api/v1/auth/setup-status") return { body: setupStatus(false) };
    if (method === "GET" && path === "/api/v1/auth/me") return { body: authPayload("ATTENDANCE") };
    throw new Error(`Unexpected API request: ${method} ${path}`);
  });

  await expect(page.getByTestId("status")).toHaveText("incompatible");
  await expect(page.getByTestId("provider-error")).toContainText(
    "public API is FULL, but the authentication response is ATTENDANCE"
  );
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual([
    "GET /api",
    "GET /api/v1/auth/setup-status",
    "GET /api/v1/auth/me",
  ]);
});

test("the real auth entry page renders a blocking compatibility message", async ({ page }) => {
  const { requests } = await openHarness(
    page,
    ({ method, path }) => {
      if (method === "GET" && path === "/api") {
        return { body: publicIdentity({ edition: "ATTENDANCE" }) };
      }
      throw new Error(`Mismatch must block downstream request: ${method} ${path}`);
    },
    { entry: true }
  );

  await expect(page.getByTestId("application-incompatible")).toBeVisible();
  await expect(page.getByTestId("application-incompatible-message")).toContainText(
    "expects FULL, but the server is ATTENDANCE"
  );
  await expect(page.locator('input[autocomplete="username"]')).toHaveCount(0);
  expect(requests.map(({ method, path }) => `${method} ${path}`)).toEqual(["GET /api"]);
});

async function openHarness(
  page: Page,
  handler: ApiHandler,
  options: { edition?: "FULL" | "ATTENDANCE"; strict?: boolean; entry?: boolean } = {}
) {
  const requests: ApiRequest[] = [];

  await page.route("**/auth-state-harness.html*", async (route) => {
    await route.fulfill({
      contentType: "text/html; charset=utf-8",
      body: `<!doctype html><html><head><meta charset="UTF-8" /></head><body><div id="root"></div>
        <script type="module">
          import RefreshRuntime from "/@react-refresh";
          RefreshRuntime.injectIntoGlobalHook(window);
          window.$RefreshReg$ = () => {};
          window.$RefreshSig$ = () => (type) => type;
          window.__vite_plugin_react_preamble_installed__ = true;
        </script>
        <script type="module" src="/tests/auth-state-harness.tsx"></script></body></html>`,
    });
  });

  await page.route(API_ROUTE, async (route) => {
    const request = route.request();
    if (request.method() === "OPTIONS") {
      await route.fulfill({ status: 204, headers: corsHeaders(route) });
      return;
    }

    const apiRequest: ApiRequest = {
      method: request.method(),
      path: new URL(request.url()).pathname,
      body: request.postDataJSON() ?? null,
    };
    requests.push(apiRequest);
    const response = await handler(apiRequest);
    try {
      await route.fulfill({
        status: response.status ?? 200,
        headers: { ...corsHeaders(route), "content-type": "application/json; charset=utf-8" },
        body: response.status === 204 ? undefined : JSON.stringify(response.body ?? {}),
      });
    } finally {
      response.afterFulfill?.();
    }
  });

  const query = new URLSearchParams();
  if (options.edition) query.set("edition", options.edition);
  if (options.strict) query.set("strict", "1");
  if (options.entry) query.set("entry", "1");
  await page.goto(`/auth-state-harness.html${query.size ? `?${query}` : ""}`);
  return { requests };
}

function corsHeaders(route: Route) {
  return {
    "access-control-allow-origin": route.request().headers()["origin"] ?? "http://127.0.0.1:5173",
    "access-control-allow-credentials": "true",
    "access-control-allow-headers": "content-type",
    "access-control-allow-methods": "GET,POST,OPTIONS",
  };
}
