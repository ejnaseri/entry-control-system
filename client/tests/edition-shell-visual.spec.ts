import { expect, test, type Page } from "@playwright/test";

const DESKTOP_VIEWPORT = { width: 1440, height: 900 } as const;
const MOBILE_VIEWPORT = { width: 390, height: 844 } as const;

test("FULL shell visual baseline — desktop dark LTR expanded", async ({ page }) => {
  await openFullShell(page, {
    viewport: DESKTOP_VIEWPORT,
    language: "en",
    theme: "dark",
    scenario: "full",
  });

  await expect(page).toHaveScreenshot("full-shell-desktop-dark-ltr-expanded.png", screenshotOptions());
});

test("FULL shell visual baseline — desktop dark LTR collapsed", async ({ page }) => {
  await openFullShell(page, {
    viewport: DESKTOP_VIEWPORT,
    language: "en",
    theme: "dark",
    scenario: "full",
  });

  await page.locator("aside > button").click();
  await expect(page.locator("aside")).toHaveClass(/\bw-11\b/u);
  await expect(page).toHaveScreenshot("full-shell-desktop-dark-ltr-collapsed.png", screenshotOptions());
});

test("FULL shell visual baseline — desktop dark settings flyout", async ({ page }) => {
  await openFullShell(page, {
    viewport: DESKTOP_VIEWPORT,
    language: "en",
    theme: "dark",
    scenario: "settings",
  });

  await page.getByTestId("main-nav-settings").hover();
  await expect(page.getByRole("menu", { name: "Settings" })).toBeVisible();
  await expect(page).toHaveScreenshot("full-shell-desktop-dark-settings-flyout.png", screenshotOptions());
});

test("FULL shell visual baseline — desktop light RTL expanded", async ({ page }) => {
  await openFullShell(page, {
    viewport: DESKTOP_VIEWPORT,
    language: "fa",
    theme: "light",
    scenario: "full",
  });

  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", "rtl");
  await expect(page.locator("html")).toHaveClass(/\btheme-light\b/u);
  await expect(page).toHaveScreenshot("full-shell-desktop-light-rtl-expanded.png", screenshotOptions());
});

test("FULL shell visual baseline — mobile dark LTR", async ({ page }) => {
  await openFullShell(page, {
    viewport: MOBILE_VIEWPORT,
    language: "en",
    theme: "dark",
    scenario: "full",
  });

  await expect(page.locator("aside")).toBeHidden();
  await expect(page).toHaveScreenshot("full-shell-mobile-dark-ltr.png", screenshotOptions());
});

type FullShellOptions = Readonly<{
  viewport: Readonly<{ width: number; height: number }>;
  language: "en" | "fa";
  theme: "dark" | "light";
  scenario: "full" | "settings";
}>;

async function openFullShell(page: Page, options: FullShellOptions) {
  await page.setViewportSize(options.viewport);
  await page.emulateMedia({ colorScheme: options.theme, reducedMotion: "reduce" });
  await page.addInitScript(
    ({ language, theme }) => {
      localStorage.setItem("i18nextLng", language);
      localStorage.setItem("ecs-theme", theme);
    },
    { language: options.language, theme: options.theme },
  );

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
      await route.fulfill({
        json: { id: "sounds", enabled: false, accessAllowedVolume: 70, accessDeniedVolume: 70, alertVolume: 70 },
      });
      return;
    }
    if (path === "/api/v1/inbox/unread-count") {
      await route.fulfill({ json: { alerts: 0, deviceFeed: 0, total: 0 } });
      return;
    }
    await route.fulfill({ json: {} });
  });

  await page.goto(`/navigation-surface-harness.html?scenario=${options.scenario}`, {
    waitUntil: "domcontentloaded",
  });
  await expect(page.getByTestId("navigation-test-page")).toBeVisible();
  await expect(page.locator(".dashboard-shell")).toHaveAttribute("dir", options.language === "fa" ? "rtl" : "ltr");
  await expect(page.locator("html")).toHaveClass(options.theme === "light" ? /\btheme-light\b/u : /^(?!.*\btheme-light\b)/u);
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
    const images = Array.from(document.images);
    await Promise.all(images.map(async (image) => {
      if (image.complete) return;
      await new Promise<void>((resolve) => {
        image.addEventListener("load", () => resolve(), { once: true });
        image.addEventListener("error", () => resolve(), { once: true });
      });
    }));
  });
}

function screenshotOptions() {
  return {
    animations: "disabled" as const,
    caret: "hide" as const,
    fullPage: false,
    scale: "css" as const,
  };
}
