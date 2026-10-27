/**
 * BANQUE DE FINS COMMUNE : toutes les phrases de fin, une seule source pour les formats du studio (tableau animé, cas
 * concret). Deux parties :
 *
 * 1. `BANQUE_APPELS` : la base 7 de l'Usine (`usine/bases/pour-la-machine/7-appels.md`, table `appel`, copie JSON du
 *    studio), GÉNÉRÉE (`npm run bases:banque`, fichier `banque-base7.generee.ts`) TELLE QUELLE : mêmes codes, mêmes phrases dites, écrites et de légende, au
 *    caractère près. Aucune phrase n'est écrite ici. Noms des champs et des valeurs : ceux du contrat d'échange
 *    (`usine/CONTRATS-ECHANGE.md`) : `appel.objectif`, `public.code` (`appel.cible = x` se lit `public.x`), `type_contenu`
 *    (« post_texte » des bases = `texte` du contrat), `linkedin_page` = réseau `linkedin`, compte de nature `page`.
 *    Une phrase à changer se change d'abord dans la base 7, puis on resynchronise et on régénère : jamais à la main ici.
 * 2. `TABLE_FINS_DIAGNOSTIC` : les fins propres au format « cas concret » (anciennement `table-diagnostic.ts`), que la
 *    base 7 laisse au studio (« Les phrases de cadeau du format cas concret : propres à ce format »). Une ligne dont le
 *    code est dans la base 7 en reprend les phrases.
 *
 * PUR, sans alias « @/ ».
 */
import { LIGNES_BASE_7 } from "./banque-base7.generee";
import type { FinTable, ReseauFin, TypeFin } from "./types";

/* ------------------------------------------------------------------ */
/* 1. Base 7 de l'Usine                                                */
/* ------------------------------------------------------------------ */

/** `appel.objectif` (contrat d'échange). */
export const OBJECTIFS_APPEL = ["MOT_CADEAU", "LIEN_PROFIL", "QUESTION", "ENREGISTRER", "PARTAGER", "ABONNEMENT", "RENDEZ_VOUS", "CANDIDATURE"] as const;
export type ObjectifAppel = (typeof OBJECTIFS_APPEL)[number];

/** `public.code` (contrat d'échange). */
export const PUBLICS_APPEL = ["public.clients", "public.apporteurs", "public.formateurs"] as const;
export type PublicAppel = (typeof PUBLICS_APPEL)[number];

/** `type_contenu` (contrat d'échange). */
export const TYPES_CONTENU = ["video", "carrousel", "image", "texte", "story"] as const;
export type TypeContenu = (typeof TYPES_CONTENU)[number];

/** `etat` des bases. */
export type EtatAppel = "brouillon" | "propose" | "valide" | "retire";

/** Une ligne de la table `appel` de la base 7. Cellule `dit` ou `ecran` vide : rien n'est dit, ou rien n'est affiché. */
export interface AppelBanque {
  code: string;
  reseaux: readonly ReseauFin[];
  /** LinkedIn seulement : profil de Williams, page de l'entreprise, ou les deux. */
  naturesLinkedin?: readonly ("profil" | "page")[];
  public: PublicAppel;
  typeContenu: TypeContenu;
  type: TypeFin;
  objectif: ObjectifAppel;
  dit: string;
  ecran: string;
  legende: string;
  /** « {MOT} » quand l'appel demande un mot à commenter, sinon vide. */
  mot: string;
  lien: string;
  emplacement: string;
  etat: EtatAppel;
  version: number;
  origine: "repris" | "propose";
  source: string;
  valideLe: string;
}

export const BANQUE_APPELS: readonly AppelBanque[] = Object.freeze(LIGNES_BASE_7.map((a) => Object.freeze(a)));

/**
 * Les phrases de la banque des fins (dites et écrites), pour la mémoire commune : le script enregistré les contient mot pour mot (la fin est imposée
 * par le code), elles reviennent donc sur presque tous les scripts gardés. Ni redites à éviter ni copie : tolérées.
 */
export const PHRASES_BANQUE_FINS: readonly string[] = [...new Set(BANQUE_APPELS.flatMap((a) => [a.dit, a.legende]).map((t) => t.trim()).filter(Boolean))];

/** La ligne de la base 7 de ce code, ou null. */
export function appelDeLaBanque(code: string): AppelBanque | null {
  return BANQUE_APPELS.find((a) => a.code === code) ?? null;
}

