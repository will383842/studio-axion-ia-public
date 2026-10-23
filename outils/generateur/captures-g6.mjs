// Captures 390 px des lots G6 et G6b (fiche sujet : « Fabriquer les N », état des versions, 2e ouverture Reels,
// « Monter ma prise ») dans docs/captures/g6/ecrans/.
// Usage : E2E_MDP='…' node outils/generateur/captures-g6.mjs http://localhost:3112
//   Serveur de développement SANS aucune clé (écriture en essai, voix, visage et rendu simulés, 0 €), lancé avec
//   MOTEUR_AVOCAT=montage-avocat (le moteur qui reprend le corps d'une mère). Le mot de passe est lu dans E2E_MDP.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , BASE = "http://localhost:3112"] = process.argv;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "g6", "ecrans");
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
    if (process.env.CAPTURES_DEBUG) await page.screenshot({ path: join(process.env.CAPTURES_DEBUG, `echec-${erreurs}.png`), fullPage: true }).catch(() => undefined);
  }
};

const MATIERES = [
  "Dans presque toutes les PME que nous voyons, une personne relance chaque facture à la main le vendredi soir, donc des relances partent en retard.",
  "Une relance oubliée, et la trésorerie se tend tout le mois.",
  "Beaucoup pensent que relancer à la main ne coûte rien.",
  "Sauf si vos clients paient tous à l'heure : gardez votre méthode.",
  "Est-ce qu'on peut automatiser les relances sans froisser les clients ?",
  "Je conseille de commencer par les factures en retard de plus de quinze jours, puis d'automatiser la première relance.",
];

