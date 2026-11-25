/**
 * PETITS OBJETS — schémas reliés (C9-16) : étoile (centre + satellites), icônes reliées en ligne, rangée d'agents reliés à un globe.
 * Pièces pures, NON inscrites (rien ne les importe). Liens et anneaux tracés par `TraceSvg`, apparition en cascade par `phaseObjet`.
 * Icônes par `iconeObjet(rôle)` ; le globe n'existe pas dans la table (rôle `globe` = null) : c'est ici une forme géométrique du schéma, pas une icône.
 * Textes en Manrope (`PILE_CSS`), ≤ 4 mots ; aucun filtre. Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { createElement } from "react";
import { PILE_CSS, GRAISSES } from "../../charte/axion-2026";
import { MOTS_MAX, SURFACE_MAX, type DefinitionObjet, type ProprietesObjet, type ZoneObjet } from "./contrat";
import { iconeObjet } from "./icones-objets";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** Un élément du schéma : un rôle d'icône (table de `icones-objets.ts`) et une étiquette facultative (≤ 4 mots). */
export interface ElementSchema {
  role: string;
  etiquette?: string;
}
/** `zone` (en % du cadre, facultative) : refusée au-delà de 60 % de la surface. */
export interface ParametresEtoile {
  centre: ElementSchema;
  satellites: ElementSchema[];
  zone?: ZoneObjet;
}
export interface ParametresIconesReliees {
  icones: ElementSchema[];
  zone?: ZoneObjet;
}
export interface ParametresAgentsGlobe {
  agents: ElementSchema[];
  etiquetteGlobe?: string;
  zone?: ZoneObjet;
}

const L = 1000;
const H = 600;
const TOILE = { largeur: L, hauteur: H } as const;
/** 2 s minimum : 6 éléments à 3 images d'écart doivent être posés avant la sortie. */
const DUREE = { min: 2, max: 4 } as const;
const ECART = 3;
const R_ANNEAU = 62;
const R_GLOBE = 92;

const SATELLITES = { min: 3, max: 6 } as const;
const ICONES = { min: 2, max: 5 } as const;
const AGENTS = { min: 2, max: 5 } as const;

function elementValide(e: unknown): ElementSchema | null {
  if (typeof e !== "object" || e === null) return null;
  const { role, etiquette } = e as Record<string, unknown>;
  if (typeof role !== "string" || iconeObjet(role) === null) return null;
  if (etiquette === undefined) return { role };
  if (typeof etiquette !== "string") return null;
  const mots = etiquette.trim().split(/\s+/).filter(Boolean);
  if (mots.length === 0 || mots.length > MOTS_MAX) return null;
  return { role, etiquette: mots.join(" ") };
}

function listeValide(v: unknown, min: number, max: number): ElementSchema[] | null {
  if (!Array.isArray(v) || v.length < min || v.length > max) return null;
  const sortie: ElementSchema[] = [];
  for (const e of v) {
    const ok = elementValide(e);
    if (!ok) return null;
    sortie.push(ok);
  }
  return sortie;
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

function avecZone<P extends object>(base: P, z: ZoneObjet | undefined): P {
  return z ? { ...base, zone: z } : base;
}

function validerEtoile(p: unknown): ParametresEtoile | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    const centre = elementValide(o.centre);
    const satellites = listeValide(o.satellites, SATELLITES.min, SATELLITES.max);
    const zone = zoneValide(o.zone);
    if (!centre || !satellites || zone === null) return null;
    return avecZone({ centre, satellites }, zone);
  } catch {
    return null;
  }
}

function validerIcones(p: unknown): ParametresIconesReliees | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    const icones = listeValide(o.icones, ICONES.min, ICONES.max);
    const zone = zoneValide(o.zone);
    if (!icones || zone === null) return null;
    return avecZone({ icones }, zone);
  } catch {
    return null;
  }
}

function validerAgents(p: unknown): ParametresAgentsGlobe | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const o = p as Record<string, unknown>;
    const agents = listeValide(o.agents, AGENTS.min, AGENTS.max);
    const zone = zoneValide(o.zone);
    if (!agents || zone === null) return null;
    let etiquetteGlobe: string | undefined;
    if (o.etiquetteGlobe !== undefined) {
      const e = elementValide({ role: "etoile", etiquette: o.etiquetteGlobe });
      if (!e) return null;
      etiquetteGlobe = e.etiquette;
    }
    const base: ParametresAgentsGlobe = etiquetteGlobe ? { agents, etiquetteGlobe } : { agents };
    return avecZone(base, zone);
  } catch {
    return null;
  }
}

const f = (x: number): string => x.toFixed(1);
const ATTRIBUTS_COULEUR = /^(fill|stroke)/;

type Point = { x: number; y: number };

/** Anneau circulaire tracé d'un seul trait (deux demi-arcs). */
function cheminAnneau(c: Point, r: number): string {
  return `M ${f(c.x - r)} ${f(c.y)} A ${f(r)} ${f(r)} 0 1 1 ${f(c.x + r)} ${f(c.y)} A ${f(r)} ${f(r)} 0 1 1 ${f(c.x - r)} ${f(c.y)}`;
}

