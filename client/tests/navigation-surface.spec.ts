import { expect, test, type Page } from "@playwright/test";

test("main navigation, header action, and breadcrumbs come from accessible manifest routes", async ({ page }) => {
  await openHarness(page, "full");
  await expect(page.getByTestId("main-nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("main-nav-members")).toBeVisible();
  await expect(page.getByTestId("main-nav-finance")).toHaveCount(0);
  await expect(page.getByTestId("header-action-members-add")).toBeVisible();
  await expect(page.getByTestId("route-breadcrumb")).toContainText("Members");
  await expect(page.getByTestId("route-breadcrumb")).toContainText("Member details");
  await expect(page.getByTestId("route-header-title")).toHaveText("Member details");
});

test("permission-only customer metadata stays hidden when its feature is disabled", async ({ page }) => {
  await openHarness(page, "hidden-feature");
  await expect(page.getByTestId("main-nav-dashboard")).toBeVisible();
  await expect(page.getByTestId("main-nav-members")).toHaveCount(0);
  await expect(page.getByTestId("header-action-members-add")).toHaveCount(0);
  await expect(page.getByTestId("route-header")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("Member details");
});

test("read-only customer access keeps navigation but removes the add shortcut", async ({ page }) => {
  await openHarness(page, "read-only");
  await expect(page.getByTestId("main-nav-members")).toBeVisible();
  await expect(page.getByTestId("header-action-members-add")).toHaveCount(0);
  await expect(page.getByTestId("route-header-title")).toHaveText("Member details");
});

test("settings parent and flyout are derived only from accessible settings routes", async ({ page }) => {
  await openHarness(page, "settings");
  const settings = page.getByTestId("main-nav-settings");
  await expect(settings).toBeVisible();
  await settings.hover();
  await expect(page.getByTestId("settings-nav-settings-audit-logs")).toBeVisible();
  await expect(page.getByTestId("settings-nav-settings-membership-plans")).toHaveCount(0);
  await expect(page.getByTestId("route-header-title")).toHaveText("Audit logs");
});

async function openHarness(page: Page, scenario: string) {
  await page.route("**/navigation-surface-harness.html*", async (route) => {
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
        <script type="module" src="/tests/navigation-surface-harness.tsx"></script></body></html>`,
    });
  });
  await page.route(/^https?:\/\/[^/]+\/api(?:\/|$)/u, async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path === "/api/v1/sounds/settings") {
      await route.fulfill({ json: { id: "sounds", enabled: false, accessAllowedVolume: 70, accessDeniedVolume: 70, alertVolume: 70 } });
      return;
    }
    if (path === "/api/v1/inbox/unread-count") {
      await route.fulfill({ json: { alerts: 0, deviceFeed: 0, total: 0 } });
      return;
    }
    await route.fulfill({ json: {} });
  });
  await page.goto(`/navigation-surface-harness.html?scenario=${scenario}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("navigation-test-page")).toBeVisible();
}
