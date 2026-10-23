// Captures 390 px du lot G4 (chaîne d'écriture et écrans) dans docs/captures/g4/.
// Usage : E2E_MDP='…' node outils/generateur/captures-g4.mjs http://localhost:3109
//   Serveur de développement SANS clé Claude (l'écriture est un essai, 0 €), lancé avec STUDIO_SIMULATION_LENTEUR_MS=1500
//   pour voir l'écran d'attente. Le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3109"] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "g4");
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

const MATIERES = [
  "Dans presque toutes les PME que nous voyons, une personne exporte, copie, colle et vérifie des fichiers Excel chaque jour, donc les erreurs passent sans que personne ne les voie.",
  "Une seule erreur de formule, et tous les chiffres sont faux.",
  "Beaucoup pensent que Excel ne coûte rien.",
  "Sauf si vos tableaux changent de forme chaque mois : gardez le tableur.",
  "Est-ce qu'on peut se passer de nos fichiers Excel sans tout casser ?",
  "Chaque lundi, il faut rassembler les chiffres de cinq fichiers Excel avant la réunion, et une cellule décalée fausse tout le reste.",
  "Je conseille de commencer par la liste des fichiers Excel que quelqu'un recopie à la main chaque semaine, puis de supprimer le premier.",
];

try {
  await page.goto(`${BASE}/connexion`, { waitUntil: "load" });
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 }), page.getByRole("button", { name: "Entrer" }).click()]);

  if (!process.env.SUJET) await etape("matières", async () => {
    await page.goto(`${BASE}/ecrire/matieres`, { waitUntil: "load" });
    await page.getByRole("button", { name: "Plusieurs" }).click();
    await page.getByLabel("Votre dictée").fill(MATIERES.join("\n"));
    await page.getByRole("button", { name: "Découper" }).click();
    await page.getByRole("button", { name: /Ranger les/ }).click();
    await pause(1500);
  });

  if (!process.env.SUJET) await etape("hors domaine", async () => {
    await page.goto(`${BASE}/ecrire/atelier`, { waitUntil: "load" });
    await page.getByPlaceholder("Dites ou tapez votre idée").fill("Comment contester un PV");
    await page.getByRole("button", { name: /Écrire · au plus/ }).click();
    await page.waitForURL(/\/ecrire\/sujets\//);
    await pause(1500);
    await capture("1-hors-du-domaine");
  });

  let sujet = process.env.SUJET ?? "";
  const debut = !process.env.SUJET;
  if (debut) await etape("sujet", async () => {
    await page.goto(`${BASE}/ecrire/atelier`, { waitUntil: "load" });
    await page.getByPlaceholder("Dites ou tapez votre idée").fill("Tous les fichiers Excel qu'une entreprise gère à la main, et qu'on peut presque tous remplacer");
    await pause(500);
    await capture("2-sujet");
    await page.getByRole("button", { name: /Écrire · au plus/ }).click();
    await page.waitForURL(/\/ecrire\/sujets\//);
    sujet = page.url();
    await pause(2500);
    await capture("3-ecriture-en-cours");
  });

  if (debut) await etape("résultat", async () => {
    for (let i = 0; i < 60 && !(await page.getByText("Détails").count()); i++) {
      await pause(3000);
      await page.goto(sujet, { waitUntil: "load" });
    }
    await pause(800);
    await capture("4-resultat");
    await page.locator("main li button[aria-expanded]").first().dispatchEvent("click");
    await pause(600);
    await capture("5-version-ouverte", true);
  });

  if (debut) await etape("détails", async () => {
    await page.goto(sujet, { waitUntil: "load" });
    await page.getByText("Détails").click();
    await pause(600);
    await page.getByText("Avis des juges").scrollIntoViewIfNeeded();
    await capture("6-details-juges");
  });

  await etape("je lis", async () => {
    await page.goto(sujet, { waitUntil: "load" });
    const jeLis = page.locator("button", { hasText: "Je lis" }).filter({ hasText: "au plus" });
    if (await jeLis.count()) {
      await jeLis.first().dispatchEvent("click");
      await pause(4000);
    }
    await page.goto(sujet, { waitUntil: "load" });
    for (let i = 0; i < 40 && !(await page.getByText("Lire sur un autre appareil").count()); i++) {
      await pause(3000);
      await page.goto(sujet, { waitUntil: "load" });
      const boutons = page.locator("main li button[aria-expanded]");
      const n = await boutons.count();
      for (let k = 0; k < n; k++) {
        await boutons.nth(k).dispatchEvent("click");
        await pause(200);
        if (await page.getByText("Lire sur un autre appareil").count()) break;
      }
    }
    await page.getByText("Lire sur un autre appareil").scrollIntoViewIfNeeded();
    await capture("7-je-lis");
    await page.getByText("Lire sur un autre appareil").first().dispatchEvent("click");
    await page.waitForURL(/\/lire\//);
    await pause(800);
    await capture("8-lire-autre-appareil");
  });

  await etape("fabriquer", async () => {
    await page.goto(sujet, { waitUntil: "load" });
    const juste = page.locator("button:visible", { hasText: "est juste" });
    if (await juste.count()) {
      await juste.first().click({ force: true });
      await pause(2500);
      await page.goto(sujet, { waitUntil: "load" });
    }
    const valider = page.locator("button:visible", { hasText: "Valider les" });
    if (await valider.count()) {
      await valider.first().click({ force: true });
      await pause(2000);
    }
    await page.goto(sujet, { waitUntil: "load" });
    await page.locator("main li button[aria-expanded]").first().dispatchEvent("click");
    await pause(500);
    await page.locator("main button:visible", { hasText: "Fabriquer" }).first().click();
    await pause(800);
    await capture("9-fabriquer");
  });
} finally {
  await navigateur.close();
}
console.log(erreurs ? `${erreurs} étape(s) en échec` : "Captures terminées.");
process.exit(erreurs ? 1 : 0);
