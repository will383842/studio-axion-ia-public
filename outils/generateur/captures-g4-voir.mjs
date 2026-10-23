// Aide de mise au point des captures G4 : capture pleine page d'une adresse (connexion d'abord). E2E_MDP requis.
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3109", chemin = "/ecrire", nom = "voir"] = process.argv;
const navigateur = await chromium.launch();
const page = await (await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, locale: "fr-FR", colorScheme: "dark" })).newPage();
page.setDefaultTimeout(120000);
await page.goto(`${BASE}/connexion`);
await page.getByLabel("Mot de passe", { exact: true }).fill(process.env.E2E_MDP ?? "");
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion")), page.getByRole("button", { name: "Entrer" }).click()]);
if (chemin.startsWith("lien:")) {
  await page.goto(`${BASE}/ecrire`, { waitUntil: "load" });
  await page.getByText(chemin.slice(5), { exact: true }).first().click();
  await page.waitForURL(/\/ecrire\/sujets\//);
} else await page.goto(`${BASE}${chemin}`, { waitUntil: "load" });
await page.waitForTimeout(1500);
if (process.env.CLIC) {
  const b = page.locator("button", { hasText: process.env.CLIC });
  console.log("boutons :", await b.count());
  await b.first().click({ force: true });
  await page.waitForTimeout(4000);
}
const sortie = join(process.env.SORTIE_VOIR ?? process.cwd(), `${nom}.png`);
await page.screenshot({ path: sortie, fullPage: true });
console.log(sortie, page.url());
console.log((await page.locator("main").innerText()).slice(0, 3000));
await navigateur.close();
