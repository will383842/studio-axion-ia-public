/**
 * E1 : essais d'interface du format « Cas concret MD », tous les parcours (simulation : base en mémoire, fournisseurs
 * simulés, aucun appel réel), 390 px puis 1440 px sur le même serveur.
 *
 * SERVEUR : une fabrication de vidéo qui paie quelque chose est refusée par un serveur de PRODUCTION dont la voix ou le
 * stockage sont simulés (`refusSimulationEnProduction`, src/services/fabrication.ts). Les scénarios qui fabriquent une
 * vidéo tournent donc sur un serveur de développement, lancé avant, en simulation :
 *   STUDIO_SANS_BASE=1 STUDIO_VEILLE=0 SESSION_SECRET=… STUDIO_PASSWORD_HASH_B64=… pnpm exec next dev -p 3100
 *   E2E_MDP=… pnpm test:e2e-ui -- tests/e2e-ui/cas-concret.spec.ts      (réutilise le serveur déjà lancé)
 * Une vidéo met environ deux minutes et demie à se fabriquer en simulation.
 *
 * Règles de rejouabilité : le mot à commenter est saisi à la main et unique (`E` + numéro du scénario + `M` ou `B`) ;
 * un cas ne se valide que si « Je valide ce cas » est visible ; aucun scénario ne suppose une liste vide. E1 et E2 ne
 * tournent pas en même temps sur le même serveur. Le cas « L'e-mail qu'on repousse… » n'est validé par aucun scénario
 * avant E1-12 (qui précède donc E1-02) : il sert à l'essai, puis à la Formation (E1-02, E1-08). « Le compte rendu dicté »
 * ne se fabrique pas en simulation (un écran de quatre mots y dure moins d'une seconde : vérification bloquante) ; il ne
 * sert qu'à E1-11. Un serveur neuf par taille d'écran (mobile, puis bureau), car les cas validés restent validés.
 */
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const MDP = process.env.E2E_MDP;

const CAS = {
  recrutement: "Recruter des apporteurs d'affaires, de l'annonce au contrat",
  compteRendu: "Le compte rendu de rendez-vous dicté",
  audit: "L'audit sur place d'une journée",
  crm: "Un contact arrive, la fiche se crée dans le CRM",
  devis: "Un devis signé en ligne, le dossier avance, l'alerte arrive",
  rappels: "Un rendez-vous réservé : confirmation, veille, une heure avant",
  email: "L'e-mail qu'on repousse depuis deux jours",
} as const;

const ETAPES = ["L'écriture", "La relecture", "Les vrais écrans", "La voix", "Le calage", "Les écrans", "Les finitions", "La vérification"];
const RAISON_SANS_MOT = "Fin sans le mot à commenter : la vidéo propose le diagnostic.";
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

/** `E` + numéro du scénario + `M` (téléphone) ou `B` (bureau) : « E101M ». */
const motDe = (numero: string, info: TestInfo) => `E${numero}${info.project.name === "mobile" ? "M" : "B"}`;

const carteDe = (page: Page, titre: string) => page.getByRole("button", { name: titre });
const aValider = (page: Page) => page.locator("details", { hasText: /À valider/ });

