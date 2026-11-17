/**
 * PETITS OBJETS — émetteur de particules à graine (C10-11) : confettis, onde de choc (réécrite), pluie d'icônes.
 * Pièce pure, NON inscrite (rien ne l'importe). Hasard par `aleaGraine`, gravité simple, 40 particules au plus,
 * toute particule hors de la zone reçue ou dans la zone du visage est retirée. Aucun texte, aucun filtre.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import { createElement, type JSX } from "react";
import type { DefinitionObjet, TonObjet, ZoneObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { BANDE_SOUS_TITRES, ZONE_VISAGE_OBJETS, verifierZone } from "./zones";
import { ICONES_BIBLIOTHEQUE } from "../bibliotheque-icones";
import { harmoniser, nomPermis } from "../bibliotheque-icones/harmoniser";

export type ModeParticules = "confettis" | "onde" | "pluie-icones";
export interface ParametresParticules {
  mode: ModeParticules;
  /** En % du cadre ; jamais sur le visage ni sur la bande des sous-titres. */
  zone: ZoneObjet;
  nombre?: number;
  /** Mode pluie seulement : nom préfixé de la bibliothèque. */
  icone?: string;
}
export interface Particule {
  /** En % du cadre. */
  x: number;
  y: number;
  /** Degrés. */
  angle: number;
  echelle: number;
  opacite: number;
  ton: TonObjet;
  forme: "rectangle" | "triangle" | "cercle" | "icone";
}

const L = 1000;
const FPS = 25;
export const PARTICULES_MAX = 40;
const NOMBRE_DEFAUT = 24;
const ICONE_DEFAUT = "lucide:etoile";
const MODES: readonly ModeParticules[] = ["confettis", "onde", "pluie-icones"];
const TONS_CONFETTIS: readonly TonObjet[] = ["accent", "neutre", "valide"];

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const f = (n: number): string => n.toFixed(1);
const dans = (x: number, y: number, z: ZoneObjet): boolean => x >= z.x && x <= z.x + z.largeur && y >= z.y && y <= z.y + z.hauteur;

function valider(p: unknown): ParametresParticules | null {
  try {
    if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
    const r = p as Record<string, unknown>;
    if (typeof r.mode !== "string" || !(MODES as readonly string[]).includes(r.mode)) return null;
    const z = r.zone;
    if (typeof z !== "object" || z === null) return null;
    const { x, y, largeur, hauteur } = z as Record<string, unknown>;
    if (!nombre(x) || !nombre(y) || !nombre(largeur) || !nombre(hauteur)) return null;
    const zone = { x, y, largeur, hauteur };
    if (verifierZone(zone) !== "ok") return null;
    const sortie: ParametresParticules = { mode: r.mode as ModeParticules, zone };
    if (r.nombre !== undefined) {
      if (!nombre(r.nombre) || !Number.isInteger(r.nombre) || r.nombre < 1 || r.nombre > PARTICULES_MAX) return null;
      sortie.nombre = r.nombre;
    }
    if (r.icone !== undefined) {
      if (typeof r.icone !== "string" || !nomPermis(r.icone) || !Object.prototype.hasOwnProperty.call(ICONES_BIBLIOTHEQUE, r.icone)) return null;
      sortie.icone = r.icone;
    }
    return sortie;
  } catch {
    return null;
  }
}

/** Liste des particules à l'image donnée. Pure ; jamais d'exception (entrée mauvaise = liste vide). */
export function emettre(graine: number, image: number, dureeImages: number, p: ParametresParticules): Particule[] {
  try {
    if (!nombre(graine) || !nombre(image) || !nombre(dureeImages) || image < 0 || dureeImages <= 0 || image >= dureeImages) return [];
    if (!p || typeof p !== "object" || !MODES.includes(p.mode)) return [];
    const z = p.zone;
    if (!z || ![z.x, z.y, z.largeur, z.hauteur].every(nombre)) return [];
    const n = Math.min(PARTICULES_MAX, Math.max(0, Math.floor(nombre(p.nombre) ? p.nombre : NOMBRE_DEFAUT)));
    const t = image / FPS;
    const avancement = image / dureeImages;
    const sortie: Particule[] = [];
    const garder = (q: Particule): void => {
      if (!dans(q.x, q.y, z) || dans(q.x, q.y, ZONE_VISAGE_OBJETS) || dans(q.x, q.y, BANDE_SOUS_TITRES)) return;
      if (sortie.length < PARTICULES_MAX) sortie.push(q);
    };
    if (p.mode === "onde") {
      const anneaux = Math.min(3, Math.max(1, nombre(p.nombre) ? Math.floor(p.nombre) : 3));
      const cx = z.x + z.largeur / 2;
      const cy = z.y + z.hauteur / 2;
      const rayonMax = Math.min(z.largeur, z.hauteur) / 2;
      for (let i = 0; i < anneaux; i++) {
        const p01 = Math.min(1, Math.max(0, avancement * 1.6 - i * 0.25));
        if (p01 <= 0) continue;
        const sortant = 1 - (1 - p01) * (1 - p01);
        garder({ x: cx, y: cy, angle: 0, echelle: rayonMax * sortant, opacite: 1 - p01, ton: "accent", forme: "cercle" });
      }
      return sortie;
    }
    const gravite = z.hauteur * 3;
    for (let i = 0; i < n; i++) {
      const a = aleaGraine(graine, i * 8);
      const b = aleaGraine(graine, i * 8 + 1);
      const c = aleaGraine(graine, i * 8 + 2);
      const d = aleaGraine(graine, i * 8 + 3);
      const e = aleaGraine(graine, i * 8 + 4);
      if (p.mode === "confettis") {
        const origineX = z.x + z.largeur / 2;
        const origineY = z.y + z.hauteur * 0.7;
        const direction = (-90 + (a - 0.5) * 140) * (Math.PI / 180);
        const vitesse = z.largeur * (0.12 + b * 0.35);
        const x = origineX + Math.cos(direction) * vitesse * t * 2;
        const y = origineY + Math.sin(direction) * vitesse * t * 0.9 * (z.hauteur / z.largeur) * 2 + 0.5 * gravite * t * t;
        garder({
          x, y, angle: (c * 360 + d * 540 * t) % 360, echelle: 0.7 + e * 0.6, opacite: Math.min(1, Math.max(0, 1 - avancement * avancement)),
          ton: TONS_CONFETTIS[Math.floor(d * TONS_CONFETTIS.length) % TONS_CONFETTIS.length], forme: c < 0.5 ? "rectangle" : "triangle",
        });
      } else {
        const depart = a * z.largeur;
        const vitesse = z.hauteur * (0.8 + b * 1.2);
        const decalage = c * 0.4;
        const tt = Math.max(0, t - decalage);
        garder({
          x: z.x + depart + Math.sin(tt * 3 + d * 6.283) * 1.2, y: z.y + vitesse * tt * 0.5 + 0.5 * gravite * 0.3 * tt * tt,
          angle: (d - 0.5) * 40 + tt * 30 * (e - 0.5), echelle: 0.7 + e * 0.5, opacite: t < decalage ? 0 : 1, ton: "neutre", forme: "icone",
        });
      }
    }
    return sortie.filter((q) => q.opacite > 0 || p.mode === "onde");
  } catch {
    return [];
  }
}

