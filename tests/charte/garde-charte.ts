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