async function ouvrirAValider(page: Page) {
  const details = aValider(page);
  if ((await details.count()) && !(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator("summary").click();
  return details;
}

/** Valide le cas seulement si « Je valide ce cas » est visible pour lui ; sinon il est déjà validé. */
async function validerSiBesoin(page: Page, titre: string) {
  // La page est rendue d'un bloc : la carte (cas validé) ou le groupe « À valider » est là, sinon on attend.
  await carteDe(page, titre).or(aValider(page).locator("summary")).first().waitFor();
  if (await carteDe(page, titre).isVisible()) return;
  const details = await ouvrirAValider(page);
  const bouton = details.locator("li", { hasText: titre }).first().getByRole("button", { name: "Je valide ce cas" });
  await expect(bouton).toBeVisible();
  await bouton.click();
  await expect(carteDe(page, titre)).toBeVisible();
}

/** Ouvre `/cas-concret` (filtre d'offre facultatif), valide le cas au besoin, ouvre sa feuille « Votre vidéo ». */
async function ouvrirCas(page: Page, titre: string, offre?: string) {
  await page.goto("/cas-concret");
  if (offre) await page.getByRole("radio", { name: offre }).click();
  await validerSiBesoin(page, titre);
  await carteDe(page, titre).click();
  await expect(page.getByRole("dialog")).toContainText("Votre vidéo");
}

/** Ouvre la feuille d'un cas non validé par « Fabriquer un essai ». */
async function ouvrirEssai(page: Page, titre: string) {
  await page.goto("/cas-concret");
  const details = await ouvrirAValider(page);
  await details.locator("li", { hasText: titre }).first().getByRole("button", { name: "Fabriquer un essai" }).click();
  await expect(page.getByRole("dialog")).toContainText("Votre vidéo");
}

/** Le mot saisi à la main, puis « Avec le mot » s'il est actif (X6 : grisé tant que le mot n'est branché sur aucun réseau coché). */
async function saisirLeMot(page: Page, mot: string) {
  await page.getByRole("textbox", { name: "Le mot à commenter" }).fill(mot);
  const choix = page.getByRole("switch", { name: /Avec le mot/ });
  if ((await choix.isEnabled()) && (await choix.getAttribute("aria-checked")) !== "true") await choix.click();
}

/** Dans la feuille ouverte : le mot, « Fabriquer la vidéo », le prix confirmé ; arrive sur la fiche de la vidéo. */
async function fabriquer(page: Page, mot: string) {
  await saisirLeMot(page, mot);
  await page.getByRole("button", { name: /Fabriquer la vidéo/ }).click();
  await page.getByRole("button", { name: /^Confirmer / }).click();
  await page.waitForURL(/\/videos\/[^/]+$/, { timeout: 60_000 });
}

const vosFichiers = (page: Page) => page.getByRole("region", { name: "Vos fichiers" });
const ligneReseau = (page: Page, reseau: string) => vosFichiers(page).locator("ul").first().locator(":scope > li", { hasText: reseau });

/** Attend « Vos fichiers » ; rend les étapes vues « en cours » pendant l'attente. */
async function attendreVideoPrete(page: Page): Promise<Set<string>> {
  const vues = new Set<string>();
  const fin = Date.now() + UNE_FABRICATION_MS - 60_000;
  while (Date.now() < fin) {
    if (await vosFichiers(page).isVisible()) return vues;
    const t = await page.locator("main").innerText().catch(() => "");
    for (const n of ETAPES) if (new RegExp(`${n}\\s*,\\s*en cours`).test(t)) vues.add(n);
    // Une étape « à reprendre » ne se rattrape pas toute seule : on le dit tout de suite, avec sa phrase.
    if (/\s,\s*à reprendre/.test(t)) throw new Error(`Étape en échec : ${t.replace(/\s+/g, " ").slice(0, 600)}`);
    await page.waitForTimeout(1000);
  }
  await expect(vosFichiers(page)).toBeVisible({ timeout: 5000 });
  return vues;
}

/** Les vidéos prêtes déjà fabriquées pendant cette séance (par taille d'écran et par cas) : évite de refabriquer. */
const pretes = new Map<string, string>();

async function videoPrete(page: Page, info: TestInfo, id: string, cas: string, offre: string | undefined, numero: string) {
  const cle = `${info.project.name}|${id}`;
  const connue = pretes.get(cle);
  if (connue) {
    await page.goto(connue);
  } else {
    await ouvrirCas(page, cas, offre);
    await fabriquer(page, motDe(numero, info));
    pretes.set(cle, new URL(page.url()).pathname);
  }
  await attendreVideoPrete(page);
}

test("E1-01 · Intégration, une automatisation : de la case à la vidéo prête", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/cas-concret");
  await expect(page.getByRole("heading", { name: "Cas concret MD", level: 1 })).toBeVisible();
  // X5 : une seule offre « Intégration » ; la nature reste en clair sur la carte ; aucun cas validé ne porte « Coaching ».
  await expect(page.getByRole("radiogroup", { name: "Les offres" }).getByRole("radio")).toHaveText(["Tous", "Formation", "Audit", "Intégration"]);
  await expect(carteDe(page, CAS.recrutement)).toContainText("Intégration");
  await expect(carteDe(page, CAS.recrutement)).toContainText("Automatisation");
  await ouvrirCas(page, CAS.recrutement, "Intégration");
  // X4 : « Avec le mot » est éteint par défaut. X6 : rien n'est branché, l'option est grisée avec sa phrase.
  const feuille = page.getByRole("dialog");
  await expect(feuille.getByRole("switch", { name: /Avec le mot/ })).toHaveAttribute("aria-checked", "false");
  await expect(feuille.getByRole("switch", { name: /Avec le mot/ })).toBeDisabled();
  await expect(feuille).toContainText("Disponible quand l'envoi du document sera en place.");
  await fabriquer(page, motDe("01", info));
  pretes.set(`${info.project.name}|automatisation`, new URL(page.url()).pathname);
  for (const n of ETAPES) await expect(page.locator("main")).toContainText(n);
  const vues = await attendreVideoPrete(page);
  expect(vues.size, `étapes vues en cours : ${[...vues].join(", ")}`).toBeGreaterThanOrEqual(5);
  await expect(vosFichiers(page).locator("ul").first().locator(":scope > li")).toHaveCount(4);
  await expect(ligneReseau(page, "Facebook")).toContainText("Fin : diagnostic et lien");
  expect(erreurs).toEqual([]);
});

/**
 * E1-12 passe AVANT E1-02 : « L'e-mail qu'on repousse… » (offre Formation) est le seul cas qui se fabrique en simulation
 * sans être validé par un autre scénario ; E1-02 et E1-08 le valident ensuite. Un serveur neuf par taille d'écran.
 */
test("E1-12 · Vidéo d'essai : un cas non validé, vidéo prête avec la pastille « Essai », sans « Copier »", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await ouvrirEssai(page, CAS.email);
  await fabriquer(page, motDe("12", info));
  await attendreVideoPrete(page);
  await expect(vosFichiers(page)).toContainText("Essai : cas à confirmer par Will, ne pas publier");
  await expect(vosFichiers(page).getByRole("button", { name: /Copier/ })).toHaveCount(0);
  await expect(page.getByRole("button", { name: /Copier/ })).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

for (const [numero, nom, offre, cas, id] of [
  ["02", "Formation", "Formation", CAS.email, "formation"],
  ["03", "Audit", "Audit", CAS.audit, "audit"],
  ["04", "Intégration", "Intégration", CAS.crm, "integration"],
] as const) {
  test(`E1-${numero} · ${nom} : par la pastille de l'offre, du cas à la vidéo prête`, async ({ page }, info) => {
    test.setTimeout(UNE_FABRICATION_MS);
    await seConnecter(page);
    const erreurs = surveiller(page);
    await ouvrirCas(page, cas, offre);
    await fabriquer(page, motDe(numero, info));
    pretes.set(`${info.project.name}|${id}`, new URL(page.url()).pathname);
    await attendreVideoPrete(page);
    await expect(vosFichiers(page).locator("ul").first().locator(":scope > li")).toHaveCount(4);
    expect(erreurs).toEqual([]);
  });
}

test("E1-05 · La case filtre : « rappel » masque les cartes sans rappel, Entrée ouvre la première feuille", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/cas-concret");
  await validerSiBesoin(page, CAS.rappels);
  await validerSiBesoin(page, CAS.audit);
  const cartes = page.locator("main ul.grid > li");
  const toutes = await cartes.count();
  const case_ = page.getByRole("textbox", { name: "Quel cas voulez-vous montrer ?" });
  await case_.fill("rappel");
  await expect(cartes.filter({ hasText: CAS.rappels })).toHaveCount(1);
  await expect(cartes.filter({ hasText: CAS.audit })).toHaveCount(0);
  expect(await cartes.count()).toBeLessThan(toutes);
  await case_.press("Enter");
  const feuille = page.getByRole("dialog");
  await expect(feuille).toContainText("Votre vidéo");
  await expect(feuille).toContainText("Les étapes");
  expect(erreurs).toEqual([]);
});

test("E1-06 · Valider un cas : il passe de « À valider » à la liste", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/cas-concret");
  await validerSiBesoin(page, CAS.devis);
  await expect(carteDe(page, CAS.devis)).toBeVisible();
  await expect(aValider(page).getByText(CAS.devis)).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test("E1-07 · Vos fichiers : « Copier le lien » pose une adresse suivie", async ({ page, context }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await videoPrete(page, info, "automatisation", CAS.recrutement, undefined, "07");
  await ligneReseau(page, "Facebook").getByRole("button", { name: "Copier le lien" }).click();
  const lien = await page.evaluate(() => navigator.clipboard.readText());
  expect(lien).toContain("utm_source=");
  expect(lien).toContain("/fr/diagnostic");
  expect(lien).toContain("utm_campaign=cc-");
  // X4 : le code de version de la vidéo (« 0001-CC-FB ») dans utm_content.
  expect(lien).toMatch(/utm_content=\d{4}-CC-FB/);
  expect(erreurs).toEqual([]);
});

test("E1-08 · Rien de branché : la fin propose le diagnostic et le lien, avec sa raison", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await videoPrete(page, info, "formation", CAS.email, "Formation", "08");
  const facebook = ligneReseau(page, "Facebook");
  await expect(facebook).toContainText("Fin : diagnostic et lien");
  await expect(facebook).toContainText(RAISON_SANS_MOT);
  expect(erreurs).toEqual([]);
});

test("E1-09 · Format caché : ni le menu, ni « Nouvelle vidéo » ne le montrent, l'adresse répond", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  const menu = async () => (await page.locator("aside, nav").evaluateAll((els) => els.map((e) => e.textContent ?? "").join(" "))).trim();
  await page.goto("/");
  expect(await menu()).not.toContain("Cas concret MD");
  await page.goto("/nouvelle");
  await expect(page.getByRole("heading", { name: "Nouvelle vidéo", level: 1 })).toBeVisible();
  await expect(page.locator("main")).not.toContainText("Cas concret MD");
  expect(await menu()).not.toContain("Cas concret MD");
  // « Formats » : /formats renvoie vers « Mes vidéos », dont les formats sont les onglets de rangement.
  await page.goto("/formats");
  await expect(page.getByRole("navigation", { name: "Rangement de mes vidéos" })).toBeVisible();
  await expect(page.getByRole("navigation", { name: "Rangement de mes vidéos" })).not.toContainText("Cas concret");
  expect(await menu()).not.toContain("Cas concret MD");
  const reponse = await page.goto("/cas-concret");
  expect(reponse?.status()).toBe(200);
  await expect(page.getByRole("heading", { name: "Cas concret MD", level: 1 })).toBeVisible();
  expect(erreurs).toEqual([]);
});

