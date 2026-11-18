/**
 * TRAIT AU FEUTRE (X1-09) : habillage Remotion seulement. Dessine `traitFeutre` (pur) avec `getStroke` de perfect-freehand
 * (dépendance de studio-rendu). `progres` (0 → 1) fait apparaître le trait peu à peu. Couleur par `couleurDuTon`.
 * Aucun branchement : rien n'importe ce fichier (non inscrit, éteint).
 */
import { AbsoluteFill } from "remotion";
import { getStroke } from "perfect-freehand";
import type { FondAxion } from "../../../src/briques/jetons-motion";
import type { TonObjet, ZoneObjet } from "../../../src/briques/motion/petits-objets/contrat";
import { couleurDuTon } from "../../../src/briques/motion/petits-objets/tons";
import { HAUTEUR_TOILE_PX, pointsVisibles, traitFeutre, type GenreTraitFeutre } from "../../../src/briques/motion/petits-objets/trait-feutre";

export interface ProprietesTraitFeutre {
  genre: GenreTraitFeutre;
  /** Graine de la vidéo (entier ≥ 0). */
  graine: number;
  zone: ZoneObjet;
  visage?: ZoneObjet;
  /** Avancement du tracé, 0 → 1. */
  progres: number;
  ton: TonObjet;
  fond: FondAxion;
}

/** Contour (polygone) rendu par getStroke → attribut `d` d'un chemin SVG. */
function cheminDe(contour: number[][]): string {
  if (contour.length === 0) return "";
  return `M ${contour.map(([x, y]) => `${x.toFixed(2)} ${y.toFixed(2)}`).join(" L ")} Z`;
}

export function TraitFeutre({ genre, graine, zone, visage, progres, ton, fond }: ProprietesTraitFeutre) {
  const trait = traitFeutre({ genre, graine, zone, visage });
  if (trait === null) return null;
  const visibles = pointsVisibles(trait.points, progres);
  if (visibles.length < 2) return null;
  // Toile de 100 × 100 unités : le diamètre est l'épaisseur en pixels ramenée à cette échelle.
  const diametre = (trait.epaisseur / HAUTEUR_TOILE_PX) * 100;
  const contour = getStroke(visibles, { size: diametre, thinning: 0.4, smoothing: 0.5, streamline: 0.4, simulatePressure: true, last: progres >= 1 });
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" width="100%" height="100%" data-trait-feutre={genre}>
        <path d={cheminDe(contour)} fill={couleurDuTon(ton, fond)} />
      </svg>
    </AbsoluteFill>
  );
}
