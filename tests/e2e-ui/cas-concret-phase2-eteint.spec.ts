/**
 * Portage phase 2 · P11 : essais d'interface, les six réglages ÉTEINTS (défaut du studio) : l'écran du « Cas concret MD » est
 * celui de master, les routes de la phase 2 répondent 404, rien de la phase 2 n'est visible. Simulation : base en mémoire,
 * fournisseurs simulés, aucun appel réel, téléphone (390 px) puis ordinateur (1440 px).
 *
 * SERVEUR (développement, simulation), lancé avant :
 *   STUDIO_SANS_BASE=1 STUDIO_VEILLE=0 SESSION_SECRET=… STUDIO_PASSWORD_HASH_B64=… pnpm exec next dev -p 3100
 *   E2E_MDP=… pnpm exec playwright test -c playwright.ui.config.ts tests/e2e-ui/cas-concret-phase2-eteint.spec.ts
 * Non couvert ici : « Fournir cet écran » dans la feuille d'un cas (le seul cas à étape derrière une connexion, `cycle-de-formation`, fait partie des
 * cas ajoutés, cachés tant que `casConcret.catalogueEtendu` est éteint : le lien ne peut pas être rendu sur ce serveur), la fiche d'une vidéo du format (la base de démonstration n'a aucune vidéo `cas-concret`, et en fabriquer une prend plus de
 * deux minutes et demie par taille d'écran) et la route du document promis (elle répond 404 aussi pour une vidéo inconnue : elle ne prouverait pas
 * le réglage). Les parcours « allumés » (porte B, retouche, document, relevés, écran fourni) ne peuvent pas tourner sur ce serveur : aucun
 * réglage n'y est allumable sans toucher à la base ; ils sont couverts par `tests/cas-concret/portage/recette-phase-2.test.ts`
 * et les tests de chaque lot (réglages allumés dans le double seulement).
 * Captures : `tests/cas-concret/interface/captures/portage-eteint-*`.
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const MDP = process.env.E2E_MDP;

async function seConnecter(page: Page) {
  test.skip(!MDP, "E2E_MDP manquant");
  await page.goto("/connexion");
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP!);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30_000 }), page.getByRole("button", { name: "Entrer" }).click()]);
}

/** Exceptions de la page et erreurs de console pendant le test (les 404 attendus sont écartés par leur adresse). */
function surveiller(page: Page, attendus404: string[] = []) {
  const erreurs: string[] = [];
  page.on("pageerror", (e) => erreurs.push(`exception : ${e.message}`));
  page.on("response", (r) => {
    const chemin = new URL(r.url()).pathname;
    if (r.status() >= 400 && !attendus404.includes(chemin)) erreurs.push(`${r.status()} ${chemin}`);
  });
  return erreurs;
}

async function capture(page: Page, info: TestInfo, nom: string) {
  const taille = info.project.name === "mobile" ? "telephone" : "ordinateur";
  await page.screenshot({ path: `tests/cas-concret/interface/captures/portage-eteint-${nom}-${taille}.jpg`, type: "jpeg", quality: 70, fullPage: false });
}

test("P11-01 · La case du cas : même avec une vraie phrase, pas de « Faire la vidéo de ce cas » (porte B éteinte)", async ({ page }, info) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/cas-concret");
  await expect(page.getByRole("heading", { name: "Cas concret MD" })).toBeVisible();
  // Le bouton exige le réglage ET au moins deux mots utiles dans la case : la phrase est donc écrite avant de constater son absence
  // (avec `casConcret.porteB` allumé, il apparaîtrait ici).
  const laCase = page.getByRole("textbox", { name: "Quel cas voulez-vous montrer ?" });
  await laCase.fill("Un cabinet comptable qui saisit ses factures à la main chaque semaine");
  await expect(laCase).toHaveValue(/cabinet comptable/);
  await expect(page.getByRole("button", { name: "Faire la vidéo de ce cas" })).toHaveCount(0);
  await capture(page, info, "page-des-cas");
  expect(erreurs).toEqual([]);
});

test("P11-02 · La route de l'écran fourni d'un cas du catalogue n'existe pas tant que le réglage est éteint", async ({ page }, info) => {
  await seConnecter(page);
  // Le chargement progressif (`loading.tsx`) a déjà répondu 200 quand `notFound()` s'exécute : c'est la page qui dit 404.
  // Le cas existe : seul le réglage `casConcret.ecranFourni` (éteint) explique la page introuvable.
  await page.goto("/cas-concret/ecran-fourni/recrutement-apporteurs");
  await expect(page.getByRole("heading", { name: "Cette page n'existe pas" })).toBeVisible();
  await expect(page.getByText("404", { exact: true })).toBeVisible();
  await capture(page, info, "route-fermee");
});
