/**
 * PETITS OBJETS — schéma de flux (C9-17) : 3 à 5 carrés arrondis reliés par un trait qui se trace, coche finale ; en ligne (16:9) ou en colonne (9:16).
 * Pièce pure, NON inscrite (rien ne l'importe). Carrés, liens et coche tracés par `TraceSvg`, apparition en cascade par `phaseObjet`.
 * Icônes facultatives par `iconeObjet(rôle)`. Textes en Manrope (`PILE_CSS`), ≤ 4 mots ; aucun filtre. Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { createElement } from "react";
import { PILE_CSS, GRAISSES } from "../../charte/axion-2026";
import { MOTS_MAX, SURFACE_MAX, type DefinitionObjet, type ProprietesObjet, type ZoneObjet } from "./contrat";
import { iconeObjet } from "./icones-objets";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** Un carré du flux : icône (rôle de la table de `icones-objets.ts`) et/ou étiquette (≤ 4 mots) ; au moins l'un des deux. */
export interface EtapeFlux {
  role?: string;
  etiquette?: string;
}
export type OrientationFlux = "ligne" | "colonne";
/** `zone` (en % du cadre, facultative) : refusée au-delà de 60 % de la surface. */
export interface ParametresFlux {
  etapes: EtapeFlux[];
  orientation?: OrientationFlux;
  zone?: ZoneObjet;
}

const L = 1000;
const H = 600;
const TOILE = { largeur: L, hauteur: H } as const;
/** 2 s minimum : 5 carrés + coche à 3 images d'écart doivent être posés avant la sortie. */
const DUREE = { min: 2, max: 4 } as const;
const ECART = 3;
const ETAPES = { min: 3, max: 5 } as const;
const R_COCHE = 36;

function etapeValide(e: unknown): EtapeFlux | null {
  if (typeof e !== "object" || e === null) return null;
  const { role, etiquette } = e as Record<string, unknown>;
  const sortie: EtapeFlux = {};
  if (role !== undefined) {
    if (typeof role !== "string" || iconeObjet(role) === null) return null;
    sortie.role = role;
  }
  if (etiquette !== undefined) {
    if (typeof etiquette !== "string") return null;
    const mots = etiquette.trim().split(/\s+/).filter(Boolean);
    if (mots.length === 0 || mots.length > MOTS_MAX) return null;
    sortie.etiquette = mots.join(" ");
  }
  return sortie.role === undefined && sortie.etiquette === undefined ? null : sortie;
}

/** `undefined` = pas de zone ; `null` = zone refusée. */
function zoneValide(z: unknown): ZoneObjet | undefined | null {
  if (z === undefined) return undefined;
  if (typeof z !== "object" || z === null) return null;
  const { x, y, largeur, hauteur } = z as Record<string, unknown>;
  if (![x, y, largeur, hauteur].every((n) => typeof n === "number" && Number.isFinite(n))) return null;
  const [X, Y, W, Hh] = [x, y, largeur, hauteur] as number[];
  if (W! <= 0 || Hh! <= 0 || X! < 0 || Y! < 0 || X! + W! > 100 || Y! + Hh! > 100) return null;
  if ((W! * Hh!) / 10000 > SURFACE_MAX) return null;
  return { x: X!, y: Y!, largeur: W!, hauteur: Hh! };
}

function validerFlux(p: unknown): ParametresFlux | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    if (!Array.isArray(o.etapes) || o.etapes.length < ETAPES.min || o.etapes.length > ETAPES.max) return null;
    const etapes: EtapeFlux[] = [];
    for (const e of o.etapes) {
      const ok = etapeValide(e);
      if (!ok) return null;
      etapes.push(ok);
    }
    if (o.orientation !== undefined && o.orientation !== "ligne" && o.orientation !== "colonne") return null;
    const zone = zoneValide(o.zone);
    if (zone === null) return null;
    const sortie: ParametresFlux = { etapes };
    if (o.orientation !== undefined) sortie.orientation = o.orientation;
    if (zone) sortie.zone = zone;
    return sortie;
  } catch {
    return null;
  }
}

const f = (x: number): string => x.toFixed(1);
const ATTRIBUTS_COULEUR = /^(fill|stroke)/;