/** Trait entre deux anneaux, raccourci de chaque rayon. */
function cheminLien(a: Point, ra: number, b: Point, rb: number): string {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const d = Math.hypot(dx, dy) || 1;
  const ux = dx / d;
  const uy = dy / d;
  return `M ${f(a.x + ux * ra)} ${f(a.y + uy * ra)} L ${f(b.x - ux * rb)} ${f(b.y - uy * rb)}`;
}

/** Dessin d'une icône de la table, couleurs imposées par le ton (les attributs de couleur de la source sont ignorés). */
function Icone({ role, c, r, couleur }: { role: string; c: Point; r: number; couleur: string }): JSX.Element | null {
  const ic = iconeObjet(role);
  if (!ic) return null;
  const taille = r * 1.1;
  const echelle = taille / 24;
  return (
    <g transform={`translate(${f(c.x - taille / 2)} ${f(c.y - taille / 2)}) scale(${echelle.toFixed(4)})`} fill="none" stroke={couleur} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
      {ic.noeuds.map(([balise, attrs], i) => {
        const propres: Record<string, string> = {};
        for (const [k, v] of Object.entries(attrs)) if (!ATTRIBUTS_COULEUR.test(k)) propres[k] = v;
        return createElement(balise, { key: i, ...propres });
      })}
    </g>
  );
}

function Etiquette({ texte, c, r, fond }: { texte?: string; c: Point; r: number; fond: ProprietesObjet<unknown>["fond"] }): JSX.Element | null {
  if (!texte) return null;
  return (
    <text x={f(c.x)} y={f(c.y + r + 40)} textAnchor="middle" fontFamily={PILE_CSS} fontWeight={GRAISSES.appui} fontSize={34} fill={couleurDuTon("neutre", fond)}>
      {texte}
    </text>
  );
}

/** Nœud rond : anneau tracé + icône, apparition au rang `rang`. */
function Noeud({ el, c, r, rang, pr }: { el: ElementSchema; c: Point; r: number; rang: number; pr: ProprietesObjet<unknown> }): JSX.Element {
  const ton = pr.ton ?? "neutre";
  const t = phaseObjet(pr.image - rang * ECART, pr.dureeImages).trace;
  return (
    <g data-noeud={rang} opacity={t}>
      <TraceSvg d={cheminAnneau(c, r)} t={t} ton={ton} fond={pr.fond} />
      <Icone role={el.role} c={c} r={r} couleur={couleurDuTon(ton, pr.fond)} />
      <Etiquette texte={el.etiquette} c={c} r={r} fond={pr.fond} />
    </g>
  );
}

function Lien({ d, rang, pr }: { d: string; rang: number; pr: ProprietesObjet<unknown> }): JSX.Element {
  const t = phaseObjet(pr.image - rang * ECART, pr.dureeImages).trace;
  return (
    <g data-lien={rang}>
      <TraceSvg d={d} t={t} ton={pr.ton ?? "neutre"} fond={pr.fond} epaisseur={5} />
    </g>
  );
}

function Cadre({ pr, children }: { pr: ProprietesObjet<unknown>; children: JSX.Element[] }): JSX.Element {
  const phase = phaseObjet(pr.image, pr.dureeImages);
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite}>{children}</g>
    </svg>
  );
}

/** Étoile : centre au milieu, satellites sur une ellipse, départ en haut. */
function Etoile(pr: ProprietesObjet<ParametresEtoile>): JSX.Element {
  const { centre, satellites } = pr.parametres;
  const c: Point = { x: L / 2, y: H / 2 - 10 };
  const items: JSX.Element[] = [];
  satellites.forEach((s, i) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / satellites.length;
    const p: Point = { x: c.x + Math.cos(a) * 340, y: c.y + Math.sin(a) * 175 };
    items.push(<Lien key={`l${i}`} d={cheminLien(c, R_ANNEAU + 10, p, R_ANNEAU)} rang={i + 1} pr={pr as ProprietesObjet<unknown>} />);
    items.push(<Noeud key={`s${i}`} el={s} c={p} r={R_ANNEAU - 14} rang={i + 1} pr={pr as ProprietesObjet<unknown>} />);
  });
  items.push(<Noeud key="c" el={centre} c={c} r={R_ANNEAU + 10} rang={0} pr={pr as ProprietesObjet<unknown>} />);
  return <Cadre pr={pr as ProprietesObjet<unknown>}>{items}</Cadre>;
}

/** Icônes en ligne reliées deux à deux par un trait qui se trace. */
function IconesReliees(pr: ProprietesObjet<ParametresIconesReliees>): JSX.Element {
  const { icones } = pr.parametres;
  const n = icones.length;
  const items: JSX.Element[] = [];
  const pts: Point[] = icones.map((_, i) => ({ x: n === 1 ? L / 2 : 130 + (i * (L - 260)) / (n - 1), y: H / 2 - 20 }));
  pts.forEach((p, i) => {
    if (i > 0) items.push(<Lien key={`l${i}`} d={cheminLien(pts[i - 1]!, R_ANNEAU, p, R_ANNEAU)} rang={i} pr={pr as ProprietesObjet<unknown>} />);
  });
  icones.forEach((el, i) => items.push(<Noeud key={`i${i}`} el={el} c={pts[i]!} r={R_ANNEAU} rang={i} pr={pr as ProprietesObjet<unknown>} />));
  return <Cadre pr={pr as ProprietesObjet<unknown>}>{items}</Cadre>;
}