/**
 * Préfixe des lignes propres aux fins Image → vidéo (26/10/2026 : accroche, appel, lien, Tour de France IA). Elles ne se
 * lisent QU'ENSEMBLE, par code (`appelDeLaBanque`), dans l'ordre accroche + appel + lien : jamais tirées une à une par
 * filtre, sinon le tableau animé et l'équipe du générateur y piocheraient une phrase seule.
 */
export const PREFIXE_FINS_IMAGE_VIDEO = "fin-iv-";

/** Les lignes VALIDÉES de la base 7 pour un réseau, un public et une sorte de contenu (ordre de la base), hors lignes réservées à Image → vidéo. */
export function appelsDeLaBanque(filtre: { reseau: ReseauFin; public: PublicAppel; typeContenu: TypeContenu }): AppelBanque[] {
  return BANQUE_APPELS.filter((a) => a.etat === "valide" && !a.code.startsWith(PREFIXE_FINS_IMAGE_VIDEO) && a.reseaux.includes(filtre.reseau) && a.public === filtre.public && a.typeContenu === filtre.typeContenu);
}

/** Phrases dite et écrite d'un code de la base 7, pour une table du studio : jamais recopiées à la main. */
export function phrasesDeLaBanque(code: string): { dit: string; ecran: string } {
  const a = appelDeLaBanque(code);
  if (!a) throw new Error(`Aucune fin « ${code} » dans la base 7.`);
  return { dit: a.dit, ecran: a.ecran };
}

/* ------------------------------------------------------------------ */
/* 2. Fins du format « cas concret » (anciennement table-diagnostic.ts) */
/* ------------------------------------------------------------------ */

/*
 * Table À PART. Jamais fusionnée dans `TABLE_FINS` (le tableau animé la lit en entier), jamais passée par défaut à
 * `finPour` : on la donne à `suiteDeFins`.
 *
 * Depuis le 12/10/2026 (réponse de l'Usine, déléguée par Will) : une seule demande par fin. « Faites votre diagnostic
 * gratuit en quelques minutes. » puis la phrase du lien de chaque réseau ; ou, là où le mot est branché, « Écrivez {MOT} en
 * commentaire. » puis « Je vous envoie la structure complète. », sans lien. Ces phrases sont des PROPOSITIONS de l'Usine,
 * utilisables par ce format, avec leur trace (`VALIDATION_USINE`) en attendant que Will les valide une à une.
 * Les anciennes lignes (la suite en deux demandes, « Le lien est dans la bio. », etc.) ne sont pas supprimées : elles sont
 * désactivées, avec leur `motif`. Les trois cadeaux transposés (intégration, formation, audit) restent non validés.
 *
 * « Réservez votre diagnostic gratuit. » (désactivée le 12/10 par la PR #146) est RÉACTIVÉE : Will a dit OUI le 12/10
 * (base 7, « Déjà tranché » : gardée, vers la page d'appel `/fr/appel`). Restent désactivées : « Ou réservez… », qui
 * ajoute une seconde demande, et la ligne de LinkedIn (rien n'est dit dans une vidéo LinkedIn).
 *
 * X7 (décision de Will du 12/10/2026) : sur Instagram, l'abonnement est obligatoire pour recevoir le cadeau. La fin au mot
 * d'Instagram est la phrase validée « Abonnez-vous et écrivez {MOT} en commentaire : je vous l'envoie. » (code de l'Usine
 * `fin-ig-mot-abonnement`), en UNE ligne : elle tient en 10 mots dits, sous la règle des 12, quel que soit le mot (un mot
 * sans espace). Facebook garde « Écrivez {MOT} en commentaire. » ; LinkedIn ne dit jamais d'appel à commenter.
 */

