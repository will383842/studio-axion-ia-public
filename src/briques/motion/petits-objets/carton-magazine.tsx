/**
 * PETITS OBJETS — carton « magazine » (C10-04a) : une ligne fine (Manrope 300) et un mot-clé géant (Manrope 800), sans fond.
 * La pièce rend exactement les textes reçus (aucun chiffre ni texte ajouté). Fond flouté facultatif : viendra de C10-04b.
 * Pièce pure, NON inscrite (rien ne l'importe). Hors v4. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION } from "../../jetons-motion";
import { MOTS_MAX, type DefinitionObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

/** `ligne` : 1 à 3 mots ; `motCle` : 1 mot ; ligne + mot-clé ≤ `MOTS_MAX`. */
export interface ParametresCartonMagazine {
  ligne: string;
  motCle: string;
}

export const L_CARTON = 1000;
export const H_CARTON = 400;
/** Taille du mot-clé = 2,25 fois celle de la ligne (borne : 2 à 2,5). */
export const RAPPORT_TAILLES = 2.25;
export const GRAISSE_LIGNE = 300;
export const GRAISSE_MOT_CLE = 800;
const TAILLE_LIGNE_MAX = 64;
const LARGEUR_MAX = 900;
const LARGEUR_CAR = 0.62;

const mots = (t: string): string[] => t.trim().split(/\s+/).filter((x) => x !== "");

/** Tailles en unités de la toile : le rapport reste constant, le tout est réduit si le texte déborde. */
export function taillesCarton(p: ParametresCartonMagazine): { ligne: number; motCle: number } {
  const besoin = Math.max(p.ligne.length * LARGEUR_CAR, p.motCle.length * LARGEUR_CAR * RAPPORT_TAILLES);
  const ligne = Math.min(TAILLE_LIGNE_MAX, besoin > 0 ? LARGEUR_MAX / besoin : TAILLE_LIGNE_MAX);
  return { ligne, motCle: ligne * RAPPORT_TAILLES };
}

function valider(p: unknown): ParametresCartonMagazine | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { ligne, motCle } = p as Record<string, unknown>;
    if (typeof ligne !== "string" || typeof motCle !== "string") return null;
    const nl = mots(ligne).length;
    const nm = mots(motCle).length;
    if (nl < 1 || nm !== 1 || nl + nm > MOTS_MAX) return null;
    return { ligne, motCle };
  } catch {
    return null;
  }
}

const f = (n: number): string => n.toFixed(1);

export const OBJET_CARTON_MAGAZINE: DefinitionObjet<ParametresCartonMagazine> = {
  id: "objet-carton-magazine",
  famille: "etiquette",
  capacite: "objet.etiquette",
  valider,
  toile: { largeur: L_CARTON, hauteur: H_CARTON },
  dureeSec: { min: 1, max: 1.5 },
  donnees: "mots-dits",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres, ton } = pr;
    const c = couleursSur(fond);
    const couleurTon = couleurDuTon(ton ?? "neutre", fond);
    const phase = phaseObjet(image, dureeImages);
    const t = taillesCarton(parametres);
    const yLigne = H_CARTON / 2 - t.motCle * 0.45;
    const yMot = H_CARTON / 2 + t.motCle * 0.55;
    const centre = f(L_CARTON / 2);
    return (
      <svg viewBox={`0 0 ${L_CARTON} ${H_CARTON}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <text x={centre} y={f(yLigne)} textAnchor="middle" fontSize={f(t.ligne)} fontWeight={GRAISSE_LIGNE} fontFamily={FAMILLE_CSS_AXION} fill={c.texte}>
            {parametres.ligne}
          </text>
          <text x={centre} y={f(yMot)} textAnchor="middle" fontSize={f(t.motCle)} fontWeight={GRAISSE_MOT_CLE} fontFamily={FAMILLE_CSS_AXION} fill={couleurTon}>
            {parametres.motCle}
          </text>
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par la planche. */
export const EXEMPLES_CARTON_MAGAZINE: readonly ParametresCartonMagazine[] = [
  { ligne: "Le secret", motCle: "Simplicité" },
  { ligne: "En un mot", motCle: "Clarté" },
  { ligne: "Ici", motCle: "Montage" },
];
