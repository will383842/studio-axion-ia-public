/**
 * PETITS OBJETS — mini-frise de montage (C9-21) : 3 à 6 blocs côte à côte et un curseur qui avance. Pièce pure, NON inscrite (rien ne l'importe).
 * Tracé par `TraceSvg` ; aucun texte, aucun filtre, ton neutre pour les blocs, accent pour le curseur. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { accentSur } from "../../jetons-motion";
import { SURFACE_MAX, type DefinitionObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { IMAGES_SORTIE, phaseObjet } from "./progres";
import { TraceSvg } from "./TraceSvg";

/** Boîte en % de la toile. */
export interface BoiteFrise {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export interface ParametresFrise {
  boite: BoiteFrise;
  /** Nombre de blocs, entier de 3 à 6. */
  blocs: number;
}

export const BLOCS_MIN = 3;
export const BLOCS_MAX = 6;
const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1.2, max: 4 } as const;
const ECART = 8;
const DECALAGE_BLOC = 2;
const EPAISSEUR = 6;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const borne01 = (n: number): number => Math.min(1, Math.max(0, n));
const f = (n: number): string => n.toFixed(1);

function valider(p: unknown): ParametresFrise | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const b = r.boite;
    if (typeof b !== "object" || b === null) return null;
    const { x, y, largeur, hauteur } = b as Record<string, unknown>;
    if (!nombre(x) || !nombre(y) || !nombre(largeur) || !nombre(hauteur)) return null;
    if (x < 0 || y < 0 || largeur <= 0 || hauteur <= 0 || x + largeur > 100 || y + hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX) return null;
    const blocs = r.blocs;
    if (!nombre(blocs) || !Number.isInteger(blocs) || blocs < BLOCS_MIN || blocs > BLOCS_MAX) return null;
    return { boite: { x, y, largeur, hauteur }, blocs };
  } catch {
    return null;
  }
}

/** Largeurs relatives des blocs, tirées de la graine (0,7 à 1,3), ramenées à la largeur disponible. */
export function largeursBlocs(blocs: number, total: number, graine: number): number[] {
  const poids = Array.from({ length: blocs }, (_, i) => 0.7 + aleaGraine(graine, i + 10) * 0.6);
  const somme = poids.reduce((a, b) => a + b, 0);
  const utile = Math.max(0, total - ECART * (blocs - 1));
  return poids.map((w) => (w / somme) * utile);
}

export const OBJET_FRISE_MONTAGE: DefinitionObjet<ParametresFrise> = {
  id: "objet-frise-montage",
  famille: "ecran",
  capacite: "objet.ecran",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres, graine } = pr;
    const bx = (parametres.boite.x * L) / 100;
    const by = (parametres.boite.y * H) / 100;
    const bl = (parametres.boite.largeur * L) / 100;
    const bh = (parametres.boite.hauteur * H) / 100;
    const phase = phaseObjet(image, dureeImages);
    const largeurs = largeursBlocs(parametres.blocs, bl, graine);
    let x = bx;
    const blocs = largeurs.map((w, i) => {
      const d = `M ${f(x)} ${f(by)} L ${f(x + w)} ${f(by)} L ${f(x + w)} ${f(by + bh)} L ${f(x)} ${f(by + bh)} Z`;
      x += w + ECART;
      const t = phaseObjet(image - i * DECALAGE_BLOC, dureeImages).trace;
      return (
        <g key={i} data-bloc={i}>
          <TraceSvg d={d} t={t} ton="neutre" fond={fond} epaisseur={EPAISSEUR} />
        </g>
      );
    });
    /* Le curseur parcourt la frise pendant toute la tenue : de la boîte à gauche à la boîte à droite. */
    const k = borne01(image / Math.max(1, dureeImages - 1 - IMAGES_SORTIE));
    const xc = bx + k * bl;
    const dc = `M ${f(xc)} ${f(by - bh * 0.25)} L ${f(xc)} ${f(by + bh * 1.25)}`;
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          {blocs}
          <g data-curseur={f(xc)}>
            <path d={dc} pathLength={1} strokeDasharray={1} strokeDashoffset={1 - phase.trace} stroke={accentSur(fond, "terracotta")} strokeWidth={EPAISSEUR + 2} strokeLinecap="round" fill="none" />
          </g>
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_FRISE: readonly ParametresFrise[] = [
  { boite: { x: 10, y: 40, largeur: 80, hauteur: 16 }, blocs: 3 },
  { boite: { x: 10, y: 40, largeur: 80, hauteur: 16 }, blocs: 6 },
];
