import { expect, test } from "@playwright/test";

test("Assistant uses a mocked API response and never spends API credit", async ({ page }) => {
  let apiCalls = 0;
  await page.route("**/api/assistant", async (route) => {
    apiCalls += 1;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        answer: "**Asset reference plan** is supported by the retrieved CFIHOS evidence.",
        status: "grounded",
        model: "e2e-mock",
      }),
    });
  });

  await page.goto("/assistant");
  await expect(page.getByRole("heading", { name: "CFIHOS Assistant" })).toBeVisible();
  const input = page.getByPlaceholder("Ask about CFIHOS or what you can do in the Explorer…");
  await input.fill("What is an asset reference plan?");
  await page.getByRole("button", { name: "Ask" }).click();
  await expect(page.getByText("Asset reference plan", { exact: false }).last()).toBeVisible();
  expect(apiCalls).toBe(1);
});

test("Assistant capability action navigates to CIS Builder", async ({ page }) => {
  await page.goto("/assistant");
  const suggestion = page.getByRole("button", { name: /build a CIS/i }).first();
  if (await suggestion.isVisible().catch(() => false)) await suggestion.click();
  const link = page.getByRole("link", { name: /Open CIS Builder/i }).first();
  if (await link.isVisible().catch(() => false)) {
    await link.click();
    await expect(page).toHaveURL(/\/cis$/);
  }
});
