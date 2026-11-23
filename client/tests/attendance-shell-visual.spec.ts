import { expect, test, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test("ATTENDANCE shared shell — desktop dark LTR", async ({ page }) => {
  await openAttendanceShell(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "employees" });
  await expect(page.getByTestId("route-header")).toHaveCount(0);
  await expect(page).toHaveScreenshot("attendance-shell-desktop-dark-ltr.png", screenshotOptions());
});

test("ATTENDANCE shared shell — desktop light RTL", async ({ page }) => {
  await openAttendanceShell(page, { viewport: DESKTOP_VIEWPORT, language: "fa", theme: "light", scenario: "employees" });
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page).toHaveScreenshot("attendance-shell-desktop-light-rtl.png", screenshotOptions());
});

test("ATTENDANCE shared shell — settings flyout", async ({ page }) => {
  await openAttendanceShell(page, { viewport: DESKTOP_VIEWPORT, language: "en", theme: "dark", scenario: "settings" });
  await page.getByTestId("main-nav-settings").hover();
  await expect(page.getByRole("menu", { name: "Settings" })).toBeVisible();
  await expect(page).toHaveScreenshot("attendance-shell-desktop-dark-settings.png", screenshotOptions());
});

test("ATTENDANCE shared shell — mobile dark LTR", async ({ page }) => {
  await openAttendanceShell(page, { viewport: MOBILE_VIEWPORT, language: "en", theme: "dark", scenario: "employees" });
  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("attendance-shell-mobile-dark-ltr.png", screenshotOptions());
});

type AttendanceShellOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario: "employees" | "settings";
}>;

async function openAttendanceShell(page: Page, options: AttendanceShellOptions) {
  await page.setViewportSize(options.viewport);
  await page.emulateMedia({ colorScheme: options.theme, reducedMotion: "reduce" });
  await page.addInitScript(
    ({ language, theme }) => {
      localStorage.setItem("i18nextLng", language);
      localStorage.setItem("ecs-theme", theme);
    },
    { language: options.language, theme: options.theme },
  );
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

  await page.goto(`/attendance-shell-visual-harness.html?scenario=${options.scenario}`, { waitUntil: "domcontentloaded" });
  await expect(page.getByTestId("attendance-shell-test-page")).toBeVisible();
  await expect(page.getByTestId("shared-app-shell")).toHaveAttribute("data-theme", options.theme);
  await page.addStyleTag({
    content: `
      *, *::before, *::after {
        animation-delay: 0s !important;
        animation-duration: 0s !important;
        caret-color: transparent !important;
        scroll-behavior: auto !important;
        transition-delay: 0s !important;
        transition-duration: 0s !important;
      }
    `,
  });
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all(Array.from(document.images).map(async (image) => {
      if (image.complete) return;
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }));
  });
}

function screenshotOptions() {
  return { animations: "disabled" as const, caret: "hide" as const, fullPage: false, scale: "css" as const };
}