test("E1-10 · Téléphone : à 390 px, rien ne défile de côté, pas de manquement grave d'accessibilité", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/cas-concret");
  await validerSiBesoin(page, CAS.recrutement);
  const debordePage = () => page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(await debordePage()).toBeLessThanOrEqual(0);
  const graves = async () => (await new AxeBuilder({ page }).analyze()).violations.filter((v) => v.impact === "serious" || v.impact === "critical").map((v) => `${v.id} : ${v.nodes.map((n) => n.target.join(" ")).join(" ; ")}`);
  expect(await graves()).toEqual([]);
  await carteDe(page, CAS.recrutement).click();
  const feuille = page.getByRole("dialog");
  await expect(feuille).toContainText("Votre vidéo");
  await page.waitForTimeout(600);
  expect(await debordePage()).toBeLessThanOrEqual(0);
  // Un élément de la feuille dépasse-t-il l'écran (390 px) ? Mesuré sur les rectangles, pas sur le défilement interne.
  const debordeFeuille = await feuille.evaluate((d, largeur) => [d, ...d.querySelectorAll("*")].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > largeur + 0.5 || r.left < -0.5); }).map((e) => `${e.tagName} ${(e.textContent ?? "").slice(0, 40)}`), 390);
  expect(debordeFeuille).toEqual([]);
  expect(await graves()).toEqual([]);
  expect(erreurs).toEqual([]);
});

test("E1-11 · Une phrase entière : le compte rendu dicté passe en premier, Entrée ouvre sa feuille", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/cas-concret");
  await validerSiBesoin(page, CAS.compteRendu);
  const case_ = page.getByRole("textbox", { name: "Quel cas voulez-vous montrer ?" });
  await case_.fill("Fais la vidéo sur le compte rendu de rendez-vous");
  await expect(page.locator("main ul.grid > li").first()).toContainText(CAS.compteRendu);
  await case_.press("Enter");
  const feuille = page.getByRole("dialog");
  await expect(feuille).toContainText("Votre vidéo");
  await expect(feuille).toContainText("La dictée");
  expect(erreurs).toEqual([]);
});
