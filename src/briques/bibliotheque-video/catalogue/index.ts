/** Réunit les fichiers de chantier, et rien d'autre (couloir K1 : chaque fiche n'écrit que son fichier). */
import type { EtatCapacite, IdCapacite } from "../types";
import { LIGNES_TEXTE } from "./texte";
import { LIGNES_ARCHIVE } from "./archive";
import { LIGNES_ECRAN } from "./ecran";
import { LIGNES_CALQUES } from "./calques";
import { LIGNES_HABILLAGE } from "./habillage";
import { LIGNES_LOGOS_ZOOM_AVIS } from "./logos-zoom-avis";
import { LIGNES_OBJETS } from "./objets";
import { LIGNES_FINITION } from "./finition";
import { LIGNES_GENERIQUES } from "./generiques";
import { LIGNES_COUVERTURE } from "./couverture";
import { LIGNES_COULISSE_V4 } from "./coulisse-v4";
import type { LigneCatalogue } from "./types";

export type { LigneCatalogue } from "./types";
export { ID, FAMILLES_CAPACITE } from "../noms";

export const CATALOGUE_CAPACITES: readonly LigneCatalogue[] = Object.freeze([
  ...LIGNES_TEXTE, ...LIGNES_ARCHIVE, ...LIGNES_ECRAN, ...LIGNES_CALQUES, ...LIGNES_HABILLAGE,
  ...LIGNES_LOGOS_ZOOM_AVIS, ...LIGNES_OBJETS, ...LIGNES_FINITION, ...LIGNES_GENERIQUES, ...LIGNES_COUVERTURE,
  ...LIGNES_COULISSE_V4,
]);

export function ligneCapacite(id: IdCapacite): LigneCatalogue | undefined {
  return CATALOGUE_CAPACITES.find((l) => l.id === id);
}

export function etatCapacite(id: IdCapacite): EtatCapacite | undefined {
  return ligneCapacite(id)?.etat;
}
