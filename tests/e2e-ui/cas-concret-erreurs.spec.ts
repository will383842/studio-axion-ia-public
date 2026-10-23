/**
 * E2 : essais d'interface du format « Cas concret MD », erreurs et non-régression visible (simulation : base en
 * mémoire, fournisseurs simulés, aucun appel réel), 390 px puis 1440 px sur le même serveur.
 *
 * SERVEUR : voir l'en-tête de `cas-concret.spec.ts` (serveur de développement en simulation : un serveur de production
 * refuse toute fabrication dont la voix ou le stockage sont simulés). E1 et E2 ne tournent pas en même temps sur le
 * même serveur.
 *   E2E_MDP=… pnpm test:e2e-ui -- tests/e2e-ui/cas-concret-erreurs.spec.ts
 *
 * Règles de rejouabilité : le mot à commenter est saisi à la main et unique (`E` + numéro du scénario + `M` ou `B`,
 * `PANNE` ou `REFUS` en préfixe pour les pannes d'essai) ; un cas ne se valide que si « Je valide ce cas » est visible ;
 * aucun scénario ne suppose une liste vide. E2-09 « cas modifié » n'est pas un essai d'interface (test de service de S1a).
 */
import { expect, test, type Page, type TestInfo } from "@playwright/test";

const MDP = process.env.E2E_MDP;

const CAS = {
  recrutement: "Recruter des apporteurs d'affaires, de l'annonce au contrat",
  email: "L'e-mail qu'on repousse depuis deux jours",
} as const;

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

/** `E` + numéro du scénario + `M` (téléphone) ou `B` (bureau), avec un préfixe facultatif : « E201M », « PANNEE205M ». */
const motDe = (numero: string, info: TestInfo, prefixe = "") => `${prefixe}E${numero}${info.project.name === "mobile" ? "M" : "B"}`;

const carteDe = (page: Page, titre: string) => page.getByRole("button", { name: titre });
const aValider = (page: Page) => page.locator("details", { hasText: /À valider/ });

async function ouvrirAValider(page: Page) {
  const details = aValider(page);
  if ((await details.count()) && !(await details.evaluate((d) => (d as HTMLDetailsElement).open))) await details.locator("summary").click();
  return details;
}

/** Ouvre `/cas-concret` puis la feuille « Votre vidéo » d'un cas validé (le cas témoin l'est toujours). */
async function ouvrirCas(page: Page, titre: string) {
  await page.goto("/cas-concret");
  await carteDe(page, titre).click();
  await expect(page.getByRole("dialog")).toContainText("Votre vidéo");
}

/** Le mot saisi à la main, puis « Avec le mot » s'il est actif (X6 : grisé tant que le mot n'est branché sur aucun réseau coché). */
async function saisirLeMot(page: Page, mot: string) {
  await page.getByRole("textbox", { name: "Le mot à commenter" }).fill(mot);
  const choix = page.getByRole("switch", { name: /Avec le mot/ });
  if ((await choix.isEnabled()) && (await choix.getAttribute("aria-checked")) !== "true") await choix.click();
}

/** Dans la feuille ouverte : le mot, « Fabriquer la vidéo », le prix confirmé. Rend la phrase d'un refus, ou arrive sur la fiche. */
async function fabriquer(page: Page, mot: string) {
  await saisirLeMot(page, mot);
  await page.getByRole("button", { name: /Fabriquer la vidéo/ }).click();
  await page.getByRole("button", { name: /^Confirmer / }).click();
}

async function fabriquerEtArriver(page: Page, mot: string) {
  await fabriquer(page, mot);
  await page.waitForURL(/\/videos\/[^/]+$/, { timeout: 60_000 });
}

const vosFichiers = (page: Page) => page.getByRole("region", { name: "Vos fichiers" });
const etapeEn = (page: Page, etape: string, etat: string) => expect.poll(async () => new RegExp(`${etape}\\s*,\\s*${etat}`).test(await page.locator("main").innerText().catch(() => "")), { timeout: UNE_FABRICATION_MS - 60_000, intervals: [1000] }).toBe(true);
const attendreVideoPrete = (page: Page) => expect(vosFichiers(page)).toBeVisible({ timeout: UNE_FABRICATION_MS - 60_000 });


