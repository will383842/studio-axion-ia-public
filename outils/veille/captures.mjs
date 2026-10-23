// Captures 390 px du lot B2 : page « Veille » (après une vraie vérification), une nouveauté ouverte, menu Plus,
// Réglages > Outils. Usage : E2E_MDP='…' node outils/veille/captures.mjs [url de base]
// (le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit). Sorties : docs/captures/veille/*.png
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3241";
const MDP = process.env.E2E_MDP;
if (!MDP) {
  console.error("E2E_MDP manquant.");
  process.exit(1);
}
const SORTIE = join(process.cwd(), "docs", "captures", "veille");
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, colorScheme: "light", locale: "fr-FR" });
await page.goto(`${BASE}/connexion`, { waitUntil: "load", timeout: 180000 });
await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30000 }), page.getByRole("button", { name: "Entrer" }).click()]);

// 1. Page « Veille », puis une vraie vérification (pages publiques, gratuit).
await page.goto(`${BASE}/veille`, { waitUntil: "load", timeout: 180000 });
await page.getByRole("button", { name: "Vérifier" }).click();
await page.waitForFunction(() => !document.body.innerText.includes("Jamais vérifiée"), null, { timeout: 120000 });
await page.waitForTimeout(1500);
// Seconde lecture aussitôt : aucune fausse nouveauté ne doit apparaître (pages relues à l'identique).
const avant = await page.locator("#titre-nouveautes").innerText();
await page.getByRole("button", { name: "Vérifier" }).click();
await page.waitForTimeout(8000);
console.log(`nouveautés après 1re lecture : « ${avant} » ; après 2e : « ${await page.locator("#titre-nouveautes").innerText()} »`);
await page.screenshot({ path: join(SORTIE, "veille-390.png"), fullPage: true });

// 2. Une nouveauté ouverte.
const premiere = page.locator("#titre-nouveautes").locator("xpath=..").getByRole("button").first();
if (await premiere.count()) {
  await premiere.click();
  await page.waitForTimeout(900);
  await page.screenshot({ path: join(SORTIE, "veille-nouveaute-390.png") });
  await page.keyboard.press("Escape");
}

// 3. Menu Plus (tuile « Veille ») et Réglages > Outils.
await page.goto(`${BASE}/`, { waitUntil: "load", timeout: 180000 });
await page.getByRole("navigation", { name: "Navigation" }).getByRole("button", { name: "Plus" }).click();
await page.waitForTimeout(2500);
await page.screenshot({ path: join(SORTIE, "menu-plus-390.png") });
await page.goto(`${BASE}/reglages#outils`, { waitUntil: "load", timeout: 180000 });
await page.waitForTimeout(2500);
await page.locator("#outils").screenshot({ path: join(SORTIE, "reglages-outils-390.png") });

// Contrôle : aucun défilement horizontal à 390 px.
await page.goto(`${BASE}/veille`, { waitUntil: "load", timeout: 180000 });
const debord = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
console.log(`débordement horizontal : ${debord} px`);
await navigateur.close();
