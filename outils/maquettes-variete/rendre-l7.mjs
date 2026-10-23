/**
 * PLANCHES DU LOT L7 (animations des objets d'étape) : images fixes (Remotion `renderStill`) avec les VRAIS composants,
 * chaque objet × chaque animation (0 = v4, 1, 2) × 3 instants. Aucune vidéo, aucun appel extérieur.
 *
 *   cd studio-rendu && node ../outils/maquettes-variete/rendre-l7.mjs l7a      (groupe : outils/maquettes-variete/l7/l7a.json)
 *
 * Sortie : outils/maquettes-variete/sortie/l7/brut/<objet>-a<n>-i<image>.jpg ; ensuite `python3 outils/maquettes-variete/planche-l7.py l7a`.
 * Navigateur : CHROMIUM (variable d'environnement), sinon celui de Remotion.
 */
import { mkdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createRequire } from "node:module";

// Remotion est installé dans studio-rendu (dossier courant) : résolu depuis là.
const requis = createRequire(join(process.cwd(), "package.json"));
const { bundle } = requis("@remotion/bundler");
const { renderStill, selectComposition } = requis("@remotion/renderer");

const RACINE = resolve("..");
const SORTIE = join(RACINE, "outils/maquettes-variete/sortie/l7/brut");
mkdirSync(SORTIE, { recursive: true });

/** Le groupe : par objet, les instants montrés (images à 25 i/s : entrée des pièces, moment qui change, posé) et les noms. */
const GROUPE = JSON.parse(readFileSync(join(RACINE, `outils/maquettes-variete/l7/${process.argv[2]}.json`), "utf-8"));
/** Textes des objets : ceux des tests (vidéo de référence, maquettes validées). */
const TEXTES = {
  "bouclier-coche": undefined,
  "bulle-lien": ["axion-ia.com/rendez-vous"],
  calendrier: ["Octobre", "14"],
  "carte-taches": ["Tâches du lundi"],
  "champ-commentaire": ["Rappel"],
  chrono: ["15", "minutes"],
  "contrat-signature": undefined,
  "dossier-classe": undefined,
  "e-mail": ["Votre rendez-vous est confirmé"],
  "outils-relies": ["Agenda", "Messagerie", "Tableau"],
  "pile-notifications": ["Nouveau rendez-vous", "Paiement reçu"],
  programme: ["Les bases", "La pratique", "Les outils", "Le suivi"],
  rapport: ["Article · 1 200 mots", "Rédaction"],
  "telephone-capture": undefined,
  "telephone-notification": ["Rappel : notre échange demain à 14:00"],
};
const capture = () => ({ src: `data:image/png;base64,${readFileSync(join(RACINE, "outils/maquettes-variete/l7/capture.png")).toString("base64")}`, largeur: 1080, hauteur: 2400 });

const objets = Object.keys(GROUPE);
const debut = Date.now();
const serveUrl = await bundle({ entryPoint: resolve("compositions/cas-concret/variantes/entree-l7.tsx") });
const reglages = { chromiumOptions: { gl: "swangle" }, logLevel: "error", ...(process.env.CHROMIUM ? { browserExecutable: process.env.CHROMIUM } : {}) };
let n = 0;
for (const objet of objets) {
  for (const anim of [0, 1, 2]) {
    const inputProps = { objet, anim, fond: "ivoire", ...(TEXTES[objet] ? { textes: TEXTES[objet] } : {}), ...(objet === "telephone-capture" ? { capture: capture() } : {}) };
    const composition = await selectComposition({ serveUrl, id: "L7Objet", inputProps, ...reglages });
    for (const image of GROUPE[objet].instants) {
      await renderStill({ composition, serveUrl, output: join(SORTIE, `${objet}-a${anim}-i${image}.jpg`), frame: image, inputProps, imageFormat: "jpeg", jpegQuality: 85, ...reglages });
      n++;
    }
    console.log(`${objet} · animation ${anim}`);
  }
}
console.log(`${n} images en ${((Date.now() - debut) / 1000).toFixed(1)} s`);
