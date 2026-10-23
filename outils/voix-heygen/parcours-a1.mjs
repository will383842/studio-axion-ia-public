// PARCOURS ET CAPTURES DU LOT A1 (voix HeyGen + prononciations) en 390 × 844, dans docs/captures/a1/.
// Usage : E2E_MDP='…' node outils/voix-heygen/parcours-a1.mjs [url de base] [nom1 nom2 …]
//   (mot de passe lu UNIQUEMENT dans E2E_MDP ; serveur déjà lancé, par exemple `next dev -p 3141`)
// Avec HEYGEN_API_KEY dans l'environnement du SERVEUR, les écoutes sont réelles (quelques centimes chacune) ;
// sans elle, tout se fait en simulation (son de démonstration).
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , baseArg, ...filtres] = process.argv;
const BASE = baseArg ?? "http://localhost:3141";
const MDP = process.env.E2E_MDP;
const SORTIE = join(process.cwd(), "docs", "captures", "a1");
if (!MDP) {
  console.error("E2E_MDP manquant.");
  process.exit(1);
}
mkdirSync(SORTIE, { recursive: true });

const attendre = (p, ms = 700) => p.waitForTimeout(ms);
const feuille = (p) => p.getByRole("dialog").last();

/** Scènes, dans l'ordre (certaines dépendent des précédentes : relier la voix avant de l'écouter). */
const SCENES = [
  { nom: "voix-a-relier", chemin: "/personnages/p-will?onglet=voix" },
  {
    nom: "voix-relier-liste",
    chemin: "/personnages/p-will?onglet=voix",
    action: async (p) => {
      await p.getByRole("button", { name: /Relier ma voix HeyGen/ }).first().click();
      await feuille(p).getByRole("button", { name: "Choisir" }).first().waitFor({ timeout: 30000 });
    },
  },
  {
    nom: "voix-reliee",
    chemin: "/personnages/p-will?onglet=voix",
    action: async (p) => {
      await p.getByRole("button", { name: /Relier ma voix HeyGen/ }).first().click();
      await feuille(p).getByRole("button", { name: "Choisir" }).first().click();
      await p.getByText("Voix reliée").first().waitFor({ timeout: 30000 });
      await attendre(p, 1500);
    },
  },
  {
    nom: "voix-essai-nom-propre",
    chemin: "/personnages/p-will?onglet=voix",
    action: async (p) => {
      await p.getByRole("button", { name: "Nom propre" }).click();
      await p.getByRole("button", { name: /Écouter un essai/ }).click();
      await p.getByText(/€ · Ma voix HeyGen|son de démonstration/).last().waitFor({ timeout: 60000 });
      await p.getByRole("button", { name: /Écouter un essai/ }).scrollIntoViewIfNeeded();
    },
    plein: false,
  },
  { nom: "prononciations-liste", chemin: "/bibliotheque/prononciations" },
  {
    nom: "prononciations-ajout-ecoute",
    chemin: "/bibliotheque/prononciations",
    plein: false,
    action: async (p) => {
      await p.getByRole("button", { name: "Ajouter un mot" }).click();
      const f = feuille(p);
      await f.getByLabel("Le mot, tel qu'il s'écrit").fill("Teleos");
      await f.getByLabel("Comment le dire").fill("té-lé-osse");
      await f.getByRole("button", { name: /Avant/ }).click();
      await f.getByText(/€ ·|son de démonstration/).waitFor({ timeout: 60000 });
      await attendre(p, 2500);
      await f.getByRole("button", { name: /Après/ }).click();
      await attendre(p, 4000);
    },
  },
  {
    nom: "prononciations-collage",
    chemin: "/bibliotheque/prononciations",
    plein: false,
    action: async (p) => {
      await p.getByRole("button", { name: "Coller une liste" }).click();
      await feuille(p).getByRole("textbox").fill("Teleos = té-lé-osse\nPV = pé-vé\nCertifexemple : ka-lio-pi\n35h = trente-cinq heures | 35 h\nnimporte quoi\nTeleos = autre");
      await attendre(p, 1500);
    },
  },
  {
    nom: "script-pastilles",
    chemin: "/nouvelle/avocat",
    plein: false,
    action: async (p) => {
      await p.getByRole("button", { name: /^Script/ }).first().click();
      await p.getByRole("tab", { name: /Coller/ }).click().catch(() => undefined);
      await p.getByRole("textbox").last().fill("Chez Teleos, votre PV de 135 € se conteste en 45 jours. Votre manager reçoit un feedback de ChatGPT, et Williams vous rappelle via le CRM.");
      await p.getByRole("button", { name: /Découper|Utiliser|Valider|Continuer/ }).last().click().catch(() => undefined);
      await p.getByText("La voix les dira-t-elle bien ?").waitFor({ timeout: 20000 });
      await p.getByText("La voix les dira-t-elle bien ?").scrollIntoViewIfNeeded();
    },
  },
  {
    nom: "video-mal-prononce",
    chemin: "/videos/v-01",
    plein: false,
    action: async (p) => {
      await p.getByRole("tab", { name: /Sous-titres/ }).click();
      await p.getByRole("list", { name: "Sous-titres" }).getByRole("button").nth(3).click();
      await feuille(p).getByRole("button", { name: /Mal prononcé/ }).waitFor();
    },
  },
  {
    nom: "video-mal-prononce-ajout",
    chemin: "/videos/v-01",
    plein: false,
    action: async (p) => {
      await p.getByRole("tab", { name: /Sous-titres/ }).click();
      await p.getByRole("list", { name: "Sous-titres" }).getByRole("button").nth(3).click();
      await feuille(p).getByRole("button", { name: /Mal prononcé/ }).click();
      await attendre(p, 800);
    },
  },
  {
    nom: "video-alerte-ajoutee-depuis",
    chemin: "/videos/v-01",
    plein: false,
    action: async (p) => {
      await p.getByRole("tab", { name: /Sous-titres/ }).click();
      await p.getByRole("list", { name: "Sous-titres" }).getByRole("button").nth(3).click();
      await feuille(p).getByRole("button", { name: /Mal prononcé/ }).click();
      await feuille(p).getByLabel("Comment le dire").fill("essai de prononciation");
      await feuille(p).getByRole("button", { name: "Ajouter" }).click();
      await p.getByText(/Et dans celle-ci/).waitFor({ timeout: 15000 });
      await attendre(p, 1500);
      await p.reload({ waitUntil: "networkidle" });
      await p.getByText("Prononciation ajoutée depuis").waitFor({ timeout: 15000 });
      await p.getByText("Prononciation ajoutée depuis").scrollIntoViewIfNeeded();
    },
  },
];

const navigateur = await chromium.launch();
const contexte = await navigateur.newContext({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true, locale: "fr-FR", colorScheme: "dark", reducedMotion: "reduce" });
const page = await contexte.newPage();
await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 60000 }), page.getByRole("button", { name: "Entrer" }).click()]);

const bilan = [];
for (const s of SCENES.filter((x) => !filtres.length || filtres.includes(x.nom))) {
  try {
    await page.goto(`${BASE}${s.chemin}`, { waitUntil: "networkidle", timeout: 120000 });
    await attendre(page);
    if (s.action) await s.action(page);
    await attendre(page);
    await page.screenshot({ path: join(SORTIE, `${s.nom}-390.png`), fullPage: s.plein !== false });
    // Aucun débordement horizontal à 390 px.
    const deborde = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    bilan.push(`${deborde ? "DÉBORDE" : "ok"}  ${s.nom}`);
  } catch (e) {
    bilan.push(`ÉCHEC ${s.nom} : ${e.message.split("\n")[0]}`);
    await page.screenshot({ path: join(SORTIE, `${s.nom}-390-echec.png`) }).catch(() => undefined);
  }
}
await navigateur.close();
console.log(bilan.join("\n"));
