/**
 * EMPRUNTS DU FORMAT « IMAGE → VIDÉO » (code IV) au cas concret et aux briques communes. LECTURE SEULE.
 *
 * Seul fichier du format qui importe ces pièces : si leur propriétaire (axion-ia-43) change une signature ou une ligne
 * de banque, `tests/image-video/emprunts.test.ts` rougit ici, et nulle part ailleurs.
 *
 * Volontairement ABSENTS (plan 50 § 0.3, corrigé) : `planDesFins` (4 réseaux, offre obligatoire, code « CC ») et
 * `nombresDe` (perd les unités et les heures) ; le format écrit `planDesFinsIV` et `chiffresDe`.
 */
export {
  LECTURES_CORPS_MAX,
  LECTURES_FIN_MAX,
  REGLES_BLANCS_CAS_CONCRET,
  avancerVoixCasConcret,
  controlerPrise,
  empreintePriseVoix,
  etatInitialVoixCasConcret,
  repriseVoixCasConcret,
} from "../montage-cas-concret/voix";
export type { EtatVoixCasConcret, OutilsAvancerVoix, PriseVoix } from "../montage-cas-concret/voix";
// Recette de la voix v4 (L12) : LUE seulement, jamais modifiée (resserrage, atempo 1,08, −14 LUFS, raccord corps + fin).
export { RECETTE_VOIX_CAS_CONCRET, parametresRaccord, planRaccordVoix } from "../montage-cas-concret/recette-voix";
export type { PlanRaccordVoix } from "../montage-cas-concret/recette-voix";
export { REGLES_FIN_DE_VOIX, controlerFinDeVoix, lireWav, niveauxDb, recalerCoupesSurSilences, silencesMesures } from "../montage-cas-concret/fin-de-voix";
export type { Silence, Son, VerdictFinDeVoix } from "../montage-cas-concret/fin-de-voix";
export { FINS_MOT_AVEC_ENVOI, motValide } from "../montage-cas-concret/fins";
export { CONSIGNE_PREMIER_COMMENTAIRE, INDICATION_FACEBOOK, premierCommentaireDiagnostic, textesDePublication } from "../montage-cas-concret/publication";
export type { OuPoserLeLien, TextePublication } from "../montage-cas-concret/publication";
export type { PlanDesFins } from "../montage-cas-concret/fiche";
export { proprietesPleineImage } from "../montage-cas-concret/zone-objets";
export { MOTS_INTERDITS_FORMAT, UNITES_NOMBRE, texteAvecNombres } from "../montage-cas-concret/regles";
export { APPELS_ECRITURE_MAX, EXEMPLE_TON_V4, MAX_TOKENS_ECRITURE } from "../montage-cas-concret/ecriture";
export { AVANCE_SOUFFLE_SEC, CLOTURE_AVANT_FIN_SEC, DECLENCHEUR_DE, ECART_MIN_SEC, SORTES_BRUITAGE, poserBruitages } from "../montage-cas-concret/bruitages";
export type { SorteBruitage } from "../montage-cas-concret/bruitages";
export {
  BANQUE_APPELS,
  RESEAUX_SANS_APPEL_A_COMMENTER,
  ErreurFin,
  MOTS_DIT_MAX,
  TABLE_FINS_DIAGNOSTIC,
  appelDeLaBanque,
  estAppelACommenter,
  finPour,
  groupeDe,
  phrasesDeLaBanque,
  suiteDeFins,
} from "../../briques/fins";
export type { FinChoisie, ReseauFin } from "../../briques/fins";
export type { Offre } from "../../formats/cas-concret/cas";
export { PAGE_DIAGNOSTIC } from "../../formats/cas-concret";

/**
 * Socle de Will (charte, style, preuves, modèles de ton) pour l'écriture du script (L6). Chargé à la DEMANDE : le
 * service `socle-will` est réservé au serveur (« server-only ») et lit les dépôts ; un import statique le tirerait dans
 * tout ce qui importe ce fichier (bruitages, rendu).
 */
export async function blocsSocleWill(...args: Parameters<typeof import("../../services/socle-will").blocsSocleWill>) {
  const { blocsSocleWill: lire } = await import("../../services/socle-will");
  return lire(...args);
}

/** Sous-titres de la charte duo (style et largeur de la v4) : la base des sous-titres variés du format. */
export { ENCRE_SOUS_TITRES_IVOIRE, LARGEUR_SOUS_TITRES_PCT, STYLE_SOUS_TITRES_DUO } from "../montage-cas-concret/fabriquer";