/** Globe géométrique : cercle, méridien (ellipse), équateur — tracés par `TraceSvg`, sans icône. */
function Globe({ c, r, rang, pr, etiquette }: { c: Point; r: number; rang: number; pr: ProprietesObjet<unknown>; etiquette?: string }): JSX.Element {
  const ton = pr.ton ?? "neutre";
  const t = phaseObjet(pr.image - rang * ECART, pr.dureeImages).trace;
  return (
    <g data-globe="1" opacity={t}>
      <TraceSvg d={cheminAnneau(c, r)} t={t} ton={ton} fond={pr.fond} />
      <TraceSvg d={`M ${f(c.x - r)} ${f(c.y)} L ${f(c.x + r)} ${f(c.y)}`} t={t} ton={ton} fond={pr.fond} epaisseur={4} />
      <TraceSvg d={`M ${f(c.x)} ${f(c.y - r)} A ${f(r * 0.45)} ${f(r)} 0 0 1 ${f(c.x)} ${f(c.y + r)} A ${f(r * 0.45)} ${f(r)} 0 0 1 ${f(c.x)} ${f(c.y - r)}`} t={t} ton={ton} fond={pr.fond} epaisseur={4} />
      {etiquette ? (
        <text x={f(c.x + r + 24)} y={f(c.y + 12)} fontFamily={PILE_CSS} fontWeight={GRAISSES.appui} fontSize={34} fill={couleurDuTon("neutre", pr.fond)}>
          {etiquette}
        </text>
      ) : null}
    </g>
  );
}

/** Globe en haut, rangée d'agents en bas, chaque agent relié au globe. */
function AgentsGlobe(pr: ProprietesObjet<ParametresAgentsGlobe>): JSX.Element {
  const { agents, etiquetteGlobe } = pr.parametres;
  const n = agents.length;
  const g: Point = { x: L / 2, y: 120 };
  const base = pr as ProprietesObjet<unknown>;
  const items: JSX.Element[] = [];
  agents.forEach((el, i) => {
    const p: Point = { x: 130 + (i * (L - 260)) / (n - 1), y: 400 };
    items.push(<Lien key={`l${i}`} d={cheminLien(g, R_GLOBE, p, R_ANNEAU - 10)} rang={i + 1} pr={base} />);
    items.push(<Noeud key={`a${i}`} el={el} c={p} r={R_ANNEAU - 10} rang={i + 1} pr={base} />);
  });
  items.push(<Globe key="g" c={g} r={R_GLOBE} rang={0} pr={base} etiquette={etiquetteGlobe} />);
  return <Cadre pr={base}>{items}</Cadre>;
}

function definir<P>(id: DefinitionObjet<P>["id"], capacite: DefinitionObjet<P>["capacite"], valider: DefinitionObjet<P>["valider"], Rendu: DefinitionObjet<P>["Rendu"]): DefinitionObjet<P> {
  return { id, famille: "schema", capacite, valider, toile: TOILE, dureeSec: DUREE, donnees: "aucune", Rendu };
}

export const OBJET_SCHEMA_ETOILE = definir<ParametresEtoile>("objet-schema-etoile", "objet.schema", validerEtoile, Etoile);
export const OBJET_ICONES_RELIEES = definir<ParametresIconesReliees>("objet-icones-reliees", "objet.reseau-schema", validerIcones, IconesReliees);
export const OBJET_AGENTS_GLOBE = definir<ParametresAgentsGlobe>("objet-agents-globe", "objet.reseau-schema", validerAgents, AgentsGlobe);

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_SCHEMAS = {
  etoile: [
    { centre: { role: "personne", etiquette: "Vous" }, satellites: [{ role: "lien" }, { role: "cloche" }, { role: "etoile" }] },
    { centre: { role: "etoile" }, satellites: [{ role: "pouce" }, { role: "lien" }, { role: "cloche" }, { role: "coche" }, { role: "personne" }, { role: "etoile" }] },
  ] satisfies ParametresEtoile[],
  icones: [
    { icones: [{ role: "personne" }, { role: "lien" }] },
    { icones: [{ role: "personne" }, { role: "lien" }, { role: "cloche" }, { role: "coche" }, { role: "pouce" }] },
  ] satisfies ParametresIconesReliees[],
  agents: [
    { agents: [{ role: "personne", etiquette: "Agent un" }, { role: "personne" }], etiquetteGlobe: "Monde" },
    { agents: [{ role: "personne" }, { role: "personne" }, { role: "personne" }, { role: "personne" }, { role: "personne" }] },
  ] satisfies ParametresAgentsGlobe[],
} as const;
