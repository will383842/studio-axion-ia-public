/**
 * RENDU DE COULEUR DES GÉNÉRATEURS (GV-LU-01) : UN seul endroit dit quelle LUT et quelle intensité reçoit chaque format.
 * Fichier PUR (aucun import, aucun alias `@/`) : le dossier `briques/charte/` est copié dans l'image du rendu.
 * Les générateurs « dessinés » ont un rendu neutre (aucune LUT) : ils ne déforment pas les couleurs de la marque.
 * Ordre de décision (fabrication.ts, écran Réglages) : choix de la vidéo > étoile de la Bibliothèque > cette table.
 */
export interface RenduCouleur {
  /** Identifiant de la LUT Axion (`LUTS_AXION`), ou `null` = rendu neutre. */
  lut: string | null;
  /** Intensité en % appliquée quand la vidéo n'en choisit pas. */
  intensite: number;
  /** « filme » : images tournées ou générées en prise de vue ; « dessine » : illustrations / schémas. */
  nature: "filme" | "dessine";
}

const NEUTRE_DESSINE: RenduCouleur = { lut: null, intensite: 70, nature: "dessine" };
const NATUREL_FILME: RenduCouleur = { lut: "lut-axion-naturel", intensite: 70, nature: "filme" };
/** Formats en simulation (pas de rendu réel) : leurs fiches citent des LUT sans fichier, la table les déclare neutres. */
const NEUTRE_FILME: RenduCouleur = { lut: null, intensite: 70, nature: "filme" };

export const RENDU_COULEUR: Record<string, RenduCouleur> = {
  avocat: { lut: "lut-avocat-v1", intensite: 70, nature: "filme" },
  facecam: NATUREL_FILME,
  "facecam-animee": NATUREL_FILME,
  "demo-facecam": NATUREL_FILME,
  "tableau-anime": NEUTRE_DESSINE,
  "cas-concret": NEUTRE_DESSINE,
  "image-video": NEUTRE_DESSINE,
  "tutoriel-outil": NEUTRE_DESSINE,
  podcast: { lut: null, intensite: 60, nature: "filme" },
  "createur-b": NEUTRE_FILME,
  "ecran-partage": NEUTRE_FILME,
  motion: NEUTRE_FILME,
  ugc: NEUTRE_FILME,
  selfie: NEUTRE_FILME,
};

/** Rendu neutre des formats inconnus (ex. format de test) : aucune LUT, intensité 70 comme l'ancien repli. */
const REPLI: RenduCouleur = { lut: null, intensite: 70, nature: "filme" };

export function renduCouleurDe(formatId: string): RenduCouleur {
  return RENDU_COULEUR[formatId] ?? REPLI;
}
