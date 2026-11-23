import { expect, test, type Page } from "@playwright/test";

test("disabled feature returns generic Not Found before permission disclosure", async ({ page }) => {
  await openHarness(page, "?permission=1");
  await expect(page.getByTestId("generic-not-found")).toBeVisible();
  await expect(page.getByTestId("protected-content")).toHaveCount(0);
  await expect(page.getByText("Permission required")).toHaveCount(0);
  await expect(page.locator("body")).not.toContainText("CUSTOMERS");
});

test("enabled feature still requires the route permission", async ({ page }) => {
  await openHarness(page, "?feature=1");
  await expect(page.getByText("Permission required")).toBeVisible();
  await expect(page.getByTestId("generic-not-found")).toHaveCount(0);
  await expect(page.getByTestId("protected-content")).toHaveCount(0);
});

test("feature and permission together render the protected route", async ({ page }) => {
  await openHarness(page, "?feature=1&permission=1");
  await expect(page.getByTestId("protected-content")).toHaveText("Protected customer content");
});

test("unknown direct URLs use the same generic Not Found surface", async ({ page }) => {
  await openHarness(page, "?feature=1&permission=1&unknown=1");
  await expect(page.getByTestId("generic-not-found")).toBeVisible();
  await expect(page.getByTestId("protected-content")).toHaveCount(0);
});

async function openHarness(page: Page, query: string) {
  await page.route("**/route-boundary-harness.html*", async (route) => {
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
        <script type="module" src="/tests/route-boundary-harness.tsx"></script></body></html>`,
    });
  });
  await page.goto(`/route-boundary-harness.html${query}`);
}
