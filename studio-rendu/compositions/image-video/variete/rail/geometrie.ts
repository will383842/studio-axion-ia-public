/**
 * Lot 3 · RAIL D'ÉTAPES : géométrie PURE des trois dessins de remplacement (RAI-B fil de progression, RAI-C icônes seules,
 * RAI-D segments façon stories). Aucun texte ; tout reste entre x 60 et 1020 et dans la hauteur du rail (coordonnées
 * relatives au haut du rail). RAI-A (référence) n'a pas de géométrie : il appelle `RailSuite` tel quel.
 */
import { RAIL_IV } from "../../plan";

export type CodeRail = "RAI-A" | "RAI-B" | "RAI-C" | "RAI-D";
export type EtatRail = "absent" | "actif" | "vu";

/** Une carte du rail (sous-ensemble de `CarteRail`), avec la part déjà remplie quand elle est en cours. */
export interface CarteGeo {
  id: string;
  x: number;
  largeur: number;
  opacite: number;
  etat: EtatRail;
  /** 0 à 1 : remplissage du segment en cours (RAI-D). */
  remplissage?: number;
}

export type ElementRail = {
  id: string;
  genre: "ligne" | "point" | "pastille" | "segment";
  x: number;
  y: number;
  largeur: number;
  hauteur: number;
  opacite: number;
  etat: EtatRail;
  remplissage: number;
};

export const POINT_RAIL = 18;
const EPAISSEUR_LIGNE = 3;
const EPAISSEUR_SEGMENT = 10;
const RAYON_MAX = 46;

/** Cale `[x, x + largeur]` dans `[gauche, droite]` (largeur rognée si besoin) ; `null` s'il n'en reste rien. */
function caler(x: number, largeur: number): { x: number; largeur: number } | null {
  const a = Math.max(RAIL_IV.gauche, x);
  const b = Math.min(RAIL_IV.droite, x + largeur);
  return b - a > 0.5 ? { x: a, largeur: b - a } : null;
}

export function geometrieRail(code: CodeRail, cartes: readonly CarteGeo[], place: { haut: number; hauteur: number }): ElementRail[] {
  if (code === "RAI-A") return [];
  const h = place.hauteur;
  const milieu = h / 2;
  const sortie: ElementRail[] = [];
  const pose = (c: CarteGeo, genre: ElementRail["genre"], x: number, largeur: number, hauteur: number, suffixe: string) => {
    const k = caler(x, largeur);
    if (!k) return;
    // Un point ou une pastille ne se rogne pas (il deviendrait un ovale) : il paraît entier ou pas du tout.
    if ((genre === "point" || genre === "pastille") && k.largeur < largeur - 1e-6) return;
    const y = Math.max(0, Math.min(h - hauteur, milieu - hauteur / 2));
    sortie.push({ id: `${c.id}${suffixe}`, genre, x: k.x, y, largeur: k.largeur, hauteur, opacite: c.opacite, etat: c.etat, remplissage: c.remplissage ?? (c.etat === "vu" ? 1 : 0) });
  };
  for (const c of cartes) {
    const centre = c.x + c.largeur / 2;
    if (code === "RAI-B") {
      pose(c, "ligne", c.x, c.largeur, EPAISSEUR_LIGNE, "-ligne");
      pose(c, "point", centre - POINT_RAIL / 2, POINT_RAIL, POINT_RAIL, "-point");
    } else if (code === "RAI-C") {
      const d = 2 * Math.min(RAYON_MAX, h / 2 - 14);
      pose(c, "pastille", centre - d / 2, d, d, "");
    } else {
      const marge = 6;
      pose(c, "segment", c.x + marge, c.largeur - 2 * marge, EPAISSEUR_SEGMENT, "");
    }
  }
  return sortie;
}
