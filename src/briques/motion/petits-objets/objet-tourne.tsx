/**
 * PETITS OBJETS — icône qui tourne en rotateY (C10-10). Pièce pure, NON inscrite (rien ne l'importe). ICÔNES SEULEMENT (bibliothèque
 * harmonisée) : aucun logo d'outil ni de client, aucun visage (`nomPermis`), sans moteur 3D. Angle pur de l'image courante ;
 * la face arrière montre la même icône. Imports relatifs seulement (dossier lu par le rendu).
 */
import { createElement, type JSX } from "react";
import { ICONES_BIBLIOTHEQUE } from "../bibliotheque-icones";
import { harmoniser, nomPermis } from "../bibliotheque-icones/harmoniser";
import { progres } from "../courbes";
import { DUREES, FPS_MOTION } from "../jetons";
import type { DefinitionObjet } from "./contrat";
import { IMAGES_SORTIE, phaseObjet } from "./progres";
import { couleurDuTon } from "./tons";

export interface ParametresObjetTourne {
  icone: string;
  tours?: 0.5 | 1 | 2;
}

const TOILE = { largeur: 1000, hauteur: 1000 } as const;
const DUREE = { min: 0.8, max: 3 } as const;
const TOURS_PERMIS: readonly number[] = [0.5, 1, 2];
const TOURS_PAR_DEFAUT = 1;
/** Côté de l'icône en % de la zone : 50 % × 50 % = 25 % du cadre, sous SURFACE_MAX. */
const COTE_PCT = 50;
const PERSPECTIVE_PX = 900;

function valider(p: unknown): ParametresObjetTourne | null {
  try {
    if (typeof p !== "object" || p === null) return null;
    const r = p as Record<string, unknown>;
    if (typeof r.icone !== "string" || !nomPermis(r.icone) || !Object.prototype.hasOwnProperty.call(ICONES_BIBLIOTHEQUE, r.icone)) return null;
    const sortie: ParametresObjetTourne = { icone: r.icone };
    if (r.tours !== undefined) {
      if (typeof r.tours !== "number" || !TOURS_PERMIS.includes(r.tours)) return null;
      sortie.tours = r.tours as 0.5 | 1 | 2;
    }
    return sortie;
  } catch {
    return null;
  }
}

/** Angle (degrés) de l'image courante : 0 à l'image 0, `tours × 360` quand la sortie commence ; courbe signature. Pur, fini. */
export function angleObjetTourne(image: number, dureeImages: number, tours: number = TOURS_PAR_DEFAUT): number {
  const fin = dureeImages - 1 - IMAGES_SORTIE;
  if (!Number.isFinite(image) || !Number.isFinite(dureeImages) || !Number.isFinite(tours) || fin <= 0 || image <= 0) return 0;
  const t = Math.min(image, fin) / FPS_MOTION;
  return tours * 360 * progres(t, 0, fin / FPS_MOTION);
}

function Face({ icone, retournee }: { icone: ReturnType<typeof harmoniser>; retournee: boolean }): JSX.Element {
  return (
    <svg
      viewBox={icone.viewBox}
      width="100%"
      height="100%"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      style={{ position: "absolute", inset: 0, backfaceVisibility: "hidden", transform: retournee ? "rotateY(180deg)" : undefined }}
    >
      {icone.noeuds.map(([balise, attributs], i) => createElement(balise, { ...attributs, key: i }))}
    </svg>
  );
}

export const OBJET_TOURNE: DefinitionObjet<ParametresObjetTourne> = {
  id: "objet-tourne",
  famille: "schema",
  capacite: "objet.schema",
  valider,
  toile: TOILE,
  dureeSec: DUREE,
  donnees: "aucune",
  Rendu(pr): JSX.Element {
    const { image, dureeImages, fond, parametres } = pr;
    const ton = pr.ton ?? "neutre";
    const phase = phaseObjet(image, dureeImages);
    const source = Object.prototype.hasOwnProperty.call(ICONES_BIBLIOTHEQUE, parametres.icone) ? ICONES_BIBLIOTHEQUE[parametres.icone] : undefined;
    const a = angleObjetTourne(image, dureeImages, parametres.tours ?? TOURS_PAR_DEFAUT);
    const icone = source ? harmoniser(source) : null;
    return (
      <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div
          style={{
            position: "relative",
            width: `${COTE_PCT}%`,
            height: `${COTE_PCT}%`,
            color: couleurDuTon(ton, fond),
            opacity: phase.opacite,
            transformStyle: "preserve-3d",
            transform: `perspective(${PERSPECTIVE_PX}px) rotateY(${a.toFixed(3)}deg)`,
          }}
        >
          {icone ? <Face icone={icone} retournee={false} /> : null}
          {icone ? <Face icone={icone} retournee /> : null}
        </div>
      </div>
    );
  },
};

/** Données de planche (entrées valides), lues plus tard par C9-39 / C9-40. */
export const EXEMPLES_OBJET_TOURNE: readonly ParametresObjetTourne[] = [
  { icone: "lucide:coche" },
  { icone: "lucide:etoile", tours: 2 },
  { icone: "lucide:cloche", tours: 0.5 },
];