/** Écrit un sujet (essai, 0 €) avec « Qui parle » donné, valide sa limite et ses versions. Renvoie l'adresse. */
async function sujet(idee, quiParle) {
  await page.goto(`${BASE}/ecrire/atelier`, { waitUntil: "load" });
  await page.getByPlaceholder("Dites ou tapez votre idée").fill(idee);
  if (quiParle) {
    await page.getByRole("button", { name: /Qui parle/ }).click();
    await page.getByRole("dialog").getByText(quiParle, { exact: true }).click();
    await pause(400);
    if (await page.getByRole("dialog").count()) await page.keyboard.press("Escape");
  }
  await page.getByRole("button", { name: /Écrire · au plus/ }).click();
  await page.waitForURL(/\/ecrire\/sujets\//);
  const url = page.url();
  for (let i = 0; i < 60 && !(await page.getByText("Détails").count()); i++) {
    await pause(2000);
    await page.goto(url, { waitUntil: "load" });
  }
  for (let i = 0; i < 8; i++) {
    await pause(1500);
    await page.goto(url, { waitUntil: "load" });
    await pause(800);
    const juste = page.getByRole("button", { name: /est juste/ });
    const valider = page.getByRole("button", { name: /Valider les/ });
    if (await juste.count()) await juste.first().click();
    else if ((await valider.count()) && (await valider.first().isEnabled())) await valider.first().click();
    else if (await page.getByText("Limite validée").count()) break;
  }
  return url;
}

/** Déplie la version dont le logo porte ce réseau (aria-label du logo). */
async function deplier(texte) {
  const boutons = page.locator("main li button[aria-expanded]");
  const n = await boutons.count();
  for (let k = 0; k < n; k++) {
    await boutons.nth(k).dispatchEvent("click");
    await pause(300);
    if (await page.getByText(texte).count()) return;
    await boutons.nth(k).dispatchEvent("click");
    await pause(200);
  }
  throw new Error(`« ${texte} » introuvable`);
}

try {
  await page.goto(`${BASE}/connexion`, { waitUntil: "load" });
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 }), page.getByRole("button", { name: "Entrer" }).click()]);

  const g6 = !process.env.SEUL_JE_LIS;
  if (g6) await etape("matières", async () => {
    await page.goto(`${BASE}/ecrire/matieres`, { waitUntil: "load" });
    await page.getByRole("button", { name: "Plusieurs" }).click();
    await page.getByLabel("Votre dictée").fill(MATIERES.join("\n"));
    await page.getByRole("button", { name: "Découper" }).click();
    await page.getByRole("button", { name: /Ranger les/ }).click();
    await pause(1500);
  });

  let url = "";
  if (g6) await etape("sujet avec le double", async () => {
    url = await sujet("Les relances de factures faites à la main chaque vendredi soir, et comment les automatiser", null);
  });

  if (g6) await etape("Fabriquer les N : carte et feuille", async () => {
    await page.goto(url, { waitUntil: "load" });
    await pause(1000);
    await page.getByText(/^Fabriquer les \d/).first().scrollIntoViewIfNeeded();
    await capture("1-fabriquer-les-n");
    await page.getByRole("button", { name: /Fabriquer les \d+ · / }).click();
    await page.getByRole("dialog").waitFor();
    await pause(700);
    await capture("2-feuille-fabriquer-les-n");
    await page.getByRole("dialog").getByRole("button", { name: "4:5" }).click();
    await pause(300);
    await capture("3-feuille-option-4x5");
    await page.getByRole("dialog").getByRole("button", { name: /Lancer · / }).click();
    await pause(2500);
  });

  if (g6) await etape("une version attend la vidéo mère", async () => {
    await page.goto(url, { waitUntil: "load" });
    await pause(800);
    await deplier("Attend la vidéo mère");
    await page.getByText("Attend la vidéo mère").scrollIntoViewIfNeeded();
    await capture("4-attend-la-mere");
  });

  if (g6) await etape("versions fabriquées : durée réelle et contrôles sur la vidéo", async () => {
    for (let i = 0; i < 90; i++) {
      await page.goto(url, { waitUntil: "load" });
      await pause(1500);
      const boutons = page.locator("main li button[aria-expanded]");
      const n = await boutons.count();
      let fini = n > 0;
      for (let k = 0; k < n; k++) {
        await boutons.nth(k).dispatchEvent("click");
        await pause(150);
      }
      fini = (await page.getByText("Sur la vidéo").count()) >= n;
      if (fini) break;
      await pause(4000);
    }
    await page.goto(url, { waitUntil: "load" });
    await pause(800);
    await deplier("Sur la vidéo");
    await page.getByText("Sur la vidéo").first().scrollIntoViewIfNeeded();
    await capture("5-sur-la-video");
  });

  if (g6) await etape("2e ouverture Reels", async () => {
    await page.goto(url, { waitUntil: "load" });
    await pause(800);
    await deplier("2e ouverture");
    await page.getByRole("button", { name: /2e ouverture · / }).scrollIntoViewIfNeeded();
    await capture("6-seconde-ouverture");
    await page.getByRole("button", { name: /2e ouverture · / }).click();
    await page.getByRole("dialog").waitFor();
    await pause(700);
    await capture("7-feuille-seconde-ouverture");
    await page.keyboard.press("Escape");
  });

  let urlJeLis = "";
  await etape("sujet « je lis »", async () => {
    urlJeLis = await sujet("Relancer ses factures à la main : ce que ça coûte vraiment à une PME", "Je lis");
  });

  await etape("filmer une prise puis Monter ma prise", async () => {
    await page.goto(`${BASE}/ecrire/tournage`, { waitUntil: "load" });
    await pause(600);
    await page.locator("main ul > li").first().locator("button[aria-pressed]").first().click();
    await page.getByRole("button", { name: /Filmer (les|celle)/ }).click();
    await page.waitForURL(/\/ecrire\/tournage\/seance-/);
    await pause(800);
    await page.getByRole("button", { name: /Filmer · / }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).waitFor();
    await pause(1200);
    await page.getByRole("dialog").getByRole("button", { name: "Filmer", exact: true }).click();
    await pause(3200 + 3000);
    await page.getByRole("dialog").getByRole("button", { name: "Arrêter" }).click();
    await page.getByRole("dialog").getByRole("button", { name: "Garder" }).waitFor();
    await pause(600);
    await page.getByRole("dialog").getByRole("button", { name: "Garder" }).click();
    await page.getByRole("dialog").getByText("Rangée", { exact: true }).waitFor();
    await page.goto(urlJeLis, { waitUntil: "load" });
    await pause(1000);
    await deplier("Monter ma prise");
    await page.getByRole("button", { name: /Monter ma prise/ }).scrollIntoViewIfNeeded();
    await capture("8-monter-ma-prise");
  });
} finally {
  await navigateur.close();
}
console.log(erreurs ? `${erreurs} étape(s) en échec` : "Captures terminées.");
process.exit(erreurs ? 1 : 0);
