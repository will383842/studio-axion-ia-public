// Captures 390 px du lot D2 (crédits et clés, voix par format) dans docs/captures/d2-credits/.
// Usage : E2E_MDP='…' node outils/credits/captures-d2.mjs <url de base> <reglages|feuille>
//   (le mot de passe est lu UNIQUEMENT dans la variable d'environnement E2E_MDP, jamais écrit nulle part)
//   « reglages » : Connexions (Tester), Crédits, carte de l'Accueil, voix par format — serveur avec la clé HeyGen réelle.
//   « feuille »  : feuille « Crédit HeyGen insuffisant » — serveur local lancé avec CREDITS_ESSAI="heygen=1" (solde
//                  d'essai de 0,01 $ : le pré-vol bloque AVANT tout appel payant ; rien n'est confirmé).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3262", serie = "reglages"] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "d2-credits");
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
const capture = async (nom, cible) => {
  const chemin = join(SORTIE, `${nom}-390.png`);
  if (cible) {
    // Fenêtre haute le temps de la capture : l'élément tient en entier (largeur 390 inchangée).
    await page.setViewportSize({ width: 390, height: 3000 });
    await pause(500);
    await cible.screenshot({ path: chemin });
    await page.setViewportSize({ width: 390, height: 844 });
  }
  else await page.screenshot({ path: chemin });
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

  if (serie === "reglages") {
    await etape("connexions", async () => {
      await page.goto(`${BASE}/reglages#connexions`, { waitUntil: "load" });
      await pause(800);
      await page.locator("#connexions").getByRole("button", { name: "Tester" }).first().click();
      await page.getByText(/Acceptée ·/).first().waitFor({ timeout: 30000 });
      await pause(800);
      await capture("connexions", page.locator("#connexions"));
    });
    await etape("credits", async () => {
      await page.goto(`${BASE}/reglages#credits`, { waitUntil: "load" });
      await pause(800);
      await capture("credits", page.locator("#credits"));
    });
    await etape("accueil", async () => {
      await page.goto(`${BASE}/`, { waitUntil: "load" });
      await pause(800);
      const carte = page.locator('a[href="/reglages#credits"]').first();
      await carte.scrollIntoViewIfNeeded();
      await capture("accueil-carte-credits", carte);
    });
    await etape("voix par format", async () => {
      await page.goto(`${BASE}/personnages/p-will?onglet=voix`, { waitUntil: "load" });
      await pause(800);
      const section = page.locator('section[aria-labelledby="voix-par-format"]');
      await section.scrollIntoViewIfNeeded();
      await capture("voix-par-format", section);
      await section.getByRole("button", { name: /Vidéo type avocat/ }).click();
      await pause(900);
      await capture("voix-par-format-feuille");
    });
  } else {
    await etape("relier la voix HeyGen (lecture gratuite des voix)", async () => {
      await page.goto(`${BASE}/personnages/p-will?onglet=voix`, { waitUntil: "load" });
      await pause(800);
      await page.getByRole("button", { name: /Relier ma voix HeyGen/ }).first().click();
      await page.getByRole("button", { name: "Choisir" }).first().click({ timeout: 30000 });
      await pause(2500);
    });
    await etape("voix par format (après le lien)", async () => {
      await page.goto(`${BASE}/personnages/p-will?onglet=voix`, { waitUntil: "load" });
      await pause(800);
      const section = page.locator('section[aria-labelledby="voix-par-format"]');
      await section.getByRole("button", { name: /Vidéo type avocat/ }).click();
      await pause(700);
      await page.getByRole("radio", { name: /Ma voix HeyGen/ }).last().click();
      await pause(1500);
      await capture("voix-par-format-choisie", section);
    });
    await etape("feuille crédit insuffisant", async () => {
      await page.goto(`${BASE}/nouvelle/avocat?script=script-2`, { waitUntil: "load" });
      await page.getByRole("button", { name: /^Voix :/ }).first().waitFor();
      await capture("votre-video-voix-du-format");
      await page.getByRole("button", { name: /^Fabriquer · / }).first().waitFor({ timeout: 60000 });
      await page.getByRole("button", { name: /^Fabriquer/ }).first().click();
      await pause(1500);
      // Une confirmation habituelle (plus cher, à vérifier) peut précéder le pré-vol : il bloque de toute façon.
      const confirmer = page.getByRole("button", { name: "Confirmer et fabriquer" });
      if (await confirmer.isVisible().catch(() => false)) {
        await confirmer.click();
        await pause(1500);
      }
      await page.getByText(/Crédit HeyGen insuffisant/).first().waitFor({ timeout: 30000 });
      await pause(700);
      await capture("feuille-credit-insuffisant");
    });
  }
} finally {
  await navigateur.close();
}
process.exit(erreurs ? 1 : 0);
