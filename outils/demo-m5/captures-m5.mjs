// Captures 390 px du lot A2 (« Mes images », cascade à l'Aperçu) dans docs/captures/m5-demo/.
// Usage : E2E_MDP='…' node outils/demo-m5/captures-m5.mjs <url de base> <dossier des images à déposer> [étapes…]
// Le mot de passe est lu UNIQUEMENT dans E2E_MDP (jamais écrit). Étapes : import, validation, apercu.
import { readdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3172", DOSSIER, ...etapes] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "m5-demo");
if (!MDP) throw new Error("E2E_MDP manquant.");
const faire = (e) => !etapes.length || etapes.includes(e);

const navigateur = await chromium.launch();
const page = await navigateur.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, hasTouch: true, isMobile: true });
const capture = async (nom, plein = true) => {
  await page.waitForTimeout(2000);
  await page.screenshot({ path: join(SORTIE, `${nom}-390.png`), fullPage: plein });
  console.log(`capture : ${nom}-390.png`);
};

await page.goto(`${BASE}/connexion`, { waitUntil: "load" });
await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30000 }), page.getByRole("button", { name: "Entrer" }).click()]);

if (faire("import") && DOSSIER) {
  await page.goto(`${BASE}/bibliotheque/mes-images?ajouter=1`, { waitUntil: "load" });
  await page.waitForTimeout(800);
  await capture("mes-images-ajouter", false);
  const fichiers = readdirSync(DOSSIER).map((f) => join(DOSSIER, f));
  await page.locator('input[type="file"][accept="image/*,video/*"]').first().setInputFiles(fichiers);
  await page.getByText(/rangée/).first().waitFor({ timeout: 60000 });
}

if (faire("validation")) {
  await page.goto(`${BASE}/bibliotheque/mes-images`, { waitUntil: "load", timeout: 120000 });
  await capture("mes-images");
  await page.getByRole("button", { name: /à vérifier/ }).first().click();
  await page.waitForTimeout(900);
  await capture("mes-images-validation", false);
  for (let i = 0; i < 12; i++) {
    if (await page.getByText("Tout est vu").count()) break;
    const accord = page.getByText("Accord de la personne visible");
    if (await accord.count()) {
      await capture("mes-images-validation-accord", false);
      await accord.first().click();
    }
    await page.getByRole("button", { name: /OK, prête|Enregistrer/ }).first().click();
    await page.waitForTimeout(1200);
  }
  await capture("mes-images-validation-fin", false);
  await page.goto(`${BASE}/bibliotheque/mes-images`, { waitUntil: "load" });
  await capture("mes-images-pretes");
}

/** Feuille « Coût » de l'écran « Votre vidéo » (l'Aperçu du format avocat) pour un script de démonstration. */
async function cout(nom, script) {
  await page.goto(`${BASE}/nouvelle/avocat?script=${script}`, { waitUntil: "load" });
  await page.getByRole("button", { name: /^Coût :/ }).first().click();
  await page.getByText("Illustrations").first().waitFor({ timeout: 120000 });
  await page.waitForTimeout(1500);
  await capture(nom, false);
}

async function archiver(nom) {
  await page.goto(`${BASE}/bibliotheque/illustration-image`, { waitUntil: "load" });
  await page.getByRole("button", { name: nom }).first().click();
  await page.getByRole("button", { name: /Archiver|Ranger/ }).first().click();
  await page.waitForTimeout(500);
  await page.getByRole("button", { name: /Archiver|Ranger/ }).last().click(); // confirmation
  await page.waitForTimeout(1200);
}

if (faire("apercu1")) await cout("apercu-mes-images-reutilisee", "script-ref-avocat-1");

if (faire("apercu")) {
  // 1. Mes images + réutilisée (0 €) — étape « apercu1 » (un serveur neuf : l'Aperçu d'un brouillon est gardé).
  // 2. Sans « Tribunal vide » ni « Salle de réunion » dans la Bibliothèque : à fabriquer, puis banque gratuite.
  await archiver("Tribunal vide");
  await archiver("Salle de réunion");
  await cout("apercu-a-fabriquer", "script-ref-avocat-1");
  await cout("apercu-banque", "script-ref-avocat-2");
}

await navigateur.close();
