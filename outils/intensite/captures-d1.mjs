// Captures 390 px du lot intensité · bruitages (D1) dans docs/captures/d1-bruitages/.
// Usage : E2E_MDP='…' node outils/intensite/captures-d1.mjs [url de base]
// (le mot de passe est lu UNIQUEMENT dans la variable d'environnement E2E_MDP, jamais écrit nulle part)
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? "http://localhost:3211";
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "d1-bruitages");
if (!MDP) {
  console.error("E2E_MDP manquant.");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });

// L'avocat n'a pas d'étape « Aperçu » : la courbe et le son par plan sont dans la feuille « Coût » de « Votre vidéo ».
const ouvrirCout = async (p) => {
  await p.getByRole("button", { name: /^Coût/ }).first().click();
  await p.getByRole("img", { name: /Courbe d'intensité/ }).first().waitFor({ timeout: 180000 });
  await p.waitForTimeout(1200);
};

const SCENES = [
  {
    nom: "tuile-style-intensite",
    chemin: "/nouvelle/avocat?script=script-2",
    action: async (p) => {
      await p.getByRole("button", { name: /^Style :/ }).first().click();
      const t = p.getByText("Intensité", { exact: true }).first();
      await t.waitFor({ timeout: 120000 });
      await t.scrollIntoViewIfNeeded();
    },
  },
  {
    nom: "apercu-courbe-intensite",
    chemin: "/nouvelle/avocat?script=script-ref-avocat-2",
    action: async (p) => {
      await ouvrirCout(p);
      await p.getByRole("img", { name: /Courbe d'intensité/ }).first().scrollIntoViewIfNeeded();
    },
  },
  {
    nom: "apercu-son-du-plan",
    chemin: "/nouvelle/avocat?script=script-ref-avocat-2",
    action: async (p) => {
      await ouvrirCout(p);
      const son = p.getByRole("group", { name: "Son" }).first();
      await son.scrollIntoViewIfNeeded();
    },
  },
  { nom: "ecoute-bruitages", chemin: "/bibliotheque/bruitage", plein: true },
];

const navigateur = await chromium.launch();
let erreurs = 0;
try {
  const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", colorScheme: "dark", reducedMotion: "reduce" });
  const page = await contexte.newPage();
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle", timeout: 180000 });
  await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
  await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 120000 }), page.getByRole("button", { name: "Entrer" }).click()]);
  for (const s of SCENES) {
    try {
      await page.goto(`${BASE}${s.chemin}`, { waitUntil: "networkidle", timeout: 240000 });
      await page.waitForTimeout(800);
      if (s.action) await s.action(page);
      await page.waitForTimeout(600);
      const fichier = `${s.nom}-390.png`;
      await page.screenshot({ path: join(SORTIE, fichier), fullPage: !!s.plein });
      console.log(`✓ ${fichier}`);
    } catch (e) {
      erreurs++;
      console.error(`✗ ${s.nom} : ${String(e.message).split("\n")[0]}`);
    }
  }
} finally {
  await navigateur.close();
}
process.exit(erreurs ? 1 : 0);
