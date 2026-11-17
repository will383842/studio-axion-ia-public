/**
 * Importe un jeu d'icônes en DONNÉES (aucune dépendance) : « toujours copier, jamais installer » (C6-H17a).
 *   node scripts/motion/importer-icones.mjs --jeu lucide|phosphor|material|tabler|heroicons|iconoir|carbon|bootstrap|health-icons --source <dossier du paquet extrait> --liste <json nom-français → nom d'origine> --version X.Y.Z [--sha256 <empreinte de l'archive>] [--sortie <fichier>]
 * Jeux (C6-H17b) : lucide (ISC + MIT Feather, icons/<nom>.svg), phosphor (MIT ; graisses regular et duotone, suffixe « ~duotone »), material (Apache-2.0 ; Material Symbols « outlined », un seul paquet).
 * Jeux au trait (C9-29) : tabler (MIT, icons/outline), heroicons (MIT, 24/outline), iconoir (MIT, icons/regular) ; `trait: true` : fill="none" et stroke="currentColor" sur chaque nœud (pas de remplissage ajouté), arrondis du <svg> reportés ; l'épaisseur est ramenée à 2 plus tard par `harmoniser`.
 * Refuse si le LICENSE de la source n'est pas celui attendu pour le jeu (texte comparé à la copie du dépôt). Déterministe.
 * Liste des SPDX admis : lue dans src/briques/droits/licences.ts (une seule source).
 * Option `--spdx-depuis <info.json>` (Iconify) : lit `info.license.spdx` et refuse ce qui n'est pas admis. Écrite, non utilisée.
 * N'écrase rien d'autre que `<jeu>.ts` (ou `--sortie`) ; ne touche pas à `generer-icones.mjs`.
 */
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { resolve, dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dossierBib = resolve(racine, "src/briques/motion/bibliotheque-icones");
const BALISES = ["path", "circle", "rect", "line", "polyline", "polygon", "ellipse"];
const SPDX_ADMIS = [...readFileSync(resolve(racine, "src/briques/droits/licences.ts"), "utf8").match(/SPDX_ADMIS = \[([^\]]*)\]/)[1].matchAll(/"([^"]+)"/g)].map((m) => m[1]);
if (SPDX_ADMIS.length === 0) throw new Error("SPDX_ADMIS illisible dans licences.ts");
const DEBUT_APACHE = /^\s*Apache License\s+Version 2\.0, January 2004/;
/** Par jeu : licence attendue, copie du dépôt, sortie, constante, graisses (dossier, suffixe de fichier, suffixe de nom). */
const JEUX = {
  lucide: {
    licence: (t) => /^ISC License/.test(t) && /Permission to use, copy, modify, and\/or distribute this software for any\s+purpose with or without fee is hereby granted/.test(t),
    attendu: "ISC", copie: "LICENCE-Lucide.txt", sortie: "lucide.ts", constante: "LUCIDE_BIBLIOTHEQUE",
    variantes: [{ dossier: "icons", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES LUCIDE — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, lucide-static ${v}, sha256 ${sha}, ISC + MIT (Feather) : voir LICENCE-Lucide.txt. Ne pas modifier à la main.`,
  },
  phosphor: {
    licence: (t) => /^MIT License/.test(t) && /Permission is hereby granted, free of charge/.test(t),
    attendu: "MIT", copie: "LICENCE-Phosphor-MIT.txt", sortie: "phosphor.ts", constante: "PHOSPHOR_BIBLIOTHEQUE",
    variantes: [{ dossier: "assets/regular", fin: "", nom: "" }, { dossier: "assets/duotone", fin: "-duotone", nom: "~duotone" }],
    entete: (v, sha) => `ICÔNES PHOSPHOR (regular et duotone) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, @phosphor-icons/core ${v}, sha256 ${sha}, MIT : voir LICENCE-Phosphor-MIT.txt. Ne pas modifier à la main.`,
  },
  material: {
    licence: (t) => DEBUT_APACHE.test(t) && /Apache License\s+Version 2\.0/.test(t),
    attendu: "Apache-2.0", copie: "LICENCE-MaterialSymbols-Apache2.txt", sortie: "material.ts", constante: "MATERIAL_BIBLIOTHEQUE",
    variantes: [{ dossier: "outlined", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES MATERIAL SYMBOLS (outlined) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, @material-symbols/svg-400 ${v}, sha256 ${sha}, Apache-2.0 : voir LICENCE-MaterialSymbols-Apache2.txt. Ne pas modifier à la main.`,
  },
  tabler: {
    licence: (t) => /^MIT License/.test(t) && /Permission is hereby granted, free of charge/.test(t),
    attendu: "MIT", copie: "LICENCE-Tabler-MIT.txt", sortie: "tabler.ts", constante: "TABLER_BIBLIOTHEQUE", trait: true,
    variantes: [{ dossier: "icons/outline", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES TABLER (trait) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, @tabler/icons ${v}, sha256 ${sha}, MIT : voir LICENCE-Tabler-MIT.txt. Ne pas modifier à la main.`,
  },
  heroicons: {
    licence: (t) => /^MIT License/.test(t) && /Permission is hereby granted, free of charge/.test(t),
    attendu: "MIT", copie: "LICENCE-Heroicons-MIT.txt", sortie: "heroicons.ts", constante: "HEROICONS_BIBLIOTHEQUE", trait: true,
    variantes: [{ dossier: "24/outline", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES HEROICONS (trait) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, heroicons ${v}, sha256 ${sha}, MIT : voir LICENCE-Heroicons-MIT.txt. Ne pas modifier à la main.`,
  },
  iconoir: {
    licence: (t) => /^MIT License/.test(t) && /Permission is hereby granted, free of charge/.test(t),
    attendu: "MIT", copie: "LICENCE-Iconoir-MIT.txt", sortie: "iconoir.ts", constante: "ICONOIR_BIBLIOTHEQUE", trait: true,
    variantes: [{ dossier: "icons/regular", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES ICONOIR (trait) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, iconoir ${v}, sha256 ${sha}, MIT : voir LICENCE-Iconoir-MIT.txt. Ne pas modifier à la main.`,
  },
  carbon: {
    licence: (t) => DEBUT_APACHE.test(t) && /Apache License\s+Version 2\.0/.test(t),
    attendu: "Apache-2.0", copie: "LICENCE-Carbon-Apache2.txt", sortie: "carbon.ts", constante: "CARBON_BIBLIOTHEQUE",
    variantes: [{ dossier: "svg/32", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES CARBON (pleines, svg/32) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, @carbon/icons ${v}, sha256 ${sha}, Apache-2.0 : voir LICENCE-Carbon-Apache2.txt. Ne pas modifier à la main.`,
  },
  bootstrap: {
    licence: (t) => /^The MIT License \(MIT\)/.test(t) && /Permission is hereby granted, free of charge/.test(t),
    attendu: "MIT", copie: "LICENCE-Bootstrap-MIT.txt", sortie: "bootstrap.ts", constante: "BOOTSTRAP_BIBLIOTHEQUE",
    variantes: [{ dossier: "icons", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES BOOTSTRAP ICONS — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, bootstrap-icons ${v}, sha256 ${sha}, MIT : voir LICENCE-Bootstrap-MIT.txt. Ne pas modifier à la main.`,
  },
  "health-icons": {
    licence: (t) => /CC0 1\.0 Universal/.test(t) && /Creative Commons Legal Code/.test(t),
    attendu: "CC0-1.0", copie: "LICENCE-HealthIcons-CC0.txt", sortie: "health-icons.ts", constante: "HEALTH_ICONS_BIBLIOTHEQUE",
    variantes: [{ dossier: "public/icons/svg/outline", fin: "", nom: "" }],
    entete: (v, sha) => `ICÔNES HEALTH ICONS (outline) — FICHIER GÉNÉRÉ par scripts/motion/importer-icones.mjs, healthicons ${v}, sha256 ${sha}, CC0-1.0 (libellé CC0 1.0) : voir LICENCE-HealthIcons-CC0.txt. Ne pas modifier à la main.`,
  },
};
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
const def = JEUX[jeu];
if (!def) refuser(`jeu inconnu « ${jeu} » : lucide, phosphor, material, tabler, heroicons ou iconoir`);
if (!SPDX_ADMIS.includes(def.attendu)) refuser(`SPDX « ${def.attendu} » absent des licences sans crédit`);
if (!source || !listeChemin || !version) refuser("--source, --liste et --version sont obligatoires");
if (jeu !== "lucide" && !arg("sha256")) refuser("--sha256 (empreinte de l'archive) est obligatoire : la preuve de droits en dépend");

// Licence : le LICENSE de la source doit être celui attendu pour le jeu, texte comparé à la copie datée du dépôt.
const licenceSource = join(source, "LICENSE");
if (!existsSync(licenceSource)) refuser("LICENSE absent de la source");
const texteSource = readFileSync(licenceSource, "utf8");
const copie = resolve(dossierBib, def.copie);
if (!def.licence(texteSource)) refuser(`le LICENSE de la source n'est pas ${def.attendu}`);
if (existsSync(copie)) {
  const entete = readFileSync(copie, "utf8");
  if (!norm(entete).includes(norm(texteSource))) refuser(`le LICENSE de la source diffère de ${def.copie}`);
} else if (jeu !== "lucide") refuser(`${def.copie} absent du dépôt : rien n'entre sans le texte de licence copié et daté`);

const liste = JSON.parse(readFileSync(listeChemin, "utf8"));
const trait = def.trait === true; // Tabler, Heroicons, Iconoir : jeux au trait
const plein = jeu !== "lucide" && !trait; // Phosphor et Material : glyphes à remplissage, la couleur vient de currentColor
const entrees = [];
for (const [nom, origine] of Object.entries(liste)) for (const v of def.variantes) entrees.push([`${nom}${v.nom}`, origine, v]);
entrees.sort(([a], [b]) => (a < b ? -1 : 1));
const lignes = [];
for (const [nom, origine, v] of entrees) {
  const fichier = join(source, v.dossier, `${origine}${v.fin}.svg`);
  if (!existsSync(fichier)) refuser(`icône absente de la source : ${v.dossier}/${origine}${v.fin}.svg`);
  const svg = readFileSync(fichier, "utf8");
  let viewBox = /viewBox="([^"]+)"/.exec(svg)?.[1];
  if (!viewBox) refuser(`viewBox absent : ${origine}`);
  // Grille à l'origine (« 0 0 L H ») : un viewBox décalé (Material : « 0 -960 960 960 ») devient « 0 0 960 960 » avec un translate sur chaque nœud.
  let decalage;
  const [x0, y0, l, h] = viewBox.split(/\s+/).map(Number);
  if ([x0, y0, l, h].some((n) => !Number.isFinite(n))) refuser(`viewBox illisible : ${origine}`);
  if (x0 !== 0 || y0 !== 0) {
    viewBox = `0 0 ${l} ${h}`;
    decalage = `translate(${-x0} ${-y0})`;
  }
  const arrondis = {};
  for (const k of ["stroke-linecap", "stroke-linejoin"]) { const r = new RegExp(`<svg[^>]*\\s${k}="([^"]+)"`).exec(svg)?.[1]; if (r) arrondis[k] = r; }
  const noeuds = [];
  for (const m of svg.matchAll(/<(\w+)\s([^>]*?)\/>/g)) {
    const balise = m[1];
    if (balise === "svg") continue;
    if (!BALISES.includes(balise)) refuser(`balise non prise en charge « ${balise} » : ${origine}`);
    const attrs = {};
    if (trait && balise === "path" && /\bd="M0 0h24v24H0z"/.test(m[2]) && /\bstroke="none"/.test(m[2])) continue; // carré de fond Tabler
    for (const a of m[2].matchAll(/([\w:-]+)="([^"]*)"/g)) {
      let val = a[2];
      if ((a[1] === "fill" || a[1] === "stroke") && !COULEURS_SANS.has(val.toLowerCase())) val = "currentColor";
      attrs[a[1]] = val;
    }
    if (plein && attrs.fill === undefined) attrs.fill = "currentColor";
    if (trait) {
      if (attrs.fill === undefined) attrs.fill = "none";
      if (attrs.stroke === undefined) attrs.stroke = "currentColor";
      for (const [k, v] of Object.entries(arrondis)) if (attrs[k] === undefined) attrs[k] = v;
    }
    if (decalage) attrs.transform = decalage;
    noeuds.push([balise, attrs]);
  }
  if (noeuds.length === 0) refuser(`aucun nœud : ${origine}`);
  lignes.push(`  /** [${origine}${v.fin}] */\n  "${jeu}:${nom}": { jeu: "${jeu}", viewBox: ${JSON.stringify(viewBox)}, noeuds: ${JSON.stringify(noeuds)} },`);
}

const sortie = arg("sortie") ?? resolve(dossierBib, def.sortie);
const types = jeu === "lucide"
  ? `export type NoeudBibliotheque = [balise: "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse", attributs: Record<string, string>];
export interface IconeBibliotheque {
  jeu: string;
  viewBox: string;
  noeuds: NoeudBibliotheque[];
}
`
  : `import type { IconeBibliotheque } from "./lucide";
`;
const contenu = `/**
 * ${def.entete(version, sha)}
 * Noms préfixés par le jeu (« ${jeu}:coche »). PUR, SANS alias « @/ » : lisible par Remotion.
 */
${types}
export const ${def.constante}: Record<string, IconeBibliotheque> = {
${lignes.join("\n")}
};
`;
writeFileSync(sortie, contenu);
console.log(`${lignes.length} icônes écrites dans ${sortie}`);
