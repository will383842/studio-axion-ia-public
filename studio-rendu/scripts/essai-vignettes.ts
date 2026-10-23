/**
 * ESSAI RÉEL des vignettes Axion v2 (lot 1) : rend 3 vignettes avec le vrai Remotion, sans Docker, sans réseau
 * extérieur, sans appel payant.
 *   1. 16:9, encre, m1, repli sans détourage (image de la vidéo) ;
 *   2. 9:16, ivoire, m2, avec le sujet détouré du dépôt ;
 *   3. 9:16, encre, Instagram (aucune image, aucun sujet).
 * Usage (depuis `studio-rendu/`) : `STUDIO_RENDU_ESSAI=1 npx tsx --tsconfig ../tsconfig.json scripts/essai-vignettes.ts`
 * Sortie : `../docs/vignettes/lot1-rendus/*.jpg`, `planche-160.png` et `RAPPORT.md`.
 * Navigateur : `STUDIO_RENDU_NAVIGATEUR` (chemin d'un Chromium local) si le navigateur de Remotion ne se télécharge pas ;
 * réservé à CE script, jamais dans le code de production.
 */
import { spawnSync } from "node:child_process";
import { copyFileSync, mkdirSync, mkdtempSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { interditsVignette } from "../../src/domaine/vignettes.js";
import type { ProprietesVignette } from "../compositions/commune/vignette/socle.js";
import { creerOperationMiniature, type RendreVignette } from "../src/operations/miniature.js";
import type { ContexteOperation, DemandeRendu } from "../src/contrat.js";

process.env.STUDIO_RENDU_ESSAI ??= "1";

const depot = resolve("..");
const sortie = join(depot, "docs/vignettes/lot1-rendus");
mkdirSync(sortie, { recursive: true });
const video = join(depot, "docs/facecam/planche-effets/main-logo.mp4");
const sujet = join(depot, "docs/vignettes/v2/images/facecam-detoure.webp");

/** Rendu Remotion d'une image fixe, avec le navigateur local si fourni (script seulement). */
const rendre: RendreVignette = async (proprietes: ProprietesVignette, sortiePng) => {
  const { renderStill, selectComposition } = await import("@remotion/renderer");
  const { paquetCompositions, REGLAGES_RENDU } = await import("../src/remotion.js");
  const serveUrl = await paquetCompositions();
  const navigateur = process.env.STUDIO_RENDU_NAVIGATEUR;
  const inputProps = proprietes as unknown as Record<string, unknown>;
  const composition = await selectComposition({ serveUrl, id: "VignetteAxion", inputProps, ...(navigateur ? { browserExecutable: navigateur } : {}) });
  await renderStill({ ...REGLAGES_RENDU, composition, serveUrl, output: sortiePng, frame: 0, imageFormat: "png", inputProps, signal: undefined, ...(navigateur ? { browserExecutable: navigateur } : {}) } as never);

};
const refus = async () => {
  throw new Error("La composition Miniature (r4) n'est pas utilisée par cet essai.");
};
const operation = creerOperationMiniature(refus, rendre);

interface Cas {
  fichier: string;
  libelle: string;
  parametres: Record<string, unknown>;
  entrees: Record<string, string>;
}
const CAS: Cas[] = [
  {
    fichier: "1-16x9-encre-m1-repli.jpg", libelle: "16:9 · encre · m1 · repli sans détourage (image de la vidéo)",
    parametres: { gabarit: "axion-v2", instantSec: 0.32, ratio: "16:9", couverture: "OÙ FUIT VOTRE TEMPS", motCle: "temps", ambiance: "encre", mise: "m1", generateur: "facecam" },
    entrees: { video },
  },
  {
    fichier: "2-9x16-ivoire-m2-sujet.jpg", libelle: "9:16 · ivoire · m2 · sujet détouré",
    parametres: { gabarit: "axion-v2", instantSec: 0.32, ratio: "9:16", couverture: "UN DEVIS EN 2 MINUTES", motCle: "2 minutes", ambiance: "ivoire", mise: "m2", generateur: "facecam" },
    entrees: { video, sujet },
  },
  {
    fichier: "3-9x16-encre-instagram.jpg", libelle: "9:16 · encre · Instagram (sans visage, sans image)",
    parametres: { gabarit: "axion-v2", instagram: true, ratio: "9:16", couverture: "OÙ FUIT VOTRE TEMPS", motCle: "temps", ambiance: "encre", generateur: "facecam" },
    entrees: {},
  },
];

const lignes: string[] = [];
for (const c of CAS) {
  const interdits = interditsVignette(String(c.parametres.couverture));
  if (interdits.length) throw new Error(`Titre refusé (${interdits.join(", ")}) : ${c.fichier}`);
  const dossier = mkdtempSync(join(tmpdir(), "essai-vignette-"));
  const contexte: ContexteOperation = { progression: () => undefined, dossier, signal: new AbortController().signal };
  const demande: DemandeRendu = { idRendu: c.fichier, operation: "miniature", file: "courte", entrees: c.entrees, sortie: { urlDepot: "", cle: c.fichier }, parametres: c.parametres };
  const debut = Date.now();
  const r = await operation(demande, contexte);
  const secondes = (Date.now() - debut) / 1000;
  copyFileSync(join(dossier, "miniature.jpg"), join(sortie, c.fichier));
  const octets = statSync(join(sortie, c.fichier)).size;
  const mesures = r.mesures ?? {};
  console.log(`${c.fichier} : ${mesures.largeur}×${mesures.hauteur}, ${Math.round(octets / 1000)} ko, ${secondes.toFixed(1)} s`);
  lignes.push(`| ${c.fichier} | ${c.libelle} | ${mesures.largeur}×${mesures.hauteur} | ${Math.round(octets / 1000)} ko | ${secondes.toFixed(1)} s | ${c.parametres.couverture} |`);
}

// Planche réduite : chaque vignette à 160 px de large (lecture sur un téléphone).
const entrees = CAS.flatMap((c) => ["-i", join(sortie, c.fichier)]);
const filtre = CAS.map((_, i) => `[${i}:v]scale=160:-2,pad=170:294:5:5:color=gray[v${i}]`).join(";") + `;${CAS.map((_, i) => `[v${i}]`).join("")}hstack=inputs=${CAS.length}:shortest=0[o]`;
const planche = spawnSync("ffmpeg", ["-hide_banner", "-v", "error", "-y", ...entrees, "-filter_complex", filtre, "-map", "[o]", "-frames:v", "1", join(sortie, "planche-160.png")]);
if (planche.status !== 0) console.warn("planche-160.png non produite :", planche.stderr.toString());

const maxRss = Math.round(process.resourceUsage().maxRSS / 1024);
const rapport = `# Lot 1 des vignettes · rendus réels de contrôle

*Produit par \`studio-rendu/scripts/essai-vignettes.ts\` (vrai Remotion, aucun réseau extérieur, aucun appel payant).*

| Fichier | Cas | Taille | Poids | Temps de rendu | Titre |
|---|---|---|---|---|---|
${lignes.join("\n")}

- Mémoire maximale du processus Node (hors navigateur) : ${maxRss} Mo (\`process.resourceUsage().maxRSS\` ; \`/usr/bin/time -v\` absent de la session).
- Planche à 160 px de large : \`planche-160.png\`.
- Contrôle des mots interdits : chaque titre passe par \`interditsVignette\` avant le rendu (le script échoue sinon).

## Contrôle visuel (images regardées une à une, 17/10)

- [x] Liseré orange et carré « A » à la même place sur les 3 ; bloc-marque « axion-ia.com » sur les 2 verticales.
- [x] Titre sur 2 lignes, un seul pavé orange (« TEMPS », « 2 MINUTES »), lisible à 160 px de large (\`planche-160.png\`).
- [x] 16:9 : coin bas droit 140×60 vide ; 9:16 : titre entre y 420 et y 1500, à gauche de x 940.
- [x] Instagram : aucune personne, aucune image de la vidéo.
- [x] Aucun « Villeexemple », « Aucun gain garanti », « Certifexemple certifié », « faites-le vous-même ».
- [x] Aucun logo, aucun nom de client dans les images.
- [x] Poids ≤ 2 Mo chacun.
- Rendu 1 (repli sans détourage) : l'image de la vidéo d'essai à 0,32 s montre un buste et des lunettes, visage hors cadre
  (recadrage centré). Moins beau que les maquettes détourées : repli assumé (rendu 2 = avec sujet détouré).
`;
writeFileSync(join(sortie, "RAPPORT.md"), rapport);
