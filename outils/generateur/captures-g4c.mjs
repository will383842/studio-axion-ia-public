// Captures 390 px du lot G4c (tournage : « Enregistrer ici », séance) dans docs/captures/g4c/.
// Usage : E2E_MDP='…' node outils/generateur/captures-g4c.mjs http://localhost:3110
//   Serveur de développement SANS clé Claude (écriture en essai, 0 €). La caméra est la caméra d'essai de Chromium
//   (--use-fake-device-for-media-stream). Le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3110"] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "g4c");
if (!MDP) {
  console.error("E2E_MDP manquant.");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });

const navigateur = await chromium.launch({ args: ["--use-fake-device-for-media-stream", "--use-fake-ui-for-media-stream"] });
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", colorScheme: "dark", permissions: ["camera", "microphone"] });
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
    if (process.env.CAPTURES_DEBUG) await page.screenshot({ path: join(process.env.CAPTURES_DEBUG, `echec-${erreurs}.png`) }).catch(() => undefined);
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
const IDEES = [
  "Tous les fichiers Excel qu'une entreprise gère à la main, et qu'on peut presque tous remplacer",
  "Une personne qui passe ses semaines à recopier des données dans des tableurs, et ce que ça coûte",
  "La réunion du lundi préparée en rassemblant cinq fichiers Excel à la main",
];

/** Écrit un sujet « Je lis » (essai, 0 €), puis valide sa limite et ses versions. Renvoie l'adresse du sujet. */
async function sujetJeLis(idee) {
  await page.goto(`${BASE}/ecrire/atelier`, { waitUntil: "load" });
  await page.getByPlaceholder("Dites ou tapez votre idée").fill(idee);
  await page.getByRole("button", { name: /Qui parle/ }).click();
  await page.getByRole("dialog").getByText("Je lis", { exact: true }).click();
  await pause(400);
  if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  await page.getByRole("button", { name: /Écrire · au plus/ }).click();
  await page.waitForURL(/\/ecrire\/sujets\//);
  const sujet = page.url();
  for (let i = 0; i < 60 && !(await page.getByText("Détails").count()); i++) {
    await pause(2000);
    await page.goto(sujet, { waitUntil: "load" });
  }
  // La limite d'abord (« C'est juste »), puis « Valider les N » ; on recharge entre deux gestes.
  for (let i = 0; i < 8; i++) {
    await pause(1500);
    await page.goto(sujet, { waitUntil: "load" });
    await pause(800);
    const juste = page.getByRole("button", { name: /est juste/ });
    const valider = page.getByRole("button", { name: /Valider les/ });
    if (await juste.count()) await juste.first().click();
    else if ((await valider.count()) && (await valider.first().isEnabled())) await valider.first().click();
    else if (await page.getByText("Limite validée").count()) break;
  }
  if (process.env.CAPTURES_DEBUG) await page.screenshot({ path: join(process.env.CAPTURES_DEBUG, `sujet-${Date.now()}.png`), fullPage: true });
  return sujet;
}

/** Une prise : compte à rebours, quelques secondes, arrêt, « Garder ». */
async function filmerUnePrise(secondes) {
  await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).click();
  await pause(3200 + secondes * 1000);
  await page.getByRole("dialog").getByRole("button", { name: "Arrêter" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Garder" }).waitFor();
  await pause(600);
  await page.getByRole("dialog").getByRole("button", { name: "Garder" }).click();
}

try {
  await page.goto(`${BASE}/connexion`, { waitUntil: "load" });
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 }), page.getByRole("button", { name: "Entrer" }).click()]);

  if (!process.env.DEJA_ECRITS) await etape("matières", async () => {
    await page.goto(`${BASE}/ecrire/matieres`, { waitUntil: "load" });
    await page.getByRole("button", { name: "Plusieurs" }).click();
    await page.getByLabel("Votre dictée").fill(MATIERES.join("\n"));
    await page.getByRole("button", { name: "Découper" }).click();
    await page.getByRole("button", { name: /Ranger les/ }).click();
    await pause(1500);
  });

  const sujets = [];
  if (!process.env.DEJA_ECRITS) for (const idee of IDEES) await etape(`sujet « ${idee.slice(0, 20)}… »`, async () => sujets.push(await sujetJeLis(idee)));

  await etape("fiche sujet : Filmer ici", async () => {
    if (!sujets.length) {
      await page.goto(`${BASE}/ecrire`, { waitUntil: "load" });
      const liens = await page.locator("a[href^='/ecrire/sujets/']").evaluateAll((a) => a.map((x) => x.getAttribute("href")));
      sujets.push(`${BASE}${liens.at(-1)}`);
    }
    await page.goto(sujets[0], { waitUntil: "load" });
    await pause(1000);
    const boutons = page.locator("main li button[aria-expanded]");
    const n = await boutons.count();
    for (let k = 0; k < n && !(await page.getByText("Filmer ici").count()); k++) {
      await boutons.nth(k).dispatchEvent("click");
      await pause(300);
    }
    await page.getByText("Filmer ici").first().scrollIntoViewIfNeeded();
    await capture("1-fiche-filmer-ici");
  });

  await etape("choix de la séance", async () => {
    await page.goto(`${BASE}/ecrire/tournage`, { waitUntil: "load" });
    await pause(600);
    // Une version par sujet (la première de chaque carte).
    const cartes = page.locator("main ul > li");
    const n = Math.min(3, await cartes.count());
    for (let k = 0; k < n; k++) await cartes.nth(k).locator("button[aria-pressed]").first().click();
    await pause(300);
    await capture("2-tournage-choix");
    await page.getByRole("button", { name: /Filmer les/ }).click();
    await page.waitForURL(/\/ecrire\/tournage\/seance-/);
    await pause(800);
    await capture("3-seance");
  });

  await etape("caméra", async () => {
    await page.getByRole("button", { name: /Filmer · / }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).waitFor();
    await pause(1500);
    await capture("4-camera-prete");
    await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).click();
    await pause(600);
    await capture("5-compte-a-rebours");
    await pause(2700 + 4000);
    await capture("6-texte-qui-defile");
    await page.locator("[role=dialog] > div").first().click();
    await pause(500);
    await capture("7-pause");
    await page.locator("[role=dialog] > div").first().click();
    await pause(1500);
    await page.getByRole("dialog").getByRole("button", { name: "Arrêter" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Garder" }).waitFor();
    await pause(800);
    await capture("8-relecture");
    await page.getByRole("dialog").getByRole("button", { name: "Garder" }).click();
    await page.getByRole("dialog").getByText("Rangée", { exact: true }).waitFor();
    await capture("9-rangee");
  });

  await etape("deux autres prises", async () => {
    await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).waitFor();
    await pause(500);
    await filmerUnePrise(2);
    await page.getByRole("dialog").getByText("Rangée", { exact: true }).waitFor();
    await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).waitFor({ timeout: 10000 });
    await pause(500);
    await filmerUnePrise(2);
    await page.getByRole("button", { name: "Séance terminée" }).waitFor();
    await capture("10-seance-terminee-camera");
    await page.getByRole("button", { name: "Séance terminée" }).click();
    await pause(1500);
    await page.reload({ waitUntil: "load" });
    await pause(800);
    await capture("11-seance-tout-range");
  });

  await etape("refaire", async () => {
    await page.getByRole("button", { name: "Refaire" }).first().click();
    await pause(1500);
    await capture("12-prise-a-refaire");
  });
} finally {
  await navigateur.close();
}
console.log(erreurs ? `${erreurs} étape(s) en échec` : "Captures terminées.");
process.exit(erreurs ? 1 : 0);
