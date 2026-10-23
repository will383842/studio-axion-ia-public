/**
 * Génère `src/briques/motion/icones.ts` (tracés des icônes Lucide, licence ISC) : `node scripts/motion/generer-icones.mjs`.
 * Les icônes sont copiées en DONNÉES (aucune dépendance React dans la brique ni dans `studio-rendu`) pour être dessinées
 * trait par trait (`pathLength=1`) par les modèles de motion design.
 */
import { writeFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const racine = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const dossier = resolve(racine, "node_modules/lucide-react/dist/esm/icons");
const ICONES = {
  coche: "check",
  "coche-cercle": "circle-check",
  croix: "x",
  horloge: "clock",
  sablier: "hourglass",
  goutte: "droplet",
  loupe: "search",
  cle: "wrench",
  marteau: "hammer",
  graphique: "chart-line",
  hausse: "trending-up",
  baisse: "trending-down",
  cible: "target",
  eclair: "zap",
  ampoule: "lightbulb",
  calendrier: "calendar",
  personne: "user",
  equipe: "users",
  message: "message-circle",
  telephone: "phone",
  document: "file-text",
  bouclier: "shield-check",
  fusee: "rocket",
  maison: "house",
  alerte: "triangle-alert",
  question: "circle-question-mark",
  etoile: "star",
  coeur: "heart",
  camera: "camera",
  robot: "bot",
  verrou: "lock",
  fleche: "arrow-right",
  euro: "euro",
  liste: "list-checks",
  route: "route",
  drapeau: "flag",
  engrenage: "settings",
  thermometre: "thermometer",
  outils: "wrench",
};
const sortie = {};
for (const [nom, lucide] of Object.entries(ICONES)) {
  const f = resolve(dossier, `${lucide}.mjs`);
  if (!existsSync(f)) throw new Error(`Icône Lucide absente : ${lucide}`);
  const { __iconData } = await import(pathToFileURL(f).href);
  if (!__iconData) throw new Error(`Données absentes : ${lucide}`);
  const noeuds = __iconData.node;
  sortie[nom] = noeuds.map(([balise, attrs]) => {
    const { key, ...reste } = attrs;
    void key;
    return [balise, reste];
  });
}
const lignes = Object.entries(sortie).map(([nom, n]) => `  ${JSON.stringify(nom)}: ${JSON.stringify(n)},`);
writeFileSync(
  resolve(racine, "src/briques/motion/icones.ts"),
  `/**
 * ICÔNES DU MOTION DESIGN — FICHIER GÉNÉRÉ par \`scripts/motion/generer-icones.mjs\` (ne pas modifier à la main).
 * Tracés Lucide (licence ISC, https://lucide.dev), grille 24 × 24, trait 2. PUR : lu par la brique et par Remotion.
 */
export type NoeudIcone = [balise: "path" | "circle" | "rect" | "line" | "polyline" | "polygon" | "ellipse", attributs: Record<string, string | number>];

export const ICONES = {
${lignes.join("\n")}
} as const satisfies Record<string, NoeudIcone[]>;

export type NomIcone = keyof typeof ICONES;

export const NOMS_ICONES = Object.keys(ICONES) as NomIcone[];
`,
);
console.log(`${Object.keys(sortie).length} icônes écrites.`);