/** Nombre de vidéos « Recruter des apporteurs… » dans « Mes vidéos ». */
async function nombreDeVideos(page: Page) {
  await page.goto("/videos");
  await expect(page.locator('a[href^="/videos/"]').first()).toBeVisible();
  return page.locator('a[href^="/videos/"]', { hasText: "Recruter des apporteurs" }).count();
}

/** Les vidéos prêtes déjà fabriquées pendant cette séance (par taille d'écran) : évite de refabriquer. */
const pretes = new Map<string, string>();

async function videoPrete(page: Page, info: TestInfo, numero: string) {
  const connue = pretes.get(info.project.name);
  if (connue) {
    await page.goto(connue);
  } else {
    await ouvrirCas(page, CAS.recrutement);
    await fabriquerEtArriver(page, motDe(numero, info));
    pretes.set(info.project.name, new URL(page.url()).pathname);
  }
  await attendreVideoPrete(page);
}

/**
 * X6 : un mot n'est dit que là où il est branché ; rien ne l'est dans les essais d'interface (aucun écran de réglage).
 * Le refus « Ce mot est déjà pris par une autre vidéo. » ne vaut que pour un mot dit : il est couvert par le test de
 * service (`tests/cas-concret/services/lancement`). Ici : le même mot, jamais dit, ne bloque pas une seconde vidéo.
 */
test("E2-01 · Mot non branché : le même mot ne bloque pas une seconde vidéo (il n'est pas dit)", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await ouvrirCas(page, CAS.recrutement);
  await fabriquerEtArriver(page, motDe("01", info));
  const avant = await nombreDeVideos(page);
  await ouvrirCas(page, CAS.recrutement);
  await fabriquerEtArriver(page, motDe("01", info));
  expect(await nombreDeVideos(page)).toBe(avant + 1);
  expect(erreurs).toEqual([]);
});

test("E2-02 · Aucun réseau : bouton inactif et la phrase", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await ouvrirCas(page, CAS.recrutement);
  const feuille = page.getByRole("dialog");
  for (const reseau of ["Facebook", "Instagram", "TikTok", "LinkedIn"]) await feuille.getByRole("checkbox", { name: reseau }).uncheck();
  await expect(feuille.getByRole("button", { name: /Fabriquer la vidéo/ })).toBeDisabled();
  await expect(feuille).toContainText("Choisissez au moins un réseau.");
  expect(erreurs).toEqual([]);
});

test("E2-03 · Cas non validé : « Je valide ce cas » et « Fabriquer un essai », jamais « Fabriquer la vidéo »", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/cas-concret");
  const details = await ouvrirAValider(page);
  const bloc = details.locator("li", { hasText: CAS.email }).first();
  await expect(bloc.getByRole("button")).toHaveText(["Je valide ce cas", "Fabriquer un essai"]);
  await expect(page.getByRole("button", { name: /Fabriquer la vidéo/ })).toHaveCount(0);
  await bloc.getByRole("button", { name: "Fabriquer un essai" }).click();
  const feuille = page.getByRole("dialog");
  await expect(feuille).toContainText("Essai : cas à confirmer par Will, ne pas publier.");
  await expect(feuille.getByRole("button", { name: "Je valide ce cas" })).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test("E2-04 · Double clic : une seule vidéo", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  const avant = await nombreDeVideos(page);
  await ouvrirCas(page, CAS.recrutement);
  await saisirLeMot(page, motDe("04", info));
  await page.getByRole("button", { name: /Fabriquer la vidéo/ }).dblclick();
  await expect(page.getByRole("button", { name: /^Confirmer / })).toHaveCount(1);
  await page.getByRole("button", { name: /^Confirmer / }).click();
  await page.waitForURL(/\/videos\/[^/]+$/, { timeout: 60_000 });
  expect(await nombreDeVideos(page)).toBe(avant + 1);
  expect(erreurs).toEqual([]);
});

