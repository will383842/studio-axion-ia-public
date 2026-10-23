/**
 * RECETTE QUALITÉ · IMAGE → VIDÉO (fiche de l'image). PUR.
 * Débit : 3,4 mots/s (`DEBIT_MOTS_PAR_SEC`, mesuré sur des voix réelles) : la recette GARDE 12 mots par phrase (arbitrage de Will) et
 * une accroche de 8 mots (Q07). Ces valeurs sont celles de `montage-image-video/regles.ts` (égalité vérifiée par les
 * tests ; ce fichier tire des modules serveur, il n'est pas importé ici).
 */
import { DEBIT_MOTS_PAR_SEC } from "@/domaine/image-video/complexite";
import type { RecetteQualite } from "../types";

/** `MOTS_PAR_PHRASE_MAX` et `ACCROCHE_IV_MOTS_MAX` du format. */
export const PHRASE_MOTS_MAX_IV = 12;
export const ACCROCHE_MOTS_MAX_IV = 8;

export const RECETTE_IMAGE_VIDEO: RecetteQualite = {
  id: "image-video",
  libelle: "Image → vidéo",
  debit: { unite: "mots", parSeconde: DEBIT_MOTS_PAR_SEC },
  reseaux: ["linkedin", "instagram", "facebook", "youtube-shorts"],
  faceCamera: false,
  ecransReels: true,
  demandeFinale: "question",
  demandeFinaleParReseau: { linkedin: "facultative" }, // la question à commenter n'est pas dite dans la vidéo LinkedIn (adaptateur)
  interdits: "image-video",
  structures: [{ id: "six-parties", parties: ["accroche", "douleur", "corps", "corps", "preuve", "a-retenir", "question"] }],
  ecarts: {
    premierePhraseMotsMax: { valeur: ACCROCHE_MOTS_MAX_IV, raison: "Image → vidéo Q07 : accroche de 8 mots au plus." },
    phraseAlerteMots: { valeur: PHRASE_MOTS_MAX_IV, raison: "Image → vidéo : format lu lentement, 12 mots par phrase (arbitrage de Will)." },
    phraseRefusMots: { valeur: PHRASE_MOTS_MAX_IV, raison: "Image → vidéo : format lu lentement, 12 mots par phrase (arbitrage de Will)." },
  },
};
