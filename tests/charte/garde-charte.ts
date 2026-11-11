import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { COULEURS_CHARTE } from "../../src/briques/charte/axion-2026";

const RACINE = process.cwd();
const EXT = /\.(ts|tsx)$/;
const IGNORES = /(\.test\.|\.d\.ts$|node_modules|\.generee\.|metriques\.ts$|metriques-inter\.ts$)/;

export function fichiers(dossier: string): string[] {
  const sortie: string[] = [];
  const marche = (d: string) => {
    for (const nom of readdirSync(d)) {
      const chemin = join(d, nom);
      if (IGNORES.test(chemin)) continue;
      if (statSync(chemin).isDirectory()) marche(chemin);
      else if (EXT.test(nom)) sortie.push(chemin);
    }
  };
  marche(join(RACINE, dossier));
  return sortie;
}

/** Retire les commentaires (bloc et ligne) ; une « // » collée à un « : » (adresse) est gardée. */
export function sansCommentaires(src: string): string {
  return src.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:"'`\\])\/\/.*$/gm, "$1");
}

const POLICES_INTERDITES = /\b(Anton|Inter|Montserrat|Poppins|Archivo|Bricolage|Caveat|Kalam|Instrument|JetBrains|Permanent Marker|Impact|Arial|Helvetica|Georgia|Times|Roboto|Courier|Verdana|Comic)\b/;
const FICHIER_POLICE = /["'`][^"'`\n]*\.(ttf|woff2?|otf)["'`]/g;
const COULEUR_NOMMEE = /["'`](white|black|red|blue|green|yellow|pink|purple|gray|grey|cyan|magenta)["'`]/i;

/** Défauts d'un fichier : couleurs hors charte et polices autres que Manrope. */
/** Fondu de lisibilité d'un bandeau de sous-titres (transparent → plein, même couleur) : pas un dégradé de marque. */
const EXCEPTIONS_DEGRADE = ["src/briques/sous-titres/scene.ts"];

/**
 * Liste FERMÉE des dégradés de matière réaliste (décision D1 : ombrage d'une même matière — métal, peau, bois,
 * aluminium). Un dégradé décoratif de fond n'est JAMAIS une exception. `nom` = id du dégradé SVG ou fonction
 * qui contient l'appel canvas.
 */
export const EXCEPTIONS_DEGRADES_MATIERES: ReadonlyArray<{ fichier: string; nom: string; raison: string }> = [
  { fichier: "studio-rendu/compositions/commune/MicroPodcast.tsx", nom: "micro-corps", raison: "ombrage du métal du corps du micro" },
  { fichier: "studio-rendu/compositions/commune/MicroPodcast.tsx", nom: "micro-mousse", raison: "ombrage de la mousse du micro" },
  { fichier: "studio-rendu/compositions/commune/MicroPodcast.tsx", nom: "micro-pied", raison: "ombrage du métal du pied du micro" },
  { fichier: "studio-rendu/compositions/commune/Silhouette.tsx", nom: "peau", raison: "ombrage de la peau" },
  { fichier: "studio-rendu/compositions/commune/effets/PlateauEffets.tsx", nom: "peau", raison: "ombrage de la peau" },
  { fichier: "studio-rendu/compositions/commune/effets/PlateauEffets.tsx", nom: "peauMain", raison: "ombrage de la peau de la main" },
];

/** Exceptions de la zone stricte `tableau-scene` : fichier de référence de la charte (décision D5 ouverte). */
export const EXCEPTIONS_STRICTES = ["src/briques/tableau-scene/reference/charte.ts"];

export interface OccurrenceDegrade {
  ligne: number;
  genre: "canvas" | "svg";
  nom: string;
}

/** Remplace les commentaires par des espaces en gardant les retours à la ligne (les numéros de ligne restent exacts). */
function masquerCommentaires(src: string): string {
  const blanc = (m: string) => m.replace(/[^\n]/g, " ");
  return src.replace(/\/\*[\s\S]*?\*\//g, blanc).replace(/(^|[^:"'`\\])(\/\/.*)$/gm, (_, a: string, b: string) => a + blanc(b));
}

/**
 * Dégradés canvas (`createXGradient`) et SVG (`<linearGradient`, `<radialGradient`) d'un fichier, hors commentaires.
 *
 * ⚠️ Le `nom` d'un dégradé canvas est la DERNIÈRE fonction déclarée avant l'appel, pas la fonction qui
 * l'englobe : une flèche locale déclarée plus haut peut « voler » le nom. Sans effet tant qu'aucune exception
 * canvas n'existe ; à corriger avant d'en ajouter une.
 */
export function occurrencesDegrades(src: string): OccurrenceDegrade[] {
  const code = masquerCommentaires(src);
  const ligneDe = (i: number) => code.slice(0, i).split("\n").length;
  const sortie: OccurrenceDegrade[] = [];
  for (const m of code.matchAll(/<(?:linear|radial)Gradient\b([^>]*)>/g)) {
    const id = m[1].match(/\bid=(?:"([^"]*)"|\{`([^`]*)`\}|\{"([^"]*)"\})/);
    sortie.push({ ligne: ligneDe(m.index!), genre: "svg", nom: (id?.[1] ?? id?.[2] ?? id?.[3] ?? "").replace(/\$\{[^}]*\}/g, "") });
  }
  for (const m of code.matchAll(/\bcreate(?:Linear|Radial|Conic)Gradient\s*\(/g)) {
    const avant = code.slice(0, m.index!);
    const f = [...avant.matchAll(/(?:function\s+([A-Za-z_$][\w$]*)|(?:const|let)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:async\s*)?(?:\([^)]*\)|[A-Za-z_$][\w$]*)\s*(?::[^=]+)?=>)/g)].pop();
    sortie.push({ ligne: ligneDe(m.index!), genre: "canvas", nom: f?.[1] ?? f?.[2] ?? "" });
  }
  return sortie;
}

