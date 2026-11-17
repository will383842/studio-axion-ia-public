/**
 * PETITS OBJETS — pellicule (C9-21) : 3 à 6 cases côte à côte, dont une peut être marquée « silence ». Pièce pure, NON inscrite (rien ne l'importe).
 * Le seul texte possible est celui passé en paramètre (4 mots au plus), jamais inventé. Manrope. Aucun filtre. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { FAMILLE_CSS_AXION, couleursSur } from "../../jetons-motion";
import { MOTS_MAX, SURFACE_MAX, type DefinitionObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { TraceSvg } from "./TraceSvg";

export interface BoitePellicule {
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
}
export interface SilencePellicule {
  /** Rang de la case marquée, de 0 à cases - 1. */
  indice: number;
  /** Texte fourni, 1 à 4 mots. */
  texte: string;
}
export interface ParametresPellicule {
  boite: BoitePellicule;
  /** Nombre de cases, entier de 3 à 6. */
  cases: number;
  silence?: SilencePellicule;
}

export const CASES_MIN = 3;
export const CASES_MAX = 6;
const L = 1000;
const H = 1000;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1.2, max: 4 } as const;
const ECART = 10;
const DECALAGE_CASE = 2;
const EPAISSEUR = 6;

const nombre = (n: unknown): n is number => typeof n === "number" && Number.isFinite(n);
const f = (n: number): string => n.toFixed(1);
const mots = (t: string): string[] => t.trim().split(/\s+/).filter((m) => m !== "");

function valider(p: unknown): ParametresPellicule | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const b = r.boite;
    if (typeof b !== "object" || b === null) return null;
    const { x, y, largeur, hauteur } = b as Record<string, unknown>;
    if (!nombre(x) || !nombre(y) || !nombre(largeur) || !nombre(hauteur)) return null;
    if (x < 0 || y < 0 || largeur <= 0 || hauteur <= 0 || x + largeur > 100 || y + hauteur > 100) return null;
    if ((largeur * hauteur) / 10000 > SURFACE_MAX) return null;
    const cases = r.cases;
    if (!nombre(cases) || !Number.isInteger(cases) || cases < CASES_MIN || cases > CASES_MAX) return null;
    const sortie: ParametresPellicule = { boite: { x, y, largeur, hauteur }, cases };
    if (r.silence !== undefined) {
      const s = r.silence;
      if (typeof s !== "object" || s === null) return null;
      const { indice, texte } = s as Record<string, unknown>;
      if (!nombre(indice) || !Number.isInteger(indice) || indice < 0 || indice >= cases) return null;
      if (typeof texte !== "string") return null;
      const n = mots(texte).length;
      if (n < 1 || n > MOTS_MAX) return null;
      sortie.silence = { indice, texte: texte.trim() };
    }
    return sortie;
  } catch {
    return null;
  }
}

export const OBJET_PELLICULE: DefinitionObjet<ParametresPellicule> = {
  id: "objet-pellicule",
  famille: "ecran",
  capacite: "objet.ecran",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const bx = (parametres.boite.x * L) / 100;
    const by = (parametres.boite.y * H) / 100;
    const bl = (parametres.boite.largeur * L) / 100;
    const bh = (parametres.boite.hauteur * H) / 100;
    const n = parametres.cases;
    const w = (bl - ECART * (n - 1)) / n;
    const phase = phaseObjet(image, dureeImages);
    const silence = parametres.silence;
    const cases = Array.from({ length: n }, (_, i) => {
      const x = bx + i * (w + ECART);
      const d = `M ${f(x)} ${f(by)} L ${f(x + w)} ${f(by)} L ${f(x + w)} ${f(by + bh)} L ${f(x)} ${f(by + bh)} Z`;
      const t = phaseObjet(image - i * DECALAGE_CASE, dureeImages).trace;
      const estSilence = silence !== undefined && silence.indice === i;
      const taille = estSilence ? Math.max(10, Math.min(bh * 0.4, (w * 0.9) / (Math.max(1, silence.texte.length) * 0.6))) : 0;
      return (
        <g key={i} data-case={i} {...(estSilence ? { "data-silence": 1 } : {})}>
          <TraceSvg d={d} t={t} ton={estSilence ? "accent" : "neutre"} fond={fond} epaisseur={EPAISSEUR} />
          {estSilence && t >= 1 ? (
            <text x={f(x + w / 2)} y={f(by + bh / 2)} textAnchor="middle" dominantBaseline="central" fontFamily={FAMILLE_CSS_AXION} fontWeight={600} fontSize={f(taille)} fill={couleursSur(fond).texte}>
              {silence.texte}
            </text>
          ) : null}
        </g>
      );
    });
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>{cases}</g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_PELLICULE: readonly ParametresPellicule[] = [
  { boite: { x: 10, y: 40, largeur: 80, hauteur: 16 }, cases: 4 },
  { boite: { x: 10, y: 40, largeur: 80, hauteur: 16 }, cases: 5, silence: { indice: 2, texte: "silence" } },
];
