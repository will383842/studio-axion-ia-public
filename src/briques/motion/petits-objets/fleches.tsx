/**
 * PETITS OBJETS — flèches (C9-06) : droite, courbe, pointillée, à main levée. Pièces pures, NON inscrites (rien ne les importe).
 * Corps tracé par `TraceSvg` ; pointe = deux petits traits tracés dans le dernier quart ; aucun texte, aucun filtre.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { SURFACE_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { tremblement } from "./tremblement";
import { TraceSvg } from "./TraceSvg";

export interface PointPourcent {
  x: number;
  y: number;
}
/** Points en % de la toile ; `courbure` (courbe seulement) dans -1..1, absent = courbe de `cheminFlecheObjet`. */
export interface ParametresFleche {
  de: PointPourcent;
  vers: PointPourcent;
  courbure?: number;
}

const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1, max: 4 } as const;
const LONGUEUR_POINTE = 46;
const OUVERTURE_POINTE = 0.5;
const PAS_TIRET = 50;
const LONGUEUR_TIRET = 28;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const point = (v: unknown): PointPourcent | null => {
  if (typeof v !== "object" || v === null) return null;
  const { x, y } = v as Record<string, unknown>;
  return nombre(x) && nombre(y) && x >= 0 && x <= 100 && y >= 0 && y <= 100 ? { x, y } : null;
};

function valider(p: unknown, avecCourbure: boolean): ParametresFleche | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const de = point(r.de);
    const vers = point(r.vers);
    if (!de || !vers || (de.x === vers.x && de.y === vers.y)) return null;
    if (Math.abs(vers.x - de.x) * Math.abs(vers.y - de.y) / 10000 > SURFACE_MAX) return null;
    const sortie: ParametresFleche = { de, vers };
    if (avecCourbure && r.courbure !== undefined) {
      if (!nombre(r.courbure) || r.courbure < -1 || r.courbure > 1) return null;
      sortie.courbure = r.courbure;
    }
    return sortie;
  } catch {
    return null;
  }
}

const px = (a: PointPourcent): { x: number; y: number } => ({ x: (a.x * L) / 100, y: (a.y * H) / 100 });
const f = (n: number): string => n.toFixed(1);
const borne01 = (n: number): number => Math.min(1, Math.max(0, n));

interface Forme {
  d: string;
  fin: { x: number; y: number };
  angle: number;
}

function formeDroite(p: ParametresFleche): Forme {
  const a = px(p.de);
  const b = px(p.vers);
  return { d: `M ${f(a.x)} ${f(a.y)} L ${f(b.x)} ${f(b.y)}`, fin: b, angle: Math.atan2(b.y - a.y, b.x - a.x) };
}

/** Sans `courbure` : même contrôle que `cheminFlecheObjet` (`TraceSvg.tsx`), donc même `d`. */
function formeCourbe(p: ParametresFleche): Forme {
  const debut = px(p.de);
  const fin = px(p.vers);
  let c: { x: number; y: number };
  if (p.courbure === undefined) c = { x: debut.x + (fin.x - debut.x) * 0.1, y: fin.y + (debut.y - fin.y) * 0.15 };
  else {
    const dx = fin.x - debut.x;
    const dy = fin.y - debut.y;
    c = { x: (debut.x + fin.x) / 2 - dy * p.courbure * 0.5, y: (debut.y + fin.y) / 2 + dx * p.courbure * 0.5 };
  }
  return { d: `M ${f(debut.x)} ${f(debut.y)} Q ${f(c.x)} ${f(c.y)} ${f(fin.x)} ${f(fin.y)}`, fin, angle: Math.atan2(fin.y - c.y, fin.x - c.x) };
}

/** Points intermédiaires décalés (perpendiculairement) par `aleaGraine`, lissés par des milieux. */
function formeMainLevee(p: ParametresFleche, graine: number): Forme {
  const a = px(p.de);
  const b = px(p.vers);
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const longueur = Math.hypot(dx, dy) || 1;
  const nx = -dy / longueur;
  const ny = dx / longueur;
  const amp = Math.min(24, longueur * 0.05);
  const pts = [a];
  for (let i = 1; i <= 5; i++) {
    const s = i / 6;
    const o = (aleaGraine(graine, i) - 0.5) * 2 * amp;
    pts.push({ x: a.x + dx * s + nx * o, y: a.y + dy * s + ny * o });
  }
  pts.push(b);
  let d = `M ${f(pts[0].x)} ${f(pts[0].y)}`;
  for (let i = 1; i < pts.length - 1; i++) {
    const m = { x: (pts[i].x + pts[i + 1].x) / 2, y: (pts[i].y + pts[i + 1].y) / 2 };
    d += ` Q ${f(pts[i].x)} ${f(pts[i].y)} ${f(m.x)} ${f(m.y)}`;
  }
  const av = pts[pts.length - 2];
  d += ` L ${f(b.x)} ${f(b.y)}`;
  return { d, fin: b, angle: Math.atan2(b.y - av.y, b.x - av.x) };
}

