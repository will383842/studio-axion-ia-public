// Captures de l'aperçu « Relire le script » (brique 1 sur 8) à 390 px et 1440 px, dans docs/captures/relire-script/.
// Usage : E2E_MDP='…' node scripts/captures-relire-script.mjs [url de base]
// Même outil que captures-gm.mjs : le mot de passe est lu UNIQUEMENT dans E2E_MDP, jamais écrit nulle part.
// Sur téléphone, la fenêtre est agrandie à la hauteur de la page : la barre collée reste en bas.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.E2E_BASE ?? "http://localhost:3107";
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "relire-script");
const CHEMIN = "/essais/relire-script";

const SCENES = [
  { nom: "1-script" },
  {
    nom: "2-phrase-modifiee",
    action: async (p) => {
      await p.getByRole("button", { name: "Modifier la phrase 3" }).click();
      const zone = p.getByLabel("Phrase 3");
      await zone.fill(
        "Avant, c'était ça : trier les candidatures, répondre à chacun, relancer, caler un rendez-vous, envoyer le contrat, courir après la signature, tout à la main.",
      );
      await p.waitForTimeout(1600);
    },
  },
  {
    nom: "3-texte-libre",
    action: async (p) => p.getByRole("button", { name: "Texte libre" }).click(),
  },
  {
    nom: "4-confirmation-prix",
    feuille: true,
    action: async (p) =>
      p.getByRole("button", { name: /Lancer la vidéo/ }).click(),
  },
];

const FORMATS = [
  {
    nom: "390",
    viewport: { width: 390, height: 844 },
    deviceScaleFactor: 2,
    isMobile: true,
    hasTouch: true,
  },
  {
    nom: "1440",
    viewport: { width: 1440, height: 900 },
    deviceScaleFactor: 1,
    isMobile: false,
    hasTouch: false,
  },
];

if (!MDP) {
  console.error("E2E_MDP manquant");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch(
  process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {},
);
for (const f of FORMATS) {
  const contexte = await navigateur.newContext({
    viewport: f.viewport,
    deviceScaleFactor: f.deviceScaleFactor,
    isMobile: f.isMobile,
    hasTouch: f.hasTouch,
    locale: "fr-FR",
    reducedMotion: "reduce",
  });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/connexion`);
  await page
    .getByLabel(/mot de passe/i)
    .first()
    .fill(MDP);
  await page
    .getByRole("button", { name: /Entrer|Se connecter|Connexion/i })
    .first()
    .click();
  await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), {
    timeout: 30000,
  });
  for (const s of SCENES) {
    await page.setViewportSize(f.viewport);
    await page.goto(`${BASE}${CHEMIN}`, { waitUntil: "networkidle" });
    await page.getByText("Prêt").first().waitFor({ timeout: 20000 });
    if (s.action) {
      await s.action(page);
      await page.waitForTimeout(800);
    }
    if (!s.feuille) {
      const hauteur = await page.evaluate(
        () => document.documentElement.scrollHeight,
      );
      await page.setViewportSize({
        width: f.viewport.width,
        height: Math.max(f.viewport.height, hauteur),
      });
      await page.waitForTimeout(300);
    }
    await page.screenshot({ path: join(SORTIE, `${s.nom}-${f.nom}.png`) });
    console.log("✓", `${s.nom}-${f.nom}`);
  }
  await contexte.close();
}
await navigateur.close();