type Point = { x: number; y: number };
type Boite = { x: number; y: number; l: number; h: number };
type Pr = ProprietesObjet<unknown>;

/** Carré à coins arrondis, tracé d'un seul trait. */
function cheminCarre({ x, y, l, h }: Boite): string {
  const r = 18;
  return (
    `M ${f(x + r)} ${f(y)} L ${f(x + l - r)} ${f(y)} A ${r} ${r} 0 0 1 ${f(x + l)} ${f(y + r)} L ${f(x + l)} ${f(y + h - r)} A ${r} ${r} 0 0 1 ${f(x + l - r)} ${f(y + h)} ` +
    `L ${f(x + r)} ${f(y + h)} A ${r} ${r} 0 0 1 ${f(x)} ${f(y + h - r)} L ${f(x)} ${f(y + r)} A ${r} ${r} 0 0 1 ${f(x + r)} ${f(y)}`
  );
}

function cheminAnneau(c: Point, r: number): string {
  return `M ${f(c.x - r)} ${f(c.y)} A ${f(r)} ${f(r)} 0 1 1 ${f(c.x + r)} ${f(c.y)} A ${f(r)} ${f(r)} 0 1 1 ${f(c.x - r)} ${f(c.y)}`;
}

function Icone({ role, c, taille, couleur }: { role: string; c: Point; taille: number; couleur: string }): JSX.Element | null {
  const ic = iconeObjet(role);
  if (!ic) return null;
  return (
    <g transform={`translate(${f(c.x - taille / 2)} ${f(c.y - taille / 2)}) scale(${(taille / 24).toFixed(4)})`} fill="none" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {ic.noeuds.map(([balise, attrs], i) => {
        const propres: Record<string, string> = {};
        for (const [k, v] of Object.entries(attrs)) if (!ATTRIBUTS_COULEUR.test(k)) propres[k] = v;
        return createElement(balise, { key: i, ...propres });
      })}
    </g>
  );
}

function Texte({ texte, x, y, ancre, fond }: { texte: string; x: number; y: number; ancre: "start" | "middle"; fond: Pr["fond"] }): JSX.Element {
  return (
    <text x={f(x)} y={f(y)} textAnchor={ancre} fontFamily={PILE_CSS} fontWeight={GRAISSES.appui} fontSize={30} fill={couleurDuTon("neutre", fond)}>
      {texte}
    </text>
  );
}

function Carre({ et, b, rang, colonne, pr }: { et: EtapeFlux; b: Boite; rang: number; colonne: boolean; pr: Pr }): JSX.Element {
  const ton = pr.ton ?? "neutre";
  const t = phaseObjet(pr.image - rang * ECART, pr.dureeImages).trace;
  const couleur = couleurDuTon(ton, pr.fond);
  const centre: Point = { x: b.x + b.l / 2, y: b.y + b.h / 2 };
  let contenu: (JSX.Element | null)[];
  if (colonne) {
    const icone = et.role ? <Icone key="i" role={et.role} c={{ x: b.x + b.h / 2, y: centre.y }} taille={b.h * 0.5} couleur={couleur} /> : null;
    const texte = et.etiquette ? <Texte key="t" texte={et.etiquette} x={et.role ? b.x + b.h : centre.x} y={centre.y + 10} ancre={et.role ? "start" : "middle"} fond={pr.fond} /> : null;
    contenu = [icone, texte];
  } else {
    const icone = et.role ? <Icone key="i" role={et.role} c={centre} taille={b.h * 0.45} couleur={couleur} /> : null;
    const texte = et.etiquette ? <Texte key="t" texte={et.etiquette} x={centre.x} y={et.role ? b.y + b.h + 44 : centre.y + 10} ancre="middle" fond={pr.fond} /> : null;
    contenu = [icone, texte];
  }
  return (
    <g data-carre={rang} data-x={f(b.x)} data-y={f(b.y)} data-l={f(b.l)} data-h={f(b.h)} opacity={t}>
      <TraceSvg d={cheminCarre(b)} t={t} ton={ton} fond={pr.fond} />
      {contenu}
    </g>
  );
}

