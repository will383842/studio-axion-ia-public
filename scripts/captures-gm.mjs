// Captures des maquettes du générateur (lot GM) à 390 px, page entière, dans docs/captures/gm-maquettes/.
// Usage : E2E_MDP='…' node scripts/captures-gm.mjs [url de base]
// Le mot de passe est lu UNIQUEMENT dans la variable d'environnement E2E_MDP, jamais écrit nulle part.
// La fenêtre est agrandie à la hauteur de la page : les barres collées restent en bas, comme sur le téléphone.
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const BASE = process.argv[2] ?? process.env.E2E_BASE ?? "http://localhost:3105";
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "gm-maquettes");
const M = "/maquettes-generateur";

const SCENES = [
  { nom: "1-scripts", chemin: `${M}/scripts` },
  { nom: "1b-scripts-tiktok", chemin: `${M}/scripts`, action: async (p) => p.getByRole("button", { name: "TikTok" }).first().click() },
  { nom: "1c-scripts-format", chemin: `${M}/scripts?format=1`, feuille: true },
  { nom: "2-sujet", chemin: `${M}/sujet` },
  { nom: "2b-sujet-sensible", chemin: `${M}/sujet?sensible=1` },
  { nom: "2c-sujet-but", chemin: `${M}/sujet`, feuille: true, action: async (p) => p.getByRole("button", { name: "But : modifier" }).click() },
  { nom: "3-resultat", chemin: `${M}/resultat` },
  { nom: "3b-resultat-details", chemin: `${M}/resultat?etat=a-valider`, action: async (p) => p.getByText("Détails", { exact: true }).click() },
  { nom: "4-carte-il-manque-une-matiere", chemin: `${M}/il-manque` },
  { nom: "5-feuille-fabrication", chemin: `${M}/resultat?etat=valide&feuille=1`, feuille: true },
];

if (!MDP) {
  console.error("E2E_MDP manquant");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, reducedMotion: "reduce" });
const page = await contexte.newPage();
await page.goto(`${BASE}/connexion`);
await page.getByLabel(/mot de passe/i).first().fill(MDP);
await page.getByRole("button", { name: /Entrer|Se connecter|Connexion/i }).first().click();
await page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 });

for (const s of SCENES) {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto(`${BASE}${s.chemin}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(500);
  if (s.action) {
    await s.action(page);
    await page.waitForTimeout(700);
  }
  if (!s.feuille) {
    const hauteur = await page.evaluate(() => document.documentElement.scrollHeight);
    await page.setViewportSize({ width: 390, height: Math.max(844, hauteur) });
    await page.waitForTimeout(300);
  } else {
    await page.waitForTimeout(500);
  }
  await page.screenshot({ path: join(SORTIE, `${s.nom}-390.png`) });
  console.log("✓", s.nom);
}
await navigateur.close();
