/**
 * RECETTE QUALITÉ · ÉCRIRE, format avocat (le double qui parle, recette v4). PUR.
 * Débit : celui du double mesuré sur l'avocat de référence (4,5 mots/s, `DEBIT_AVATAR_MESURE_AVOCATREF`). Face caméra : pas de règle
 * « changement à l'écran ». L'appel est facultatif (`PLAFONDS_AVOCAT.appelFacultatif`). Les 10 structures AV.S1-AV.S10
 * restent celles de la recette ; le socle ne les impose pas.
 */
import { DEBIT_AVATAR_MESURE_AVOCATREF, PLAFONDS_AVOCAT, STRUCTURES_AVOCAT } from "@/donnees/generateur/recette-avocat-v4";
import type { RecetteQualite } from "../types";

export const RECETTE_ECRIRE_AVOCAT: RecetteQualite = {
  id: "ecrire-avocat",
  libelle: "Écrire · avocat",
  debit: { unite: "mots", parSeconde: DEBIT_AVATAR_MESURE_AVOCATREF },
  reseaux: ["linkedin", "instagram", "facebook", "tiktok", "youtube-shorts"],
  faceCamera: true,
  ecransReels: false,
  demandeFinale: PLAFONDS_AVOCAT.appelFacultatif ? "facultative" : "demande",
  interdits: "ecrire",
  structures: STRUCTURES_AVOCAT.map((s) => ({ id: s.id, parties: ["accroche", "corps", "appel"] as const })),
  ecarts: { accrocheFinSecMax: { valeur: PLAFONDS_AVOCAT.accrocheMaxSec, raison: "Recette avocat v4 : l'accroche entière peut durer 5 s (mesure l'avocat de référence) ; la 1re phrase reste à 3 s." } },
};
