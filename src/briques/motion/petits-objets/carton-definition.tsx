/**
 * PETITS OBJETS — carton « mot + définition » (C10-09). Pièce pure, NON inscrite (rien ne l'importe).
 * Le texte vient d'une phrase DITE (règle d'extraction côté Studio : `definition-dite.ts` côté Studio) ; la garde C9-04 vérifie les mots.
 * Carte sobre, mot en gras, définition dessous, filet fin tracé ; entrée puis sortie en 6 images (`phaseObjet`). Manrope. Aucun filtre.
 * Imports relatifs seulement (dossier lu par le rendu).
 */
import type { JSX } from "react";
import { FAMILLE_CSS_AXION, couleursSur } from "../../jetons-motion";
import { MOTS_MAX, type DefinitionObjet, type ProprietesObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { TraceSvg } from "./TraceSvg";

export interface ParametresCartonDefinition {
  mot: string;
  definition: string;
}

const L = 1000;
const H = 400;
const TOILE = { largeur: L, hauteur: H } as const;
const DUREE = { min: 1.5, max: 4 } as const;

const nbMots = (s: string): number => s.split(/[^\p{L}\p{N}]+/u).filter(Boolean).length;
const champ = (v: unknown): string | null => {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t !== "" && nbMots(t) >= 1 && nbMots(t) <= MOTS_MAX ? t : null;
};

function valider(p: unknown): ParametresCartonDefinition | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    const mot = champ(r.mot);
    const definition = champ(r.definition);
    return mot !== null && definition !== null ? { mot, definition } : null;
  } catch {
    return null;
  }
}

const borne01 = (n: number): number => Math.min(1, Math.max(0, n));
/** Corps de texte réduit selon la longueur, pour tenir dans la carte. */
const taille = (texte: string, max: number, largeurCar: number): number => Math.round(Math.min(max, 860 / (Math.max(1, texte.length) * largeurCar)));

export const OBJET_CARTON_DEFINITION: DefinitionObjet<ParametresCartonDefinition> = {
  id: "objet-carton-definition",
  famille: "etiquette",
  capacite: "objet.etiquette",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "mots-dits",
  Rendu(pr: ProprietesObjet<ParametresCartonDefinition>): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const ton = pr.ton ?? "neutre";
    const c = couleursSur(fond);
    const phase = phaseObjet(image, dureeImages);
    const t = phase.trace;
    return (
      <svg viewBox={`0 0 ${L} ${H}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <rect x={0} y={0} width={L} height={H} rx={28} fill={c.panneauRelief} />
          <text x={L / 2} y={160} textAnchor="middle" fontFamily={FAMILLE_CSS_AXION} fontWeight={800} fontSize={taille(parametres.mot, 120, 0.66)} fill={c.texte} opacity={borne01(t * 2)}>
            {parametres.mot}
          </text>
          <TraceSvg d={`M 300 215 L 700 215`} t={t} ton={ton} fond={fond} epaisseur={4} />
          <text x={L / 2} y={305} textAnchor="middle" fontFamily={FAMILLE_CSS_AXION} fontWeight={400} fontSize={taille(parametres.definition, 64, 0.56)} fill={c.texteDoux} opacity={borne01(t * 2 - 0.6)}>
            {parametres.definition}
          </text>
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_CARTON_DEFINITION: readonly ParametresCartonDefinition[] = [
  { mot: "le ROI", definition: "ce que tu gagnes" },
  { mot: "le churn", definition: "les départs" },
  { mot: "un lead", definition: "un contact chaud" },
];
