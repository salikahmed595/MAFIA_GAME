import { test, expect } from "@playwright/test";
test.beforeEach(async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
});
test("home, room forms and settings persist across refresh", async ({
  page,
}) => {
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "A quiet town. A deadly secret." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Join a room", exact: true }).click();
  await expect(page.getByLabel("Room code", { exact: true })).toBeVisible();
  await page.getByLabel("Room code", { exact: true }).fill("abc123");
  await expect(page.getByLabel("Room code", { exact: true })).toHaveValue(
    "ABC123",
  );
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await page.getByLabel("Music volume").fill("67");
  await page.getByLabel("Scene animation").uncheck();
  await page.getByRole("button", { name: "Close dialog" }).click();
  await page.reload();
  await page.getByRole("button", { name: "Settings", exact: true }).click();
  await expect(page.getByLabel("Music volume")).toHaveValue("67");
  await expect(page.getByLabel("Scene animation")).not.toBeChecked();
  await page.keyboard.press("Escape");
  await expect(page.getByRole("dialog")).toHaveCount(0);
});
test("practice role, investigation, voting and restart are playable", async ({
  page,
}) => {
  await page.addInitScript(() => {
    let seed = 391;
    Math.random = () => {
      seed = (seed * 16807) % 2147483647;
      return (seed - 1) / 2147483646;
    };
  });
  await page.goto("/practice");
  await page.getByRole("button", { name: "Reveal role" }).click();
  await expect(
    page.getByRole("heading", { name: "Detective", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: /Vivian/ }).click();
  await page.getByRole("button", { name: "Confirm choice" }).click();
  await expect(page.getByText("Vivian is Mafia.")).toBeVisible();
  await page.getByRole("button", { name: "Advance practice phase" }).click();
  await expect(
    page.getByRole("heading", { name: "Someone knows something." }),
  ).toBeVisible();
  await page.getByRole("button", { name: "Advance practice phase" }).click();
  await expect(
    page.getByRole("heading", { name: "Make your accusation." }),
  ).toBeVisible();
  for (let i = 0; i < 35; i++) {
    if (await page.getByRole("button", { name: "Play again" }).isVisible())
      break;
    await page.getByRole("button", { name: "Advance practice phase" }).click();
  }
  await expect(page.getByRole("button", { name: "Play again" })).toBeVisible();
  await page.getByRole("button", { name: "Play again" }).click();
  await expect(
    page.getByRole("heading", { name: "The town falls silent." }),
  ).toBeVisible();
});
test("deep link joins correct room and layouts fit the viewport", async ({
  page,
}) => {
  await page.goto("/room/ABC123");
  await expect(page.getByText("ABC123", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Your nickname")).toBeVisible();
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "Join the council" }),
  ).toBeVisible();
  await page.goto("/");
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);
  await expect(page.locator("canvas")).toBeVisible();
  await expect(page.getByText("Building Blackthorn…")).toHaveCount(0);
  await page.screenshot({
    path: `test-results/home-${test.info().project.name}.png`,
    fullPage: true,
  });
});
