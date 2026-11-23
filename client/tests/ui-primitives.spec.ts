import { expect, test, type Page } from "@playwright/test";

test("shared UI primitives — desktop dark LTR visual", async ({ page }) => {
  await openPrimitiveGallery(page, "en", "dark");
  await page.getByRole("button", { name: "Show filters" }).click();
  await expect(page.locator("#primitive-filter-content")).toBeVisible();
  await expect(page).toHaveScreenshot("ui-primitives-desktop-dark-ltr.png", screenshotOptions());
});

test("shared UI primitives — desktop light RTL visual", async ({ page }) => {
  await openPrimitiveGallery(page, "fa", "light");
  await expect(page.locator("html")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("ui-primitives-desktop-light-rtl.png", screenshotOptions());
});

test("shared UI primitives — modal visual", async ({ page }) => {
  await openPrimitiveGallery(page, "en", "dark");
  await page.getByTestId("open-primitive-modal").click();
  await expect(page.getByRole("dialog", { name: "Record manual attendance" })).toBeVisible();
  await expect(page).toHaveScreenshot("ui-primitives-modal-dark-ltr.png", screenshotOptions());
});

test("shared UI primitives preserve keyboard, focus, semantics, and reduced motion", async ({ page }) => {
  await openPrimitiveGallery(page, "en", "dark");

  const filterToggle = page.getByRole("button", { name: "Show filters" });
  await expect(filterToggle).toHaveAttribute("aria-expanded", "false");
  await filterToggle.focus();
  await page.keyboard.press("Enter");
  await expect(filterToggle).toHaveAttribute("aria-expanded", "true");
  await expect(page.locator("#primitive-filter-content")).toBeVisible();

  const clickableRow = page.getByRole("row", { name: "Activate Eraj Naseri row" });
  await clickableRow.focus();
  await page.keyboard.press("Enter");
  await expect(page.getByTestId("row-activation-count")).toHaveText("1");

  await expect(page.getByRole("navigation", { name: "Pagination" })).toBeVisible();
  await expect(page.getByRole("table", { name: "Attendance table example" })).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("Data could not be loaded");

  const openModal = page.getByTestId("open-primitive-modal");
  await openModal.focus();
  await openModal.click();
  const dialog = page.getByRole("dialog", { name: "Record manual attendance" });
  await expect(dialog).toBeVisible();
  await expect(page.getByRole("button", { name: "Cancel" }).first()).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(dialog.getByRole("button", { name: "Save" })).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(page.getByRole("button", { name: "Cancel" }).first()).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(dialog).toHaveCount(0);
  await expect(openModal).toBeFocused();

  await expect(page.getByTestId("loading-button")).toHaveAttribute("aria-busy", "true");
  const spinnerAnimation = await page.locator(".app-button__spinner").evaluate((element) => getComputedStyle(element).animationName);
  expect(spinnerAnimation).toBe("none");
});

async function openPrimitiveGallery(page: Page, language: "en" | "fa", theme: "dark" | "light") {
  await page.setViewportSize({ width: 1280, height: 900 });
  await page.emulateMedia({ colorScheme: theme, reducedMotion: "reduce" });
  await page.route("**/ui-primitives-harness.html*", async (route) => {
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
        <script type="module" src="/tests/ui-primitives-harness.tsx"></script></body></html>`,
    });
  });
  await page.goto(`/ui-primitives-harness.html?language=${language}&theme=${theme}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("ui-primitives-gallery")).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", language);
  await expect(page.locator("html")).toHaveClass(theme === "light" ? /\btheme-light\b/u : /^(?!.*\btheme-light\b)/u);
  await page.evaluate(async () => document.fonts.ready);
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: true, scale: "css" as const };
}
