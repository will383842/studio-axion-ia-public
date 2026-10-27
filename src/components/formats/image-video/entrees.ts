/**
 * Entrées proposées sur l'écran de départ « Image → vidéo ». Le mode « à partir d'une image » ne marche pas assez bien :
 * il est masqué ici, son code et ses actions serveur restent intacts. Pour le remettre, passer cette ligne à `true`.
 */
export const ENTREE_IMAGE_VISIBLE = false;

export type EntreeDepot = "image" | "texte" | "script";

/** Les entrées visibles, dans l'ordre d'affichage. */
export const ENTREES_VISIBLES: { valeur: EntreeDepot; libelle: string; icone?: "image" }[] = [
  ...(ENTREE_IMAGE_VISIBLE ? [{ valeur: "image" as const, libelle: "Déposer une image", icone: "image" as const }] : []),
  { valeur: "texte", libelle: "Décrire avec mes mots" },
  { valeur: "script", libelle: "Coller mon script complet" },
];

/** Entrée choisie à l'ouverture de l'écran. */
export const ENTREE_PAR_DEFAUT: EntreeDepot = ENTREE_IMAGE_VISIBLE ? "image" : "texte";

/** Phrase de l'écran vide : ne parle d'image que si le dépôt d'image est proposé. */
export const PHRASE_ECRAN_VIDE = ENTREE_IMAGE_VISIBLE ? "Déposez une image pour commencer." : "Décrivez votre vidéo pour commencer.";
