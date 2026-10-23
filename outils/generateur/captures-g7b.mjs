// Captures 390 px du lot G7b (« Ce qui marche ») dans docs/captures/g7b/.
// Usage : E2E_MDP='…' node outils/generateur/captures-g7b.mjs http://localhost:3111
//   Serveur de développement lancé avec STUDIO_APERCU_MESURES=1 (exemples de démonstration, jamais en production).
//   Le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3111"] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "g7b");
if (!MDP) {
  console.error("E2E_MDP manquant.");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", colorScheme: "dark", reducedMotion: "reduce" });
const page = await contexte.newPage();
page.setDefaultTimeout(120000);
page.setDefaultNavigationTimeout(180000);
const pause = (ms) => page.waitForTimeout(ms);
const capture = async (nom, pleine = false) => {
  await page.screenshot({ path: join(SORTIE, `${nom}-390.png`), fullPage: pleine });
  console.log(`✓ ${nom}-390.png`);
};
let erreurs = 0;
const etape = async (nom, f) => {
  try {
    await f();
  } catch (e) {
    erreurs++;
    console.error(`✗ ${nom} : ${String(e.message).split("\n")[0]}`);
  }
};

try {
  await page.goto(`${BASE}/connexion`, { waitUntil: "load" });
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 }), page.getByRole("button", { name: "Entrer" }).click()]);

  await etape("mesures", async () => {
    await page.goto(`${BASE}/mesures`, { waitUntil: "load" });
    await pause(800);
    await capture("1-mesures-lien-ce-qui-marche");
  });

  await etape("ce qui marche", async () => {
    await page.goto(`${BASE}/mesures/ce-qui-marche`, { waitUntil: "load" });
    await page.getByText("Classement").waitFor();
    await pause(800);
    await capture("2-ce-qui-marche");
    await capture("3-ce-qui-marche-page-entiere", true);
  });

  await etape("détail d'un rang", async () => {
    await page.locator("section[aria-labelledby='titre-classement'] li button").first().click();
    await pause(400);
    await capture("4-detail-rang");
  });

  await etape("autre réseau", async () => {
    await page.getByRole("tab", { name: /LinkedIn/i }).click();
    await pause(400);
    await page.locator("#titre-classement").scrollIntoViewIfNeeded();
    await capture("5-classement-linkedin");
  });

  await etape("ouverture", async () => {
    await page.getByRole("tab", { name: "Ouverture" }).click();
    await page.locator("#titre-devant").scrollIntoViewIfNeeded();
    await pause(400);
    await capture("6-ce-qui-revient-devant-ouverture");
  });

  await etape("5 plus proches", async () => {
    await page.locator("section[aria-labelledby='titre-avant'] li button").first().click();
    await page.locator("#titre-avant").scrollIntoViewIfNeeded();
    await pause(400);
    await capture("7-avant-de-publier-5-plus-proches");
  });

  await etape("mettre à jour", async () => {
    await page.evaluate(() => window.scrollTo(0, 0));
    await page.getByRole("button", { name: /Mettre à jour/ }).click();
    await page.getByText(/Essai|relevé|Rien de nouveau/).first().waitFor({ timeout: 30000 });
    await pause(300);
    await capture("8-mise-a-jour");
  });

  // Débordement horizontal à 390 px : aucun.
  await etape("débordement", async () => {
    const large = await page.evaluate(() => document.documentElement.scrollWidth);
    if (large > 390) throw new Error(`débordement : ${large} px`);
    console.log(`✓ largeur ${large} px`);
  });
} finally {
  await navigateur.close();
}
process.exit(erreurs ? 1 : 0);
