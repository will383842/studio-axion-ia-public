/** Regardeur commun : Claude recopie ce qu'il voit sur la vidéo finie, le CODE décide des défauts (brique pure). */
export type CodeDefautVu = "phrase-non-choisie" | "fin-absente" | "page-vide" | "texte-coupe" | "hors-cadre" | "desynchro" | "noire" | "illisible" | "non-relue";

export interface InstantRegard {
  /** « i01 »… */
  nom: string;
  instantSec: number;
  /** Scène, page ou passage ; null = début ou fin. */
  partieId: string | null;
  sorte: "debut" | "partie" | "fin";
  legende: string;
  /** La fiche prévoit du texte écrit à cet instant. */
  texteAttendu: boolean;
  /** Mots dits entre t−1 s et t+1 s. */
  motsDits: string[];
}

export interface TexteLu {
  texte: string;
  coupe: boolean;
  horsCadre: boolean;
}

export interface ImageLue {
  nom: string;
  textes: TexteLu[];
  sousTitre: string | null;
  pageVide: boolean;
  noire: boolean;
  illisible: boolean;
}

export interface LectureRegard {
  images: ImageLue[];
}

export interface FinAttendue {
  texte: string;
  motCle?: string;
}

export interface DefautVu {
  code: CodeDefautVu;
  nom: string;
  instantSec: number;
  partieId: string | null;
  /** Français, sans sigle. */
  detail: string;
  /** Seulement PORTÉ ici : aucune décision de blocage dans cette brique (lot 2). */
  bloquantSiSur: boolean;
}

export interface VerdictRegard {
  defauts: DefautVu[];
  relues: number;
  nonRelues: number;
  partiesFautives: string[];
}
