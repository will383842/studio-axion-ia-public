/** Libellés de l'écran « Mots » (PUR, français simple). Tout est éteint par défaut. */
import type { Tonalite } from "@/domaine/libelles";
import type { EtatMot } from "@/services/mots-service";

export const ETATS_MOT: Record<EtatMot, { libelle: string; ton: Tonalite }> = {
  non_pose: { libelle: "Pas posé", ton: "neutre" },
  pause: { libelle: "En pause", ton: "ambre" },
  pause_auto: { libelle: "Pause automatique", ton: "brique" },
  actif: { libelle: "Actif", ton: "sauge" },
};

export interface EtatGlobal {
  libelle: string;
  ton: Tonalite;
}
/** Ce que l'opérateur lit en premier : l'ordre va du plus bloquant au plus calme. */
export function etatGlobalMots(v: { interrupteurAllume: boolean; toutArrete: boolean; disjoncteurOuvert: boolean }): EtatGlobal {
  if (v.toutArrete) return { libelle: "Tout est à l’arrêt", ton: "brique" };
  if (v.disjoncteurOuvert) return { libelle: "Disjoncteur ouvert", ton: "brique" };
  if (!v.interrupteurAllume) return { libelle: "Éteint : simulation seulement", ton: "neutre" };
  return { libelle: "Allumé", ton: "sauge" };
}

/** Phrases pour les codes de refus (jamais de détail technique). */
export const PHRASES_REFUS: Record<string, string> = {
  textes_non_valides: "Les textes ne sont pas validés.",
  texte_refuse: "Un texte ne respecte pas les règles.",
  mot_invalide: "Ce mot n’est pas valide.",
  validation_operateur_absente: "Votre validation est nécessaire.",
  tout_arrete: "Tout est à l’arrêt.",
  disjoncteur_ouvert: "Le disjoncteur est ouvert.",
  mot_non_pose: "Ce mot n’est pas posé.",
  zernio_refuse: "Zernio n’a pas accepté la demande.",
  reponse_inattendue: "Réponse inattendue de Zernio.",
  fichier_absent: "Fichier du mot introuvable.",
  mot_non_valide: "Les textes de ce mot ne sont pas validés.",
  titre_guide_absent: "Le titre du guide manque côté serveur : rien n’est validé.",
  deja_pose_chez_zernio: "Ce mot est déjà posé chez Zernio.",
  ligne_zernio: "Ce mot est posé chez Zernio : utilisez la pause habituelle.",
  lecture_impossible: "Les réglages sont illisibles : rien n’a changé.",
  validation_perimee: "Les textes ou le titre ont changé depuis la validation : validez de nouveau les textes du mot GUIDE.",
  compte_hors_liste: "Ce compte n’est pas dans la liste des comptes autorisés du serveur.",
  guide_fichier_present: "Un fichier mots/GUIDE.md existe sur le serveur : le parcours n’envoie pas ce fichier, la validation est refusée.",
  texte_dictionnaire_incomplet: "Un texte du dictionnaire est incomplet : rien n’est validé.",
  mot_non_pris_en_charge: "Seul le mot GUIDE peut être activé ici.",
  interrupteur_eteint: "Éteint : rien n’a été envoyé (simulation).",
};
export const phraseRefus = (code: string): string => PHRASES_REFUS[code] ?? "Demande refusée.";