function Pointe({ forme, t, ton, fond }: { forme: Forme; t: number; ton: ProprietesObjet<ParametresFleche>["ton"]; fond: ProprietesObjet<ParametresFleche>["fond"] }): JSX.Element {
  const tp = borne01((t - 0.75) / 0.25);
  const bras = (s: number): string => {
    const a = forme.angle + Math.PI + s * OUVERTURE_POINTE;
    return `M ${f(forme.fin.x)} ${f(forme.fin.y)} L ${f(forme.fin.x + Math.cos(a) * LONGUEUR_POINTE)} ${f(forme.fin.y + Math.sin(a) * LONGUEUR_POINTE)}`;
  };
  return (
    <>
      <TraceSvg d={bras(1)} t={tp} ton={ton ?? "neutre"} fond={fond} />
      <TraceSvg d={bras(-1)} t={tp} ton={ton ?? "neutre"} fond={fond} />
    </>
  );
}

function Tirets({ p, t, ton, fond }: { p: ParametresFleche; t: number; ton: ProprietesObjet<ParametresFleche>["ton"]; fond: ProprietesObjet<ParametresFleche>["fond"] }): JSX.Element {
  const a = px(p.de);
  const b = px(p.vers);
  const longueur = Math.hypot(b.x - a.x, b.y - a.y);
  const n = Math.max(2, Math.floor(longueur / PAS_TIRET));
  const pas = longueur / n;
  const ux = (b.x - a.x) / longueur;
  const uy = (b.y - a.y) / longueur;
  const tirets: JSX.Element[] = [];
  for (let i = 0; i < n; i++) {
    const s0 = i * pas;
    const s1 = Math.min(longueur, s0 + Math.min(LONGUEUR_TIRET, pas * 0.6));
    const d = `M ${f(a.x + ux * s0)} ${f(a.y + uy * s0)} L ${f(a.x + ux * s1)} ${f(a.y + uy * s1)}`;
    tirets.push(<TraceSvg key={i} d={d} t={borne01(t * n - i)} ton={ton ?? "neutre"} fond={fond} />);
  }
  return <>{tirets}</>;
}

type Variante = "droite" | "courbe" | "pointillee" | "main-levee";

function creer(variante: Variante, id: DefinitionObjet<ParametresFleche>["id"]): DefinitionObjet<ParametresFleche> {
  return {
    id,
    famille: "trait",
    capacite: "objet.trait",
    valider: (p) => valider(p, variante === "courbe"),
    toile: TOILE,
    dureeSec: DUREE,
    donnees: "aucune",
    Rendu(pr): JSX.Element {
      const { image, fps, dureeImages, fond, parametres, graine } = pr;
      const ton = pr.ton ?? "neutre";
      const phase = phaseObjet(image, dureeImages);
      const t = phase.trace;
      const forme = variante === "courbe" ? formeCourbe(parametres) : variante === "main-levee" ? formeMainLevee(parametres, graine) : formeDroite(parametres);
      const tr = variante === "main-levee" ? tremblement(graine, image, fps) : { dx: 0, dy: 0, angle: 0 };
      const transform = `translate(${tr.dx.toFixed(2)} ${tr.dy.toFixed(2)}) rotate(${tr.angle.toFixed(2)} ${L / 2} ${H / 2})`;
      return (
        <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
          <g opacity={phase.opacite} transform={transform}>
            {variante === "pointillee" ? <Tirets p={parametres} t={t} ton={ton} fond={fond} /> : <TraceSvg d={forme.d} t={t} ton={ton} fond={fond} />}
            <Pointe forme={forme} t={t} ton={ton} fond={fond} />
          </g>
        </svg>
      );
    },
  };
}

export const OBJET_FLECHE_DROITE = creer("droite", "objet-fleche-droite");
export const OBJET_FLECHE_COURBE = creer("courbe", "objet-fleche-courbe");
export const OBJET_FLECHE_POINTILLEE = creer("pointillee", "objet-fleche-pointillee");
export const OBJET_FLECHE_MAIN_LEVEE = creer("main-levee", "objet-fleche-main-levee");

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_FLECHES: readonly ParametresFleche[] = [
  { de: { x: 15, y: 20 }, vers: { x: 70, y: 55 } },
  { de: { x: 80, y: 75 }, vers: { x: 30, y: 40 }, courbure: 0.4 },
  { de: { x: 20, y: 80 }, vers: { x: 75, y: 70 } },
];
