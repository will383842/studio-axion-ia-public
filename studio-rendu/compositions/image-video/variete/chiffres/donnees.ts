/**
 * Formes des données de l'axe « chiffres » lues par les compositions (recopiées de
 * `src/moteurs/montage-image-video/variete/axes/chiffres.ts`, sans l'importer : le moteur n'est pas copié dans l'image
 * du rendu). Un test vérifie que les données du moteur s'y assignent. Instants en secondes depuis le début du BLOC.
 */
export type CodeChiffresRendu = "CHI-A" | "CHI-B" | "CHI-C" | "CHI-D" | "CHI-E";

export interface ChiffreEcranRendu {
  texte: string;
  legende?: string;
  t: number;
}

export interface DonneesEcranChiffresRendu {
  code: Exclude<CodeChiffresRendu, "CHI-A">;
  fond: "sombre" | "ivoire";
  debut: number;
  fin: number;
  etiquette?: string;
  chiffres: ChiffreEcranRendu[];
  focal: number;
  finVariante: number;
  anneau?: { valeur: number; reste?: { texte: string; legende?: string } };
  /** CHI-C : l'ancienne valeur du même indicateur, barrée quand la nouvelle (le focal) est dite. */
  duel?: { ancien: { texte: string; legende?: string; t?: number } };
  geant?: { lignes: string[]; legende?: string };
  objets?: { total: number; part: number; reste?: { texte: string } };
  icones: { entree: string; sortie: string };
}

export type RectRendu = { x: number; y: number; largeur: number; hauteur: number };

export interface AccentToileRendu {
  noeud: string;
  t: number;
  texte: string;
  vues?: { debut: number; fin: number; x: number; y: number; largeur: number; hauteur: number; obstacles: RectRendu[] }[];
}

export interface DonneesChiffresRendu {
  code: CodeChiffresRendu;
  ecran?: DonneesEcranChiffresRendu;
  accents?: AccentToileRendu[];
}
