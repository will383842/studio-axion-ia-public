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
  validation_perimee: "Les textes ou le titre ont changé depuis la validation : validez-les de nouveau.",
  compte_hors_liste: "Ce compte n’est pas dans la liste des comptes autorisés du serveur.",
  guide_fichier_present: "Un fichier mots/GUIDE.md existe sur le serveur : le parcours n’envoie pas ce fichier, la validation est refusée.",
  texte_dictionnaire_incomplet: "Un texte du dictionnaire est incomplet : rien n’est validé.",
  mot_non_pris_en_charge: "Seul le mot GUIDE peut être activé ici.",
  plusieurs_mots_eteint: "Le réglage « plusieurs mots » est éteint : seul le mot GUIDE peut envoyer pour l’instant. Ce mot ne part pas tant qu’il est éteint.",
  activation_par_la_fiche: "Un mot autre que GUIDE s’active depuis sa fiche, compte par compte.",
  textes_non_valides_reseau: "Les textes de ce mot ne sont pas validés pour le réseau de ce compte.",
  reseau_a_la_main: "Ce réseau se traite à la main, depuis « À traiter » : rien n’y part tout seul.",
  reseau_du_compte_inconnu: "Le réseau de ce compte est inconnu : relancez « Tester » dans Réglages, Zernio.",
  cible_test: "C’est une cible d’essai (TEST) : elle ne s’envoie jamais à de vraies personnes.",
  adresse_pas_encore: "Une adresse de page n’est pas encore envoyée par message privé : seuls les guides partent.",
  site_injoignable: "Le site ne répond pas : rien n’a été changé. Réessayez dans un instant.",
  sans_cible: "Ce mot n’a pas de cible : choisissez-en une d’abord.",
  cible_introuvable: "La cible de ce mot n’est plus au catalogue ou elle est désactivée : choisissez-en une autre.",
  mot_guide_a_part: "Les textes du mot GUIDE se valident dans le bloc « Mot GUIDE », plus bas sur cette page.",
  titre_cible_absent: "Le titre de la cible manque : rien n’est validé.",
  mot_reserve: "Le mot GUIDE est réservé : il existe déjà et se gère plus bas sur cette page.",
  cible_guide_figee: "La cible du mot GUIDE ne se change pas ici pour l'instant.",
  mot_existe: "Ce mot existe déjà : changez sa cible depuis le tableau.",
  mot_inconnu: "Ce mot n’est pas dans le tableau.",
  site_refuse: "Le site n’a pas accepté la demande.",
  interrupteur_eteint: "Éteint : rien n’a été envoyé (simulation).",
};
export const phraseRefus = (code: string): string => PHRASES_REFUS[code] ?? "Demande refusée.";
