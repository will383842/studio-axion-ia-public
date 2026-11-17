/**
 * PETITS OBJETS — onde sonore (C9-22). Pièce pure, NON inscrite (rien ne l'importe).
 * Déclaré : motif décoratif, jamais une mesure de la voix. Hauteurs tirées de la graine, animées par un sinus ;
 * aucun niveau sonore n'est accepté en entrée. Aucun texte, aucun chiffre, aucune graduation.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import type { DefinitionObjet } from "./contrat";
import { aleaGraine } from "./graine";
import { phaseObjet } from "./progres";
import { TraceSvg } from "./TraceSvg";

/** Seul paramètre : le nombre de barres. */
export interface ParametresOnde {
  barres: number;
}

const L = 1000;
const H = 300;
const BARRES_MIN = 12;
const BARRES_MAX = 48;
const MARGE = 40;

function valider(p: unknown): ParametresOnde | null {
  try {
    if (typeof p !== "object" || p === null || Array.isArray(p)) return null;
    const cles = Object.keys(p);
    if (cles.length !== 1 || cles[0] !== "barres") return null;
    const n = (p as Record<string, unknown>).barres;
    if (typeof n !== "number" || !Number.isInteger(n) || n < BARRES_MIN || n > BARRES_MAX) return null;
    return { barres: n };
  } catch {
    return null;
  }
}

const f = (n: number): string => n.toFixed(1);

/** Hauteur relative (0..1) de la barre i : motif tiré de la graine, modulé par un sinus du temps. */
function hauteur(graine: number, i: number, secondes: number): number {
  const base = 0.25 + 0.75 * aleaGraine(graine, i);
  const frequence = 0.6 + aleaGraine(graine, 1000 + i) * 1.4;
  const phase = aleaGraine(graine, 2000 + i) * 2 * Math.PI;
  return base * (0.7 + 0.3 * Math.sin(2 * Math.PI * frequence * secondes + phase));
}

export const OBJET_ONDE_MOTIF: DefinitionObjet<ParametresOnde> = {
  id: "objet-onde-motif",
  famille: "schema",
  capacite: "objet.schema",
  valider,
  toile: { largeur: L, hauteur: H },
  dureeSec: { min: 1, max: 4 },
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, fps, dureeImages, fond, parametres, graine } = pr;
    const ton = pr.ton ?? "neutre";
    const phase = phaseObjet(image, dureeImages);
    const n = parametres.barres;
    const pas = (L - 2 * MARGE) / (n - 1);
    const secondes = fps > 0 ? image / fps : 0;
    const barres: JSX.Element[] = [];
    for (let i = 0; i < n; i++) {
      const x = MARGE + i * pas;
      const demi = (hauteur(graine, i, secondes) * (H - 20)) / 2;
      barres.push(<TraceSvg key={i} d={`M ${f(x)} ${f(H / 2 - demi)} L ${f(x)} ${f(H / 2 + demi)}`} t={phase.trace} ton={ton} fond={fond} epaisseur={Math.max(4, Math.min(14, pas * 0.5))} />);
    }
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>{barres}</g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_ONDE: readonly ParametresOnde[] = [{ barres: 12 }, { barres: 24 }, { barres: 48 }];
