// Vidéos sur le site, lot S1 — PUR, importable côté client.
import type { DateIso, Id, Montant, Ratio } from "@/domaine/types";
import type { ResultatControlesSite } from "./controles";

/** Conseil du plan (section 1) : jamais une décision ; la décision est le réglage `siteGenerateurs.<formatId>`. */
export type ConseilSite = "oui" | "au-cas-par-cas" | "non";

/** Comment un format découpe ses chapitres web. Absent : un chapitre par bloc de la recette, libellé = nom du bloc. */
export interface RegleChapitresWeb {
  /** Blocs jamais montrés comme chapitre : ils sont rattachés au chapitre précédent (ex. avocat « boucle »). */
  rattaches?: string[];
  /** Libellé par bloc (absent : `BlocRecette.nom`). Un bloc répétable est numéroté : « Étape 1 », « Étape 2 »… */
  libelles?: Record<string, string>;
}

export interface ChapitreWeb {
  /** Secondes, arrondies au dixième. Le premier vaut 0. Deux chapitres n'ont jamais le même début. */
  debutSec: number;
  finSec: number;
  libelle: string;
  /** Bloc de recette d'origine (traçabilité, jamais envoyé au site). */
  blocRecette: string;
}

/** Origine d'un champ : écrit par le studio (essai, gratuit), par Claude, ou retouché par Will (sa retouche gagne). */
export type OrigineChampWeb = "essai" | "claude" | "will";

export interface PasseportWeb {
  /** Monte de 1 à chaque changement envoyable (texte, chapitres, version choisie). Sert au rejeu sans doublon. */
  version: number;
  /** 60 caractères au plus, sans code interne (« 0005-FC-TT-L · »), sans « | Axion IA ». */
  titreWeb: string;
  /** 2-3 phrases, 160 à 300 caractères conseillés. */
  resume: string;
  /** Texte validé complet (jamais une écoute). */
  transcription: string;
  /** Vide si la vidéo dure moins de 30 s ou si moins de 2 chapitres (correction A4 n° 4). */
  chapitres: ChapitreWeb[];
  /** 3 points « À retenir » (correction A4 n° 9). Vide dans l'essai : la publication est alors bloquée (S2). */
  aRetenir: string[];
  /** 2 ou 3 questions-réponses visibles (correction A4 n° 9). Vide dans l'essai. */
  questions: { question: string; reponse: string }[];
  /** Thème du site (proposé, validé par Will). Vide dans l'essai. */
  rubrique: string;
  motsCles: string[];
  /** Repris du kit (`KitPublication.credits`). */
  credits: string[];
  /** Lien conseillé vers une page service ou formation (adresse relative du site), facultatif. */
  lienService?: string;
  /** Sortie à publier : par défaut celle du ratio maître (`video.ratios[0]`), sans réseau, la plus grande. */
  sortieId?: Id;
  ratio: Ratio;
  /** La vidéo montre-t-elle un double ou une voix générée ? (mention IA affichée par le site, correction A4 n° 2.) */
  contenuGenere: boolean;
  origines: Partial<Record<"titreWeb" | "resume" | "aRetenir" | "questions" | "rubrique" | "motsCles" | "chapitres", OrigineChampWeb>>;
  modifieLe: DateIso;
}

/** État de la vidéo sur le site (posé par S3/S4 ; absent = jamais publiée). */
export interface EtatSite {
  /** Case « Sur le site » de la fiche (décochée par défaut). */
  choisie: boolean;
  etat: "hors-ligne" | "envoi-en-cours" | "en-ligne" | "retrait-en-cours" | "retiree" | "echec";
  /** Version du passeport réellement en ligne. */
  versionEnLigne?: number;
  /** Adresse de la page rendue par le site (`/fr/videos/<slug>`). */
  url?: string;
  /** Clés publiques déposées et pas encore effacées (toutes versions confondues). */
  fichiersPublics: string[];
  /** Case de la feuille « Aucun client nommé, aucun logo » (cochée par Will après vérification). */
  aucunClient?: boolean;
  /** Retirée parce que son générateur a été éteint : à republier quand il est rallumé. */
  retireeParGenerateur?: boolean;
  derniereErreur?: string;
  modifieLe: DateIso;
}

/** Une ligne de Réglages → Sur le site : un générateur, son conseil, ses deux interrupteurs (éteints par défaut). */
export interface LigneReglageSite {
  formatId: string;
  nom: string;
  conseil: ConseilSite;
  /** `siteGenerateurs.<formatId>` : ses vidéos peuvent aller sur le site. */
  generateur: boolean;
  /** `siteAuto.<formatId>` : publication automatique après les finitions (grisé tant que le générateur est éteint). */
  auto: boolean;
}

/** Ce que montre la feuille de relecture « Sur le site » d'une vidéo (lue à l'ouverture de la feuille). */
export interface VueFeuilleSurLeSite {
  videoId: Id;
  passeport: PasseportWeb;
  controles: ResultatControlesSite;
  /** Case « Aucun client nommé, aucun logo » cochée. */
  aucunClient: boolean;
  /** Prix de « Réécrire avec Claude », dit avant le geste ; `null` : le geste n'est pas proposé (réglage éteint). */
  prixClaude: Montant | null;
  /** Envoi vers le site factice (pastille « Essai »). */
  simulation: boolean;
  enLigne: boolean;
}
