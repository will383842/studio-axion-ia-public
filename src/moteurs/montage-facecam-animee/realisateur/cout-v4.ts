/**
 * COÛT DU RÉALISATEUR v4 (face caméra animée) — PUR. Estimation HONNÊTE affichée avant « Animer ma vidéo » : on construit la requête
 * réellement envoyée à Claude Opus (consigne v4, schéma, message de la transcription) et on la chiffre au pire (`pireCasRole`, la fonction
 * unique des réservations du studio), jusqu'à 3 essais (`ESSAIS_MAX_REALISATEUR`), les essais 2 et 3 portant en plus le plan refusé et la liste des erreurs
 * de l'essai précédent. Le rendu tourne sur le serveur du studio et la voix est celle de Will : 0 €. Le plafond Claude propre d'une vidéo
 * (`PLAFOND_CLAUDE_FA_USD`) borne la dépense réelle : jamais changé ici.
 */
import { pireCasRole } from "@/generateur/roles/types";
import { MAX_JETONS_REALISATEUR_V4, entreeRoleRealisateurV4, roleRealisateurV4 } from "./role-v4";
import { ESSAIS_MAX_REALISATEUR, messageAvecErreurs, messageRealisateur, type EntreeRealisateur } from "./index";
import { ESSAIS_REPLI_SANS_VIDEO_V4 } from "../repli-sans-video-v4";

/** Débit de parole PESSIMISTE (mots par seconde) : la recette vise 2,8 ; une prise rapide en dit davantage. */
export const MOTS_PAR_SECONDE_PIRE_CAS = 3.5;
/** Longueur pessimiste d'un mot (caractères) : français moyen ≈ 5, mots longs («automatiser,») jusqu'à 12 : on prend 12. */
const CARACTERES_PAR_MOT = 12;
/** Erreurs rejouées au pire dans un nouvel essai (`verifierPlan` en liste 20 au plus dans l'état) et longueur de chacune. */
const ERREURS_REJOUEES = 20;
const CARACTERES_PAR_ERREUR = 450;
/** Plan refusé renvoyé au réessai (jusqu'à la sortie maximale) : compté dans les essais 2 et 3. */
const CARACTERES_PLAN_RENVOYE = 90_000;

export interface EstimationOpusV4 {
  /** Un seul essai, au pire (dollars). */
  unEssaiUsd: number;
  /** Jusqu'à 3 essais plus le repli sans vidéo, au pire (dollars) : peut dépasser le plafond, qui coupe alors la dépense. */
  pireCasUsd: number;
  /** Ce que Claude peut réellement coûter : le pire cas borné par le plafond de la vidéo. */
  engageMaxUsd: number;
  plafondUsd: number;
  essaisMax: number;
  /** Essais de plus du repli « sans vidéo » (une seule fois par vidéo), déjà comptés dans le pire cas. */
  essaisRepliMax: number;
  /** Jetons d'entrée (premier essai) et de sortie maximum d'un essai, tels qu'ils servent au chiffrage. */
  jetonsSortieMax: number;
}

/** Mots de la prise pour le chiffrage : le plus grand du texte donné et de la durée × débit pessimiste. PUR. */
export function motsPourEstimation(dureeSec: number, motsTexte = 0): number {
  const duree = Number.isFinite(dureeSec) && dureeSec > 0 ? dureeSec : 0;
  return Math.max(Math.ceil(duree * MOTS_PAR_SECONDE_PIRE_CAS), Math.max(0, Math.floor(motsTexte)));
}

/** Transcription fictive, de la taille du pire cas (un mot par ligne comme dans la vraie requête). PUR. */
function entreePourEstimation(dureeSec: number, nbMots: number): EntreeRealisateur {
  const duree = Math.max(dureeSec, nbMots / MOTS_PAR_SECONDE_PIRE_CAS);
  const pas = duree / Math.max(1, nbMots);
  const mot = "m".repeat(CARACTERES_PAR_MOT);
  const mots = Array.from({ length: nbMots }, (_, i) => ({ w: mot, a: i * pas, f: (i + 1) * pas }));
  return { mots, dureeSec: duree, titre: "x".repeat(80), prise: { src: "prise", finSec: duree }, fin: { marque: "", adresse: "", motCle: "", tuiles: [] } };
}

type DemandeEstimation = { dureeSec: number; motsTexte?: number; plafondUsd: number };

/** Coût au pire d'un essai « premier » (la transcription seule) et d'un essai « suivant » (plan refusé et erreurs renvoyés). PUR. */
function coutsEssaisV4(d: DemandeEstimation): { premier: number; suivant: number } {
  const entree = entreePourEstimation(d.dureeSec, motsPourEstimation(d.dureeSec, d.motsTexte));
  const role = roleRealisateurV4();
  const base = messageRealisateur(entree);
  const erreurs = Array.from({ length: ERREURS_REJOUEES }, () => "e".repeat(CARACTERES_PAR_ERREUR));
  const cout = (message: string) => pireCasRole(role, entreeRoleRealisateurV4({ systeme: "", message, schema: {} }));
  return { premier: cout(base), suivant: cout(messageAvecErreurs(base, erreurs, "p".repeat(CARACTERES_PLAN_RENVOYE))) };
}

/** Coût au pire d'un essai suivant (nouvel essai ou essai du repli « sans vidéo »). PUR. */
export const coutEssaiSuivantV4 = (d: DemandeEstimation): number => coutsEssaisV4(d).suivant;

/** Estimation de l'appel Opus d'une prise (au pire). PUR. */
export function estimerOpusV4(d: DemandeEstimation): EstimationOpusV4 {
  const { premier, suivant } = coutsEssaisV4(d);
  // Les 3 essais normaux, plus le repli « sans vidéo » (plan précédent et erreurs D16 renvoyés comme dans un nouvel essai).
  const pireCasUsd = premier + (ESSAIS_MAX_REALISATEUR - 1) * suivant + ESSAIS_REPLI_SANS_VIDEO_V4 * suivant;
  return {
    unEssaiUsd: premier,
    pireCasUsd,
    engageMaxUsd: Math.min(pireCasUsd, d.plafondUsd),
    plafondUsd: d.plafondUsd,
    essaisMax: ESSAIS_MAX_REALISATEUR,
    essaisRepliMax: ESSAIS_REPLI_SANS_VIDEO_V4,
    jetonsSortieMax: MAX_JETONS_REALISATEUR_V4,
  };
}
