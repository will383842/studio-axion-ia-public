/**
 * Importe un jeu d'icônes en DONNÉES (aucune dépendance) : « toujours copier, jamais installer » (C6-H17a).
 *   node scripts/motion/importer-icones.mjs --jeu lucide --source <dossier du paquet extrait> --liste <json nom-français → nom d'origine> --version X.Y.Z [--sha256 <empreinte de l'archive>] [--sortie <fichier>]
 * Refuse si le LICENSE de la source n'est pas le texte ISC de Lucide (comparé à la copie du dépôt). Déterministe.
 * Option `--spdx-depuis <info.json>` (Iconify) : lit `info.license.spdx` et refuse ce qui n'est pas admis. Écrite, non utilisée.
 * N'écrase rien d'autre que `lucide.ts` (ou `--sortie`) ; ne touche pas à `generer-icones.mjs`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dossierBib = resolve(racine, "src/briques/motion/bibliotheque-icones");
const BALISES = ["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"];
const SPDX_ADMIS = ["MIT", "ISC", "Apache-2.0", "CC0-1.0", "Unlicense", "OFL-1.1"];
const COULEURS_SANS = new Set(["none", "currentcolor"]);

function arg(nom) {
  const i = process.argv.indexOf(`--${nom}`);
  return i >= 0 ? process.argv[i + 1] : undefined;
}
function refuser(msg) {
  console.error(`REFUSÉ : ${msg}`);
  process.exit(1);
}
const norm = (t) => t.replace(/\r/g, "").replace(/\s+/g, " ").trim();

const jeu = arg("jeu");
const source = arg("source");
const listeChemin = arg("liste");
const version = arg("version");
const sha = arg("sha256") ?? "non fourni";
const spdxDepuis = arg("spdx-depuis");

if (spdxDepuis) {
  const info = JSON.parse(readFileSync(spdxDepuis, "utf8"));
  const spdx = info?.license?.spdx;
  if (!SPDX_ADMIS.includes(spdx)) refuser(`SPDX « ${spdx} » absent des licences sans crédit`);
}
if (jeu !== "lucide") refuser("seul --jeu lucide est pris en charge (Phosphor et Material : C6-H17b)");
if (!source || !listeChemin || !version) refuser("--source, --liste et --version sont obligatoires");

// Licence : le LICENSE de la source doit être l'ISC + MIT (Feather) de Lucide, texte comparé.
const licenceSource = join(source, "LICENSE");
if (!existsSync(licenceSource)) refuser("LICENSE absent de la source");
const texteSource = readFileSync(licenceSource, "utf8");
const copie = resolve(dossierBib, "LICENCE-Lucide.txt");
if (!/^ISC License/.test(texteSource) || !/Permission to use, copy, modify, and\/or distribute this software for any\s+purpose with or without fee is hereby granted/.test(texteSource)) refuser("le LICENSE de la source n'est pas ISC");
if (existsSync(copie)) {
  const entete = readFileSync(copie, "utf8");
  if (!norm(entete).includes(norm(texteSource))) refuser("le LICENSE de la source diffère de LICENCE-Lucide.txt");
}

const liste = JSON.parse(readFileSync(listeChemin, "utf8"));
const lignes = [];
for (const [nom, origine] of Object.entries(liste).sort(([a], [b]) => (a < b ? -1 : 1))) {
  const fichier = join(source, "icons", `${origine}.svg`);
  if (!existsSync(fichier)) refuser(`icône absente de la source : ${origine}`);
  const svg = readFileSync(fichier, "utf8");
  const viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox) refuser(`viewBox absent : ${origine}`);
  const noeuds = [];
  for (const m of svg.matchAll(/<(\w+)\s([^>]*?)\/>/g)) {
    const balise = m[1];
    if (balise === "svg") continue;
    if (!BALISES.includes(balise)) refuser(`balise non prise en charge « ${balise} » : ${origine}`);
    const attrs = {};
    for (const a of m[2].matchAll(/([\w:-]+)="([^"]*)"/g)) {
      let v = a[2];
      if ((a[1] === "fill" || a[1] === "stroke") && !COULEURS_SANS.has(v.toLowerCase())) v = "currentColor";
      attrs[a[1]] = v;
    }
    noeuds.push([balise, attrs]);
  }
  if (noeuds.length === 0) refuser(`aucun nœud : ${origine}`);
  lignes.push(`  /** [${origine}] */\n  "${jeu}:${nom}": { jeu: "${jeu}", viewBox: ${JSON.stringify(viewBox)}, noeuds: ${JSON.stringify(noeuds)} },`);
}

const sortie = arg("sortie") ?? resolve(dossierBib, "lucide.ts");
const contenu = `/**
 * ICÔNES LUCIDE — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, lucide-static ${version}, sha256 ${sha}, ISC + MIT (Feather) : voir LICENCE-Lucide.txt. Ne pas modifier à la main.
 * Noms préfixés par le jeu (« lucide:coche »). PUR, SANS alias « @/ » : lisible par Remotion.
 */
export type NoeudBibliotheque = [balise: "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse", attributs: Record<string, string>];
export interface IconeBibliotheque {
  jeu: string;
  viewBox: string;
  noeuds: NoeudBibliotheque[];
}

export const LUCIDE_BIBLIOTHEQUE: Record<string, IconeBibliotheque> = {
${lignes.join("\n")}
};
`;
writeFileSync(sortie, contenu);
console.log(`${lignes.length} icônes écrites dans ${sortie}`);
