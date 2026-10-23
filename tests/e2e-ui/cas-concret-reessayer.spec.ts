/**
 * X12 : « Reprendre cette étape » ne faisait RIEN en ligne (vidéo arrêtée à « L'écriture », aucune requête au clic).
 * Essais d'interface en simulation (base en mémoire, fournisseurs simulés, aucun appel réel), 390 px puis 1440 px.
 *
 * SERVEUR : voir l'en-tête de `cas-concret.spec.ts` (serveur de développement en simulation, lancé avant).
 *   E2E_MDP=… pnpm test:e2e-ui -- tests/e2e-ui/cas-concret-reessayer.spec.ts
 *
 * Un mot `REFUS…` fait refuser l'écriture à chaque essai (panne d'essai, simulation seulement) : la vidéo s'arrête à
 * « L'écriture ». Un clic sur « Reprendre cette étape » doit TOUJOURS avoir un effet visible : un travail repart (le
 * bouton passe en attente, l'étape repasse en cours ou en échec avec un nouvel essai), ou une phrase s'affiche à côté
 * du bouton. Jamais une nouvelle vidéo.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const MDP = process.env.E2E_MDP;
const CAS_RECRUTEMENT = "Recruter des apporteurs d'affaires, de l'annonce au contrat";
const UNE_FABRICATION_MS = 480_000;

async function seConnecter(page: Page) {
  test.skip(!MDP, "E2E_MDP manquant");
  await page.goto("/connexion");
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP!);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30_000 }), page.getByRole("button", { name: "Entrer" }).click()]);
}

/** Erreurs de la console, exceptions et réponses ≥ 400 pendant le test. */
function surveiller(page: Page) {
  const erreurs: string[] = [];
  page.on("console", (m) => {
    if (m.type() === "error") erreurs.push(`console : ${m.text()}`);
  });
  page.on("pageerror", (e) => erreurs.push(`exception : ${e.message}`));
  page.on("response", (r) => {
    if (r.status() >= 400) erreurs.push(`${r.status()} ${new URL(r.url()).pathname}`);
  });
  return erreurs;
}

const motDe = (numero: string, info: TestInfo, prefixe = "") => `${prefixe}X${numero}${info.project.name === "mobile" ? "M" : "B"}${Date.now().toString(36).slice(-4).toUpperCase()}`;

async function arreteeALEcriture(page: Page, mot: string) {
  await page.goto("/cas-concret");
  await page.getByRole("button", { name: CAS_RECRUTEMENT }).click();
  await expect(page.getByRole("dialog")).toContainText("Votre vidéo");
  await page.getByRole("textbox", { name: "Le mot à commenter" }).fill(mot);
  await page.getByRole("button", { name: /Fabriquer la vidéo/ }).click();
  await page.getByRole("button", { name: /^Confirmer / }).click();
  await page.waitForURL(/\/videos\/[^/]+$/, { timeout: 60_000 });
  await expect
    .poll(async () => /L'écriture\s*,\s*à reprendre/.test(await page.locator("main").innerText().catch(() => "")), { timeout: UNE_FABRICATION_MS - 120_000, intervals: [1000] })
    .toBe(true);
  return new URL(page.url()).pathname;
}

/** Nombre de vidéos « Recruter des apporteurs… » dans « Mes vidéos ». */
async function nombreDeVideos(page: Page) {
  await page.goto("/videos");
  await expect(page.locator('a[href^="/videos/"]').first()).toBeVisible();
  return page.locator('a[href^="/videos/"]', { hasText: "Recruter des apporteurs" }).count();
}

test("X12-01 · Arrêtée à « L'écriture » : « Reprendre cette étape » envoie la relance et a un effet visible", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  const fiche = await arreteeALEcriture(page, motDe("01", info, "REFUS"));
  const avant = await nombreDeVideos(page);
  await page.goto(fiche);
  await expect(page.locator("main")).toContainText("L'étape « L'écriture » n'a pas abouti.");
  const posts: string[] = [];
  page.on("request", (r) => {
    if (r.method() === "POST") posts.push(new URL(r.url()).pathname);
  });
  await page.getByRole("button", { name: "Reprendre cette étape" }).click();
  // La relance part : une requête POST (adresse du format).
  await expect.poll(() => posts.length, { timeout: 15_000 }).toBeGreaterThan(0);
  // Effet visible : une phrase à côté du bouton (relance envoyée, nouvel essai fait), ou l'étape qui repart.
  await expect
    .poll(async () => {
      const texte = await page.locator("main").innerText().catch(() => "");
      return /L'écriture\s*,\s*en cours/.test(texte) || /Relance envoyée|Nouvel essai fait/.test(texte);
    }, { timeout: 30_000, intervals: [500] })
    .toBe(true);
  // Le nouvel essai (refusé lui aussi : panne d'essai) est dit, avec sa propre phrase.
  await expect(page.locator("main")).toContainText("Nouvel essai fait", { timeout: 60_000 });
  await expect(page.locator("main")).toContainText("Fiche d'écrans refusée au nouvel essai");
  // Toujours la même vidéo.
  expect(await nombreDeVideos(page)).toBe(avant);
  expect(erreurs).toEqual([]);
});

test("X12-02 · Jamais un clic sans effet : refus du serveur ou studio injoignable → une phrase à côté du bouton", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const fiche = await arreteeALEcriture(page, motDe("02", info, "REFUS"));
  await page.goto(fiche);
  const bouton = page.getByRole("button", { name: "Reprendre cette étape" });
  // Refus du serveur (ex. budget du mois atteint) : sa phrase est dite.
  await page.route("**/cas-concret/relance", (r) => r.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ issue: { statut: "refusee", phrase: "Le budget du mois serait dépassé. Augmentez-le dans Réglages." } }) }));
  await bouton.click();
  await expect(page.getByRole("alert").filter({ hasText: "Le budget du mois serait dépassé." })).toBeVisible();
  await expect(bouton).toBeEnabled();
  // Studio injoignable : une phrase, le bouton reste utilisable.
  await page.unroute("**/cas-concret/relance");
  await page.route("**/cas-concret/relance", (r) => r.abort("connectionrefused"));
  await bouton.click();
  await expect(page.getByRole("alert").filter({ hasText: "Le studio ne répond pas pour l'instant." })).toBeVisible();
  await expect(bouton).toBeEnabled();
  // Réponse illisible : une phrase aussi.
  await page.unroute("**/cas-concret/relance");
  await page.route("**/cas-concret/relance", (r) => r.fulfill({ status: 500, contentType: "text/html", body: "<html></html>" }));
  await bouton.click();
  await expect(page.getByRole("alert").filter({ hasText: "La relance n'a pas abouti." })).toBeVisible();
});
