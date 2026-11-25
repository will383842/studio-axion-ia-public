/**
 * PETITS OBJETS — étapes (C9-14) : pastille « Étape n/N » et compteur « n/N » à segments. Pièces pures, NON inscrites (rien ne les importe).
 * Contours et segments tracés par `TraceSvg` ; textes en Manrope (`PILE_CSS`), ≤ 4 mots ; aucun filtre.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { PILE_CSS, GRAISSES } from "../../charte/axion-2026";
import type { DefinitionObjet, ProprietesObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";
import { TraceSvg } from "./TraceSvg";

/** n = étape courante, N = nombre d'étapes ; entiers, 1 ≤ n ≤ N ≤ 9. */
export interface ParametresEtape {
  n: number;
  N: number;
}

const L = 1000;
const H = 220;
const TOILE = { largeur: L, hauteur: H } as const;
/** 2 s minimum : 9 segments à 3 images d'écart doivent être tracés avant la sortie. */
const DUREE = { min: 2, max: 4 } as const;
const ECART_SEGMENTS = 3;
const OPACITE_ETEINT = 0.35;
const N_MAX = 9;

const entier = (v: unknown): v is number => typeof v === "number" && Number.isInteger(v);

function valider(p: unknown): ParametresEtape | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { n, N } = p as Record<string, unknown>;
    if (!entier(n) || !entier(N) || n < 1 || n > N || N > N_MAX) return null;
    return { n, N };
  } catch {
    return null;
  }
}

const f = (x: number): string => x.toFixed(1);

/** Rectangle à bouts arrondis, tracé d'un seul trait. */
function cheminPastille(x: number, y: number, l: number, h: number): string {
  const r = h / 2;
  return `M ${f(x + r)} ${f(y)} L ${f(x + l - r)} ${f(y)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + l - r)} ${f(y + h)} L ${f(x + r)} ${f(y + h)} A ${f(r)} ${f(r)} 0 0 1 ${f(x + r)} ${f(y)}`;
}

const PASTILLE = { x: 200, y: 40, l: 600, h: 140 };

function Pastille(pr: ProprietesObjet<ParametresEtape>): JSX.Element {
  const { image, dureeImages, fond, parametres } = pr;
  const ton = pr.ton ?? "neutre";
  const phase = phaseObjet(image, dureeImages);
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite}>
        <TraceSvg d={cheminPastille(PASTILLE.x, PASTILLE.y, PASTILLE.l, PASTILLE.h)} t={phase.trace} ton={ton} fond={fond} />
        <text
          x={PASTILLE.x + PASTILLE.l / 2}
          y={PASTILLE.y + PASTILLE.h / 2 + 26}
          textAnchor="middle"
          fontFamily={PILE_CSS}
          fontWeight={GRAISSES.gras}
          fontSize={76}
          fill={couleurDuTon(ton, fond)}
          fillOpacity={phase.trace}
        >
          {`Étape ${parametres.n}/${parametres.N}`}
        </text>
      </g>
    </svg>
  );
}

const SEGMENTS = { x: 100, largeur: 800, y: 150, epaisseur: 26, gouttiere: 14 };

function Segments(pr: ProprietesObjet<ParametresEtape>): JSX.Element {
  const { image, dureeImages, fond, parametres } = pr;
  const { n, N } = parametres;
  const phase = phaseObjet(image, dureeImages);
  const l = (SEGMENTS.largeur - SEGMENTS.gouttiere * (N - 1)) / N;
  const segments: JSX.Element[] = [];
  for (let i = 0; i < N; i++) {
    const x0 = SEGMENTS.x + i * (l + SEGMENTS.gouttiere);
    const t = phaseObjet(image - i * ECART_SEGMENTS, dureeImages).trace;
    const allume = i < n;
    segments.push(
      <g key={i} data-segment={i} opacity={allume ? 1 : OPACITE_ETEINT}>
        <TraceSvg d={`M ${f(x0)} ${SEGMENTS.y} L ${f(x0 + l)} ${SEGMENTS.y}`} t={t} ton={allume ? "accent" : "neutre"} fond={fond} epaisseur={SEGMENTS.epaisseur} />
      </g>,
    );
  }
  return (
    <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
      <g opacity={phase.opacite}>
        <text
          x={L / 2}
          y={90}
          textAnchor="middle"
          fontFamily={PILE_CSS}
          fontWeight={GRAISSES.gras}
          fontSize={72}
          fill={couleurDuTon("neutre", fond)}
          fillOpacity={phase.trace}
        >
          {`${n}/${N}`}
        </text>
        {segments}
      </g>
    </svg>
  );
}

function creer(id: DefinitionObjet<ParametresEtape>["id"], Rendu: DefinitionObjet<ParametresEtape>["Rendu"]): DefinitionObjet<ParametresEtape> {
  return { id, famille: "chiffre", capacite: "objet.etape", valider, toile: TOILE, dureeSec: DUREE, donnees: "aucune", Rendu };
}

export const OBJET_ETAPE = creer("objet-etape", Pastille);
export const OBJET_ETAPE_SEGMENTS = creer("objet-etape-segments", Segments);

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_ETAPES: readonly ParametresEtape[] = [
  { n: 1, N: 4 },
  { n: 2, N: 5 },
  { n: 3, N: 3 },
  { n: 4, N: 9 },
];
