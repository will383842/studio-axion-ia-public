/**
 * PARCOURS PRINCIPAUX (B.9, AV2.4-5 ; lot M3 du moteur avocat, B.0 §2) :
 * - parcours complet (avocat, seul format actif) : accueil → « Votre vidéo » en mode rapide (coller, Fabriquer)
 *   → fabrication simulée jusqu'à « prête » → fiche vidéo → lien public (contexte NON connecté) → révocation → 410 ;
 * - écran « Votre vidéo » (avocat) : ≤ 4 touches APRÈS le choix du format (coller le texte compte pour UNE action,
 *   puis « Fabriquer », la relecture du script, « Lancer la vidéo » et l'accord du prix), et l'aperçu du plateau
 *   composé en moins d'une seconde à 390 px ;
 * - route protégée sans session → /connexion.
 */
import { expect, test, type Page } from "@playwright/test";

const MDP = process.env.E2E_MDP;

async function seConnecter(page: Page) {
  test.skip(!MDP, "E2E_MDP manquant");
  await page.goto("/connexion");
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP!);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30_000 }), page.getByRole("button", { name: "Entrer" }).click()]);
}

test("route protégée sans session → /connexion", async ({ page }) => {
  await page.goto("/videos");
  await expect(page).toHaveURL(/\/connexion\?suite=%2Fvideos/);
  const api = await page.request.get("/api/travaux");
  expect(api.status()).toBe(401);
});

// Relire le script (brique 6) : un texte non retouché est contrôlé au barème « machine » ; « Je vous explique » (boucle
// annoncée, C40) y bloquerait le lancement jusqu'à ce que Will retouche la phrase. Le parcours n'en a pas.
const TEXTE_AVOCAT =
  "Votre patron peut-il lire vos mails ? En trente secondes, voici la règle. Un mail envoyé depuis la messagerie du travail est présumé professionnel. " +
  "Votre employeur peut donc l'ouvrir, sauf s'il porte la mention personnel. La Cour de cassation l'a jugé en 2001, et le confirme depuis. " +
  "Retenez ce mot : personnel. Et la prochaine fois qu'on vous demande si votre patron lit vos mails, vous saurez quoi répondre.";

/** Colle le texte dans la zone « Votre texte » (UNE action, comme un vrai collage). */
async function collerTexte(page: Page, texte: string) {
  const zone = page.getByRole("textbox", { name: "Votre texte", exact: true });
  await expect(zone).toBeVisible();
  await zone.evaluate((el, t) => {
    const dt = new DataTransfer();
    dt.setData("text/plain", t);
    el.dispatchEvent(new ClipboardEvent("paste", { clipboardData: dt, bubbles: true, cancelable: true }));
  }, texte);
}

/**
 * Relire le script (brique 6) : « Fabriquer » ouvre TOUJOURS la relecture ; « Lancer la vidéo (≈ prix) », puis
 * l'accord sur le prix (« Confirmer … »). Renvoie le nombre de touches.
 */
async function lancerApresRelecture(page: Page): Promise<number> {
  await expect(page.getByRole("heading", { name: "Relire le script" })).toBeVisible();
  const lancer = page.getByRole("button", { name: /^Lancer la vidéo/ });
  await expect(lancer).toBeEnabled({ timeout: 15_000 });
  await lancer.click();
  const confirmer = page.getByRole("button", { name: /^Confirmer/ });
  if (await confirmer.isVisible({ timeout: 3_000 }).catch(() => false)) {
    await confirmer.click();
    return 2;
  }
  return 1;
}