test("E2-05 · Étape en échec : « Les écrans » échoue avec une phrase, « Reprendre » la reprend", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await ouvrirCas(page, CAS.recrutement);
  await fabriquerEtArriver(page, motDe("05", info, "PANNE"));
  await etapeEn(page, "Les écrans", "à reprendre");
  await expect(page.locator("main")).toContainText("L'étape « Les écrans » n'a pas abouti.");
  await page.getByRole("button", { name: "Reprendre cette étape" }).click();
  await attendreVideoPrete(page);
  expect(erreurs).toEqual([]);
});

test("E2-06 · Mots interdits : ni « machine », ni « Villeexemple », ni « aucun gain garanti », ni « undefined », ni tutoiement", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  const interdits = (t: string) => [
    ...(t.match(/machine|villeexemple|aucun gain garanti|undefined|\[object/gi) ?? []),
    ...(t.match(/(?<!\p{L})(tu|toi|ton|ta|tes)(?!\p{L})/giu) ?? []),
  ];
  await page.goto("/cas-concret");
  await expect(carteDe(page, CAS.recrutement)).toBeVisible();
  expect(interdits(await page.locator("main").innerText())).toEqual([]);
  await carteDe(page, CAS.recrutement).click();
  await expect(page.getByRole("dialog")).toContainText("Votre vidéo");
  expect(interdits(await page.getByRole("dialog").innerText())).toEqual([]);
  await videoPrete(page, info, "06");
  expect(interdits(await page.locator("main").innerText())).toEqual([]);
  expect(erreurs).toEqual([]);
});

test("E2-07 · Rien ne change ailleurs : facecam et avocat s'ouvrent, la fiche de l'avocat garde sa publication", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  for (const [adresse, titre] of [["/nouvelle/facecam", "Vidéo face caméra"], ["/nouvelle/avocat", "Vidéo type avocat"]] as const) {
    const reponse = await page.goto(adresse);
    expect(reponse?.status()).toBe(200);
    await expect(page.locator("main")).toContainText(titre);
  }
  await page.goto("/videos/v-03");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("L'IA peut-elle remplacer mon comptable ?");
  await expect(page.locator("main")).not.toContainText("Vos fichiers");
  await expect(page.locator("main")).not.toContainText("Cas concret");
  await expect(page.getByRole("tab", { name: /Publier|Publication/i }).or(page.getByRole("button", { name: /Publier|Publication/i })).first()).toBeVisible();
  expect(erreurs).toEqual([]);
});

test("E2-08 · Aucune publication : ni « Publier », ni « Programmer » sur toute la page d'une vidéo du format", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await videoPrete(page, info, "08");
  for (const role of ["button", "tab", "link"] as const) await expect(page.getByRole(role, { name: /Publier|Programmer/i })).toHaveCount(0);
  expect(erreurs).toEqual([]);
});

test("E2-10 · Écriture refusée deux fois : échec en une phrase à « L'écriture », aucune voix faite, « Reprendre » proposé", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await ouvrirCas(page, CAS.recrutement);
  await fabriquerEtArriver(page, motDe("10", info, "REFUS"));
  await etapeEn(page, "L'écriture", "à reprendre");
  const texte = await page.locator("main").innerText();
  expect(texte).toContain("L'étape « L'écriture » n'a pas abouti.");
  expect(texte).not.toMatch(/La voix\s*,\s*(terminée|en cours)/);
  await expect(page.getByRole("button", { name: /Reprendre/ })).toBeVisible();
  expect(erreurs).toEqual([]);
});

test("E2-11 · Vrai écran remplacé : « Écran réel remplacé par un dessin » dans « Vérifications »", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await videoPrete(page, info, "11");
  const verifications = vosFichiers(page).locator("section, div").filter({ has: page.getByRole("heading", { name: "Vérifications" }) }).last();
  await expect(verifications).toContainText("Écran réel remplacé par un dessin");
  await expect(verifications).not.toContainText("Écran réel : Écran réel");
  expect(erreurs).toEqual([]);
});

