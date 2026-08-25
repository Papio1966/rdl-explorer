import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";

const routes = ["/", "/rdls", "/search?q=pump&source=all",
  "/intelligence", "/documents", "/cis", "/assistant", "/about", "/help"];

for (const route of routes) {
  test(`no serious or critical automated accessibility violations on ${route}`, async ({ page }) => {
    await page.goto(route);
    await expect(page.locator("main")).toBeVisible();
    const results = await new AxeBuilder({ page }).analyze();
    const blocking = results.violations.filter((violation) =>
      violation.impact === "serious" || violation.impact === "critical",
    );
    expect(blocking, blocking.map((v) => `${v.id}: ${v.help}`).join("\n")).toEqual([]);
  });
}

test("primary navigation and Assistant input are keyboard reachable", async ({ page }) => {
  await page.goto("/assistant");
  const input = page.getByPlaceholder("Ask about CFIHOS or what you can do in the Explorer…");
  await expect(input).toBeVisible();

  let reachedInput = false;
  for (let index = 0; index < 40; index += 1) {
    await page.keyboard.press("Tab");
    if (await input.evaluate((element) => element === document.activeElement)) {
      reachedInput = true;
      break;
    }
  }

  expect(reachedInput, "Assistant input should be reachable using keyboard Tab navigation").toBe(true);
  await expect(input).toBeFocused();
});
