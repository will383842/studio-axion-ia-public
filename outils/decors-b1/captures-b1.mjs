// Captures 390 px du lot B1 (« Mes décors ») dans docs/captures/b1-decors/.
// Usage : E2E_MDP='…' node outils/decors-b1/captures-b1.mjs <url de base>
// Le mot de passe est lu UNIQUEMENT dans E2E_MDP (jamais écrit). Le studio tourne en essai (aucune clé) : la demande
// pose les photos de l'essai, le Look est simulé ; rien n'est payé.
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3174"] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "b1-decors");
if (!MDP) throw new Error("E2E_MDP manquant.");

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const capture = async (nom, plein = true) => {
  await page.waitForTimeout(1500);
  await page.screenshot({ path: join(SORTIE, `${nom}-390.png`), fullPage: plein });
  console.log(`capture : ${nom}-390.png`);
};

await page.goto(`${BASE}/connexion`, { waitUntil: "load", timeout: 180000 });
await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 }), page.getByRole("button", { name: "Entrer" }).click()]);

// 1. L'écran « Mes décors ».
await page.goto(`${BASE}/bibliotheque/decor`, { waitUntil: "load", timeout: 180000 });
await capture("mes-decors");

// 2. Un fond neutre ouvert : la vignette SUR le double.
await page.getByRole("button", { name: /^Lumière dorée/ }).first().click();
await capture("decor-sur-double", false);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// 3. Un décor réaliste : fabriqué avec le double au premier usage, coût affiché avant.
await page.getByRole("button", { name: /^Bibliothèque/ }).first().click();
await page.getByText(/Fabriqué avec votre double|n'existe pas encore/).first().waitFor({ timeout: 30000 });
await capture("decor-realiste-cout", false);
await page.keyboard.press("Escape");
await page.waitForTimeout(600);

// 4. « Demander un décor » : une phrase, le coût, puis 3 propositions sur le double.
await page.getByRole("button", { name: /Demander un décor/ }).first().click();
await page.getByRole("button", { name: "Un bureau en bois avec une bibliothèque" }).click();
await page.getByRole("button", { name: "Voir le coût" }).click();
await page.getByRole("button", { name: /Créer 3 propositions/ }).waitFor({ timeout: 30000 });
await capture("demande-cout", false);
await page.getByRole("button", { name: /Créer 3 propositions/ }).click();
await page.getByText("Choisissez-en un").first().waitFor({ timeout: 120000 });
await page.getByText("Choisissez-en un").first().scrollIntoViewIfNeeded();
await capture("demande-propositions", false);

// 5. Garder la première : les deux autres sont rangées.
await page.getByRole("button", { name: "Garder" }).first().click();
await page.getByText("Vos décors").first().waitFor({ timeout: 30000 });
await capture("demande-gardee");

await navigateur.close();