const estMatiere = (chemin: string, o: OccurrenceDegrade) =>
  EXCEPTIONS_DEGRADES_MATIERES.some((e) => e.fichier === chemin && e.nom === o.nom);

export function defauts(src: string, chemin = ""): string[] {
  const code = sansCommentaires(src);
  const liste: string[] = [];
  for (const m of code.matchAll(/#[0-9a-fA-F]{8}\b|#[0-9a-fA-F]{6}\b|#[0-9a-fA-F]{3}\b/g)) {
    const hex = m[0].toUpperCase();
    const six = hex.length === 4 ? "#" + [...hex.slice(1)].map((c) => c + c).join("") : hex.slice(0, 7);
    if (!COULEURS_CHARTE.includes(six)) liste.push(`couleur ${m[0]}`);
  }
  for (const m of code.matchAll(/rgba?\(\s*(\d+)[\s,]+(\d+)[\s,]+(\d+)/g)) {
    const hex = "#" + [m[1], m[2], m[3]].map((n) => Number(n).toString(16).padStart(2, "0")).join("").toUpperCase();
    if (!COULEURS_CHARTE.includes(hex)) liste.push(`couleur ${m[0]})`);
  }
  if (/hsla?\(/.test(code)) liste.push("couleur hsl()");
  if (/(linear|radial|conic)-gradient\(/.test(code) && !EXCEPTIONS_DEGRADE.includes(chemin)) liste.push("dégradé");
  for (const o of occurrencesDegrades(src)) {
    if (!estMatiere(chemin, o)) liste.push(`dégradé ${o.genre} ligne ${o.ligne}${o.nom ? ` (${o.nom})` : ""}`);
  }
  const nom = code.match(COULEUR_NOMMEE);
  if (nom) liste.push(`couleur nommée ${nom[0]}`);
  for (const m of code.matchAll(FICHIER_POLICE)) if (!/Manrope/i.test(m[0])) liste.push(`fichier de police ${m[0]}`);
  for (const l of code.split("\n")) {
    if (/[Ff]ont|famil|police/i.test(l) && /["'`]/.test(l)) {
      const guillemets = [...l.matchAll(/(["'`])((?:\\.|(?!\1).)*)\1/g)].map((x) => x[2]);
      for (const g of guillemets) if (POLICES_INTERDITES.test(g) && !/Manrope/.test(g)) liste.push(`police « ${g.slice(0, 40)} »`);
    }
  }
  return liste;
}

export const relatif = (f: string) => relative(RACINE, f).replace(/\\/g, "/");
export { readFileSync };
