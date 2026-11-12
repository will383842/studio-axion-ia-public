/**
 * Les 9 statuts de l'usine, les 3 familles de contenu et les réseaux de la pastille (maquette M0, refonte R3).
 * Données pures : les couleurs sont des jetons de globals.css (--statut-*, --fam-*, --res-*), jamais des valeurs écrites.
 * Une pastille porte toujours son mot : la couleur n'est jamais seule.
 */

export type StatutUsine = "brouillon" | "fabrication" | "valider" | "retouche" | "accepte" | "programme" | "publie" | "corriger" | "refuse";

export interface DefinitionStatut {
  libelle: string;
  /** Jeton du fond (`var(--statut-<nom>-fond)`). */
  fond: string;
  /** Jeton du texte. */
  texte: string;
  /** Bord : aucun, trait plein, ou pointillés (retouche, refusé). */
  bord: "aucun" | "plein" | "pointille";
  /** Couleur du bord (jeton). */
  couleurBord?: string;
  /** Petit point animé : le travail est en cours. */
  anime?: boolean;
}

const jeton = (nom: string, partie: "fond" | "texte") => `var(--statut-${nom}-${partie})`;

export const STATUTS_USINE: Record<StatutUsine, DefinitionStatut> = {
  brouillon: { libelle: "Brouillon", fond: jeton("brouillon", "fond"), texte: jeton("brouillon", "texte"), bord: "aucun" },
  fabrication: { libelle: "En fabrication", fond: jeton("fabrication", "fond"), texte: jeton("fabrication", "texte"), bord: "aucun", anime: true },
  valider: { libelle: "À valider", fond: jeton("valider", "fond"), texte: jeton("valider", "texte"), bord: "aucun" },
  retouche: { libelle: "En retouche", fond: jeton("retouche", "fond"), texte: jeton("retouche", "texte"), bord: "pointille", couleurBord: "currentColor" },
  accepte: { libelle: "Accepté", fond: jeton("accepte", "fond"), texte: jeton("accepte", "texte"), bord: "aucun" },
  programme: { libelle: "Programmé", fond: jeton("programme", "fond"), texte: jeton("programme", "texte"), bord: "aucun" },
  publie: { libelle: "Publié", fond: jeton("publie", "fond"), texte: jeton("publie", "texte"), bord: "plein", couleurBord: "var(--trait-fort)" },
  corriger: { libelle: "À corriger", fond: jeton("corriger", "fond"), texte: jeton("corriger", "texte"), bord: "aucun" },
  refuse: { libelle: "Refusé", fond: jeton("refuse", "fond"), texte: jeton("refuse", "texte"), bord: "pointille", couleurBord: "var(--trait-champ)" },
};

export const ORDRE_STATUTS_USINE = Object.keys(STATUTS_USINE) as StatutUsine[];

export type FamilleContenu = "video" | "carrousel" | "infographie";

export const FAMILLES_CONTENU: Record<FamilleContenu, { libelle: string; couleur: string; doux: string }> = {
  video: { libelle: "Vidéo", couleur: "var(--fam-video)", doux: "var(--fam-video-doux)" },
  carrousel: { libelle: "Carrousel", couleur: "var(--fam-carrousel)", doux: "var(--fam-carrousel-doux)" },
  infographie: { libelle: "Infographie", couleur: "var(--fam-infographie)", doux: "var(--fam-infographie-doux)" },
};

export type ReseauPastille = "linkedin" | "instagram" | "facebook" | "tiktok" | "youtube" | "youtube-shorts";

/**
 * Les jetons `--res-*` et `--sur-res` sont ajoutés à globals.css par la fiche CAL-06 de l'usine. En attendant, le repli
 * (gris du texte doux) garde la pastille lisible, avec son nom écrit.
 */
export const RESEAUX_PASTILLE: Record<ReseauPastille, { libelle: string; fond: string }> = {
  linkedin: { libelle: "LinkedIn", fond: "var(--res-linkedin, var(--texte-doux))" },
  instagram: { libelle: "Instagram", fond: "var(--res-instagram, var(--texte-doux))" },
  facebook: { libelle: "Facebook", fond: "var(--res-facebook, var(--texte-doux))" },
  tiktok: { libelle: "TikTok", fond: "var(--res-tiktok, var(--texte-doux))" },
  youtube: { libelle: "YouTube", fond: "var(--res-youtube, var(--texte-doux))" },
  "youtube-shorts": { libelle: "YouTube Shorts", fond: "var(--res-youtube, var(--texte-doux))" },
};

export const TEXTE_SUR_RESEAU = "var(--sur-res, var(--sur-accent))";
