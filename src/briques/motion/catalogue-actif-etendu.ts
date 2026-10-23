/**
 * CATALOGUE ACTIF À 13 MODÈLES (lot F2) pour l'API unique `cartesPourFormat` (mission H). Même contrat que
 * `CATALOGUE_ACTIF_BASE` (6 modèles). Intégration Z : `CATALOGUE_ACTIF` (`pourFormat.ts`) pointe sur celui-ci, tous les
 * formats qui passent par l'API unique ont les modèles 7 à 13. Le vocabulaire du monteur face caméra (`MODELES_CARTE`,
 * option `modelesEtendus`) reste à 6 modèles tant que Will n'a pas validé la planche `docs/facecam/planche-motion-7-13/`.
 *
 * En moitié haute d'un écran partagé, une carte qui n'y tient pas (`tientEnMoitieHaute`) n'est pas rendue là : le
 * format la pose ailleurs en plein écran, ou s'en passe (jamais de texte sous 3 % de la hauteur). PUR, sans « @/ ».
 */
import { CATALOGUE_MOTION_TOUS, estModeleEtendu, IDS_MODELES_MOTION_TOUS } from "./catalogue-etendu";
import { calerCarteTous } from "./calage-etendu";
import { choisirModeleTous, type ContexteChoixMotion } from "./choix-etendu";
import { preparerCarte } from "./demande";
import { parametresCarteModeleEtendu } from "./demande-etendue";
import { tientEnMoitieHaute } from "./disposition-etendue";
import type { CatalogueMotionActif } from "./pourFormat";
import { carteDepuisTextes } from "./textes";
import { carteDepuisTextesEtendus } from "./textes-etendus";
import type { CarteModele, IdModeleMotion } from "./types";
import type { CarteModeleEtendu, CarteMotionTous } from "./types-etendus";

/**
 * Catalogue à 13 modèles. `contexte.capture` : l'image du passage (Mes images, B-roll) qui rend possible la capture
 * annotée. Les cartes 7 à 13 circulent dans le type `CarteModele` de l'API (union élargie à l'exécution).
 */
export function catalogueActifEtendu(contexte: ContexteChoixMotion = {}): CatalogueMotionActif {
  return {
    ids: () => IDS_MODELES_MOTION_TOUS,
    fiche: (id) => (CATALOGUE_MOTION_TOUS as Record<string, { composition: string; dureeSec: [number, number]; automatique: boolean }>)[id],
    choisir: (phrase) => {
      const c = choisirModeleTous(phrase, contexte);
      return c ? { modele: c.modele, carte: c.carte as CarteModele, confiance: c.confiance, raison: c.raison } : null;
    },
    depuisTextes: (modele, textes) => {
      if (estModeleEtendu(modele)) return carteDepuisTextesEtendus(modele, textes, contexte) as unknown as CarteModele | null;
      return (Object.keys(CATALOGUE_MOTION_TOUS) as string[]).includes(modele) ? carteDepuisTextes(modele as IdModeleMotion, textes) : null;
    },
    caler: (carte, mots, debut, duree) => calerCarteTous(carte as CarteMotionTous, mots, debut, duree) as CarteModele,
    parametres: (carte, mp) => {
      const c = carte as CarteMotionTous;
      if (!estModeleEtendu(c.modele)) return preparerCarte({ carte: c as CarteModele }, mp).parametres;
      if (mp.disposition === "moitie-haute" && !tientEnMoitieHaute(c as CarteModeleEtendu, mp.ratio)) return null;
      return parametresCarteModeleEtendu(c as CarteModeleEtendu, mp);
    },
  };
}

/** Catalogue à 13 modèles sans image de passage (pas de capture annotée automatique). */
export const CATALOGUE_ACTIF_ETENDU: CatalogueMotionActif = catalogueActifEtendu();
