// Captures d'écran du Studio en 390x844 (mobile) et 1440x900 (bureau) dans docs/captures/.
// Usage :
//   E2E_MDP='…' node scripts/captures.mjs [url de base] [nom1 nom2 …]
//   (le mot de passe est lu UNIQUEMENT dans la variable d'environnement E2E_MDP, jamais écrit nulle part)
//   Les noms filtrent les scènes (ex. « accueil assistant-apercu »).
// Prérequis : serveur lancé (ex. pnpm start -p 3100) ; navigateur : pnpm exec playwright install chromium
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { chromium } from "@playwright/test";

const [, , baseArg, ...filtres] = process.argv;
const BASE = baseArg ?? process.env.E2E_BASE ?? "http://localhost:3100";
const MDP = process.env.E2E_MDP;
// CAPTURES_SORTIE : dossier de sortie (ex. docs/captures/harmonisation/h1/apres).
const SORTIE = process.env.CAPTURES_SORTIE ? join(process.cwd(), process.env.CAPTURES_SORTIE) : join(process.cwd(), "docs", "captures");

/** Scènes : { nom, chemin, action?, mobileSeul?, plein? (fullPage, vrai par défaut) }. */
const SCENES = [
  { nom: "accueil", chemin: "/" },
  { nom: "alertes-credits", chemin: "/", plein: false },
  { nom: "plus", chemin: "/", mobileSeul: true, plein: false, action: async (p) => p.getByRole("navigation", { name: "Navigation" }).getByRole("button", { name: "Plus" }).click() },
  {
    nom: "recherche",
    chemin: "/",
    plein: false,
    action: async (p) => {
      await p.getByRole("button", { name: /Rechercher/ }).first().click();
      await p.getByPlaceholder("Vidéos, scripts, idées…").fill("mail");
      await p.waitForTimeout(900);
    },
  },
  { nom: "nouvelle", chemin: "/nouvelle" },
  // Harmonisation H1/H2 : tableau animé et pages « Bientôt ».
  { nom: "tableau-nouvelle", chemin: "/tableau/nouvelle" },
  { nom: "formats-createur-b", chemin: "/formats/createur-b" },
  // Harmonisation H8 : assistant face caméra et avocat (express, pas à pas, fabrication).
  { nom: "assistant-facecam", chemin: "/nouvelle/facecam" },
  { nom: "assistant-pas-a-pas", chemin: "/nouvelle/avocat?script=script-2", action: async (p) => { await p.getByRole("radio", { name: "Pas à pas" }).click(); await p.waitForTimeout(800); await p.keyboard.press("Escape"); } },
  // Harmonisation H8b : fabrication lancée en mode essai (simulée), puis la fiche de la vidéo en cours.
  { nom: "fabrication-lancee", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => { await p.getByRole("button", { name: /^Fabriquer/ }).last().click(); await p.getByRole("heading", { name: /Je fabrique votre vidéo|Votre vidéo est prête|Une étape a coincé/ }).waitFor({ timeout: 30000 }); await p.waitForTimeout(500); } },
  // Harmonisation H8b : fabrication en cours (v-05 ; serveur lancé avec STUDIO_BOUCLE=0 pour qu'elle reste en cours) et fiche de la vidéo.
  { nom: "fabrication-avocat", chemin: "/nouvelle/avocat?brouillon=v-05", plein: false },
  { nom: "fiche-video-suivi", chemin: "/videos/v-05" },
  // Harmonisation H3 : face caméra animée.
  { nom: "face-camera-animee", chemin: "/face-camera-animee" },
  // Harmonisation H4 : image → vidéo, dépôt.
  { nom: "image-video-depot", chemin: "/image-video" },
  // H5/H6 : aucune donnée d'exemple (créer une vidéo lit l'image : appel payant) ; on contrôle l'état « introuvable » sans erreur.
  { nom: "image-video-introuvable", chemin: "/image-video/v-absente" },
  { nom: "image-video-lot-introuvable", chemin: "/image-video/lot/l-absent" },
  // Lot M3 : écran « Votre vidéo » (avocat) — vide, rempli par un script, chaque feuille du bas, et le mode pas à pas.
  { nom: "votre-video", chemin: "/nouvelle/avocat" },
  { nom: "votre-video-rempli", chemin: "/nouvelle/avocat?script=script-2" },
  { nom: "votre-video-brouillon", chemin: "/nouvelle/avocat?brouillon=v-07" },
  { nom: "votre-video-script", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => p.getByRole("button", { name: /^Script :/ }).first().click() },
  { nom: "votre-video-plateau", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => p.getByRole("button", { name: /^Plateau :/ }).first().click() },
  { nom: "votre-video-voix", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => p.getByRole("button", { name: /^Voix :/ }).first().click() },
  { nom: "votre-video-style", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => p.getByRole("button", { name: /^Style :/ }).first().click() },
  { nom: "votre-video-cout", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => p.getByRole("button", { name: /^Coût :/ }).first().click() },
  { nom: "votre-video-pas-a-pas", chemin: "/nouvelle/avocat?script=script-2", action: async (p) => p.getByRole("radio", { name: "Pas à pas" }).click() },
  { nom: "assistant-fabrication", chemin: "/nouvelle/avocat?brouillon=v-05", plein: false },
  { nom: "videos", chemin: "/videos" },
  { nom: "formats-avocat", chemin: "/formats/avocat" },
  { nom: "formats-podcast", chemin: "/formats/podcast" },
  { nom: "video-v-01", chemin: "/videos/v-01" },
  { nom: "video-v-01-partager", chemin: "/videos/v-01", plein: false, action: async (p) => p.getByRole("button", { name: "Lien privé" }).first().click() },
  { nom: "video-v-05", chemin: "/videos/v-05" },
  { nom: "video-v-06", chemin: "/videos/v-06" },
  // Lot M1b : tableau des coûts.
  // « video-v-05-arreter » retirée : la boucle de fond termine v-05 dès le démarrage du serveur, le bouton n'existe plus à la capture.
  { nom: "reglages-budget", chemin: "/reglages#budget", plein: false },
  { nom: "ecrire", chemin: "/ecrire" },
  { nom: "ecrire-atelier", chemin: "/ecrire/atelier" },
  { nom: "script", chemin: "/scripts/script-ref-avocat-1" },
  { nom: "modeles", chemin: "/modeles" },
  { nom: "personnages", chemin: "/personnages" },
  { nom: "personnage-will", chemin: "/personnages/p-will" },
  { nom: "personnage-will-voix", chemin: "/personnages/p-will?onglet=voix" },
  { nom: "personnage-sophie", chemin: "/personnages/p-sophie" },
  { nom: "bibliotheque", chemin: "/bibliotheque" },
  { nom: "bibliotheque-lut", chemin: "/bibliotheque/lut" },
  { nom: "bibliotheque-images", chemin: "/bibliotheque/illustration-image" },
  { nom: "bibliotheque-sous-titres", chemin: "/bibliotheque/style-sous-titres" },
  { nom: "bibliotheque-musiques", chemin: "/bibliotheque/musique" },
  // Lots A et B du 02/10 : voix HeyGen, prononciations, Mes images, Mes décors, veille des outils.
  { nom: "voix-relier", chemin: "/personnages/p-will?onglet=voix", plein: false, action: async (p) => {
    await p.getByRole("button", { name: /Relier ma voix HeyGen|Changer de voix HeyGen/ }).last().click();
    await p.getByRole("dialog").last().getByRole("button", { name: /^Écouter / }).first().waitFor({ timeout: 30000 });
  } },
  { nom: "prononciations", chemin: "/bibliotheque/prononciations" },
  { nom: "prononciations-ajout", chemin: "/bibliotheque/prononciations", plein: false, action: async (p) => {
    await p.getByRole("button", { name: "Ajouter un mot" }).click();
    const f = p.getByRole("dialog").last();
    await f.getByLabel("Le mot, tel qu'il s'écrit").fill("Teleos");
    await f.getByLabel("Comment le dire").fill("té-lé-osse");
  } },
  { nom: "votre-video-pastilles", chemin: "/nouvelle/avocat?script=script-2", plein: false, action: async (p) => {
    await p.getByRole("button", { name: /^Script :/ }).first().click();
    await p.getByText("La voix les dira-t-elle bien ?").waitFor({ timeout: 20000 });
    await p.getByText("La voix les dira-t-elle bien ?").scrollIntoViewIfNeeded();
  } },
  // Aperçu (feuille « Coût ») : pastilles d'origine des illustrations ; réelles si le serveur a les banques (PEXELS_API_KEY…).
  { nom: "apercu-illustrations", chemin: "/nouvelle/avocat?script=script-ref-avocat-2", plein: false, action: async (p) => {
    await p.getByRole("button", { name: /^Coût :/ }).first().click();
    await p.getByText("Illustrations").first().waitFor({ timeout: 120000 });
    await p.waitForTimeout(2500);
  } },
  { nom: "mes-images", chemin: "/bibliotheque/mes-images" },
  { nom: "mes-decors", chemin: "/bibliotheque/decor" },
  { nom: "veille", chemin: "/veille" },
  { nom: "calendrier", chemin: "/calendrier" },
  { nom: "reglages", chemin: "/reglages" },
  { nom: "styleguide", chemin: "/styleguide" },
  { nom: "page-inexistante", chemin: "/page-inexistante" },
];

