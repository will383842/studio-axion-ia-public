/**
 * FORMAT FACE CAMÉRA — données et états (plan facecam v4, lot A « Fondations »). PUR : importable côté client et serveur.
 *
 * `Video.entrees.facecam` ne garde que des CLÉS : les données lourdes (points du visage, masques, transcription au mot,
 * piste de cadrage) vont sur R2 en json.gz. La table `documents` est chargée en entier en mémoire au démarrage, dans un
 * conteneur limité à 1 Go : rien de volumineux ne doit entrer dans un document Video.
 */
import type { DateIso } from "./types";

/** Une coupe proposée par le studio (début et fin à jeter, reprise, silence, consigne « Monteur, … »). */
export interface CoupeFacecam {
  id: string;
  type: "debut" | "fin" | "reprise" | "silence" | "hesitation" | "consigne";
  /** Bornes dans la prise d'origine (s). La prise d'origine n'est jamais modifiée. */
  debutSec: number;
  finSec: number;
  /** Phrase lisible pour Will : « Phrase reprise : “Je vous explique…” ». */
  libelle?: string;
}

/** Réglage d'image en 3 crans (pas de curseur de 0 à 100, v4 n° 17). */
export type CranImage = "moins" | "juste" | "plus";

export interface ImageFacecam {
  lumiere: CranImage;
  couleurs: CranImage;
  mine: CranImage;
  dents: CranImage;
}

/** Passage habillé (écran partagé, carte, B-roll, zoom…) posé sur la vidéo montée. */
export interface PassageFacecam {
  id: string;
  type: "ecran-partage" | "carte" | "broll" | "zoom" | "titre" | "generique" | "autre";
  debutSec: number;
  finSec: number;
  /** Modèle de carte, ou « sur-mesure » (HTML écrit par Claude, stocké sur R2). */
  modele?: string;
  /** Contenu lourd (HTML, image…) sur R2. */
  contenuCle?: string;
  texte?: string;
}

/** Consigne donnée au monteur, dite (« Monteur, … ») ou écrite. */
export interface ConsigneFacecam {
  id: string;
  origine: "voix" | "ecrite";
  texte: string;
  /** Instant dans la prise d'origine, pour une consigne dite. */
  dansPriseSec?: number;
  etat: "comprise" | "appliquee" | "non-comprise" | "annulee";
  le?: DateIso;
}

export interface EntreesFacecam {
  /** Piste de cadrage et points du visage (json.gz sur R2). */
  pisteVisageCle?: string;
  /** Transcription horodatée au mot (json.gz sur R2). */
  transcriptionCle?: string;
  /** Masques (peau, dents, segmentation à la demande) (json.gz sur R2). */
  masquesCle?: string;
  coupes: { auto: CoupeFacecam[]; retablies: string[] };
  image: ImageFacecam;
  passages: PassageFacecam[];
  consignes: ConsigneFacecam[];
  /**
   * Vérif V1 (10/10) : cartes automatiques posées par l'habillage de la version (d'après les mots dits). Rangées pour
   * que le monteur du chat les voie (« enlève la carte sur les relances ») ; absentes : aucune connue.
   */
  cartesAuto?: CarteAutoFacecam[];
}

/** Carte automatique posée par l'habillage (temps de la vidéo montée). L'identifiant `auto-…` est tiré du contenu. */
export interface CarteAutoFacecam {
  id: string;
  debutSec: number;
  finSec: number;
  modele: string;
  texte: string;
}

export const IMAGE_FACECAM_PAR_DEFAUT: ImageFacecam = { lumiere: "juste", couleurs: "juste", mine: "juste", dents: "juste" };

export function entreesFacecamVides(): EntreesFacecam {
  return { coupes: { auto: [], retablies: [] }, image: { ...IMAGE_FACECAM_PAR_DEFAUT }, passages: [], consignes: [] };
}

const estCle = (v: unknown): v is string => typeof v === "string" && v.length > 0 && v.length <= 400;
const CRANS: CranImage[] = ["moins", "juste", "plus"];
const cran = (v: unknown): CranImage => (CRANS.includes(v as CranImage) ? (v as CranImage) : "juste");

/**
 * Lit `entrees.facecam` d'une vidéo (ou d'une commande) sans jamais lever : un champ absent ou mal formé prend sa valeur
 * par défaut. Une clé R2 trop longue (contenu lourd glissé par erreur) est écartée.
 */
