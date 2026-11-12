/**
 * NAV · écran /contenus (L2-09), en SIMULATION : serveur de développement, aucune clé réelle, aucun réseau sortant.
 * Vérifie ce qui ne dépend pas des données : les 3 familles sont proposées, ?reseau=instagram est lu et l'adresse garde les
 * filtres, une valeur inconnue est ignorée, aucun mot interdit ni mot anglais. La capture va dans le dossier de résultats
 * du test (jamais dans le dépôt public).
 */
import { expect, test } from "@playwright/test";
import { motsAnglais, motsInterditsVisibles } from "./aides/controles";
import { seConnecter } from "./aides/demarrage";

test.describe("Tous mes contenus", () => {
  test.beforeEach(async ({ page }) => {
    await seConnecter(page);
  });

  test("les 3 familles sont affichées", async ({ page }) => {
    await page.goto("/contenus");
    const filtres = page.getByTestId("filtres-contenus");
    await expect(filtres).toBeVisible();
    for (const nom of ["Vidéos", "Images", "Carrousels"]) await expect(filtres.getByRole("link", { name: new RegExp(`^${nom}`) })).toBeVisible();
  });

  test("?reseau=instagram est lu ; choisir un type garde le réseau dans l'adresse", async ({ page }, info) => {
    await page.goto("/contenus?reseau=instagram");
    await expect(page.getByRole("heading", { name: "Tous mes contenus" })).toBeVisible();
    await page.getByTestId("filtres-contenus").getByRole("link", { name: /^Carrousels/ }).click();
    await expect(page).toHaveURL(/\/contenus\?reseau=instagram&type=carrousel$/);
    await page.screenshot({ path: info.outputPath("contenus.png"), fullPage: true });
  });

  test("une valeur inconnue est ignorée, la page reste utilisable", async ({ page }) => {
    const r = await page.goto("/contenus?reseau=inconnu&type=zzz&page=-4");
    expect(r?.status()).toBe(200);
    await expect(page.getByTestId("filtres-contenus")).toBeVisible();
  });

  test("aucun mot interdit ni mot anglais à l'écran", async ({ page }) => {
    await page.goto("/contenus");
    await expect(page.getByTestId("filtres-contenus")).toBeVisible();
    expect(await motsInterditsVisibles(page)).toEqual([]);
    expect(await motsAnglais(page)).toEqual([]);
  });
});