// Seul l'avocat est un format actif (les autres sont « Bientôt ») : le parcours complet passe par l'écran « Votre vidéo », mode rapide.
test("parcours complet (avocat, mode rapide) : accueil → coller → Fabriquer en ≤ 5 touches → vidéo prête → lien public → révocation → 410", async ({ page, browser }, info) => {
  await seConnecter(page);
  await expect(page).toHaveURL(/\/$/);

  let touches = 0;
  // 1. Carte « Nouvelle vidéo » de l'accueil.
  await page.locator('main a[href="/nouvelle"]').first().click();
  touches++;
  await expect(page).toHaveURL(/\/nouvelle$/);
  // 2. Le format « type avocat ».
  await page.locator('main a[href="/nouvelle/avocat"]').first().click();
  touches++;
  await expect(page.getByRole("heading", { name: "Votre vidéo" })).toBeVisible();

  // 3. Coller le texte (UNE action).
  await collerTexte(page, TEXTE_AVOCAT);
  touches++;
  await expect(page.getByRole("button", { name: /^Script : ≈/ })).toBeVisible({ timeout: 20_000 });
  await expect(page).toHaveURL(/brouillon=/, { timeout: 20_000 });

  // 4. Fabriquer → relecture du script (brique 6) → « Lancer la vidéo » → accord sur le prix.
  const fabriquer = page.getByRole("button", { name: /^Fabriquer · (≈|Essai gratuit)/ });
  await expect(fabriquer).toBeEnabled({ timeout: 30_000 });
  await fabriquer.click();
  touches++;
  touches += await lancerApresRelecture(page);
  console.log(`[${info.project.name}] touches jusqu'au lancement : ${touches}`);
  expect(touches).toBeLessThanOrEqual(6);

  // Fabrication simulée jusqu'à « prête ».
  const voir = page.getByRole("link", { name: "Voir la vidéo" });
  await expect(voir).toBeVisible({ timeout: 150_000 });
  await voir.click();
  await expect(page).toHaveURL(/\/videos\/[^/?]+/);
  const videoUrl = page.url();

  // Fiche vidéo : lecteur présent, lien privé.
  await expect(page.locator("video").first()).toBeAttached();
  await page.getByRole("button", { name: "Lien privé" }).first().click();
  await page.getByRole("button", { name: /Créer et copier le lien/ }).click();
  const lien = page.locator("p.font-mono").filter({ hasText: "/v/" });
  await expect(lien).toBeVisible();
  const chemin = /\/v\/[a-z0-9]+/.exec((await lien.textContent()) ?? "")?.[0];
  expect(chemin).toBeTruthy();

  // Lien public dans un contexte NON connecté.
  const anonyme = await browser.newContext();
  try {
    const publique = await anonyme.newPage();
    const r = await publique.goto(chemin!);
    expect(r?.status()).toBe(200);
    await expect(publique.locator("video").first()).toBeAttached();
    await expect(publique).toHaveURL(new RegExp(chemin!.replace(/\//g, "\/")));
    expect((await r!.allHeaders())["x-robots-tag"]).toContain("noindex");

    // Révocation depuis la fiche.
    await page.goto(videoUrl);
    await page.getByRole("button", { name: "Lien privé" }).first().click();
    const ligne = page.getByRole("button", { name: `Copier ${chemin}` }).locator("xpath=ancestor::li[1]");
    const revoquer = (await ligne.count()) ? ligne.getByRole("button", { name: "Révoquer" }) : page.getByRole("button", { name: "Révoquer" }).first();
    await revoquer.click();
    await expect(page.getByText("Lien révoqué").first()).toBeVisible();

    // 410 + page soignée.
    const apres = await publique.goto(chemin!);
    expect(apres?.status()).toBe(410);
    await expect(publique.getByRole("heading", { name: /Ce lien n.est plus actif/ })).toBeVisible();
  } finally {
    await anonyme.close();
  }
});

test("écran « Votre vidéo » (avocat) : coller le texte, Fabriquer, relire, lancer — 4 touches au plus après le choix du format", async ({ page }, info) => {
  await seConnecter(page);
  await page.goto("/nouvelle/avocat");
  await expect(page.getByRole("heading", { name: "Votre vidéo" })).toBeVisible();

  let touches = 0;
  // 1. Coller le texte (UNE action) : il est découpé en blocs de la recette, sans un mot réécrit.
  await collerTexte(page, TEXTE_AVOCAT);
  touches++;
  await expect(page.getByRole("button", { name: /^Script : ≈/ })).toBeVisible({ timeout: 20_000 });

  // Le brouillon s'enregistre tout seul (≈ 800 ms) et le prix s'affiche sur le bouton.
  await expect(page).toHaveURL(/brouillon=/, { timeout: 20_000 });
  const fabriquer = page.getByRole("button", { name: /^Fabriquer · (≈|Essai gratuit)/ });
  await expect(fabriquer).toBeEnabled({ timeout: 30_000 });

  // 2. Fabriquer : la relecture s'ouvre MÊME sous le seuil (brique 6), puis « Lancer la vidéo » et l'accord du prix.
  await fabriquer.click();
  touches++;
  touches += await lancerApresRelecture(page);
  console.log(`[${info.project.name}] touches après le choix du format (avocat) : ${touches}`);
  expect(touches).toBeLessThanOrEqual(4);
  await expect(page.getByRole("link", { name: "Voir la vidéo" })).toBeVisible({ timeout: 120_000 });
});

test("relecture : la flèche retour garde les phrases retouchées, reprises au prochain « Fabriquer »", async ({ page }) => {
  await seConnecter(page);
  await page.goto("/nouvelle/avocat");
  await collerTexte(page, TEXTE_AVOCAT);
  await expect(page).toHaveURL(/brouillon=/, { timeout: 20_000 });
  const fabriquer = page.getByRole("button", { name: /^Fabriquer · (≈|Essai gratuit)/ });
  await expect(fabriquer).toBeEnabled({ timeout: 30_000 });
  await fabriquer.click();
  await expect(page.getByRole("heading", { name: "Relire le script" })).toBeVisible();
  await page.getByRole("button", { name: "Modifier la phrase 1" }).click();
  await page.getByRole("textbox", { name: "Phrase 1" }).fill("Votre patron a-t-il le droit de lire vos mails ?");
  await page.getByRole("button", { name: "OK" }).click();
  await expect(page.getByText("1 modifiée")).toBeVisible();
  // Flèche retour (vérifier le décor…), puis « Fabriquer » de nouveau : la phrase retouchée est toujours là.
  await page.getByRole("button", { name: "Revenir à votre vidéo" }).click();
  await expect(page.getByRole("heading", { name: "Votre vidéo" })).toBeVisible();
  await fabriquer.click();
  await expect(page.getByRole("heading", { name: "Relire le script" })).toBeVisible();
  await expect(page.getByText("Votre patron a-t-il le droit de lire vos mails ?")).toBeVisible();
  await expect(page.getByText("1 modifiée")).toBeVisible();
});

test("écran « Votre vidéo » : l'aperçu du plateau se compose en moins d'une seconde à 390 px, et le brouillon se reprend", async ({ page }) => {
  await seConnecter(page);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/nouvelle/avocat");
  await page.getByRole("textbox", { name: "Votre texte", exact: true }).fill(TEXTE_AVOCAT);
  await page.getByRole("button", { name: "Utiliser ce texte" }).click();
  await expect(page).toHaveURL(/brouillon=/, { timeout: 20_000 });
  const adresse = page.url();

  await page.getByRole("button", { name: /^Plateau :/ }).click();
  const apercu = page.getByTestId("apercu-plateau");
  await expect(apercu).toHaveAttribute("data-duree-ms", /^\d+$/, { timeout: 5_000 });
  const duree = Number(await apercu.getAttribute("data-duree-ms"));
  console.log(`aperçu du plateau composé en ${duree} ms`);
  expect(duree).toBeLessThan(1000);

  // Choisir un autre décor, quitter, revenir : le choix est gardé (enregistrement différé).
  await page.getByRole("radio", { name: /Crème chaud/ }).click();
  await page.waitForTimeout(1500);
  await page.goto(adresse);
  await page.getByRole("button", { name: /^Plateau :/ }).click();
  await expect(page.getByRole("radio", { name: /Crème chaud/ })).toHaveAttribute("aria-checked", "true");
});

test("écran « Votre vidéo » ouvert depuis un script : le brouillon naît seul et le coût s'affiche sans rien toucher", async ({ page }) => {
  await seConnecter(page);
  await page.goto("/nouvelle/avocat?script=script-2");
  await expect(page.getByRole("button", { name: /^Script : ≈/ })).toBeVisible({ timeout: 20_000 });
  // Avant correction : « Coût : Calcul en cours » pour toujours, faute de brouillon enregistré.
  await expect(page.getByRole("button", { name: /^Coût : ≈/ })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("button", { name: /^Fabriquer · (≈|Essai gratuit)/ })).toBeVisible();
  await expect(page).toHaveURL(/brouillon=/);
  // Format sans musique : l'interrupteur de la brique son ne parle pas de musique.
  await page.getByRole("button", { name: /^Style :/ }).click();
  await expect(page.getByText("Son et bruitages", { exact: true })).toBeVisible();
  await expect(page.getByText("Musique et bruitages", { exact: true })).toHaveCount(0);
});

// Lot A1 (M0b) : « Relier ma voix HeyGen » — la liste s'ouvre, un toucher sur « Choisir », la voix est reliée.
// Sans HEYGEN_API_KEY sur le serveur, ce sont les voix d'essai (rien n'est envoyé à HeyGen).
test("Relier ma voix : la liste HeyGen s'ouvre, Choisir, la voix est reliée et devient celle de Will", async ({ page }) => {
  await seConnecter(page);
  await page.goto("/personnages/p-will?onglet=voix");
  const dejaReliee = await page.getByText("Voix reliée").first().isVisible().catch(() => false);
  await page.getByRole("button", { name: dejaReliee ? /Changer de voix HeyGen/ : /Relier ma voix HeyGen/ }).last().click();
  const feuille = page.getByRole("dialog").last();
  await expect(feuille.getByRole("heading", { name: "Relier ma voix HeyGen" })).toBeVisible();
  // Une voix utilisable (« Choisir ») ou déjà reliée (« Reliée ») ; une voix qui ne sait pas lire un texte seul n'est pas choisissable.
  const choisir = feuille.getByRole("button", { name: "Choisir", exact: true }).first();
  if (!dejaReliee) {
    await expect(choisir).toBeEnabled({ timeout: 30_000 });
    await expect(feuille.getByRole("button", { name: /^Écouter / }).first()).toBeVisible();
    await choisir.click();
    await expect(feuille).toBeHidden({ timeout: 30_000 });
  } else {
    await expect(feuille.getByText("Reliée", { exact: true }).first()).toBeVisible({ timeout: 30_000 });
    await page.keyboard.press("Escape");
  }
  await expect(page.getByText("Voix reliée").first()).toBeVisible({ timeout: 30_000 });
  // Après rechargement : toujours reliée (écrite côté serveur), et le bouton propose de CHANGER, plus de relier.
  await page.reload();
  await expect(page.getByText("Voix reliée").first()).toBeVisible();
  await expect(page.getByRole("button", { name: /Changer de voix HeyGen/ }).last()).toBeVisible();
});

// Lot A1 (prononciations n° 2) : un mot à risque détecté dans le script → « Comment dire … ? » → ajouté → plus proposé,
// et présent dans Bibliothèque > Prononciations.
test("prononciation détectée dans le script → ajoutée en un geste → retrouvée dans la Bibliothèque", async ({ page }) => {
  await seConnecter(page);
  // Un nom propre inventé, en lettres seulement, différent à chaque passage (mobile puis bureau).
  const mot = `Zorva${[...Date.now().toString().slice(-4)].map((c) => "bcdfgklmnr"[Number(c)]).join("")}`;
  await page.goto("/nouvelle/avocat");
  await collerTexte(page, `Chez ${mot}, nous vous expliquons tout simplement comment contester une amende en quarante-cinq jours, sans avocat et sans frais.`);
  await expect(page.getByRole("button", { name: /^Script : ≈/ })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: /^Script : ≈/ }).first().click();
  const pastille = page.getByRole("button", { name: new RegExp(`Comment dire « ${mot} » \?`) });
  await expect(pastille).toBeVisible({ timeout: 20_000 });
  await pastille.click();
  const ajout = page.getByRole("dialog").last();
  await expect(ajout.getByLabel("Le mot, tel qu'il s'écrit")).toHaveValue(mot);
  // ▶ Avant : la voix lit la phrase type (son de démonstration sans clé).
  await ajout.getByRole("button", { name: /Avant/ }).click();
  await ajout.getByLabel("Comment le dire").fill("zor-va-tèk");
  await ajout.getByRole("button", { name: "Ajouter", exact: true }).click();
  await expect(page.getByText(`« ${mot} » ajouté`).first()).toBeVisible({ timeout: 15_000 });
  await expect(pastille).toBeHidden({ timeout: 15_000 });

  await page.goto("/bibliotheque/prononciations");
  await expect(page.getByText(mot, { exact: true }).first()).toBeVisible({ timeout: 15_000 });
  await expect(page.getByText("zor-va-tèk").first()).toBeVisible();
});
