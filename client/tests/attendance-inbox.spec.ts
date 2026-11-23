import { expect, test, type Page } from "@playwright/test";

type HarnessOptions = {
  inbox: boolean;
  language?: "en" | "fa" | "ps";
  theme?: "dark" | "light";
  queryRetry?: boolean;
};

test("Attendance Inbox stays absent when the auth feature is off", async ({ page }) => {
  const requests: string[] = [];
  const websockets: string[] = [];
  page.on("request", (request) => requests.push(request.url()));
  page.on("websocket", (socket) => websockets.push(socket.url()));

  await openHarness(page, { inbox: false });
  await expect(page.getByTestId("inbox-open")).toHaveCount(0);
  await page.waitForTimeout(100);

  expect(requests.some((url) => url.includes("/api/v1/inbox"))).toBe(false);
  expect(requests.some((url) => url.includes("AttendanceInboxShell"))).toBe(false);
  expect(websockets.some((url) => url.includes("/ws/inbox"))).toBe(false);
});

test("Attendance Inbox uses the shared drawer without Membership or Sounds", async ({ page }) => {
  const requests: string[] = [];
  page.on("request", (request) => requests.push(request.url()));

  await page.route("http://localhost:4000/api/v1/inbox/unread-count", async (route) => {
    await route.fulfill({ json: { alerts: 3, deviceFeed: 1, total: 4 } });
  });
  await page.route("http://localhost:4000/api/v1/inbox**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/unread-count")) {
      await route.fulfill({ json: { alerts: 3, deviceFeed: 1, total: 4 } });
      return;
    }
    await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
  });
  await page.routeWebSocket("ws://localhost:4000/ws/inbox", (socket) => {
    socket.send(JSON.stringify({ type: "WELCOME" }));
  });

  await openHarness(page, { inbox: true });
  const bell = page.getByTestId("inbox-open");
  await expect(bell).toBeVisible();
  await expect(bell).toContainText("3");
  await bell.click();
  await expect(page.getByTestId("inbox-drawer")).toBeVisible();

  await page.getByTestId("inbox-alert-type-filter").click();
  await expect(page.getByRole("option", { name: "Shift ending soon" })).toBeVisible();
  await expect(page.getByRole("option", { name: "Membership expiring" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Membership expired" })).toHaveCount(0);
  await expect(page.getByRole("option", { name: "Shift violation" })).toHaveCount(0);

  expect(requests.some((url) => url.includes("AttendanceInboxShell"))).toBe(true);
  expect(requests.some((url) => /\/api\/v1\/sounds|soundPlayer|\/api\/sounds/iu.test(url))).toBe(false);
  expect(requests.some((url) => url.includes("/api/v1/devices"))).toBe(false);
});

test("Attendance Inbox renders populated and loading states", async ({ page }) => {
  await page.route("http://localhost:4000/api/v1/inbox/unread-count", (route) =>
    route.fulfill({ json: { alerts: 1, deviceFeed: 0, total: 1 } })
  );
  await page.route("http://localhost:4000/api/v1/inbox**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/unread-count")) {
      await route.fulfill({ json: { alerts: 1, deviceFeed: 0, total: 1 } });
      return;
    }
    await new Promise((resolve) => setTimeout(resolve, 350));
    await route.fulfill({
      json: {
        items: [{
          id: "attendance-alert-1",
          category: "ALERT",
          type: "DEVICE_DISCONNECTED",
          severity: "CRITICAL",
          title: "Front desk device disconnected",
          body: "Device K40 is offline",
          createdAt: "2026-10-03T12:00:00.000Z",
          readAt: null,
          actionPath: "/devices",
          deviceId: "device-1",
        }],
        total: 1,
        page: 1,
        pageSize: 20,
      },
    });
  });
  await page.routeWebSocket("ws://localhost:4000/ws/inbox", (socket) => {
    socket.send(JSON.stringify({ type: "WELCOME" }));
  });

  await openHarness(page, { inbox: true, language: "en", theme: "dark" });
  await page.getByTestId("inbox-open").click();
  await expect(page.getByText("Loading inbox...")).toBeVisible();
  await expect(page.getByText("Front desk device disconnected")).toBeVisible();
  await expect(page.locator(".dashboard-shell")).not.toHaveClass(/\btheme-shell-light\b/u);
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "ltr");
});

test("Attendance Inbox empty state is localized for Dari light RTL", async ({ page }) => {
  await mockEmptyInbox(page);
  await openHarness(page, { inbox: true, language: "fa", theme: "light" });
  await page.getByTestId("inbox-open").click();

  await expect(page.getByText("هشداری وجود ندارد.")).toBeVisible();
  await expect(page.locator(".dashboard-shell")).toHaveClass(/\btheme-shell-light\b/u);
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
});

test("Attendance Inbox error and retry work in Pashto mobile RTL", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  let recovered = false;
  await page.route("http://localhost:4000/api/v1/inbox/unread-count", (route) =>
    route.fulfill({ json: { alerts: 0, deviceFeed: 0, total: 0 } })
  );
  await page.route("http://localhost:4000/api/v1/inbox**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/unread-count")) {
      await route.fulfill({ json: { alerts: 0, deviceFeed: 0, total: 0 } });
      return;
    }
    if (!recovered) {
      await route.fulfill({ status: 503, json: { message: "Unavailable" } });
      return;
    }
    await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
  });
  await page.routeWebSocket("ws://localhost:4000/ws/inbox", (socket) => {
    socket.send(JSON.stringify({ type: "WELCOME" }));
  });

  await openHarness(page, { inbox: true, language: "ps", theme: "dark", queryRetry: false });
  await page.getByTestId("inbox-open").click();
  await expect(page.getByTestId("inbox-error-state")).toContainText("ان باکس ونه لوډېده.");
  recovered = true;
  await page.getByRole("button", { name: "بیا هڅه وکړئ" }).click();
  await expect(page.getByText("خبرتیا نشته.")).toBeVisible();
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page.getByTestId("inbox-drawer")).toBeVisible();
});

async function mockEmptyInbox(page: Page) {
  await page.route("http://localhost:4000/api/v1/inbox/unread-count", (route) =>
    route.fulfill({ json: { alerts: 0, deviceFeed: 0, total: 0 } })
  );
  await page.route("http://localhost:4000/api/v1/inbox**", async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname.endsWith("/unread-count")) {
      await route.fulfill({ json: { alerts: 0, deviceFeed: 0, total: 0 } });
      return;
    }
    await route.fulfill({ json: { items: [], total: 0, page: 1, pageSize: 20 } });
  });
  await page.routeWebSocket("ws://localhost:4000/ws/inbox", (socket) => {
    socket.send(JSON.stringify({ type: "WELCOME" }));
  });
}

async function openHarness(page: Page, options: HarnessOptions) {
  const language = options.language ?? "en";
  const theme = options.theme ?? "dark";
  await page.addInitScript(({ language: nextLanguage, theme: nextTheme }) => {
    localStorage.setItem("i18nextLng", nextLanguage);
    localStorage.setItem("ecs-theme", nextTheme);
  }, { language, theme });
  await page.route("**/attendance-shell-visual-harness.html*", async (route) => {
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
        <script type="module" src="/tests/attendance-shell-visual-harness.tsx"></script></body></html>`,
    });
  });
  const params = new URLSearchParams({
    scenario: "employees",
    inbox: options.inbox ? "1" : "0",
    queryRetry: options.queryRetry === false ? "0" : "1",
  });
  await page.goto(`/attendance-shell-visual-harness.html?${params.toString()}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("attendance-shell-test-page")).toBeVisible();
}
