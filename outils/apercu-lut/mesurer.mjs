// Mesure du temps de composition de l'aperçu du plateau (écran « Votre vidéo », 390 px), cache du navigateur vidé
// à chaque essai, trois séries :
//   - normal : processeur normal, « Plateau » touché dès que le bouton paraît (comme le test e2e) ;
//   - ralentiX4 : processeur ralenti ×4 (« machine chargée », émulation Chromium), touché dès que le bouton paraît
//     (pire cas : la page n'a pas fini de s'animer) ;
//   - ralentiX4Apres2s : ralenti ×4, touché 2 s après l'ouverture de l'écran (le temps de lire l'écran).
// Usage : E2E_MDP='…' node outils/apercu-lut/mesurer.mjs <url de base> [essais=5] > resultat.json
// Le mot de passe n'est lu que dans E2E_MDP (jamais écrit). Prérequis : serveur lancé, Chromium de Playwright.
import { chromium, devices } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3100";
const ESSAIS = Number(process.argv[3] ?? 5);
const MDP = process.env.E2E_MDP;
if (!MDP) throw new Error("E2E_MDP manquant");
const TEXTE =
  "Votre patron peut-il lire vos mails ? Je vous explique en trente secondes. Un mail envoyé depuis la messagerie du travail est présumé professionnel. " +
  "Votre employeur peut donc l'ouvrir, sauf s'il porte la mention personnel. La Cour de cassation l'a jugé en 2001, et le confirme depuis.";

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ ...devices["iPhone 13"], baseURL: BASE, locale: "fr-FR" });
const page = await contexte.newPage();
await page.goto("/connexion");
await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30_000 }), page.getByRole("button", { name: "Entrer" }).click()]);
await page.goto("/nouvelle/avocat");
await page.getByRole("textbox", { name: "Votre texte", exact: true }).fill(TEXTE);
await page.getByRole("button", { name: "Utiliser ce texte" }).click();
await page.waitForURL(/brouillon=/, { timeout: 30_000 });
const adresse = page.url();
const cdp = await contexte.newCDPSession(page);
await cdp.send("Network.enable");

const octetsLut = [];
page.on("response", async (r) => {
  if (/\/luts\//.test(r.url())) {
    const corps = await r.body().catch(() => null);
    octetsLut.push({ url: new URL(r.url()).pathname, octets: corps?.length ?? null, encodage: r.headers()["content-encoding"] ?? "aucun" });
  }
});

async function essai(ralenti, attenteMs = 0) {
  await cdp.send("Network.clearBrowserCache");
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  await page.goto(adresse);
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: ralenti });
  await page.getByRole("button", { name: /^Plateau :/ }).waitFor({ timeout: 30_000 });
  if (attenteMs) await page.waitForTimeout(attenteMs);
  await page.getByRole("button", { name: /^Plateau :/ }).click();
  const apercu = page.getByTestId("apercu-plateau");
  await apercu.and(page.locator("[data-duree-ms]")).waitFor({ timeout: 60_000 });
  const duree = Number(await apercu.getAttribute("data-duree-ms"));
  await cdp.send("Emulation.setCPUThrottlingRate", { rate: 1 });
  return duree;
}

const resultat = { base: BASE, date: new Date().toISOString(), essais: ESSAIS, normal: [], ralentiX4: [], ralentiX4Apres2s: [] };
for (let i = 0; i < ESSAIS; i++) resultat.normal.push(await essai(1));
for (let i = 0; i < ESSAIS; i++) resultat.ralentiX4.push(await essai(4));
for (let i = 0; i < ESSAIS; i++) resultat.ralentiX4Apres2s.push(await essai(4, 2000));
const med = (t) => [...t].sort((a, b) => a - b)[Math.floor(t.length / 2)];
resultat.medianeNormalMs = med(resultat.normal);
resultat.medianeRalentiX4Ms = med(resultat.ralentiX4);
resultat.maxRalentiX4Ms = Math.max(...resultat.ralentiX4);
resultat.medianeRalentiX4Apres2sMs = med(resultat.ralentiX4Apres2s);
resultat.maxRalentiX4Apres2sMs = Math.max(...resultat.ralentiX4Apres2s);
resultat.maxNormalMs = Math.max(...resultat.normal);
resultat.fichiersLut = [...new Map(octetsLut.map((o) => [o.url, o])).values()];
console.log(JSON.stringify(resultat, null, 1));
await navigateur.close();