const VALIDATION = Object.freeze({ par: "will" as const, le: "2026-10-11", source: "dictée de Will et vidéo de référence v10" });
/** `par` ne connaît que « will » (`types.ts`) : la source dit que la phrase est proposée par l'Usine sur délégation. */
export const VALIDATION_USINE = Object.freeze({ par: "will" as const, le: "2026-10-12", source: "proposée par l'Usine sur délégation de Will, 12/10/2026" });
/** Fin validée par Will lui-même le 12/10/2026, reprise de l'Usine sous son code. */
export const VALIDATION_WILL_ABONNEMENT = Object.freeze({ par: "will" as const, le: "2026-10-12", source: "validée par Will le 12/10/2026 (code de l'Usine fin-ig-mot-abonnement)" });
/** « Réservez votre diagnostic gratuit. » : OUI de Will le 12/10/2026, vers la page d'appel. */
export const VALIDATION_WILL_RESERVEZ = Object.freeze({ par: "will" as const, le: "2026-10-12", source: "« Réservez votre diagnostic gratuit » gardée, vers la page d'appel : OUI de Will le 12/10/2026 (base 7, fin-ig-rdv-seul et fin-fb-rdv-seul)" });
/** Fin de secours de Facebook : texte validé par Will le 15/10/2026 (décision « A », vidéo v-dd3049053f88). */
export const VALIDATION_WILL_SECOURS = Object.freeze({ par: "will" as const, le: "2026-10-15", source: "fin de secours de Facebook validée par Will le 15/10/2026 (décision « A », v-dd3049053f88)" });
/** 2ᵉ fin de secours de Facebook : texte validé par Will le 15/10/2026 (« OK fais ce qui est nécessaire », v-dd3049053f88). */
export const VALIDATION_WILL_SECOURS_2 = Object.freeze({ par: "will" as const, le: "2026-10-15", source: "2e fin de secours de Facebook validée par Will le 15/10/2026 (« OK fais ce qui est nécessaire », v-dd3049053f88)" });
/** Motif d'une ligne désactivée le 12/10/2026. */
/** Fin de secours d'Instagram et de YouTube Shorts : variante B validée par Will le 19/10/2026 (vidéo v-6a3b74364711). */
export const VALIDATION_WILL_SECOURS_IG = Object.freeze({ par: "will" as const, le: "2026-10-19", source: "fin de secours d'Instagram et de YouTube Shorts : variante B validée par Will le 19/10/2026 (v-6a3b74364711), avec la relecture de la seule fin" });
/** Fin de secours de Shorts « … en haut de ma chaîne » : variante de la phrase validée le 19/10 (« profil » → « chaîne »), PAS encore validée. */
export const VALIDATION_SECOURS_CHAINE_IV = Object.freeze({ par: "proposition" as const, le: "2026-10-26", source: "proposée le 26/10/2026, à valider par Will (variante « chaîne » de la phrase de secours validée le 19/10/2026)" });

/** Fins de secours `fin-iv-…` communes (commentaire, sous la vidéo, profil) : phrases dites validées le 15/10 et le 19/10, écrans neutres NOUVEAUX, à valider par Will. */
export const VALIDATION_SECOURS_NEUTRE_IV = Object.freeze({ par: "proposition" as const, le: "2026-10-26", source: "proposée le 26/10/2026, à valider par Will : phrase dite déjà validée (15/10 ou 19/10), écran neutre nouveau, aussi lu par LinkedIn et TikTok" });

export const MOTIF_REMPLACEE = "remplacée le 12/10/2026";
/** Motif des deux lignes « Réservez… » qui restent désactivées. */
export const MOTIF_RESERVEZ_NON_REPRIS = "non réactivée le 14/10/2026 : seconde demande (« Ou réservez… ») ou phrase dite dans une vidéo LinkedIn";

/**
 * Ligne de la table : une ligne désactivée garde son `motif`. `secours` : fin DE SECOURS, jamais choisie d'office ; un
 * format ne la lit que par son identifiant, quand la voix de la fin habituelle de ce réseau a été refusée.
 */
export type FinDiagnostic = FinTable & { motif?: string; secours?: true };

type Ligne = Omit<FinTable, "validation"> & { proposee?: true; abonnement?: true; reservez?: true; secours?: true; secours2?: true; secoursIg?: true; motif?: string };

