/**
 * DÉMONSTRATION DU LOT B1 — un décor PHOTO-INCRUSTÉ (la proposition « Lumière dorée » de la demande « un bureau en bois
 * avec une bibliothèque », vraie photo fal.ai SANS personne) posé par la brique commune `composition`, exactement comme
 * dans une vidéo : `parametresComposition` (recette avocat) → `CompositionImage` de `studio-rendu` (opération
 * `image-fixe`, en local). Trois formats (9:16, 4:5, 1:1), plan large et plan poitrine ; double simulé (silhouette).
 * Gratuit (aucun appel payant).
 *
 * Usage (racine du dépôt) : `pnpm exec tsx outils/decors-b1/demo-decor-photo.mts`
 * Sorties : `docs/captures/b1-decors/demo-photo-<ratio>-<plan>.jpg`, planche `demo-photo.jpg`, `preuve-demo.json`.
 */
import { copyFileSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import type { CommandeFabrication, ValeurDecor } from "@/domaine/types";
import type { PlanProduit } from "@/moteurs/types";

const charger = async <T,>(m: string): Promise<T> => {
  const x = (await import(m)) as T & { default?: T };
  return (x.default ?? x) as T;
};
const brique = await charger<typeof import("@/briques/composition")>("@/briques/composition");
const recette = await charger<typeof import("@/moteurs/montage-avocat/recette-composition")>("@/moteurs/montage-avocat/recette-composition");
const { imageFixe } = await import("../../studio-rendu/src/operations/image-fixe");
const { servirDossier } = await import("../../studio-rendu/src/composition/serveur-fichiers");

const RACINE = resolve(import.meta.dirname, "..", "..");
const SORTIE = join(RACINE, "docs", "captures", "b1-decors");
const TRAVAIL = join(tmpdir(), "studio-b1-demo-photo");
const ENTREES = join(TRAVAIL, "entrees");
mkdirSync(ENTREES, { recursive: true });
copyFileSync(join(RACINE, "public", "demo", "decors", "propositions", "bureau-doree.jpg"), join(ENTREES, "bureau-doree.jpg"));

const DECOR: ValeurDecor = { type: "decor", mode: "image", methode: "photo-incrustee", profondeurFlou: 14, teinte: "#1A120B", teinteLumiere: "#D69650", directionLumiere: "droite", positionSujet: 0.5, ambiance: "Lumière dorée", statut: "valide" };
const commande = {
  versionContrat: 2,
  moteurId: "montage-avocat",
  videoId: "demo-b1",
  formatId: "avocat",
  versionFormat: 2,
  profilRenduVersion: 1,
  dureeCibleSec: 4,
  ratios: ["9:16", "4:5", "1:1"],
  script: { blocs: [], texteComplet: "" },
  distribution: [{ role: "Face caméra", source: "double", modeAngles: "un-angle", visagesResolus: {} }],
  styles: { lut: null, sousTitres: null, habillage: null, profilSon: null, musique: null, decor: { id: "decor-demande-bureau", nom: "Bureau en bois · Lumière dorée", valeur: DECOR } },
  briques: { "sous-titres": false, etalonnage: false, illustrations: false, son: false, habillage: false, "texte-ecran": false, "mention-ia": false },
  entrees: {},
  reglages: {},
  plans: [],
  prononciations: [],
  mentionIA: { active: false },
  budgetMax: { centimes: 0, devise: "EUR" },
  construiteLe: new Date().toISOString(),
  medias: { "decor-demande-bureau": { cle: "bureau-doree.jpg", mime: "image/jpeg" } },
} as unknown as CommandeFabrication;

const plan = (valeur: "large" | "poitrine"): PlanProduit => ({ ordre: 1, debutSec: 0, finSec: 4, texte: "", segmentId: "s1", sourceImage: "double", motsEnValeur: [], cadrage: { pointInteret: { x: 0.5, y: 0.36 }, zoom: valeur === "poitrine" ? 1.2 : 1, valeur }, transition: "coupe", angle: "trois-quarts" });

const serveur = await servirDossier(ENTREES);
const t0 = Date.now();
const faits: { ratio: string; plan: string; fichier: string; alertes: string[] }[] = [];
for (const ratio of ["9:16", "4:5", "1:1"] as const) {
  for (const valeur of ["large", "poitrine"] as const) {
    const p = brique.parametresComposition(commande, { ratio, plans: [plan(valeur)], segments: [], dureeSec: 4 }, recette.RECETTE_COMPOSITION_AVOCAT);
    const entrees = Object.fromEntries(Object.entries(p.entrees).map(([nom, cle]) => [nom, `${serveur.base}/${cle}`]));
    const dossier = join(TRAVAIL, `${ratio.replace(":", "x")}-${valeur}`);
    mkdirSync(dossier, { recursive: true });
    await imageFixe(
      { idRendu: `demo-${ratio}-${valeur}`, operation: "image-fixe", file: "courte", entrees, sortie: { urlDepot: "", cle: "d.png" }, parametres: { composition: "CompositionImage", image: 0, proprietes: { ...p.image, images: 1 }, references: true } },
      { dossier, signal: new AbortController().signal, progression: () => {} },
    );
    const nom = `demo-photo-${ratio.replace(":", "x")}-${valeur}.jpg`;
    spawnSync("ffmpeg", ["-v", "error", "-y", "-i", join(dossier, "image.png"), "-vf", "scale=540:-2:flags=lanczos", "-q:v", "3", join(SORTIE, nom)]);
    faits.push({ ratio, plan: valeur, fichier: `docs/captures/b1-decors/${nom}`, alertes: p.alertes.map((a) => a.message) });
    console.log(`démonstration : ${ratio} ${valeur}`);
  }
}
await serveur.fermer();
const entrees = faits.flatMap((f) => ["-i", join(RACINE, f.fichier)]);
const filtre = faits.map((_, i) => `[${i}]scale=-2:400[v${i}]`).join(";") + ";" + faits.map((_, i) => `[v${i}]`).join("") + `hstack=${faits.length}`;
spawnSync("ffmpeg", ["-v", "error", "-y", ...entrees, "-filter_complex", filtre, "-q:v", "3", join(SORTIE, "demo-photo.jpg")]);
writeFileSync(join(SORTIE, "preuve-demo.json"), JSON.stringify({ date: new Date().toISOString(), coutUsd: 0, decor: "photo-incrustee (fal.ai, sans personne), flou 14 px, liseré doré côté gauche", double: "silhouette simulée", dureeSec: Math.round((Date.now() - t0) / 1000), images: faits }, null, 2));
console.log(`${faits.length} images en ${Math.round((Date.now() - t0) / 1000)} s.`);
