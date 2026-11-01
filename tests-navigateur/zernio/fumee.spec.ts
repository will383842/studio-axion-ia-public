import { expect, test } from "@playwright/test";
import { seConnecter } from "../aides/demarrage";

test("fumée : connexion et page Réglages", async ({ page }) => {
  await seConnecter(page);
  await page.goto("/reglages");
  await expect(page.getByRole("heading", { name: "Connexions" }).first()).toBeVisible();
});
