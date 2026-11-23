import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";

const SERVER_ROOT = fileURLToPath(new URL("../../server", import.meta.url));
const FIXTURE_SCRIPT = fileURLToPath(
  new URL("../../server/dist/modules/expenses/expense-audit.browser.fixture.js", import.meta.url)
);
const LIVE_APP_URL = process.env["EXPENSE_AUDIT_LIVE_APP_URL"] ?? "http://localhost:5173";

type SetupFixture = {
  token: string;
  username: string;
  actorName: string;
  adminId: string;
  sessionId: string;
  cookieName: string;
  categoryId: string;
  reference: string;
  vendorName: string;
  notes: string;
  amount: number;
};

type VerifiedFixture = {
  expenseId: string;
  reversalId: string;
  createdAuditId: string;
  reversedAuditId: string;
};

test("creates and reverses an expense in the live UI, then reconciles its real audit records", async ({ page, context }) => {
  const fixture = runFixture<SetupFixture>("setup");
  try {
    await context.addCookies([
      {
        name: fixture.cookieName,
        value: fixture.token,
        url: "http://localhost:4000",
        httpOnly: true,
        sameSite: "Lax",
      },
    ]);
    await page.addInitScript(() => {
      window.localStorage.setItem("i18nextLng", "en");
      window.localStorage.setItem("ecs-theme", "light");
    });

    await page.goto(`${LIVE_APP_URL}/payments/expenses`);
    await expect(page.getByTestId("expenses-create-open")).toBeVisible();
    await page.getByTestId("expenses-create-open").click();
    const dialog = page.getByRole("dialog", { name: "New expense entry" });
    await expect(dialog).toBeVisible();
    await page.getByTestId("expenses-create-category").selectOption(fixture.categoryId);
    await page.getByTestId("expenses-create-amount").fill(String(fixture.amount));
    await dialog.getByLabel("Vendor").fill(fixture.vendorName);
    await dialog.getByLabel("Reference").fill(fixture.reference);
    await dialog.getByLabel("Notes").fill(fixture.notes);

    const createdResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === "/api/v1/expenses" && response.request().method() === "POST";
    });
    await page.getByTestId("expenses-create-submit").click();
    const createdResponse = await createdResponsePromise;
    expect(createdResponse.status()).toBe(201);
    const created = await createdResponse.json() as { id: string; reference: string; status: string };
    expect(created.reference).toBe(fixture.reference);
    expect(created.status).toBe("POSTED");
    await expect(dialog).toHaveCount(0);

    const expenseRow = page.getByRole("row").filter({
      has: page.getByRole("cell", { name: fixture.reference, exact: true }),
    });
    await expect(expenseRow).toBeVisible();
    await expect(expenseRow).toContainText("Posted");
    page.once("dialog", (prompt) => prompt.accept("Live browser audit verification"));
    const reversedResponsePromise = page.waitForResponse((response) => {
      const url = new URL(response.url());
      return url.pathname === `/api/v1/expenses/${created.id}/reverse` && response.request().method() === "POST";
    });
    await expenseRow.getByRole("button", { name: "Reverse" }).click();
    const reversedResponse = await reversedResponsePromise;
    expect(reversedResponse.status()).toBe(201);
    const reversed = await reversedResponse.json() as {
      original: { id: string; status: string };
      reversal: { id: string; amount: number; reversalOfExpenseId: string };
    };
    expect(reversed.original.id).toBe(created.id);
    expect(reversed.original.status).toBe("REVERSED");
    expect(reversed.reversal.amount).toBe(-fixture.amount);
    expect(reversed.reversal.reversalOfExpenseId).toBe(created.id);
    await expect(expenseRow).toContainText("Reversed");

    const verified = runFixture<VerifiedFixture>(
      "verify",
      fixture.adminId,
      fixture.sessionId,
      fixture.reference,
      String(fixture.amount)
    );
    expect(verified.expenseId).toBe(created.id);
    expect(verified.reversalId).toBe(reversed.reversal.id);

    await page.goto(`${LIVE_APP_URL}/settings/audit-logs`);
    const createdAuditRow = page.getByTestId(`audit-log-row-${verified.createdAuditId}`);
    const reversedAuditRow = page.getByTestId(`audit-log-row-${verified.reversedAuditId}`);
    await expect(createdAuditRow).toBeVisible();
    await expect(createdAuditRow).toContainText(fixture.actorName);
    await expect(createdAuditRow).toContainText("Expense");
    await expect(createdAuditRow).toContainText("Created");
    await expect(createdAuditRow).toContainText("expense.created");
    await expect(reversedAuditRow).toBeVisible();
    await expect(reversedAuditRow).toContainText(fixture.actorName);
    await expect(reversedAuditRow).toContainText("Expense");
    await expect(reversedAuditRow).toContainText("Reversed");
    await expect(reversedAuditRow).toContainText("expense.reversed");

    await page.getByTestId(`audit-log-view-${verified.reversedAuditId}`).click();
    const auditModal = page.getByTestId("audit-log-detail-modal");
    await expect(auditModal).toBeVisible();
    await expect(auditModal).toContainText(created.id);
    await expect(auditModal).toContainText(reversed.reversal.id);
    await expect(auditModal).toContainText("POSTED");
    await expect(auditModal).toContainText("REVERSED");
    await expect(auditModal).not.toContainText(fixture.vendorName);
    await expect(auditModal).not.toContainText(fixture.notes);
  } finally {
    const cleanup = runFixture<{ cleaned: boolean; leftovers: number[] }>(
      "cleanup",
      fixture.adminId,
      fixture.sessionId,
      fixture.reference
    );
    expect(cleanup.cleaned).toBe(true);
    expect(cleanup.leftovers).toEqual([0, 0, 0, 0, 0]);
  }
});

function runFixture<T>(...args: string[]) {
  const output = execFileSync(process.execPath, [FIXTURE_SCRIPT, ...args], {
    cwd: SERVER_ROOT,
    encoding: "utf8",
    env: process.env,
  });
  const marker = "EXPENSE_AUDIT_BROWSER_FIXTURE:";
  const line = output
    .split(/\r?\n/u)
    .find((candidate) => candidate.startsWith(marker));
  if (!line) throw new Error(`Expense browser fixture returned no JSON payload:\n${output}`);
  return JSON.parse(line.slice(marker.length)) as T;
}