function Lien({ a, b, rang, pr }: { a: Point; b: Point; rang: number; pr: Pr }): JSX.Element {
  const t = phaseObjet(pr.image - rang * ECART, pr.dureeImages).trace;
  return (
    <g data-lien={rang}>
      <TraceSvg d={`M ${f(a.x)} ${f(a.y)} L ${f(b.x)} ${f(b.y)}`} t={t} ton={pr.ton ?? "neutre"} fond={pr.fond} epaisseur={5} />
    </g>
  );
}

/** Coche finale : coche tracée dans un anneau, après le dernier carré. */
function Coche({ c, rang, pr }: { c: Point; rang: number; pr: Pr }): JSX.Element {
  const ton = pr.ton ?? "neutre";
  const t = phaseObjet(pr.image - rang * ECART, pr.dureeImages).trace;
  const r = R_COCHE;
  return (
    <g data-coche="1" opacity={t}>
      <TraceSvg d={`M ${f(c.x - r * 0.42)} ${f(c.y + r * 0.02)} L ${f(c.x - r * 0.1)} ${f(c.y + r * 0.34)} L ${f(c.x + r * 0.46)} ${f(c.y - r * 0.32)}`} t={t} ton={ton} fond={pr.fond} epaisseur={6} />
      <TraceSvg d={cheminAnneau(c, r)} t={t} ton={ton} fond={pr.fond} />
    </g>
  );
}

function Flux(pr: ProprietesObjet<ParametresFlux>): JSX.Element {
  const { etapes, orientation } = pr.parametres;
  const colonne = orientation === "colonne";
  const base = pr as Pr;
  const n = etapes.length;
  const boites: Boite[] = [];
  let coche: Point;
  if (colonne) {
    const l = 380;
    const h = 64;
    const ecart = 34;
    const y0 = (H - (n * (h + ecart) + 2 * R_COCHE)) / 2;
    for (let i = 0; i < n; i++) boites.push({ x: (L - l) / 2, y: y0 + i * (h + ecart), l, h });
    coche = { x: L / 2, y: y0 + n * (h + ecart) + R_COCHE };
  } else {
    const l = 120;
    const ecart = 56;
    const x0 = (L - (n * (l + ecart) + 2 * R_COCHE)) / 2;
    for (let i = 0; i < n; i++) boites.push({ x: x0 + i * (l + ecart), y: 150, l, h: l });
    coche = { x: x0 + n * (l + ecart) + R_COCHE, y: 150 + l / 2 };
  }
  const items: JSX.Element[] = [];
  boites.forEach((b, i) => {
    const suivant = i + 1 < n ? boites[i + 1]! : null;
    const sortie: Point = colonne ? { x: b.x + b.l / 2, y: b.y + b.h } : { x: b.x + b.l, y: b.y + b.h / 2 };
    const entree: Point = suivant ? (colonne ? { x: suivant.x + suivant.l / 2, y: suivant.y } : { x: suivant.x, y: suivant.y + suivant.h / 2 }) : colonne ? { x: coche.x, y: coche.y - R_COCHE } : { x: coche.x - R_COCHE, y: coche.y };
    items.push(<Lien key={`l${i}`} a={sortie} b={entree} rang={i + 1} pr={base} />);
    items.push(<Carre key={`c${i}`} et={etapes[i]!} b={b} rang={i} colonne={colonne} pr={base} />);
  });
  items.push(<Coche key="ok" c={coche} rang={n} pr={base} />);
  const phase = phaseObjet(pr.image, pr.dureeImages);
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite}>{items}</g>
    </svg>
  );
}

export const OBJET_SCHEMA_FLUX: DefinitionObjet<ParametresFlux> = {
  id: "objet-schema-flux",
  famille: "schema",
  capacite: "objet.reseau-schema",
  valider: validerFlux,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "aucune",
  Rendu: Flux,
};

/** Données de planche (entrées valides), lues plus tard par C9-40. */
export const EXEMPLES_FLUX = [
  { etapes: [{ role: "personne", etiquette: "Demande" }, { role: "lien", etiquette: "Envoi" }, { role: "cloche", etiquette: "Alerte" }] },
  { etapes: [{ etiquette: "Un" }, { etiquette: "Deux" }, { etiquette: "Trois" }, { etiquette: "Quatre" }, { etiquette: "Cinq" }], orientation: "colonne" },
] satisfies ParametresFlux[];