export function lireEntreesFacecam(entrees: Record<string, unknown> | null | undefined): EntreesFacecam {
  const brut = (entrees?.facecam ?? {}) as Partial<Record<keyof EntreesFacecam, unknown>>;
  const vide = entreesFacecamVides();
  const coupes = (brut.coupes ?? {}) as { auto?: unknown; retablies?: unknown };
  const image = (brut.image ?? {}) as Partial<Record<keyof ImageFacecam, unknown>>;
  return {
    ...(estCle(brut.pisteVisageCle) ? { pisteVisageCle: brut.pisteVisageCle } : {}),
    ...(estCle(brut.transcriptionCle) ? { transcriptionCle: brut.transcriptionCle } : {}),
    ...(estCle(brut.masquesCle) ? { masquesCle: brut.masquesCle } : {}),
    coupes: {
      auto: Array.isArray(coupes.auto) ? (coupes.auto as CoupeFacecam[]) : vide.coupes.auto,
      retablies: Array.isArray(coupes.retablies) ? (coupes.retablies as unknown[]).filter((x): x is string => typeof x === "string") : vide.coupes.retablies,
    },
    image: { lumiere: cran(image.lumiere), couleurs: cran(image.couleurs), mine: cran(image.mine), dents: cran(image.dents) },
    passages: Array.isArray(brut.passages) ? (brut.passages as PassageFacecam[]) : vide.passages,
    consignes: Array.isArray(brut.consignes) ? (brut.consignes as ConsigneFacecam[]) : vide.consignes,
    ...(Array.isArray(brut.cartesAuto) ? { cartesAuto: (brut.cartesAuto as CarteAutoFacecam[]).filter((c) => typeof c?.id === "string" && Number.isFinite(c.debutSec) && Number.isFinite(c.finSec)) } : {}),
  };
}

/* ------------------------------------------------------------------ */
/* États d'une vidéo face caméra (v4 n° 25)                            */
/* ------------------------------------------------------------------ */

export enum EtatFacecam {
  EnvoiEnCours = "envoi-en-cours",
  EnvoiCoupe = "envoi-coupe",
  FichierReduitIos = "fichier-reduit-ios",
  HdrOuLog = "hdr-ou-log",
  Montage = "montage",
  TexteNonRetrouve = "texte-non-retrouve",
  VisageIntrouvable = "visage-introuvable",
  PlafondAtteint = "plafond-atteint",
  EffetRate = "effet-rate",
  ConsigneNonComprise = "consigne-non-comprise",
  Prete = "prete",
  Publiee = "publiee",
}

/** Les 4 étapes parlantes du montage (« Montage en 4 étapes »), dans l'ordre. */
export const ETAPES_MONTAGE_FACECAM = ["Le son", "Les coupes", "L'image", "Les sous-titres et cartes"] as const;

export interface LibelleEtatFacecam {
  /** Ce que Will lit, en mots simples. */
  libelle: string;
  /** Le geste suivant proposé (absent : rien à faire). */
  geste?: string;
  ton: "attente" | "pret" | "orange";
}

export const LIBELLES_ETAT_FACECAM: Record<EtatFacecam, LibelleEtatFacecam> = {
  [EtatFacecam.EnvoiEnCours]: { libelle: "Envoi en cours. Gardez l'écran allumé.", ton: "attente" },
  [EtatFacecam.EnvoiCoupe]: { libelle: "Envoi en pause.", geste: "Reprendre", ton: "orange" },
  [EtatFacecam.FichierReduitIos]: { libelle: "Votre iPhone a réduit la vidéo : renvoyez-la depuis l'app Fichiers.", geste: "Renvoyer", ton: "orange" },
  [EtatFacecam.HdrOuLog]: { libelle: "Vidéo filmée en HDR ou en Log : le studio la convertit, l'image peut changer un peu.", ton: "attente" },
  [EtatFacecam.Montage]: { libelle: "Montage en cours. Vous pouvez fermer.", ton: "attente" },
  [EtatFacecam.TexteNonRetrouve]: { libelle: "Le texte n'a pas été retrouvé dans la vidéo : elle est montée comme une vidéo libre.", ton: "orange" },
  [EtatFacecam.VisageIntrouvable]: { libelle: "Visage introuvable ou image trop sombre.", geste: "Renvoyer une autre prise", ton: "orange" },
  [EtatFacecam.PlafondAtteint]: { libelle: "Plafond du mois atteint : la vidéo sort en version simple.", geste: "Relever le plafond", ton: "orange" },
  [EtatFacecam.EffetRate]: { libelle: "Effet non réussi : la vidéo est livrée sans lui.", geste: "Réessayer", ton: "orange" },
  [EtatFacecam.ConsigneNonComprise]: { libelle: "Une consigne n'a pas été comprise.", geste: "Reformuler", ton: "orange" },
  [EtatFacecam.Prete]: { libelle: "Votre vidéo est prête.", geste: "Regarder", ton: "pret" },
  [EtatFacecam.Publiee]: { libelle: "Publiée.", ton: "pret" },
};

/** Libellé de l'état « montage », avec l'étape parlante en cours (« Montage · L'image (3 sur 4) »). */
export function libelleMontageFacecam(indexEtape: number): string {
  const i = Math.min(Math.max(0, Math.floor(indexEtape)), ETAPES_MONTAGE_FACECAM.length - 1);
  return `Montage · ${ETAPES_MONTAGE_FACECAM[i]} (${i + 1} sur ${ETAPES_MONTAGE_FACECAM.length})`;
}

/** Mention montrée quand le plafond du mois est atteint (la vidéo sort quand même, en version simple). */
export const MENTION_PLAFOND_FACECAM = "Plafond du mois atteint — relever ?";
