/**
 * Table des crans du dosage de l'animation (X3-01).
 * Brique pure, côté Studio seulement, jamais importée par `studio-rendu/**`.
 * Aucune date, aucun hasard.
 */
import type { NiveauIntensite } from "@/domaine/types";
import { DOSAGES } from "./types";
import type { DosageMotion, IdGenerateurDosage, RetraitsDosage } from "./types";

export const NIVEAU_DU_DOSAGE: Record<DosageMotion, NiveauIntensite> = {
  aucun: "sobre",
  sobre: "sobre",
  equilibre: "equilibre",
  dynamique: "tres-dynamique",
};

const GARDE: Omit<RetraitsDosage, "transitions"> = {
  cartes: false,
  illustrations: false,
  texteEcran: false,
  zooms: false,
  bandeauNom: false,
  effetsSpeciaux: false,
  bruitagesParDefaut: "reglage",
};

export const RETRAITS: Record<DosageMotion, RetraitsDosage> = {
  aucun: {
    cartes: true,
    illustrations: true,
    texteEcran: true,
    zooms: true,
    transitions: "franches",
    bandeauNom: true,
    effetsSpeciaux: true,
    bruitagesParDefaut: "aucun",
  },
  sobre: { ...GARDE, transitions: "douces" },
  equilibre: { ...GARDE, transitions: "inchangees" },
  dynamique: { ...GARDE, transitions: "inchangees" },
};

const TOUS: readonly DosageMotion[] = DOSAGES;
const SANS_AUCUN: readonly DosageMotion[] = ["sobre", "equilibre", "dynamique"];

export const CRANS_PERMIS: Record<IdGenerateurDosage, readonly DosageMotion[]> = {
  avocat: TOUS,
  facecam: TOUS,
  "demo-facecam": TOUS,
  "tutoriel-outil": TOUS,
  "cas-concret": SANS_AUCUN,
  tableau: SANS_AUCUN,
  "image-video": SANS_AUCUN,
  "facecam-animee": ["dynamique"],
};

export const DOSAGE_DEFAUT_CODE: Record<IdGenerateurDosage, DosageMotion> = {
  avocat: "equilibre",
  facecam: "equilibre",
  "demo-facecam": "equilibre",
  "tutoriel-outil": "equilibre",
  "cas-concret": "equilibre",
  tableau: "equilibre",
  "image-video": "equilibre",
  "facecam-animee": "dynamique",
};

export const PHRASE_CRAN_GRISE = {
  animations: "Ce générateur est fait d'animations : on peut les calmer, pas les retirer.",
  v4: "Rendu validé : la v4 reste telle quelle. Pour une vidéo face caméra sans animation, choisissez Face caméra.",
} as const;