const LIGNES: readonly Ligne[] = [
  { id: "fin-if-mot", groupe: "instagram-facebook", type: "commentaire", dit: "Écrivez {MOT} en commentaire.", ecran: "Écrivez {MOT} en commentaire", validee: true },
  { id: "fin-if-cadeau-automatisation", groupe: "instagram-facebook", type: "cadeau", dit: "On vous envoie toute la structure de cette automatisation.", ecran: "Toute la structure de cette automatisation", validee: true },
  { id: "fin-if-cadeau-integration", groupe: "instagram-facebook", type: "cadeau", dit: "On vous envoie tout le schéma de cette intégration.", ecran: "Tout le schéma de cette intégration", validee: false },
  { id: "fin-if-cadeau-formation", groupe: "instagram-facebook", type: "cadeau", dit: "On vous envoie le programme complet de cette formation.", ecran: "Le programme complet de cette formation", validee: false },
  { id: "fin-if-cadeau-audit", groupe: "instagram-facebook", type: "cadeau", dit: "On vous envoie un exemple complet de plan d'audit.", ecran: "Un exemple de plan d'audit", validee: false },
  { id: "fin-if-cadeau-suite", groupe: "instagram-facebook", type: "cadeau", dit: "À mettre en place chez vous.", ecran: "À mettre en place chez vous", validee: true },
  // « Réservez votre diagnostic gratuit. » : réactivée (OUI de Will le 12/10), sauf la suite en deux demandes et LinkedIn.
  { id: "fin-if-rdv", groupe: "instagram-facebook", type: "rendez-vous", dit: "Ou réservez votre diagnostic gratuit.", ecran: "Réservez votre diagnostic gratuit", validee: false, motif: MOTIF_RESERVEZ_NON_REPRIS },
  { id: "fin-if-rdv-seul", groupe: "instagram-facebook", type: "rendez-vous", dit: "Réservez votre diagnostic gratuit.", ecran: "Réservez votre diagnostic gratuit", validee: true, reservez: true },
  { id: "fin-ty-rdv", groupe: "tiktok-youtube", type: "rendez-vous", dit: "Réservez votre diagnostic gratuit.", ecran: "Réservez votre diagnostic gratuit", validee: true, reservez: true },
  { id: "fin-li-rdv", groupe: "linkedin", type: "rendez-vous", dit: "Réservez votre diagnostic gratuit.", ecran: "Réservez votre diagnostic gratuit", validee: false, motif: MOTIF_RESERVEZ_NON_REPRIS },
  // Désactivées le 12/10/2026 (une fin ne fait plus qu'une demande ; le lien a sa phrase propre au format, plus bas).
  { id: "fin-fb-lien", groupe: "instagram-facebook", type: "lien", ...phrasesDeLaBanque("fin-fb-lien"), reseaux: ["facebook"], validee: false, motif: MOTIF_REMPLACEE },
  { id: "fin-li-lien", groupe: "linkedin", type: "lien", dit: "Le lien vous attend en premier commentaire.", ecran: "Lien en premier commentaire", validee: false, motif: MOTIF_REMPLACEE },
  { id: "fin-ig-lien", groupe: "instagram-facebook", type: "lien", ...phrasesDeLaBanque("fin-ig-lien"), reseaux: ["instagram"], validee: false, motif: MOTIF_REMPLACEE },
  { id: "fin-tt-lien", groupe: "tiktok-youtube", type: "lien", dit: "Le lien est dans la bio.", ecran: "Le lien est dans la bio", reseaux: ["tiktok"], validee: false, motif: MOTIF_REMPLACEE },
  // Proposées par l'Usine le 12/10/2026 (type « rendez-vous » : la table n'a pas de type « diagnostic »).
  { id: "fin-if-diagnostic-gratuit", groupe: "instagram-facebook", type: "rendez-vous", dit: "Faites votre diagnostic gratuit en quelques minutes.", ecran: "Faites votre diagnostic gratuit", validee: true, proposee: true },
  { id: "fin-ty-diagnostic-gratuit", groupe: "tiktok-youtube", type: "rendez-vous", dit: "Faites votre diagnostic gratuit en quelques minutes.", ecran: "Faites votre diagnostic gratuit", validee: true, proposee: true },
  { id: "fin-li-diagnostic-gratuit", groupe: "linkedin", type: "rendez-vous", dit: "Faites votre diagnostic gratuit en quelques minutes.", ecran: "Faites votre diagnostic gratuit", validee: true, proposee: true },
  { id: "fin-ig-lien-profil", groupe: "instagram-facebook", type: "lien", dit: "Le lien est dans mon profil.", ecran: "Diagnostic gratuit · lien dans le profil", reseaux: ["instagram"], validee: true, proposee: true },
  { id: "fin-tt-lien-profil", groupe: "tiktok-youtube", type: "lien", dit: "Le lien est dans mon profil.", ecran: "Diagnostic gratuit · lien dans le profil", reseaux: ["tiktok"], validee: true, proposee: true },
  { id: "fin-fb-lien-commentaire", groupe: "instagram-facebook", type: "lien", dit: "Le lien est en commentaire.", ecran: "Diagnostic gratuit · lien en commentaire", reseaux: ["facebook"], validee: true, proposee: true },
  { id: "fin-li-lien-commentaire", groupe: "linkedin", type: "lien", dit: "Le lien est en premier commentaire.", ecran: "Diagnostic gratuit · lien en commentaire", validee: true, proposee: true },
  // Fin au mot, seulement là où le mot est branché : le mot, puis l'envoi (aucun lien annoncé).
  { id: "fin-if-envoi-structure", groupe: "instagram-facebook", type: "cadeau", dit: "Je vous envoie la structure complète.", ecran: "Je vous envoie la structure complète", validee: true, proposee: true },
  // Fin au mot d'Instagram (X7, décision de Will du 12/10/2026) : l'abonnement, le mot et l'envoi, en une phrase. La
  // phrase dite est celle de la base 7 ; l'ÉCRAN du format garde « … en commentaire » (base 7 : « Abonnez-vous et
  // écrivez {MOT} ») : écart à trancher par Will, le format en dépend (texte de publication, fabrication).
  { id: "fin-ig-mot-abonnement", groupe: "instagram-facebook", type: "commentaire", dit: phrasesDeLaBanque("fin-ig-mot-abonnement").dit, ecran: "Abonnez-vous et écrivez {MOT} en commentaire", reseaux: ["instagram"], validee: true, abonnement: true },
  // Fin DE SECOURS de Facebook (15/10/2026, v-dd3049053f88) : la voix de « Le lien est en commentaire. » s'écartait de la
  // référence ; Will valide cette reformulation légère pour garder la version Facebook. Ajout pur : aucun choix ne la
  // prend d'office (choix par identifiant), le cas concret et les autres générateurs ne changent pas.
  { id: "fin-fb-lien-premier-commentaire", groupe: "instagram-facebook", type: "lien", dit: "Le lien est dans le premier commentaire.", ecran: "Diagnostic gratuit · lien en premier commentaire", reseaux: ["facebook"], validee: true, secours: true },
  // 2ᵉ fin DE SECOURS de Facebook (15/10/2026, v-dd3049053f88) : « … premier commentaire. » s'écartait aussi de la
  // référence (le mot « commentaire » semble faire monter la voix). Le lien reste publié en PREMIER COMMENTAIRE (pas de lien
  // externe dans le texte du post), juste sous la vidéo : la phrase le décrit fidèlement. Même traitement que la 1re.
  { id: "fin-fb-lien-sous-video", groupe: "instagram-facebook", type: "lien", dit: "Le lien est juste sous la vidéo.", ecran: "Diagnostic gratuit · lien juste sous la vidéo", reseaux: ["facebook"], validee: true, secours: true, secours2: true },
  // Fin DE SECOURS d'Instagram et de YouTube Shorts (19/10/2026, v-6a3b74364711) : la voix de « Le lien est dans mon profil. »
  // s'écartait de la référence après ses deux lectures. Variante B de Will, mot pour mot ; le lien reste dans le PROFIL (écran
  // identique à la fin habituelle de chaque réseau). Ni « Instagram », ni « commentaire », ni « bio » : Facebook peut la reprendre
  // en repli. Instagram et Shorts disent la même phrase : une seule lecture pour les deux. Ajout pur, à la FIN de la table.
  { id: "fin-ig-lien-profil-secours", groupe: "instagram-facebook", type: "lien", dit: "Vous trouverez le lien juste en haut de mon profil.", ecran: "Diagnostic gratuit · lien dans le profil", reseaux: ["instagram"], validee: true, secours: true, secoursIg: true },
  { id: "fin-ys-lien-profil-secours", groupe: "tiktok-youtube", type: "lien", dit: "Vous trouverez le lien juste en haut de mon profil.", ecran: "Le lien est dans mon profil", reseaux: ["youtube-shorts"], validee: true, secours: true, secoursIg: true },
];

export const TABLE_FINS_DIAGNOSTIC: readonly FinDiagnostic[] = Object.freeze(
  LIGNES.map(({ proposee, abonnement, reservez, secours2, secoursIg, ...l }) =>
    Object.freeze({ ...l, ...(l.validee ? { validation: secoursIg ? VALIDATION_WILL_SECOURS_IG : secours2 ? VALIDATION_WILL_SECOURS_2 : l.secours ? VALIDATION_WILL_SECOURS : abonnement ? VALIDATION_WILL_ABONNEMENT : reservez ? VALIDATION_WILL_RESERVEZ : proposee ? VALIDATION_USINE : VALIDATION } : {}) }) as FinDiagnostic,
  ),
);
