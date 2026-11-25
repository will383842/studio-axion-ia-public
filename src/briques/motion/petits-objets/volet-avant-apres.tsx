/**
 * PETITS OBJETS — volet « avant / après » (C10-08) : cadre arrondi, trait de séparation, poignée ronde et deux étiquettes fixes.
 * Ce fichier ne dessine AUCUNE image : l'habillage Remotion (`studio-rendu/compositions/petits-objets/VoletAvantApres.tsx`) pose les deux vraies
 * captures fournies, découpées selon `geometrieVolet`. Pièce pure, NON inscrite (rien ne l'importe). Hors v4. Imports relatifs seulement.
 */
import type { JSX } from "react";
import { couleursSur, FAMILLE_CSS_AXION } from "../../jetons-motion";
import { DUREES, FPS_MOTION } from "../jetons";
import { progres } from "../courbes";
import type { DefinitionObjet } from "./contrat";
import { phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

export type SensVolet = "gauche-droite" | "droite-gauche";

/** `avant` et `apres` : adresses d'images (déjà signées par le Studio), non vides et différentes. `etiquettes` : seul `true` les allume. */
export interface ParametresVoletAvantApres {
  avant: string;
  apres: string;
  sens?: SensVolet;
  etiquettes?: boolean;
}

export interface GeometrieVolet {
  /** Position du trait, de 0 (bord gauche) à 1 (bord droit). */
  coupure: number;
  /** Poignée en unités de la toile. */
  poignee: { x: number; y: number; r: number };
}

export const L_VOLET = 1000;
export const H_VOLET = 625;
const RAYON_POIGNEE = 38;
const MARGE_ETIQUETTE = 32;

const borne01 = (n: number): number => (Number.isFinite(n) ? Math.min(1, Math.max(0, n)) : 0);

/** La poignée glisse du bord de départ jusqu'au milieu (courbe de signature) puis s'y arrête. Pure : même entrée = même sortie. */
export function geometrieVolet(image: number, dureeImages: number, sens: SensVolet = "gauche-droite"): GeometrieVolet {
  const t = Number.isFinite(image) && Number.isFinite(dureeImages) && image >= 0 ? image / FPS_MOTION : 0;
  const p = borne01(progres(t, 0, DUREES.entree));
  const depart = sens === "droite-gauche" ? 1 : 0;
  const coupure = depart + (0.5 - depart) * p;
  return { coupure, poignee: { x: coupure * L_VOLET, y: H_VOLET / 2, r: RAYON_POIGNEE } };
}

function valider(p: unknown): ParametresVoletAvantApres | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const { avant, apres, sens, etiquettes } = p as Record<string, unknown>;
    if (typeof avant !== "string" || typeof apres !== "string") return null;
    if (avant.trim() === "" || apres.trim() === "" || avant === apres) return null;
    if (sens !== undefined && sens !== "gauche-droite" && sens !== "droite-gauche") return null;
    if (etiquettes !== undefined && typeof etiquettes !== "boolean") return null;
    const sortie: ParametresVoletAvantApres = { avant, apres };
    if (sens !== undefined) sortie.sens = sens;
    if (etiquettes !== undefined) sortie.etiquettes = etiquettes;
    return sortie;
  } catch {
    return null;
  }
}

const f = (n: number): string => n.toFixed(1);

export const OBJET_VOLET_AVANT_APRES: DefinitionObjet<ParametresVoletAvantApres> = {
  id: "objet-volet-avant-apres",
  famille: "ecran",
  capacite: "objet.ecran",
  valider,
  toile: { largeur: L_VOLET, hauteur: H_VOLET },
  dureeSec: { min: 1.2, max: 4 },
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres, ton } = pr;
    const sens = parametres.sens ?? "gauche-droite";
    const c = couleursSur(fond);
    const couleurTon = couleurDuTon(ton ?? "neutre", fond);
    const phase = phaseObjet(image, dureeImages);
    const g = geometrieVolet(image, dureeImages, sens);
    const x = g.coupure * L_VOLET;
    const avantAGauche = sens === "gauche-droite";
    const { r } = g.poignee;
    const etiquette = (texte: string, gauche: boolean): JSX.Element => {
      const largeur = 150;
      const bx = gauche ? MARGE_ETIQUETTE : L_VOLET - MARGE_ETIQUETTE - largeur;
      return (
        <g key={texte}>
          <rect x={f(bx)} y={MARGE_ETIQUETTE} width={largeur} height={52} rx={26} fill={c.panneau} stroke={c.filet} strokeWidth={2} />
          <text x={f(bx + largeur / 2)} y={MARGE_ETIQUETTE + 35} textAnchor="middle" fontSize={28} fontWeight={600} fontFamily={FAMILLE_CSS_AXION} fill={c.texte}>
            {texte}
          </text>
        </g>
      );
    };
    return (
      <svg viewBox={`0 0 ${L_VOLET} ${H_VOLET}`} width="100%" height="100%" style={{ position: "absolute", inset: 0, overflow: "visible" }}>
        <g opacity={phase.opacite}>
          <rect x={3} y={3} width={L_VOLET - 6} height={H_VOLET - 6} rx={28} fill="none" stroke={c.texte} strokeWidth={6} />
          <line x1={f(x)} y1={3} x2={f(x)} y2={H_VOLET - 3} stroke={couleurTon} strokeWidth={6} />
          <circle cx={f(x)} cy={f(H_VOLET / 2)} r={r} fill={c.fond} stroke={couleurTon} strokeWidth={6} />
          <path d={`M ${f(x - 14)} ${f(H_VOLET / 2 - 14)} L ${f(x - 26)} ${f(H_VOLET / 2)} L ${f(x - 14)} ${f(H_VOLET / 2 + 14)}`} fill="none" stroke={couleurTon} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          <path d={`M ${f(x + 14)} ${f(H_VOLET / 2 - 14)} L ${f(x + 26)} ${f(H_VOLET / 2)} L ${f(x + 14)} ${f(H_VOLET / 2 + 14)}`} fill="none" stroke={couleurTon} strokeWidth={5} strokeLinecap="round" strokeLinejoin="round" />
          {parametres.etiquettes === true ? [etiquette("Avant", avantAGauche), etiquette("Après", !avantAGauche)] : null}
        </g>
      </svg>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par la planche. Adresses neutres : aucune vraie capture n'est choisie ici. */
export const EXEMPLES_VOLET: readonly ParametresVoletAvantApres[] = [
  { avant: "capture-avant.png", apres: "capture-apres.png", etiquettes: true },
  { avant: "capture-avant.png", apres: "capture-apres.png", sens: "droite-gauche", etiquettes: true },
  { avant: "capture-avant.png", apres: "capture-apres.png" },
];
