// Captures « Relire le script » dans le générateur de sujets (grande chaîne), téléphone 390 px, dans
// docs/captures/relire-generateur/. Usage : E2E_MDP='…' node scripts/captures-relire-generateur.mjs [url de base]
// Même outil que captures-relire-script.mjs : le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit nulle part.
// Serveur SANS clé (écriture et vidéos simulées, 0 €) : le script crée son propre sujet, l'écrit, puis relit.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.E2E_BASE ?? "http://localhost:3107";
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "relire-generateur");
const MATIERE =
  "Chez un client, une personne passait 35 heures par semaine à recopier des tableaux Excel. Aujourd'hui la tâche prend presque zéro heure. Par contre, si vos tableaux changent de forme chaque mois, gardez le tableur.";

if (!MDP) {
  console.error("E2E_MDP manquant");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", reducedMotion: "reduce" });
const p = await contexte.newPage();
const visible = (l) => l.isVisible().catch(() => false);

async function capturer(nom, { plein = true } = {}) {
  await p.waitForTimeout(800);
  if (plein) {
    const hauteur = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: 390, height: Math.max(844, hauteur) });
    await p.waitForTimeout(300);
  }
  await p.screenshot({ path: join(SORTIE, `${nom}-390.png`) });
  await p.setViewportSize({ width: 390, height: 844 });
  console.log("✓", nom);
}

// Connexion.
await p.goto(`${BASE}/connexion`);
await p.getByLabel(/mot de passe/i).first().fill(MDP);
await p.getByRole("button", { name: /Entrer|Se connecter|Connexion/i }).first().click();
await p.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 });

// Un sujet écrit en simulation (matière, accord, limite validée).
await p.goto(`${BASE}/ecrire/atelier`, { waitUntil: "networkidle", timeout: 120000 });
await p.getByPlaceholder("Dites ou tapez votre idée").fill("Pourquoi vos tableaux Excel vous coûtent un temps plein");
await p.getByRole("button", { name: /^Écrire ·/ }).click();
await p.waitForURL(/\/ecrire\/sujets\//, { timeout: 60000 });
const fiche = p.url().split("?")[0];
await p.getByLabel("Votre matière").fill(MATIERE);
await p.getByRole("button", { name: /Ajouter et écrire/ }).click();
for (let i = 0; i < 40; i++) {
  await p.waitForTimeout(3000);
  await p.goto(fiche, { waitUntil: "networkidle" });
  const accord = p.getByRole("button", { name: /J'ai son accord/ }).first();
  if (await visible(accord)) await accord.click();
  if (await visible(p.getByRole("button", { name: /Valider les \d/ }))) break;
}
const juste = p.getByRole("button", { name: "C'est juste" });
if (await visible(juste)) {
  await juste.click();
  await p.waitForTimeout(2500);
  await p.goto(fiche, { waitUntil: "networkidle" });
}

// 1. La fiche sujet : une version ouverte, « Relire et modifier · 0 € » à la place de « Corriger une phrase ».
await p.getByRole("button", { name: /Pourquoi vos tableaux|Vos données|Votre excel|Il ne faut/ }).first().click();
await p.waitForTimeout(600);
const relireModifier = p.getByRole("link", { name: /Relire et modifier/ }).first();
await relireModifier.scrollIntoViewIfNeeded();
await capturer("1-fiche-relire-et-modifier", { plein: false });

// 2. Relire et modifier (0 €) : l'écran commun ouvert sur la version.
await relireModifier.click();
await p.waitForURL(/\/relire/, { timeout: 60000 });
await p.getByText("Prêt").or(p.getByText(/à corriger/)).first().waitFor({ timeout: 30000 });
await capturer("2-relire-et-modifier");

// 3. Une phrase modifiée : pastilles refaites en direct, au barème « will ».
await p.getByRole("button", { name: "Modifier la phrase 1" }).click();
await p.getByLabel("Phrase 1").fill("Vos tableaux Excel vous coûtent un temps plein, et personne ne le voit.");
await p.waitForTimeout(2500);
await capturer("3-phrase-modifiee");

// 4. Versions validées, « Fabriquer » d'une version : la feuille du prix mène à « Relire le script ».
await p.goto(fiche, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Valider les \d/ }).click();
await p.waitForTimeout(2500);
await p.goto(fiche, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Pourquoi vos tableaux|Vos données|Votre excel|Il ne faut/ }).first().click();
await p.getByRole("button", { name: /^Fabriquer$/ }).first().click();
await p.getByRole("link", { name: "Relire le script" }).waitFor();
await capturer("4-feuille-fabriquer", { plein: false });

// 5. Relire avant la vidéo, puis 6. la confirmation du prix.
await p.getByRole("link", { name: "Relire le script" }).click();
await p.waitForURL(/\/relire/, { timeout: 60000 });
await p.getByText("Prêt").or(p.getByText(/à corriger/)).first().waitFor({ timeout: 30000 });
await capturer("5-relire-avant-la-video");
await p.getByRole("button", { name: /Lancer la vidéo/ }).click();
await p.waitForTimeout(1200);
await capturer("6-confirmation-prix", { plein: false });

// 7. « Fabriquer les N » : le lot entier, milieu commun une seule fois.
await p.goto(`${fiche}/relire`, { waitUntil: "networkidle" });
await p.getByText("Prêt").or(p.getByText(/à corriger/)).first().waitFor({ timeout: 30000 });
await capturer("7-relire-les-n");

await navigateur.close();