test("E2-12 · Arrêter : pendant « Les écrans », la vidéo n'est plus en fabrication, sans erreur", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await ouvrirCas(page, CAS.recrutement);
  await fabriquerEtArriver(page, motDe("12", info));
  await etapeEn(page, "Les écrans", "en cours");
  await page.getByRole("button", { name: "Arrêter" }).click();
  const confirmer = page.getByRole("dialog").getByRole("button", { name: /Arrêter|Confirmer|Oui/ });
  if (await confirmer.first().isVisible().catch(() => false)) await confirmer.first().click();
  await expect(page.getByRole("button", { name: "Arrêter" })).toHaveCount(0);
  await expect(page.locator("main")).not.toContainText("En fabrication");
  expect(erreurs).toEqual([]);
});

test("E2-13 · Non connecté : /cas-concret renvoie à la connexion", async ({ page }) => {
  test.skip(!MDP, "E2E_MDP manquant");
  await page.goto("/cas-concret");
  await expect(page).toHaveURL(/\/connexion/);
  await expect(page.getByLabel("Mot de passe", { exact: true })).toBeVisible();
});

test("E2-14 · Tableau animé intact : son écran s'ouvre, aucune phrase « diagnostic »", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  // Le tableau animé est ouvert depuis #124 (« Allume le format tableau animé ») : son écran d'entrée s'affiche.
  await page.goto("/tableau/nouvelle");
  await expect(page.locator("main")).toContainText("Tableau animé");
  await expect(page.locator("main")).toContainText("Votre texte, écrit et dessiné au trait.");
  await expect(page.locator("main")).not.toContainText(/diagnostic/i);
  await expect(page.locator("main")).not.toContainText("Cas concret");
  for (const adresse of ["/nouvelle"]) {
    expect((await page.goto(adresse))?.status()).toBe(200);
    await expect(page.locator("main")).not.toContainText("Cas concret");
  }
  expect(erreurs).toEqual([]);
});

test("E2-15 · Mes vidéos : après une fabrication, la liste s'ouvre sans erreur et montre la vidéo", async ({ page }, info) => {
  test.setTimeout(UNE_FABRICATION_MS);
  await seConnecter(page);
  const erreurs = surveiller(page);
  await videoPrete(page, info, "15");
  const reponse = await page.goto("/videos");
  expect(reponse?.status()).toBe(200);
  await expect(page.locator('a[href^="/videos/"]', { hasText: CAS.recrutement }).first()).toBeVisible();
  expect(erreurs).toEqual([]);
});

/**
 * X8 · Essai réel en ligne : rien de désigné pour « Vidéo type avocat » (« Habituelle »), la voix habituelle prête suffit.
 * Le refus « aucune voix prête de HeyGen » (consigne et lien) est couvert par `tests/cas-concret/ecrans/entree.test.ts`
 * et `tests/cas-concret/services/voix` : la simulation ne permet pas de retirer la voix d'essai par l'écran.
 */
test("E2-16 · Voix habituelle, rien de désigné pour l'avocat : la feuille ne refuse pas ; « Fabriquer » actif", async ({ page }) => {
  await seConnecter(page);
  const erreurs = surveiller(page);
  await page.goto("/personnages/p-will?onglet=voix");
  const ligne = page.locator("section[aria-labelledby=voix-par-format]").getByRole("button", { name: /Vidéo type avocat/ });
  await expect(ligne).toBeVisible();
  if (!/Habituelle/.test(await ligne.innerText())) {
    await ligne.click();
    await page.getByRole("radio", { name: /Voix habituelle/ }).click();
    await expect(ligne).toContainText("Habituelle");
  }
  await ouvrirCas(page, CAS.recrutement);
  const feuille = page.getByRole("dialog");
  await expect(feuille.getByRole("button", { name: /Fabriquer la vidéo/ })).toBeEnabled();
  await expect(feuille).not.toContainText("Votre voix n'est pas prête");
  expect(erreurs).toEqual([]);
});
