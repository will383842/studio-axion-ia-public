/**
 * TEINTES-PLANCHE-a : partie PURE de l'outil local « planche des teintes » (C6-H9 / C6-H23).
 * Une tuile « sans teinte » (le témoin) puis une tuile par teinte de `LUTS_AXION` et `LUTS_AXION_SUPPLEMENTAIRES`,
 * appliquée comme le rendu final (`lut3d=file=…:interp=tetrahedral`, `studio-rendu/src/operations/etalonnage.ts`),
 * mélangée à l'identité selon `intensiteParDefaut` (fait par l'appelant, avec `melangerAvecIdentite`). Le nom de la
 * teinte est écrit sous chaque tuile. Aucun fichier n'est lu ni écrit ici. Jamais importé par `src/` ni `studio-rendu/`.
 */
import { isAbsolute, relative, resolve, sep } from "node:path";
import { LUTS_AXION } from "../../src/donnees/luts-axion";
import { LUTS_AXION_SUPPLEMENTAIRES } from "../../src/donnees/luts-axion-supplementaires";

export interface TeinteDePlanche {
  /** Nom écrit sous la tuile. */
  nom: string;
  /** Fichier `.cube` sous `public/luts/` ; `null` = le témoin (aucune teinte). */
  fichier: string | null;
  /** Intensité du mélange, entre 0 et 1. */
  intensite: number;
}

/** Le témoin, puis les 4 teintes livrées, puis les 3 supplémentaires (8 tuiles). */
export function teintesDeLaPlanche(): TeinteDePlanche[] {
  return [
    { nom: "Sans teinte", fichier: null, intensite: 0 },
    ...[...LUTS_AXION, ...LUTS_AXION_SUPPLEMENTAIRES].map((l) => ({ nom: l.nom, fichier: l.fichier, intensite: Math.min(1, Math.max(0, l.intensiteParDefaut / 100)) })),
  ];
}

/** Nom du fichier de teinte mélangée, RELATIF au dossier de travail (un chemin Windows casserait la syntaxe des filtres). */
export function nomCubeMelange(indice: number): string {
  return `teinte-${indice}.cube`;
}

/** Vrai si `chemin` est la racine du dépôt ou est dedans. PUR. */
export function estDansLeDepot(chemin: string, racine: string): boolean {
  const rel = relative(resolve(racine), resolve(chemin));
  return rel === "" || !(rel === ".." || rel.startsWith(".." + sep) || isAbsolute(rel));
}

export type ArgumentsPlanche = { ok: true; image: string; sortie: string } | { ok: false; erreur: string };

/** Lit et refuse les arguments : `--image` et `--sortie` obligatoires, image existante, ni l'une ni l'autre dans le dépôt du Studio. PUR (l'existence est passée). */
export function lireArgumentsPlanche(args: string[], racine: string, existe: (chemin: string) => boolean): ArgumentsPlanche {
  const valeur = (cle: string): string | undefined => {
    const i = args.indexOf(cle);
    const v = i >= 0 ? args[i + 1] : undefined;
    return v && !v.startsWith("--") ? v : undefined;
  };
  const image = valeur("--image");
  const sortie = valeur("--sortie");
  if (!image) return { ok: false, erreur: "--image <chemin> est obligatoire (une vraie prise, hors du dépôt)." };
  if (!sortie) return { ok: false, erreur: "--sortie <chemin> est obligatoire (hors du dépôt)." };
  if (!existe(image)) return { ok: false, erreur: `Image introuvable : ${image}` };
  if (estDansLeDepot(image, racine)) return { ok: false, erreur: "Refus : l'image source est DANS le dépôt du Studio (aucune image de personne dans le dépôt public)." };
  if (estDansLeDepot(sortie, racine)) return { ok: false, erreur: "Refus : la sortie est DANS le dépôt du Studio (aucune image de personne dans le dépôt public)." };
  return { ok: true, image: resolve(image), sortie: resolve(sortie) };
}

/** Texte sûr pour `drawtext` : lettres, chiffres, espaces, parenthèses, tiret et virgule seulement. */
export function texteTuile(nom: string): string {
  return nom.replace(/[^\p{L}\p{N} ()\-,]/gu, "").trim();
}

function echapperPolice(chemin: string): string {
  return chemin.replace(/\\/g, "/").replace(/:/g, "\\:");
}

/** Placement `xstack` : `colonnes` tuiles par ligne, toutes de la taille de la première (`w0`, `h0`). */
export function dispositionXstack(nb: number, colonnes: number): string {
  const cases: string[] = [];
  for (let k = 0; k < nb; k++) {
    const c = k % colonnes;
    const r = Math.floor(k / colonnes);
    cases.push(`${c === 0 ? "0" : Array(c).fill("w0").join("+")}_${r === 0 ? "0" : Array(r).fill("h0").join("+")}`);
  }
  return cases.join("|");
}

/** Le graphe `filter_complex` : une branche par teinte (échelle, LUT tétraédrique, nom sous la tuile), puis la grille. PUR. */
export function grapheDePlanche(teintes: TeinteDePlanche[], largeurTuile: number, fichierPolice: string, colonnes = 4): string {
  const n = teintes.length;
  const lignes: string[] = [`[0:v]scale=${largeurTuile}:-2,format=rgb24,split=${n}${teintes.map((_, i) => `[s${i}]`).join("")}`];
  teintes.forEach((t, i) => {
    const lut = t.fichier ? [`lut3d=file=${nomCubeMelange(i)}:interp=tetrahedral`] : [];
    const etiquette = `drawtext=fontfile='${echapperPolice(fichierPolice)}':text='${texteTuile(t.nom)}':fontcolor=white:fontsize=22:box=1:boxcolor=black@0.6:boxborderw=8:x=(w-text_w)/2:y=h-text_h-14`;
    lignes.push(`[s${i}]${["format=gbrp", ...lut, "format=rgb24", etiquette].join(",")}[t${i}]`);
  });
  lignes.push(`${teintes.map((_, i) => `[t${i}]`).join("")}xstack=inputs=${n}:layout=${dispositionXstack(n, colonnes)}[planche]`);
  return lignes.join(";");
}

/** Arguments complets de ffmpeg (UNE image de sortie). PUR. */
export function argumentsFfmpegPlanche(image: string, sortie: string, teintes: TeinteDePlanche[], fichierPolice: string, largeurTuile = 480): string[] {
  return ["-hide_banner", "-v", "error", "-y", "-i", image, "-filter_complex", grapheDePlanche(teintes, largeurTuile, fichierPolice), "-map", "[planche]", "-frames:v", "1", "-q:v", "2", sortie];
}
