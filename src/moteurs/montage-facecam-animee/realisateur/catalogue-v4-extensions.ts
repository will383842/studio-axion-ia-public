/**
 * C4-U4.9a-a : fiche catalogue du téléphone qui joue un extrait (lot 6, N-17) et catalogue ouvert par option. Pur, rien ne l'importe.
 * `CATALOGUE_V4` n'est jamais modifié : l'option rend un NOUVEAU tableau. Valeurs de géométrie PROVISOIRES, réglées sur la planche de
 * 3 images montrée à Williams avant tout allumage (CONCEPTION-N-17-TOUR-2.md l. 92).
 */
import type { FicheCatalogueV4 } from "./catalogue-v4";
import { CATALOGUE_V4, ficheV4, Y_SOUS_TITRES_MAX_V4 } from "./catalogue-v4";

/** Type réservé du téléphone (égal à `ID_TELEPHONE_VIDEO` de `lot6/rendus-lot6.tsx`, vérifié par le test). */
export const ID_TELEPHONE_VIDEO_V4 = "telephone-video";

export interface FicheExtensionV4 extends Omit<FicheCatalogueV4, "lot"> { lot: 6 }

export const FICHE_TELEPHONE_VIDEO_V4: Readonly<FicheExtensionV4> = Object.freeze({
  id: ID_TELEPHONE_VIDEO_V4,
  lot: 6 as const,
  composant: "TelephoneVideo",
  fichier: "studio-rendu/compositions/interface-claire/motion-v4/lot6/TelephoneVideo.tsx",
  nom: "Téléphone qui joue un extrait",
  famille: "fenetre" as const,
  slot: "fenetre" as const,
  // recopié de FenetreTelephone, à régler sur planche
  gabarit: "M4" as const,
  descente: 0,
  couvreVisage: true,
  coupDePoing: false,
  sousTitres: Y_SOUS_TITRES_MAX_V4,
  dureeSec: [2.0, 4.0] as const,
  evts: [0, 4, 6, 14, 19, 15, 21, 29, 36, 44, 52, 60, 68, -4],
  imagesVisagePartiel: 2,
  maxParVideo: 3,
  textes: [0, 0] as const,
  lignes: [0, 0] as const,
  instants: [0, 0] as const,
  videos: [1, 1] as const,
  exigeNombreDit: false,
  /** Aucun son : le téléphone joue muet. */
  sons: [] as const,
  contenu: "un téléphone qui joue un extrait d'une vidéo de Will déjà publiée ; « recherches[0] » commence par axion:",
  quand: "quand Will parle d'une chose qu'il a déjà montrée dans une de ses vidéos",
  actif: true as const,
});

type OptionsOuverture = { telephoneVideo?: unknown };

/** Éteint (tout sauf `true` exact) : le catalogue lui-même (même référence). Allumé : un nouveau tableau gelé, le téléphone en dernier. */
export function catalogueV4Ouvert(options?: OptionsOuverture): readonly Readonly<FicheCatalogueV4 | FicheExtensionV4>[] {
  if (options?.telephoneVideo !== true) return CATALOGUE_V4;
  return Object.freeze([...CATALOGUE_V4, FICHE_TELEPHONE_VIDEO_V4]);
}

export function ficheV4Ouverte(id: string, options?: OptionsOuverture) {
  if (id === ID_TELEPHONE_VIDEO_V4 && options?.telephoneVideo === true) return FICHE_TELEPHONE_VIDEO_V4;
  return ficheV4(id);
}
