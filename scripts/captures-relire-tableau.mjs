// Captures « Relire le script » du TABLEAU ANIMÉ (brique 7 sur 8) à 390 px, dans docs/captures/relire-tableau/.
// Usage : E2E_MDP='…' node scripts/captures-relire-tableau.mjs [url de base] [videoId d'un brouillon avec fiche]
// Même outil que captures-relire-script.mjs : le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit nulle part.
// Rien n'est payé : les captures s'arrêtent à la confirmation du prix (« Annuler »).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.E2E_BASE ?? "http://localhost:3107";
const BROUILLON = process.argv[3] ?? process.env.E2E_BROUILLON;
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "relire-tableau");

/** Le texte du gabarit validé le 15/10 (« Ce devis collé dans ChatGPT… »), collé à la main. */
const TEXTE =
  "Ce devis collé dans ChatGPT contient trois données de trop. Le nom du client. L'adresse du chantier. Son portable. Selon les réglages, l'outil peut s'en servir pour s'entraîner. Votre client, lui, n'a rien autorisé. Trois réflexes à prendre avant de coller. Le troisième se cache là où personne ne regarde. Un. Remplacez les noms par des lettres. Monsieur Martin devient Client A, la société Durand devient Fournisseur B. Pour rédiger une relance, l'IA n'a pas besoin du vrai nom. Deux. Effacez les coordonnées : adresse, téléphone, e-mail, numéro de dossier. Gardez seulement ce qui sert à la réponse, par exemple « chantier en ville ». Trois. Coupez la signature et l'historique en bas du mail. C'est là que restent le nom, le portable et souvent l'adresse du client. Une assistante prépare une relance de devis. Avant, elle collait tout le fil de mails. Maintenant, elle colle six lignes : Client A, sans coordonnées, sans signature. La relance est aussi utile, et les données du client restent chez vous. Ce qui permet de reconnaître votre client ne se colle pas. Axion-IA forme les équipes à ces réflexes. Réservez un appel de diagnostic.";

const TELEPHONE = { viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", reducedMotion: "reduce" };

if (!MDP) {
  console.error("E2E_MDP manquant");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const contexte = await navigateur.newContext(TELEPHONE);
const page = await contexte.newPage();

/** Page entière (la barre collée reste en bas), ou l'écran seul (`feuille` : la confirmation du prix). */
async function capturer(nom, { feuille = false } = {}) {
  await page.waitForTimeout(600);
  if (!feuille) {
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 390, height: Math.max(844, hauteur) });
    await page.waitForTimeout(300);
  }
  await page.screenshot({ path: join(SORTIE, `${nom}-390.png`) });
  await page.setViewportSize(TELEPHONE.viewport);
  console.log("✓", nom);
}

await page.goto(`${BASE}/connexion`);
await page.getByLabel(/mot de passe/i).first().fill(MDP);
await page.getByRole("button", { name: /Entrer|Se connecter|Connexion/i }).first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 30000 });

// 1. Avant « Découper en scènes » : le texte dit se relit.
await page.goto(`${BASE}/tableau/nouvelle`, { waitUntil: "networkidle" });
await page.getByRole("button", { name: "J'ai déjà mon texte" }).first().click();
await page.getByLabel("Le texte dit").fill(TEXTE);
await page.getByRole("button", { name: "Relire le texte" }).click();
await page.getByText(/^Prêt$|à corriger/).first().waitFor({ timeout: 30000 });
await capturer("1-texte-relu");

await page.getByRole("button", { name: "Modifier la phrase 6" }).click();
await page.getByLabel("Phrase 6").fill("Votre client, lui, n'a rien autorisé : contactez-nous dès demain.");
await page.waitForTimeout(2500);
await capturer("2-mot-interdit");

await page.getByRole("button", { name: "Rétablir" }).click();
await page.getByRole("button", { name: "Texte libre" }).click();
await page.waitForTimeout(2500);
await capturer("3-texte-libre");

await page.getByRole("button", { name: /Découper en scènes/ }).click();
await page.getByRole("button", { name: /Annuler/ }).first().waitFor({ timeout: 10000 });
await capturer("4-confirmation-decoupage", { feuille: true });
await page.getByRole("button", { name: /Annuler/ }).first().click();

// 2. Avant « Fabriquer » : la fiche se relit (brouillon découpé fourni).
if (BROUILLON) {
  await page.goto(`${BASE}/tableau/nouvelle?brouillon=${BROUILLON}`, { waitUntil: "networkidle" });
  await page.getByText(/^Prêt$|à corriger/).first().waitFor({ timeout: 30000 });
  await capturer("5-fiche-relue");
  await page.getByRole("button", { name: "Modifier la phrase 2" }).click();
  const zone = page.getByLabel("Phrase 2");
  await zone.fill(`${await zone.inputValue()} Encore une phrase.`);
  await page.waitForTimeout(3000);
  await capturer("6-fiche-modifiee");
}

await navigateur.close();
