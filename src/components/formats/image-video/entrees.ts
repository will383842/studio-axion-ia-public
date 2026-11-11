/**
 * Entrées proposées sur l'écran de départ « Image → vidéo » (décision de Williams, lot F) : le générateur ne part plus d'une
 * image. Deux entrées seulement : un TITRE ou une IDÉE (le studio génère le script, que Williams relit et modifie avant toute
 * fabrication) ou un SCRIPT collé (utilisé tel quel, fabriqué directement). Le code des images internes (montage) reste.
 */
export type EntreeDepot = "texte" | "script";

/** Les entrées visibles, dans l'ordre d'affichage. */
export const ENTREES_VISIBLES: { valeur: EntreeDepot; libelle: string }[] = [
  { valeur: "texte", libelle: "Titre ou idée" },
  { valeur: "script", libelle: "Mon script" },
];

/** Entrée choisie à l'ouverture de l'écran. */
export const ENTREE_PAR_DEFAUT: EntreeDepot = "texte";

/** Phrase de l'écran vide. */
export const PHRASE_ECRAN_VIDE = "Donnez un titre ou une idée pour commencer.";