/** Pages publiques, capturées SANS session. */
const PUBLIQUES = [
  { nom: "connexion", chemin: "/connexion" },
  { nom: "v-public", chemin: "/v/mails7k2" },
  { nom: "v-lien-expire", chemin: "/v/sms4n8qp" },
];

const FORMATS = [
  { nom: "390", viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true },
  { nom: "1440", viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, isMobile: false, hasTouch: false },
];

if (!MDP) {
  console.error("E2E_MDP manquant : définissez le mot de passe dans la variable d'environnement E2E_MDP.");
  process.exit(1);
}

const garder = (s) => !filtres.length || filtres.includes(s.nom);

async function capturer(page, scene, f) {
  const r = await page.goto(`${BASE}${scene.chemin}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(700);
  if (scene.action) {
    await scene.action(page);
    await page.waitForTimeout(700);
  }
  const fichier = `${scene.nom}-${f.nom}.png`;
  await page.screenshot({ path: join(SORTIE, fichier), fullPage: scene.plein !== false });
  console.log(`✓ ${fichier} (${r?.status()})`);
}

mkdirSync(SORTIE, { recursive: true });
const navigateur = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
let erreurs = 0;
try {
  for (const f of FORMATS) {
    const options = { viewport: f.viewport, deviceScaleFactor: f.deviceScaleFactor, isMobile: f.isMobile, hasTouch: f.hasTouch, locale: "fr-FR", colorScheme: "dark", reducedMotion: "reduce" };

    // Pages publiques, sans session.
    const anonyme = await navigateur.newContext(options);
    const pa = await anonyme.newPage();
    for (const s of PUBLIQUES.filter(garder)) await capturer(pa, s, f).catch((e) => (erreurs++, console.error(`✗ ${s.nom}-${f.nom} : ${e.message.split("\n")[0]}`)));
    await anonyme.close();

    // Connexion (mot de passe lu dans E2E_MDP), puis les écrans.
    const contexte = await navigateur.newContext(options);
    const page = await contexte.newPage();
    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
    await page.getByLabel("Mot de passe", { exact: true }).fill(MDP);
    await Promise.all([page.waitForURL((u) => !u.pathname.startsWith("/connexion"), { timeout: 20000 }), page.getByRole("button", { name: "Entrer" }).click()]);

    for (const s of SCENES.filter(garder)) {
      if (s.mobileSeul && !f.isMobile) continue;
      await capturer(page, s, f).catch((e) => (erreurs++, console.error(`✗ ${s.nom}-${f.nom} : ${e.message.split("\n")[0]}`)));
    }
    await contexte.close();
  }
} finally {
  await navigateur.close();
}
process.exit(erreurs ? 1 : 0);
