import { expect, test, type Page } from "@playwright/test";

const languages = ["en", "fa", "ps"] as const;

test.describe("localized date controls", () => {
  for (const language of languages) {
    test(`${language} preserves Gregorian values while localizing the picker`, async ({ page }) => {
      await openHarness(page, language);

      const dateInput = page.getByTestId("date-control").locator("input");
      const monthInput = page.getByTestId("month-control").locator("input");
      const dateTimeInput = page.getByTestId("datetime-control").locator("input");

      await expect(page.getByTestId("date-value")).toHaveText("2026-03-21");
      await expect(page.getByTestId("month-value")).toHaveText("2026-03");
      await expect(page.getByTestId("datetime-value")).toHaveText("2026-03-21T09:05");
      await expect(dateInput).toHaveValue(language === "en" ? "2026/03/21" : "۱۴۰۵/۰۱/۰۱");
      await expect(monthInput).toHaveValue(monthDisplay(language));
      await expect(dateTimeInput).toHaveValue(language === "en" ? "2026/03/21 09:05" : "۱۴۰۵/۰۱/۰۱ ۰۹:۰۵");

      await dateInput.click();
      const calendar = page.locator(".rmdp-calendar").last();
      await expect(calendar).toBeVisible();
      await expect(calendar.locator(".rmdp-header-values")).toContainText(language === "en" ? "March" : language === "fa" ? "حمل" : "وری");
      await calendar.locator(".rmdp-day:not(.rmdp-day-hidden)").filter({ hasText: language === "en" ? /^2$/ : /^۲$/ }).first().click();

      await expect(page.getByTestId("date-value")).toHaveText(language === "en" ? "2026-03-02" : "2026-03-22");
      await expect(dateInput).toHaveValue(language === "en" ? "2026/03/02" : "۱۴۰۵/۰۱/۰۲");
      await expect(page.locator("main")).toHaveAttribute("dir", language === "en" ? "ltr" : "rtl");
    });
  }
});

async function openHarness(page: Page, language: (typeof languages)[number]) {
  await page.route("**/date-localization-harness.html*", async (route) => {
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
        <script type="module" src="/tests/date-localization-harness.tsx"></script></body></html>`,
    });
  });
  await page.goto(`/date-localization-harness.html?locale=${language}`);
  await expect(page.getByTestId("date-control").locator("input")).not.toHaveAttribute("aria-busy", "true");
}

function monthDisplay(language: (typeof languages)[number]) {
  if (language === "fa") return "مارچ ۲۰۲۶";
  if (language === "ps") return "مارچ ۲۰۲۶";
  return "March 2026";
}