/** Attributs SVG en camelCase pour React ; couleurs toujours en currentColor. */
function attributs(a: Record<string, string>): Record<string, string> {
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(a)) o[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
  return o;
}

function Particules({ p, image, dureeImages, graine, ton, couleur }: { p: ParametresParticules; image: number; dureeImages: number; graine: number; ton: TonObjet; couleur: (t: TonObjet) => string }): JSX.Element {
  const l = emettre(graine, image, dureeImages, p);
  if (p.mode === "pluie-icones") {
    const brut = ICONES_BIBLIOTHEQUE[p.icone ?? ICONE_DEFAUT] ?? ICONES_BIBLIOTHEQUE[ICONE_DEFAUT];
    const icone = brut ? harmoniser(brut) : null;
    return (
      <g color={couleur(ton)}>
        {icone
          ? l.map((q, i) => (
              <g key={i} fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" opacity={f(q.opacite)} transform={`translate(${f(q.x * 10)} ${f(q.y * 10)}) rotate(${f(q.angle)}) scale(${f((q.echelle * 50) / 24)}) translate(-12 -12)`}>
                {icone.noeuds.map(([balise, a], k) => createElement(balise, { key: k, ...attributs(a) }))}
              </g>
            ))
          : null}
      </g>
    );
  }
  if (p.mode === "onde") {
    return (
      <>
        {l.map((q, i) => (
          <circle key={i} cx={f(q.x * 10)} cy={f(q.y * 10)} r={f(q.echelle * 10)} fill="none" stroke={couleur("accent")} strokeWidth={6} opacity={f(q.opacite)} />
        ))}
      </>
    );
  }
  return (
    <>
      {l.map((q, i) => {
        const cx = f(q.x * 10);
        const cy = f(q.y * 10);
        const e = q.echelle;
        const forme =
          q.forme === "rectangle" ? (
            <rect x={f(-9 * e)} y={f(-5 * e)} width={f(18 * e)} height={f(10 * e)} fill={couleur(q.ton)} />
          ) : (
            <polygon points={`${f(-8 * e)},${f(7 * e)} 0,${f(-8 * e)} ${f(8 * e)},${f(7 * e)}`} fill={couleur(q.ton)} />
          );
        return (
          <g key={i} opacity={f(q.opacite)} transform={`translate(${cx} ${cy}) rotate(${f(q.angle)})`}>
            {forme}
          </g>
        );
      })}
    </>
  );
}

export const OBJET_PARTICULES: DefinitionObjet<ParametresParticules> = {
  id: "objet-particules",
  famille: "marque",
  capacite: "objet.marque",
  valider,
  toile: { largeur: L, hauteur: L },
  dureeSec: { min: 0.6, max: 2.5 },
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres, graine } = pr;
    const phase = phaseObjet(image, dureeImages);
    return (
      <svg viewBox={`0 0 ${L} ${L}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <Particules p={parametres} image={image} dureeImages={dureeImages} graine={graine} ton={pr.ton ?? "neutre"} couleur={(t) => couleurDuTon(t, fond)} />
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_PARTICULES: readonly ParametresParticules[] = [
  { mode: "confettis", zone: { x: 5, y: 72, largeur: 90, hauteur: 26 }, nombre: 30 },
  { mode: "onde", zone: { x: 5, y: 72, largeur: 90, hauteur: 26 }, nombre: 3 },
  { mode: "pluie-icones", zone: { x: 5, y: 2, largeur: 90, hauteur: 10 }, nombre: 12, icone: "lucide:etoile" },
];
