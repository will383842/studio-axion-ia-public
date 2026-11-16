/**
 * LOGOS D'OUTILS (C8-L02) : assainisseur SVG à liste blanche + génération de `dessins.ts`.
 * Usage : pnpm exec tsx outils/logos-outils/convertir.mts
 *   lit `src/briques/motion/logos-outils/fichiers/*.svg` (dossier absent = zéro fichier = `{}`)
 *   et écrit `src/briques/motion/logos-outils/dessins.ts` (généré, ne pas modifier à la main).
 * Liste blanche : seuls `<svg viewBox>` et `<path d fill?>`. Rendu prévu par `<path>` React seulement.
 */
import { existsSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import type { DessinLogo, NoeudLogo } from "../../src/briques/motion/logos-outils/types";

export const PLAFOND_LOGO_OCTETS = 8 * 1024;
export const PLAFOND_DESSINS_OCTETS = 64 * 1024;

const OCTETS = (t: string) => Buffer.byteLength(t, "utf8");
const ID_LOGO = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const TRACE = /^[MmLlHhVvCcSsQqTtAaZz0-9eE+\-.,\s]+$/;
const HEX = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
const NOMBRE = /^[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?$/;
const ATTRIBUT = /\s+([A-Za-z_][\w:.-]*)\s*=\s*(?:"([^"]*)"|'([^']*)')/y;

type Resultat = { dessin: DessinLogo } | { refus: string };

/** Lit des attributs `nom="valeur"` ; null si le reste n'est pas uniquement des attributs. */
function lireAttributs(brut: string): Record<string, string> | null {
  const out: Record<string, string> = {};
  let pos = 0;
  for (;;) {
    ATTRIBUT.lastIndex = pos;
    const m = ATTRIBUT.exec(brut);
    if (!m) break;
    if (m[1] in out) return null;
    out[m[1]] = m[2] ?? m[3] ?? "";
    pos = ATTRIBUT.lastIndex;
  }
  return /^\s*$/.test(brut.slice(pos)) ? out : null;
}

export function assainirSvg(texte: string): Resultat {
  if (typeof texte !== "string") return { refus: "texte attendu" };
  if (OCTETS(texte) > PLAFOND_LOGO_OCTETS) return { refus: "plus de 8 Ko" };
  const t = texte.trim();
  if (/&/.test(t)) return { refus: "entité interdite" };
  if (/<\s*(script|style|image|use)\b/i.test(t)) return { refus: "balise interdite (script, style, image, use)" };
  if (/href\s*=/i.test(t)) return { refus: "href interdit" };
  if (/\bon[a-z]+\s*=/i.test(t)) return { refus: "gestionnaire on*= interdit" };
  if (/url\s*\(/i.test(t)) return { refus: "url( interdit" };
  if (/transform\s*=/i.test(t)) return { refus: "transform interdit" };

  const racine = /^<svg((?:\s[^<>]*)?)>([\s\S]*)<\/svg>$/.exec(t);
  if (!racine) return { refus: "seul <svg …>…</svg> est accepté" };
  const attrsSvg = lireAttributs(racine[1]);
  if (!attrsSvg) return { refus: "attributs <svg> illisibles" };
  for (const [nom, val] of Object.entries(attrsSvg)) {
    if (nom === "viewBox") continue;
    if (nom === "xmlns" && val === "http://www.w3.org/2000/svg") continue;
    if (nom === "role" && val === "img") continue;
    return { refus: `attribut <svg> interdit : ${nom}` };
  }
  const vb = attrsSvg.viewBox;
  if (vb === undefined) return { refus: "viewBox manquant" };
  const morceaux = vb.trim().split(/[\s,]+/);
  if (morceaux.length !== 4 || !morceaux.every((m) => NOMBRE.test(m))) return { refus: "viewBox invalide" };
  const vue = morceaux.map(Number) as DessinLogo["vue"];
  if (!vue.every(Number.isFinite) || vue[2] <= 0 || vue[3] <= 0) return { refus: "viewBox invalide" };

  const noeuds: NoeudLogo[] = [];
  const PATH = /\s*<path((?:\s[^<>]*?)?)\s*(?:\/>|><\/path>)/y;
  const corps = racine[2];
  let pos = 0;
  for (;;) {
    PATH.lastIndex = pos;
    const m = PATH.exec(corps);
    if (!m) break;
    pos = PATH.lastIndex;
    const a = lireAttributs(m[1]);
    if (!a) return { refus: "attributs <path> illisibles" };
    for (const nom of Object.keys(a)) if (nom !== "d" && nom !== "fill") return { refus: `attribut <path> interdit : ${nom}` };
    const d = a.d?.trim();
    if (!d) return { refus: "d manquant ou vide" };
    if (!TRACE.test(d) || !/^[Mm]/.test(d)) return { refus: "d invalide (commandes de tracé et nombres seulement, M en tête)" };
    const attrs: { d: string; fill?: string } = { d };
    if (a.fill !== undefined) {
      if (!HEX.test(a.fill)) return { refus: "fill : hexadécimal seulement" };
      attrs.fill = a.fill;
    }
    noeuds.push(["path", attrs]);
  }
  if (!/^\s*$/.test(corps.slice(pos))) return { refus: "contenu autre que <path> (liste blanche)" };
  if (noeuds.length === 0) return { refus: "aucun <path>" };
  const dessin: DessinLogo = { vue, noeuds };
  if (OCTETS(JSON.stringify(dessin)) > PLAFOND_LOGO_OCTETS) return { refus: "plus de 8 Ko" };
  return { dessin };
}

/** Texte complet de `dessins.ts` pour ces fichiers ; lève si un fichier est refusé ou si 64 Ko sont dépassés. */
export function genererDessins(fichiers: { id: string; texte: string }[]): string {
  const vus = new Set<string>();
  const lignes: string[] = [];
  for (const { id, texte } of [...fichiers].sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0))) {
    if (!ID_LOGO.test(id)) throw new Error(`id de logo invalide : ${id}`);
    if (vus.has(id)) throw new Error(`id en double : ${id}`);
    vus.add(id);
    const r = assainirSvg(texte);
    if ("refus" in r) throw new Error(`${id}.svg refusé : ${r.refus}`);
    lignes.push(`  ${JSON.stringify(id)}: ${JSON.stringify(r.dessin)},`);
  }
  const sortie = [
    "/**",
    " * DESSINS DES LOGOS D'OUTILS (C8-L02) — GÉNÉRÉ par `outils/logos-outils/convertir.mts`, ne pas modifier à la main.",
    " * Même forme que `src/briques/dessins/traces.ts` ; lu par le rendu : PUR, sans alias de chemin.",
    " */",
    'import type { DessinLogo } from "./types";',
    "",
    lignes.length === 0
      ? "export const DESSINS_LOGOS: Record<string, DessinLogo> = {};"
      : `export const DESSINS_LOGOS: Record<string, DessinLogo> = {\n${lignes.join("\n")}\n};`,
    "",
  ].join("\n");
  if (OCTETS(sortie) > PLAFOND_DESSINS_OCTETS) throw new Error("dessins.ts dépasse 64 Ko");
  return sortie;
}

export function lireFichiersLogos(dossier: string): { id: string; texte: string }[] {
  if (!existsSync(dossier)) return [];
  return readdirSync(dossier)
    .filter((f) => f.endsWith(".svg"))
    .map((f) => ({ id: f.slice(0, -4), texte: readFileSync(join(dossier, f), "utf8") }));
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const base = join(process.cwd(), "src", "briques", "motion", "logos-outils");
  const texte = genererDessins(lireFichiersLogos(join(base, "fichiers")));
  writeFileSync(join(base, "dessins.ts"), texte);
  console.log(`dessins.ts écrit (${OCTETS(texte)} octets)`);
}
