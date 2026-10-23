// Captures « Relire le script » du cas concret (brique 3 sur 8) au téléphone (390 px), dans
// docs/captures/relire-cas-concret/. Vrai parcours du studio (base en mémoire, fabrication simulée : rien n'est payé).
// Usage : E2E_MDP='…' node scripts/captures-relire-cas-concret.mjs [url de base]
// Le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit nulle part.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.E2E_BASE ?? "http://localhost:3107";
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "relire-cas-concret");
const VUE = { width: 390, height: 844 };

if (!MDP) {
  console.error("E2E_MDP manquant");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const contexte = await navigateur.newContext({ viewport: VUE, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", reducedMotion: "reduce" });
const p = await contexte.newPage();

/** Capture : l'écran visible (feuilles), ou la page entière (fenêtre agrandie : la barre collée reste en bas). */
async function capture(nom, { plein = true } = {}) {
  await p.waitForTimeout(600);
  if (plein) {
    const hauteur = await p.evaluate(() => document.documentElement.scrollHeight);
    await p.setViewportSize({ width: VUE.width, height: Math.max(VUE.height, hauteur) });
    await p.waitForTimeout(300);
  }
  await p.screenshot({ path: join(SORTIE, `${nom}-390.png`) });
  await p.setViewportSize(VUE);
  console.log("✓", nom);
}

await p.goto(`${BASE}/connexion`);
await p.getByLabel(/mot de passe/i).first().fill(MDP);
await p.getByRole("button", { name: /Entrer|Se connecter|Connexion/i }).first().click();
await p.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 });

// 1. Script déjà validé : la feuille mène à la relecture avant le lancement.
await p.goto(`${BASE}/cas-concret`, { waitUntil: "networkidle" });
await p.getByRole("button", { name: /Recruter des apporteurs/ }).first().click();
await p.getByRole("button", { name: "Relire le script, puis lancer" }).waitFor({ timeout: 20000 });
await capture("1-feuille-relire-puis-lancer", { plein: false });
await p.getByRole("button", { name: "Relire le script, puis lancer" }).click();
await p.getByText("Prêt").first().waitFor({ timeout: 30000 });
await capture("2-relire-avant-lancement");
await p.getByRole("button", { name: "Modifier la phrase 2", exact: true }).click();
await capture("3-chiffre-verrouille", { plein: false });
await p.getByRole("button", { name: "OK" }).click();
await p.getByRole("button", { name: "Modifier la phrase 1", exact: true }).click();
await p.getByLabel("Phrase 1", { exact: true }).fill("On recrute nos collaborateurs sans");
await p.waitForTimeout(2500);
await capture("4-phrase-modifiee");
await p.getByRole("button", { name: /Lancer la vidéo/ }).click();
await capture("5-confirmation-prix", { plein: false });
await p.getByRole("button", { name: /^Confirmer/ }).click();
await p.waitForURL((u) => u.pathname.startsWith("/videos/"), { timeout: 60000 });
await capture("6-lancee-nouvelle-version");

// 2. Cas sans script validé : la fabrication s'arrête « À relire » avant la voix, l'écran commun sur la fiche vidéo.
await p.goto(`${BASE}/cas-concret`, { waitUntil: "networkidle" });
await p.getByText(/À valider/).first().click();
await p.getByRole("button", { name: "Fabriquer un essai" }).first().click();
await p.getByRole("button", { name: /Fabriquer la vidéo/ }).click();
await p.getByRole("button", { name: /^Confirmer/ }).click();
await p.waitForURL((u) => u.pathname.startsWith("/videos/"), { timeout: 60000 });
for (let i = 0; i < 60; i++) {
  if (await p.getByRole("button", { name: /Valider ce script/ }).count()) break;
  await p.waitForTimeout(3000);
  await p.reload({ waitUntil: "networkidle" });
}
await p.getByText("Prêt").first().waitFor({ timeout: 30000 });
await capture("7-fiche-a-relire");
await p.getByRole("button", { name: "Modifier la phrase 2", exact: true }).click();
await capture("8-fiche-modifier-phrase", { plein: false });

await contexte.close();
await navigateur.close();
