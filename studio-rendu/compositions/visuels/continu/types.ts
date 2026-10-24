/** Propriétés reçues par les composants de la toile (plaquettes, parcours, raccords). PUR. */
import type { PageToile } from "../../../../src/domaine/visuels/continu/schema-toile";

/** Une plaquette : sa page validée, sa place et la hauteur du format. Elle dessine dans un cadre 1080 × hauteur, sans en-tête ni pied. */
export interface ProprietesPlaquette {
  page: PageToile;
  index: number;
  total: number;
  hauteur: number;
  sombre: boolean;
}

/** Un parcours : ses pages, dans un calque de `pages.length` × 1080 × 1350 (décalé de 45 px en 3:4). */
export interface ProprietesParcours {
  pages: PageToile[];
  debut: number;
  total: number;
  /** Positions (0 = première page du parcours) en fond sombre. */
  sombres: readonly number[];
}

/** Un raccord : objet centré dans un carré de `diametre` px, lui-même centré sur la couture. */
export interface ProprietesRaccord {
  diametre: number;
}

export type ComposantPlaquette = (p: ProprietesPlaquette) => React.JSX.Element;
export type ComposantParcours = (p: ProprietesParcours) => React.JSX.Element;
export type ComposantRaccord = (p: ProprietesRaccord) => React.JSX.Element;
