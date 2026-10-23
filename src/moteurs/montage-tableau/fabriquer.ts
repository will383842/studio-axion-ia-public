/**
 * CHAÎNE DE FABRICATION DE LA PLUS PETITE PREMIÈRE VERSION DU TABLEAU ANIMÉ (tâche TB-06a, plan
 * `02-FORMAT-TABLEAU-ANIME.md` § 4, § 11, § 14). De la fiche de scènes à la vidéo, en ASSEMBLANT l'existant, sans rien
 * réécrire :
 *
 *   1. fiche         `validerFicheTableau` (refus = arrêt avec les raisons, avant tout appel) ;
 *   2. script        contrôles d'avant la voix : `controlerVideoTableau` sans mesures (fiche, variété, déjà-vu, mise en
 *                    page, première image) ; un bloquant = arrêt ;
 *   3. voix          brique `voix-maitre` pour la lecture payée, puis la RECETTE de la voix du tableau
 *                    (`voix-tableau.ts`, paramètres dans `recette-voix.ts` : vitesse 1,1, blancs resserrés, filtres,
 *                    mots recalés) ; texte = les `texteDit` mis bout à bout ; le budget est vérifié et réservé JUSTE
 *                    AVANT la lecture payante (`avantLecture`) ; sans horodatage des mots, la voix brute (journal) ;
 *   4. calage        `calerFicheTableau` ;
 *   5. mise en page  `mettreEnPage` ;
 *   6. fin           styles « blocs/2 » et « reference/1 » : AUCUNE scène ajoutée (« reference/1 » : la dernière page
 *                    écrit l'appel de la fiche, ou la phrase de la fin et « axion-ia.com » pour TikTok et Shorts) ;
 *                    « blocs/2 » : l'écran d'appel de la dernière scène en tient lieu (mot
 *                    saisi à la création ou « Appel de diagnostic », selon la fin retenue pour la sortie : option `appel`
 *                    de `mettreEnPage`), tenu 2,5 s après le dernier mot puis 0,4 s de fondu (calage). Sinon :
 *                    une scène simple tirée de la phrase À L'ÉCRAN de la fin choisie par `fiche.appelId` (`choisirFin`,
 *                    injecté par les services, demandé POUR CHAQUE SORTIE : le groupe de réseaux de la sortie ; seule
 *                    une fin validée par Will est rendue ; sinon AUCUN écran de fin, et le compte rendu le dit) ; à
 *                    défaut de `choisirFin`, l'ancienne phrase `fin` (lanceur, tests).
 *                    Jamais écrite ici. Affichée seulement (non dite : la voix reste le script validé, règle 2) pendant
 *                    `DUREE_FIN_MS`. Préparée avant le rendu : elle est rendue avec les scènes ;
 *   7. scènes        une composition `TableauScene` par scène (`proprietesScenes`), rendues une à une par
 *                    `rendu-cartes.ts` avec `bloquant` et `parEmpreinte` : seules les scènes changées sont rendues ;
 *   8. composition   composition `complet` existante (`avancerCompositions`) : scènes posées comme plans, voix à
 *                    −14 LUFS, sous-titres « Encre » dans la bande réservée, export 9:16, mesures du fichier ; en
 *                    « blocs/2 » : sous-titres dessinés par les scènes (ceux de la composition coupés), bruitages du plan
 *                    des scènes (`bruitagesVideoV2`) mixés sous la voix, scènes et export à 30 i/s ; en « reference/1 » et
 *                    « reference/2 » : aucun sous-titre (le texte écrit de la page les remplace, comme les maquettes) ;
 *                    en « reference/3 » et les trois fonds : sous-titres au design central (style « Avocat » par
 *                    défaut, couleurs de la marque, sans pastille) dans la bande basse que la mise en page réserve,
 *                    sur une bande sombre de fond quand le fond est clair ;
 *   9. contrôles     `controlerVideoTableau` avec les mesures du fichier exporté, puis un compte rendu (coût, durée
 *                    de chaque étape, scènes rendues ou reprises, clés des fichiers).
 *
 * Formats de sortie (`sorties`, défaut `["vertical"]`) : les étapes 1 à 4 sont faites UNE fois ; 5 à 9 le sont pour
 * chaque sortie (`formats-sortie.ts`), le vertical gardant la forme de journal et les clés d'avant.
 *
 * Fin propre au vertical de TikTok et Shorts (`vertical-liens`, décision du 12/10/2026, `variantes-fin.ts`) : jamais la
 * fin au mot ; sa fin validée sans promesse d'envoi, ou aucun appel (écran du site, alerte au rapport). Quand sa fin
 * diffère de celle des autres sorties, la voix est faite par LECTURES : le corps (tout sauf l'appel final) lu UNE fois,
 * chaque phrase de fin à part, puis raccordée au corps avant le traitement final commun (`planRaccordVoix`) ; chaque
 * variante a son calage, la dernière scène et la composition propres ; les autres scènes sont reprises du vertical.
 * Repli (appel pas à la fin de la dernière scène) : une voix complète par variante, surcoût compris dans l'estimation.
 * Toutes les sorties disant la même fin : la voix unique d'avant, inchangée.
 *
 * Chaque étape porte une EMPREINTE de ses entrées : une étape déjà réussie avec la même empreinte est reprise telle
 * quelle (journal injecté), y compris après une panne ; la voix, les scènes et la composition gardent aussi leur état
 * en cours (une voix payée n'est jamais relue).
 *
 * Vérification préalable (lue dans `studio-rendu/src/operations/composition.ts` et `src/briques/composition`) : une
 * composition `complet` SANS double n'est PAS acceptée telle quelle. `doubles.principal` est obligatoire ; sans piste,
 * `sourceDuDouble` pose une silhouette dessinée, ce qui coupe le chemin rapide FFmpeg (`imageParFfmpeg`) et dessine
 * la silhouette partout où aucun plan ne la couvre. Le décor, lui, peut être une simple teinte (sans image). D'où :
 *  - le décor est une page fixe de la couleur de la charte (`COULEURS_VIDEO.page`), sans image ;
 *  - les scènes couvrent TOUTE la durée (plans d'illustration bout à bout) : aucun morceau « double » n'est monté ;
 *  - la piste du double désigne le fichier de la première scène (lu par le conteneur, jamais monté), pour garder le
 *    chemin FFmpeg ;
 *  - les scènes passent par les plans d'illustration, PAS par `cartesPleinEcran` : `parametresComposition` retire les
 *    sous-titres pendant une carte plein écran (`masquerPendantCartesPleinEcran`), il n'en resterait aucun. Le plan
 *    obtenu est celui de `pose.ts` (illustration vidéo, coupe franche), sans son drapeau `sansLook` (aucune LUT ici).
 *
 * Traçabilité (`tracer`, injecté : `ajouterEvenement` du service de traçabilité) : la chaîne écrit elle-même la version
 * du code, la voix et sa recette, l'heure de début de chaque étape, chaque fichier (format, empreinte), le verdict des
 * contrôles et le lien vers la trace du script généré. Jamais de montant (le coût reste celui du journal). Une trace
 * qui ne s'écrit pas n'arrête jamais la fabrication.
 *
 * Tout ce qui touche l'extérieur est INJECTÉ (voix, stockage, rendu, signature, journal, budget, préparation des
 * propriétés des scènes, qui vit dans `studio-rendu`) : ce fichier
 * n'importe aucun fournisseur réel et se teste avec des doubles.
 */
import { ALERTE_FIN_NON_PROPRE, controleFinDesMesures, FIN_PROPRE_COMMUNE } from "@/briques/composition/fin-propre";
import { createHash } from "node:crypto";
import type { OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { lecturesVoixMax } from "@/briques/voix-maitre/reference";
import { avancerCartesMotion, cartesMotionFinies, etatInitialCartesMotion, type EtatCartesMotion, type OutilsRenduCartes } from "@/briques/motion/rendu-cartes";
import type { CarteFormat } from "@/briques/motion/pourFormat";
import { avancerCompositions, demandeComposition, montageFini, type BaseComposition, type EtatComposition, type EtatMontage, type OutilsMontage } from "@/briques/composition/montage";
import { ErreurRendu } from "@/fournisseurs/rendu/client";
import type { RecetteComposition } from "@/briques/composition/recette";
import { GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT } from "@/briques/composition/recette";
import { REDUCTION_LARGE_PAR_DEFAUT } from "@/briques/composition/scene";
import { parametresComposition, type EntreeComposition } from "@/briques/composition/parametres";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { COULEURS_VIDEO } from "@/briques/habillage/charte-video";
import { STYLE_SOUS_TITRES_MINIMAL } from "@/donnees/elements-avocat";
import { substituerPrononciations } from "@/domaine/prononciations";
import type { AlerteQualite, CommandeFabrication, IntensiteSousTitres, MediaCommande, SegmentSousTitres, StyleResolu, ValeurDecor, ValeurProfilSon, ValeurStyleSousTitres } from "@/domaine/types";
import { bandeDe, bandeDuCalque, bornerDansLaBande, groupesTableau, sousTitresDynamiquesTableau, sousTitresTableau, supplementsSousTitresTableau, zoneTexteTableau, type BandeSousTitres, type SousTitresTableau } from "./sous-titres-tableau";
import { calerFicheTableau, type ElementCale } from "./calage";
import { controlerVideoTableau, type CaseDejaVu, type OutilsControleTableau, type RapportControleTableau } from "./controles";
import { FORMAT_TABLEAU, avecStyleTableau, validerFicheTableau, type FicheTableau, type SceneTableau } from "./fiche";
import { ErreurMiseEnPage, mettreEnPage, reseauxVerticaux, type MiseEnPageTableau } from "./mise-en-page";
import { controlerSortie, type ControleSortie } from "./controles-sortie";
import { descriptionSortie, formatImage, lireSorties, sansAppelAuMot, VERTICAL_LIENS, type IdSortie } from "./formats-sortie";
import { estimerVoixSorties, planVoixSorties, texteDitDe, texteLu, type LectureVoix, type PlanVoixSorties, type VarianteVoix } from "./variantes-fin";
import type { AudioBrut } from "@/briques/voix-maitre/types";
import { listerReseaux } from "@/reseaux";
import type { IdReseau, MotHorodate, Ratio } from "@/domaine/types";
import type { ContexteTableau } from "./regles";
import type { LeveeVariete, ResumeVisuel } from "@/briques/variete";
import type { NouvelEvenementTrace } from "@/domaine/tracabilite-tableau";
import { RECETTE_VOIX_TABLEAU, reglagesRecette } from "./recette-voix";
import { appelEnFinDeFiche, estPageEcrite, estStyleBlocs2, estStyleReference2, estStyleReference3 } from "./fiche";
import { problemesAnimation3 } from "./controles-v3";
import { pagesDuStyle } from "./densite";

export { pagesDuStyle } from "./densite";
import { controlerAnimationTableau } from "./controles-tableau";
import { tempsReference3 } from "./temps-reference-3";
import type { AppelFinV2 } from "./mise-en-page";
import { RECETTE_STYLE_BLOCS_2, bruitagesVideoV2 } from "@/briques/tableau-scene/v2/recette";
import type { ProprietesTableauScene } from "@/briques/tableau-scene/types";
import type { BruitagePlace } from "@/briques/intensite/types";
import { finDeLaSortie, preuvesDeLaFiche, relireFicheTableau, sortiesRelues, type FinRetenue } from "./relecture";
import { avancerLectureBrute, avancerRecetteVariante, avancerVoixTableau, lectureFaite, type AudioVoixTableau, type EtatLectureBrute, type EtatRecetteVariante, type EtatVoixTableau } from "./voix-tableau";

export { FIN_SANS_APPEL_LIENS } from "./variantes-fin";

/** Version de la chaîne (entre dans chaque empreinte : une chaîne changée refait tout). */
export const VERSION_FABRICATION = "fabrication-tableau/1";

/** Étapes, dans l'ordre d'exécution. */
export const ETAPES_FABRICATION = ["fiche", "script", "voix", "calage", "mise-en-page", "fin", "scenes", "composition", "controles"] as const;
export type EtapeFabrication = (typeof ETAPES_FABRICATION)[number];

/**
 * Étapes gratuites et pures, toujours refaites avec le code courant (vidéo v-6616b3800357 : « Relancer » reprenait la
 * mise en page gardée par le code d'avant le correctif, et la scène d'appel n'avait toujours pas d'heure).
 */
export const ETAPES_RECALCULEES: ReadonlySet<EtapeFabrication> = new Set(["fiche", "script", "calage", "mise-en-page", "fin"]);

/** Durée de la scène de fin (plan § 11 : 3 à 4 s). */
export const DUREE_FIN_MS = 3_500;

/** Identifiant de la composition d'une scène (`COMPOSITIONS_TABLEAU.scene`, non importé : il tire Remotion). */
export const COMPOSITION_SCENE = "TableauScene";

/**
 * Qualité d'encodage des scènes (`parametres.crf` de l'opération `composition` sans mode). Posé, il fait aussi sortir
 * la scène en BT.709 plage TV, comme la composition `complet` la lit : sans lui, Remotion écrit du `yuvj420p` plage
 * pleine et la page ivoire ressortait délavée (mesuré le 11/10 : #E9DCC8 → 253, 236, 213). Quasi sans perte.
 */
export const CRF_SCENE = 12;

/** Cadence des scènes et de l'export du style « blocs/2 » (celle de la vidéo modèle) ; l'ancien style reste à 25. */
export const FPS_BLOCS_2 = 30;

/** Identifiant de la scène de fin (hors fiche). */
export const ID_SCENE_FIN = "fin";

/** Tours de boucle au plus par étape suivie (voix, scènes, composition) avant d'abandonner. */
export const TOURS_MAX = 2_000;

/**
 * Séries d'essais de la composition quand `studio-rendu` répond `fichier-inaccessible` (essai réel après la PR #76 :
 * 404 sur une entrée absente du stockage, resoumise sans fin). Une série (3 essais, adresses resignées à chaque essai),
 * puis arrêt clair, avec l'entrée en cause au journal et à la traçabilité. Les autres échecs passagers gardent la règle
 * commune (`SERIES_COMPOSITION`).
 */
export const SERIES_FICHIER_INACCESSIBLE_TABLEAU = 1;

/** Alerte gardée au journal (et tracée) : le nom de l'entrée et sa clé, jamais l'adresse signée. */
export interface AlerteJournal {
  etape: EtapeFabrication;
  sortie?: IdSortie;
  code: "bruitage-introuvable" | "entree-introuvable" | "composition-arretee" | "fin-sans-appel" | "sortie-manquante" | "fin-non-propre" | "sous-titres-repli";
  message: string;
  entree?: string;
  cle?: string;
  le: string;
}

/** Un plan produit pour la composition (même type que `BaseComposition.plans`). */
type PlanProduit = BaseComposition["plans"][number];

/** Phrase testée et date du test d'une bulle de preuve (même forme que `ContenuPreuve` de `studio-rendu`). */
export interface ContenuPreuve {
  phrase: string;
  testeLe: string;
}

/** Ce que la chaîne lit des propriétés d'une `TableauScene` (le reste passe tel quel au rendu). */
export interface ProprietesScene {
  scene: { id: string; debutMs: number; finMs: number };
}

/**
 * Préparation des scènes INJECTÉE : `proprietesScenes` et `controlerProprietes` de
 * `studio-rendu/compositions/tableau/proprietes.ts` (le moteur n'importe rien hors de `src/`, test d'isolement TB-01).
 */
export interface PreparationScenes<P extends ProprietesScene = ProprietesScene> {
  proprietesScenes(entree: { miseEnPage: MiseEnPageTableau; scenes: readonly SceneTableau[]; heures: readonly ElementCale[]; stylo: string; preuves?: Record<string, ContenuPreuve>; mots?: readonly { mot: string; debutSec: number; finSec: number }[]; fps?: number }): P[];
  controlerProprietes(p: P): string[];
}

/** Arrêt de la chaîne : l'étape et ses raisons, en français. */
export class ErreurFabrication extends Error {
  constructor(
    readonly etape: EtapeFabrication,
    readonly raisons: readonly string[],
    /**
     * Erreur imprévue (panne, attente d'un fournisseur, pause) enveloppée par une étape : jamais traitée comme le refus
     * d'une seule sortie. Absente : arrêt décidé par la chaîne (calage refusé, mise en page impossible…).
     */
    readonly imprevue = false,
  ) {
    super(`Fabrication arrêtée à l'étape « ${etape} » : ${raisons.join(" ")}`);
    this.name = "ErreurFabrication";
  }
}

/** Une étape réussie : empreinte de ses entrées, durée, sortie (JSON). */
export interface EtapeFaite {
  empreinte: string;
  dureeMs: number;
  sortie: unknown;
}

/** Ce que le journal garde d'UNE sortie : ses étapes faites et l'état en cours de ses scènes et de sa composition. */
export interface JournalSortie {
  etapes: Partial<Record<EtapeFabrication, EtapeFaite>>;
  scenes?: { empreinte: string; etat: EtatCartesMotion; rendues: string[] };
  composition?: { empreinte: string; etat: EtatComposition };
}

/** Une ligne du relevé des sorties (journal) : format, dimensions, chemin, durée, taille. */
export interface ResumeSortie {
  format: IdSortie;
  largeur: number;
  hauteur: number;
  /** Clé de stockage de la vidéo. */
  chemin: string;
  dureeSec: number;
  /** Octets du fichier exporté ; `null` : non mesuré (rendu simulé). */
  tailleOctets: number | null;
}

/** Journal gardé entre deux lancements (reprise). */
export interface JournalFabrication {
  version: typeof VERSION_FABRICATION;
  /** Étapes communes et étapes de la sortie verticale (forme d'avant). */
  etapes: Partial<Record<EtapeFabrication, EtapeFaite>>;
  /** État en cours de la voix (une voix payée n'est jamais relue). */
  voix?: { empreinte: string; etat: EtatVoixTableau };
  /** Fins propres à chaque sortie : état de chaque lecture brute (corps, phrases de fin), par empreinte ; jamais relue. */
  lectures?: Record<string, { empreinte: string; etat: EtatLectureBrute }>;
  /** Fins propres à chaque sortie : état de la recette (raccord) de chaque variante de voix, par empreinte. */
  recettes?: Record<string, { empreinte: string; etat: EtatRecetteVariante }>;
  /** État en cours du rendu des scènes, et les scènes réellement soumises au rendu. */
  scenes?: { empreinte: string; etat: EtatCartesMotion; rendues: string[] };
  composition?: { empreinte: string; etat: EtatComposition };
  /** Sorties autres que verticale, chacune avec ses étapes (mise en page → composition) et ses états en cours. */
  sorties?: Partial<Record<IdSortie, JournalSortie>>;
  /** Relevé de chaque sortie fabriquée, dans l'ordre demandé. */
  resume?: ResumeSortie[];
  /** Alertes de la fabrication (bruitage retiré, entrée introuvable, montage arrêté), sans doublon. */
  alertes?: AlerteJournal[];
}

/** Estimation de la dépense, montrée AVANT tout appel payant. */
export interface EstimationFabrication {
  caracteres: number;
  /** Centimes d'euro (voix seule : le rendu est fait par le serveur du studio). */
  centimes: number;
  /** Fins propres à chaque sortie : surcoût par rapport à une voix unique (absent : aucun). */
  surcoutCentimes?: number;
  /** Phrase lisible du surcoût, montrée avec le prix (absente : aucun). */
  phraseSurcout?: string;
  /** Une ligne par lecture payée (absente : une seule voix). */
  lectures?: { id: string; role: LectureVoix["role"]; caracteres: number; centimes: number }[];
}

/** Outils de la voix maître fournis par l'appelant ; la chaîne pose le texte, l'empreinte, les clés et le budget. */
export type OutilsVoixFabrication = Pick<OutilsVoixMaitre, "voix" | "stockage" | "aligneur" | "rendu" | "renduEstSimule" | "idVoix" | "reglages" | "tauxUsdEur" | "fournisseurVoix" | "caler" | "regles" | "erreurStockage" | "ressemblance"> & {
  /** Clé de stockage d'un fichier de la voix (`analyse.json`, `audio-maitre.wav`). */
  cle: (nom: string) => string;
};

export interface OutilsFabrication {
  videoId: string;
  /** Environnement des clés (`dev`, `prod`) : `studio/<env>/scenes/<videoId>/<empreinte>.mp4`. */
  env: string;
  /** Fiche brute (JSON lu). */
  lireFiche: () => Promise<unknown>;
  contexte: ContexteTableau;
  /** Résumés visuels des dernières vidéos du compte (variété) ; absents : aucun historique. */
  historique?: readonly ResumeVisuel[];
  dejaVu?: CaseDejaVu;
  leveeVariete?: LeveeVariete;
  /** Prononciations substituées avant la voix (même liste au calage). */
  prononciations?: readonly { mot: string; prononciation: string }[];
  /**
   * Style des sous-titres résolu par le studio (choix de la vidéo, sinon défaut du format : « Avocat », le style central),
   * lu dans la commande ; absent : le style central par défaut (ou l'Encre pour les anciens styles).
   */
  styleSousTitres?: StyleResolu<ValeurStyleSousTitres> | null;
  /**
   * Intensité du mélange des sous-titres (17/10, sous-titres dynamiques) : celle de la commande du studio (choix de la
   * vidéo, sinon profil du format) ; absente : « equilibre ».
   */
  intensiteSousTitres?: IntensiteSousTitres;
  /** Contenu des bulles de preuve, par `preuveId` (phrase testée, date du test). */
  contenusPreuves?: Readonly<Record<string, ContenuPreuve>>;
  /**
   * Formats de sortie (`formats-sortie.ts`), dans l'ordre ; défaut : `["vertical"]` (comportement d'avant). La voix et
   * le calage sont faits UNE fois pour toutes ; chaque sortie a sa mise en page, ses scènes, sa vidéo, sa vignette et
   * ses contrôles. La première sortie remplit les champs d'avant du compte rendu (`cles`, `scenes`, `controles`).
   */
  sorties?: readonly IdSortie[];
  /** Phrase de la fin commune provisoire ; absente = pas de fin. Ignorée quand `choisirFin` est fourni. */
  fin?: string;
  /**
   * Fin tirée de `fiche.appelId` (services : `finPour` de `src/briques/fins`) ; prioritaire sur `fin`. Demandée pour
   * chaque sortie (`sortie` : le format, donc le groupe de réseaux qu'il sert).
   */
  choisirFin?: (appelId: string | null, sortie: IdSortie) => FinRetenue;
  /** Écrit un événement de traçabilité (services : `ajouterEvenement`) ; absent : rien n'est tracé. */
  tracer?: (e: EvenementFabrication) => Promise<unknown>;
  /** Version du code qui fabrique (commit lu à la construction ; « inconnu » sinon). */
  versionCode?: string;
  /** Trace du script généré dont vient la vidéo (générateur de scripts du tableau). */
  traceScriptId?: string;
  journal: { lire: () => Promise<JournalFabrication | null>; ecrire: (j: JournalFabrication) => Promise<void> };
  /** Avancement lisible, au fil de l'eau (lanceur : une ligne par étape commencée, faite ou reprise). */
  avancement?: (ligne: string) => void;
  budget: {
    /** Centimes d'euro par caractère lu par la voix. */
    tarifCentimesParCaractere: number;
    /** Contrôle ET réservation, juste avant la lecture payante ; lever l'interdit (aucun appel n'est fait). */
    verifierEtReserver: (estimation: EstimationFabrication) => Promise<void>;
  };
  voix: OutilsVoixFabrication;
  /** Propriétés et contrôle de chaque `TableauScene` (fonctions de `studio-rendu`, injectées). */
  preparation: PreparationScenes;
  scenes: OutilsRenduCartes;
  /**
   * Rendu, signature des adresses, clés des sorties de la composition. `lisible` (facultatif) : l'entrée existe-t-elle
   * là où `studio-rendu` la lira ? Sert au repli des bruitages (un son introuvable est retiré, avec une alerte) et à
   * nommer l'entrée en cause d'un arrêt `fichier-inaccessible`. Absent : aucun contrôle (simulation, tests d'avant).
   */
  montage: Omit<OutilsMontage, "recette" | "seriesFichierInaccessible"> & { lisible?: (cle: string) => Promise<boolean> };
  /** Personnage qui prête sa voix (inscrit dans la distribution de la commande). */
  personnageId?: string;
  /** Relecture indicative des 6 images clés (absente : « non faite »). */
  relireImagesCles?: OutilsControleTableau["relireImagesCles"];
  /** Attente entre deux tours d'une étape suivie (tests : rien). */
  attendre?: () => Promise<void>;
  /** Horloge des durées d'étape (ms). */
  horloge?: () => number;
}

export { appelDeLaFin, finDeLaSortie, type FinRetenue } from "./relecture";

/**
 * Instants (s) où mesurer les bords noirs d'une vidéo « blocs/2 » : le milieu de trois écrans CLAIRS (ivoire, orange)
 * répartis dans la vidéo. Le fond encre est plus sombre que le noir de la vidéo : mesurés sur lui, ses bords passeraient
 * pour une bande noire. Aucun écran clair : la mesure par défaut (10, 50 et 90 %).
 */
export function instantsBordsClairs(proprietes: readonly unknown[]): number[] {
  const vus = new Map<string, number>();
  for (const p of proprietes as readonly ProprietesTableauScene[]) {
    for (const e of p.v2?.ecrans ?? []) {
      const t = p.v2!.temps[e.id];
      if (e.fond !== "encre" && t && !vus.has(e.id)) vus.set(e.id, +((t.debutMs + t.finMs) / 2000).toFixed(3));
    }
  }
  const tous = [...vus.values()].sort((a, b) => a - b);
  if (tous.length <= 3) return tous;
  return [tous[0], tous[Math.floor(tous.length / 2)], tous[tous.length - 1]];
}

/** Déclencheur de la banque commune noté pour chaque famille de bruitage du tableau (journal du mixage seulement). */
const DECLENCHEUR_FAMILLE: Readonly<Record<string, BruitagePlace["declencheur"]>> = { trait: "document", toc: "chiffre", validation: "impact" };

/**
 * Bruitages d'une vidéo « blocs/2 » à mixer sous la voix : ceux du plan des scènes (`bruitagesVideoV2`), avec le gain de
 * la recette (`RECETTE_STYLE_BLOCS_2.bruitagesPlan`), jamais à moins de `sousVoixDbMin` (18 dB) sous la voix. Aucun son
 * dans la dernière seconde, ni après la fin. Le fichier de chaque famille est un média de la commande.
 */
export function bruitagesTableau(proprietes: readonly unknown[], dureeSec: number): { places: BruitagePlace[]; medias: Record<string, MediaCommande> } {
  const plan = RECETTE_STYLE_BLOCS_2.bruitagesPlan;
  const poses = bruitagesVideoV2(proprietes as readonly ProprietesTableauScene[]).filter((b) => b.sec >= 0 && b.sec < dureeSec - 1);
  const medias: Record<string, MediaCommande> = {};
  const places = poses.map((b) => {
    const elementId = `son:tableau-${b.famille}`;
    medias[elementId] = { cle: b.cleStockage, mime: "audio/wav" };
    return { elementId, declencheur: DECLENCHEUR_FAMILLE[b.famille] ?? "impact", debutSec: b.sec, dureeSec: 0.4, gainDb: Math.min(b.gainDb, -plan.sousVoixDbMin) };
  });
  return { places, medias };
}

/** Un bruitage du tableau retiré parce que son fichier est introuvable. */
export interface BruitageManquant {
  /** Nom du son dans la commande (`son:tableau-trait`…). */
  entree: string;
  cle: string;
}

/**
 * Repli sûr des bruitages : chaque fichier est vérifié (`lisible`) ; un son introuvable est retiré (sa place et son
 * média), la vidéo se fabrique sans lui. Sans `lisible` : rien n'est retiré. Une vérification qui lève vaut « absent ».
 */
export async function retirerBruitagesIntrouvables(sons: { places: BruitagePlace[]; medias: Record<string, MediaCommande> }, lisible?: (cle: string) => Promise<boolean>): Promise<{ places: BruitagePlace[]; medias: Record<string, MediaCommande>; manquants: BruitageManquant[] }> {
  if (!lisible) return { ...sons, manquants: [] };
  const manquants: BruitageManquant[] = [];
  const medias: Record<string, MediaCommande> = {};
  for (const [entree, m] of Object.entries(sons.medias)) {
    const ok = await lisible(m.cle).catch(() => false);
    if (ok) medias[entree] = m;
    else manquants.push({ entree, cle: m.cle });
  }
  return { places: sons.places.filter((p) => !!medias[p.elementId]), medias, manquants };
}

/** Événement de traçabilité écrit par la chaîne (la vidéo est posée par la chaîne, la version par le moteur). */
export type EvenementFabrication = Omit<NouvelEvenementTrace, "origine">;

/** Libellés des étapes dans l'historique (mêmes mots que la reconstruction). */
const LIBELLES_ETAPES: Readonly<Record<EtapeFabrication, string>> = {
  fiche: "Fiche de scènes relue",
  script: "Contrôles avant la voix",
  voix: "Voix",
  calage: "Calage sur la voix",
  "mise-en-page": "Mise en page",
  fin: "Fin de la vidéo",
  scenes: "Dessin des scènes",
  composition: "Montage",
  controles: "Contrôles finaux",
};

/** Version du code lue d'une variable de construction (pièce commune, aussi lue par `/api/sante`). */
export { versionDuCode } from "@/lib/version-code";

export interface EtapeCompteRendu {
  etape: EtapeFabrication;
  statut: "faite" | "reprise";
  dureeMs: number;
  /** Sortie concernée (absente : étape commune, ou sortie verticale). */
  sortie?: IdSortie;
}

/** Une sortie fabriquée. */
export interface SortieFaite {
  format: IdSortie;
  libelle: string;
  ratio: Ratio;
  largeur: number;
  hauteur: number;
  /** Réseaux servis (libellés). */
  reseaux: string[];
  /** Fin de cette sortie. */
  fin?: FinRetenue;
  scenes: { rendues: string[]; reprises: string[] };
  cles: { scenes: Record<string, string>; video: string; master?: string; vignette: string };
  dureeSec: number;
  /** Octets du fichier exporté (absent : non mesuré). */
  tailleOctets?: number;
  controles: RapportControleTableau;
  /** Dimensions exactes et bords du fichier exporté. */
  controleFichier: ControleSortie;
  /** Alertes de la sortie (un bruitage introuvable retiré, par exemple) ; absent : aucune. */
  alertes?: AlerteQualite[];
}

/** Compte rendu d'un lancement. */
export interface CompteRenduFabrication {
  videoId: string;
  estimation: EstimationFabrication;
  /** Payé pendant CE lancement (0 si la voix est reprise). */
  coutCentimes: number;
  /** Coût de la voix de la vidéo, quel que soit le lancement qui l'a payée. */
  coutVoixCentimes: number;
  etapes: EtapeCompteRendu[];
  scenes: { rendues: string[]; reprises: string[] };
  cles: { voix: string; scenes: Record<string, string>; video: string; master?: string; vignette: string };
  dureeSec: number;
  controles: RapportControleTableau;
  /** Fin rendue (celle de la première sortie), ou la phrase qui dit pourquoi la vidéo n'en a pas ; absente : ni `choisirFin` ni `fin`. */
  fin?: FinRetenue;
  /** Ce que la recette a fait de la voix (absent : voix d'un journal d'avant la recette). */
  recetteVoix?: AudioVoixTableau["recette"];
  /** Chaque sortie, dans l'ordre demandé (la première est celle des champs ci-dessus). */
  sorties: SortieFaite[];
  /** Alertes de la première sortie (les autres : `sorties[i].alertes`) ; absent : aucune. */
  alertes?: AlerteQualite[];
  /**
   * Sorties demandées mais refusées (calage, mise en page, scènes…) alors qu'une autre est prête : la vidéo garde les
   * fichiers prêts (pas d'échec global) et le rapport dit « Il manque … ». Absent : aucune.
   */
  manquantes?: SortieManquante[];
}

/** Une sortie demandée qui n'a pas pu être fabriquée. */
export interface SortieManquante {
  format: IdSortie;
  libelle: string;
  etape: EtapeFabrication;
  raisons: string[];
}

/* ------------------------------------------------------------------ */
/* Outils purs                                                           */
/* ------------------------------------------------------------------ */

/** JSON aux clés triées (les fonctions sont ignorées) : base des empreintes. */
function stable(v: unknown): string {
  if (v === null || typeof v !== "object") return typeof v === "function" || v === undefined ? "null" : JSON.stringify(v);
  if (Array.isArray(v)) return `[${v.map(stable).join(",")}]`;
  const o = v as Record<string, unknown>;
  return `{${Object.keys(o)
    .filter((k) => o[k] !== undefined && typeof o[k] !== "function")
    .sort()
    .map((k) => `${JSON.stringify(k)}:${stable(o[k])}`)
    .join(",")}}`;
}

/** Empreinte (sha256 hexadécimal, 32 caractères) d'un ensemble d'entrées. */
export function empreinte(...parts: unknown[]): string {
  return createHash("sha256").update(stable([VERSION_FABRICATION, ...parts])).digest("hex").slice(0, 32);
}

/** Texte envoyé à la voix : les `texteDit` mis bout à bout, prononciations substituées. */
export function texteVoixTableau(fiche: Pick<FicheTableau, "scenes">, prononciations: readonly { mot: string; prononciation: string }[] = []): string {
  const texte = fiche.scenes.map((s) => s.texteDit).join(" ");
  return prononciations.length ? substituerPrononciations(texte, [...prononciations]) : texte;
}

/**
 * Estimation de la dépense (voix seule), au tarif donné. `sorties` (facultatif) : les sorties et leur fin ; quand la
 * fin du vertical de TikTok et Shorts diffère, le prix est celui des lectures (corps et phrases de fin), avec le
 * surcoût et sa phrase (repli : une voix complète par fin). Absent : une voix unique (comportement d'avant).
 * `lecturesVoixMax` (14/10, contrôle de ressemblance à la voix de référence) : chaque lecture peut être payée jusqu'à
 * ce nombre de fois ; le prix annoncé est ce MAXIMUM (absent : 1, prix d'avant).
 */
export function estimerFabrication(fiche: Pick<FicheTableau, "scenes">, tarifUnitaire: number, prononciations: readonly { mot: string; prononciation: string }[] = [], options: { sorties?: readonly { id: IdSortie; fin?: FinRetenue }[]; lecturesVoixMax?: number } = {}): EstimationFabrication {
  const tarifCentimesParCaractere = tarifUnitaire * Math.max(1, Math.floor(options.lecturesVoixMax ?? 1));
  const caracteres = texteVoixTableau(fiche, prononciations).length;
  const unique = { caracteres, centimes: Math.ceil(caracteres * tarifCentimesParCaractere - 1e-9) };
  if (!options.sorties?.length || !("formatId" in fiche)) return unique;
  const complete = fiche as FicheTableau;
  const plan = planVoixSorties(complete, options.sorties.map((x) => ({ id: x.id, fin: finDeLaSortie(x.id, x.fin, complete) })));
  if (plan.mode === "unique") return unique;
  const e = estimerVoixSorties(complete, plan, tarifCentimesParCaractere, prononciations);
  return { caracteres: e.caracteres, centimes: e.centimes, lectures: e.lectures, ...(e.surcoutCentimes ? { surcoutCentimes: e.surcoutCentimes } : {}), ...(e.phraseSurcout ? { phraseSurcout: e.phraseSurcout } : {}) };
}

/** Propriétés de la scène de fin : une page neuve, la phrase en titre, écrite dès la première image. */
export function proprietesFin<P extends ProprietesScene>(preparation: PreparationScenes<P>, fiche: FicheTableau, phrase: string, debutMs: number, format?: IdSortie): P {
  const scene = { id: ID_SCENE_FIN, role: "fin" as const, page: 1, texteDit: phrase, elements: [{ id: "fin-l1", type: "ligne" as const, texte: phrase, niveau: "titre" as const, role: "resultat" as const, ancre: 0 }] };
  const miniFiche: FicheTableau = { ...fiche, scenes: [scene] };
  const image = format ? formatImage(format) : undefined;
  const mise = mettreEnPage(miniFiche, image && image !== "vertical" ? { format: image } : {});
  const [p] = preparation.proprietesScenes({ miseEnPage: mise, scenes: [{ ...scene, debutMs, finMs: debutMs + DUREE_FIN_MS }], heures: [{ elementId: "fin-l1", sceneId: ID_SCENE_FIN, debutMs }], stylo: fiche.stylo });
  return p;
}

/**
 * Sous-titres du tableau (17/10/2026) : le design central (`sous-titres-tableau.ts`) ; « Encre » ne reste que pour les
 * anciens styles. Réexportés pour les bancs et les tests.
 */
export { STYLE_SOUS_TITRES_ENCRE, STYLE_SOUS_TITRES_TABLEAU } from "./sous-titres-tableau";

/**
 * Groupes des sous-titres du style « reference/3 » : tous au style de base, dans la bande basse (jamais d'accent qui
 * monterait sur le texte de la page), à taille constante, sans soulignement (le mot dit est déjà en orange).
 */
export function sousTitresAxion(segments: readonly SegmentSousTitres[]): SegmentSousTitres[] {
  return groupesTableau(segments, "karaoke");
}

/**
 * Profil de son du tableau (14/10/2026, souffle entendu par Will). Sans profil, la composition posait sous la voix un
 * « ton de pièce » de synthèse (bruit brun grave) à −42,5 dB, de la première à la dernière image : c'est le bruit
 * mesuré à −43/−45 dB dans les blancs et dans les 2,7 s de fin (la vidéo de référence v4 : −56/−69 dB). Ici, le ton
 * de pièce est gardé (aucune pause en silence numérique) mais à −66 dB, au niveau des blancs de la v4. Le reste est la
 * valeur par défaut de la composition (−14 LUFS, crête −1,5 dBTP, passe-haut 80 Hz, compression 3:1 au plus).
 */
export const PROFIL_SON_TABLEAU: ValeurProfilSon = Object.freeze({
  type: "profil-son" as const,
  volumeMusique: 0,
  baisseSousVoixDb: 0,
  traitementVoix: "sec" as const,
  densiteBruitages: "leger" as const,
  niveauCibleLufs: -14,
  tonPieceDb: [-66, -66] as [number, number],
});

/** Recette de composition du tableau : page de la charte, ni grain, ni vignette, ni LUT, ni fondu. */
export const RECETTE_COMPOSITION_TABLEAU: RecetteComposition = {
  id: FORMAT_TABLEAU,
  angles: { principal: "face" },
  decorRepli: { teinte: COULEURS_VIDEO.page, directionLumiere: "face", flouPx: 0, clair: true },
  nomDecorRepli: "Page de la charte",
  reductionLarge: { ...REDUCTION_LARGE_PAR_DEFAUT, "16:9": 1 },
  centreSousTitres: { "9:16": 80, "4:5": 80, "1:1": 80, "16:9": 80 },
  tailleSousTitresPx: STYLE_SOUS_TITRES_MINIMAL.taillePx ?? 60,
  incrustations: GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT,
  realisme: { grainPct: 0, grainTaillePx: 1, vignettePct: 0 },
  lutIntensiteParDefaut: 0,
  // 11/10 : export sans la bande noire du FFmpeg 8.1.1, et mesure des bords noirs du fichier exporté.
  exportBordsSurs: true,
  // 14/10 : fin propre commune (image finale tenue puis fondu image + son).
  finPropre: FIN_PROPRE_COMMUNE,
};

/** Réseaux du registre qui ont une zone protégée pour ce ratio (largeur des sous-titres hors du 9:16). */
export function reseauxDuRatio(ratio: Ratio): IdReseau[] {
  return listerReseaux()
    .filter((r) => !!r.zonesProtegees[ratio])
    .map((r) => r.id);
}

/** Centre de la bande des sous-titres, en % de la hauteur. */
export function centreBandePct(mise: Pick<MiseEnPageTableau, "bandeSousTitres" | "hauteurPx">): number {
  const b = mise.bandeSousTitres.px;
  return +(((b.y + b.hauteur / 2) / mise.hauteurPx) * 100).toFixed(2);
}

/** Une scène rendue, pour la composition. */
export interface ScenePosee {
  id: string;
  debutSec: number;
  finSec: number;
  cle: string;
}

/**
 * Groupes des sous-titres d'une sortie du tableau (17/10/2026), la MÊME chaîne pour la fabrication, les tests et les
 * aperçus : groupes du système central (`fabriquerSousTitres`, style posé dans la commande) ; puis, pour la charte Axion
 * et les styles choisis (`dynamiques`), le mélange central avec les garde-fous du tableau (`sousTitresDynamiquesTableau`)
 * et la taille des accents bornée par la bande sur le calque réel (`bornerDansLaBande`). Anciens styles « Encre » : les
 * groupes d'avant. PUR.
 */
export function segmentsSousTitresTableau(o: { c: CommandeFabrication; st: SousTitresTableau; dynamiques: boolean; texte: string; dureeSec: number; mots?: MotHorodate[]; prononciations?: readonly { mot: string; prononciation: string }[]; ratio: Ratio; reseaux: IdReseau[]; scenes: readonly ScenePosee[]; mise: MiseEnPageTableau; dureeVideoSec?: number; supplements?: Partial<EntreeComposition> }): SegmentSousTitres[] {
  const brutes = fabriquerSousTitres({ texte: o.texte, dureeSec: o.dureeSec, ...(o.mots ? { mots: o.mots } : {}), prononciations: [...(o.prononciations ?? [])], style: o.c.styles.sousTitres?.valeur, base: o.c.sousTitres?.base ?? "karaoke", ratio: o.ratio, reseaux: o.reseaux });
  if (!o.dynamiques) return brutes;
  const coupesSec = o.scenes.slice(1).map((s) => s.debutSec);
  // Mélange central avec les garde-fous du tableau (toujours dans la bande, jamais sur la page).
  const segments = sousTitresDynamiquesTableau(brutes, { st: o.st, intensite: o.c.sousTitres?.intensite ?? "equilibre", coupesSec, dureeSec: o.dureeSec });
  // Taille des accents bornée par la bande, sur le calque réel de cette sortie.
  const calque = parametresComposition(o.c, { ratio: o.ratio, plans: plansTableau(o.scenes), segments, dureeSec: o.dureeVideoSec ?? o.dureeSec, ...(o.mots ? { mots: o.mots } : {}), pistesDouble: { face: o.scenes[0]?.cle ?? "" }, ...(o.supplements ?? {}) }, RECETTE_COMPOSITION_TABLEAU).texte.sousTitres;
  return calque ? bornerDansLaBande(segments, calque, zoneTexteTableau(o.st, bandeDuCalque(o.mise, calque)), o.st.gabarit) : segments;
}

/**
 * Commande de fabrication MINIMALE du tableau (lue par `parametresComposition`, sans base) : page de la charte en
 * décor, sous-titres « Encre » centrés dans la bande réservée, aucune LUT, aucune musique, aucun bruitage.
 */
export function commandeTableau(o: { videoId: string; fiche: FicheTableau; texteScript: string; dureeSec: number; centreSousTitresPct: number; scenes: readonly ScenePosee[]; personnageId?: string; prononciations?: readonly { mot: string; prononciation: string }[]; ratio?: Ratio; mediasSons?: Record<string, MediaCommande>; styleSousTitres?: StyleResolu<ValeurStyleSousTitres> | null; bandeSousTitres?: BandeSousTitres; intensite?: IntensiteSousTitres }): CommandeFabrication {
  const medias: Record<string, MediaCommande> = { ...Object.fromEntries(o.scenes.map((s) => [`scene:${s.id}`, { cle: s.cle, mime: "video/mp4", dureeSec: +(s.finSec - s.debutSec).toFixed(3) }])), ...(o.mediasSons ?? {}) };
  // Style « blocs/2 » : les scènes dessinent elles-mêmes les sous-titres (pastille) ; export à la cadence du style.
  const blocs2 = estStyleBlocs2(o.fiche);
  // Styles « reference/1 » et « reference/2 » : aucun sous-titre, le texte écrit de la page les remplace (maquettes du 14/10).
  // « reference/3 » (charte Axion, 15/10) : les sous-titres communs, dans la bande basse.
  const axion = estStyleReference3(o.fiche);
  const sansSousTitres = blocs2 || (estPageEcrite(o.fiche) && !axion);
  // 17/10 : le design central (style choisi dans le studio, sinon « Avocat »), avec les garde-fous du tableau (bande,
  // bande sombre de fond sur les fonds clairs).
  const st = sousTitresTableau({ fiche: o.fiche, choisi: o.styleSousTitres, positionPct: o.centreSousTitresPct, ...(o.bandeSousTitres ? { bande: o.bandeSousTitres } : {}) });
  const decor: ValeurDecor = st.decor ?? { type: "decor", mode: "teinte", teinte: COULEURS_VIDEO.page, profondeurFlou: 0, directionLumiere: "face", positionSujet: 0.5, clair: true };
  return {
    versionContrat: 2,
    moteurId: "montage-tableau",
    videoId: o.videoId,
    formatId: FORMAT_TABLEAU,
    versionFormat: 1,
    profilRenduVersion: 1,
    dureeCibleSec: Math.round(o.dureeSec),
    ratios: [o.ratio ?? "9:16"],
    script: { blocs: [], texteComplet: o.texteScript },
    distribution: [{ role: "voix", source: "double", ...(o.personnageId ? { personnageId: o.personnageId } : {}) }],
    styles: { sousTitres: st.style, decor: st.decor ? { id: "fond-tableau", nom: "Fond du tableau", valeur: decor } : { id: "page-charte", nom: "Page de la charte", valeur: decor }, profilSon: { id: "ps-tableau", nom: "Tableau (ton de pièce à −66 dB)", valeur: PROFIL_SON_TABLEAU }, lut: null, musique: null },
    ...(blocs2 ? { profilRendu: { version: 1, export: { fps: FPS_BLOCS_2, debitMbpsMin: 12, debitMbpsMax: 16, audio: { codec: "aac" as const, kbps: 256, hz: 48000 }, couleur: "bt709" as const } } } : {}),
    briques: { "sous-titres": !sansSousTitres, etalonnage: false, illustrations: true, son: true, habillage: false, "texte-ecran": false, "mention-ia": false },
    entrees: {},
    reglages: {},
    plans: [],
    prononciations: [...(o.prononciations ?? [])],
    mentionIA: { incrustee: false, position: "haut-droite", dureeSec: 0, texte: "", dansLegende: false },
    budgetMax: { centimes: 0, devise: "EUR" },
    construiteLe: "1970-01-01T00:00:00.000Z",
    sousTitres: { base: st.base, intensite: o.intensite ?? "equilibre" },
    medias,
  };
}

/** Plans de la composition : une scène = un plan d'illustration vidéo, bout à bout de 0 à la fin. */
export function plansTableau(scenes: readonly ScenePosee[]): PlanProduit[] {
  return scenes.map((s, i) => ({
    ordre: i + 1,
    segmentId: s.id,
    debutSec: s.debutSec,
    finSec: s.finSec,
    texte: "",
    sourceImage: "illustration",
    illustration: { source: "bibliotheque", elementId: `scene:${s.id}`, verrouille: true, candidats: [] },
    motsEnValeur: [],
    cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1, zoomFin: 1, valeur: "large" },
    transition: "coupe",
  }));
}

/* ------------------------------------------------------------------ */
/* La chaîne                                                             */
/* ------------------------------------------------------------------ */

const raisonDe = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Fabrique la vidéo d'une fiche de scènes. Lève `ErreurFabrication` (étape et raisons) ; le journal permet la reprise. */
export async function fabriquerTableau(o: OutilsFabrication): Promise<CompteRenduFabrication> {
  const horloge = o.horloge ?? Date.now;
  const attendre = o.attendre ?? (async () => undefined);
  const lu = await o.journal.lire();
  const journal: JournalFabrication = lu?.version === VERSION_FABRICATION ? lu : { version: VERSION_FABRICATION, etapes: {} };
  const etapes: EtapeCompteRendu[] = [];
  const prononciations = o.prononciations ?? [];
  let coutCentimes = 0;
  let ordreTrace = 0;

  /** Écrit un événement de traçabilité ; une trace qui échoue n'arrête jamais la fabrication. */
  async function tracer(e: Omit<EvenementFabrication, "videoId" | "ordre" | "date"> & { date?: string }): Promise<void> {
    if (!o.tracer) return;
    try {
      await o.tracer({ ...e, videoId: o.videoId, date: e.date ?? new Date(horloge()).toISOString(), ordre: 500_000 + ordreTrace++ });
    } catch {
      // Ajout seul, sans conséquence sur la vidéo : la reconstruction depuis le journal comblera le manque.
    }
  }

  /**
   * Une étape reprise ou faite ; `store` : la sortie dont elle relève (racine du journal par défaut). Les étapes
   * GRATUITES et pures (`ETAPES_RECALCULEES` : relecture, calage, mise en page, fin) sont toujours refaites avec le code
   * courant : la même sortie que le journal = reprise ; une autre (le code a changé depuis, « Relancer » après un
   * correctif) = faite à nouveau. Les étapes qui coûtent (voix, rendus) sont reprises sur leur empreinte.
   */
  async function etape<T>(nom: EtapeFabrication, cle: string, faire: () => Promise<T>, store: Pick<JournalSortie, "etapes"> = journal, sortieId?: IdSortie): Promise<T> {
    const enPlus = sortieId ? { sortie: sortieId } : {};
    const libelle = `${LIBELLES_ETAPES[nom]}${sortieId ? ` (${sortieId})` : ""}`;
    const deja = store.etapes[nom];
    const recalculee = ETAPES_RECALCULEES.has(nom);
    if (deja && deja.empreinte === cle && !recalculee) {
      etapes.push({ etape: nom, statut: "reprise", dureeMs: 0, ...enPlus });
      dire(`${libelle} : reprise du journal.`);
      return deja.sortie as T;
    }
    const t0 = horloge();
    if (!deja || deja.empreinte !== cle) dire(`${libelle} : en cours…`);
    try {
      const sortie = await faire();
      if (deja && deja.empreinte === cle && stable(sortie) === stable(deja.sortie)) {
        etapes.push({ etape: nom, statut: "reprise", dureeMs: 0, ...enPlus });
        dire(`${libelle} : reprise du journal.`);
        return deja.sortie as T;
      }
      if (deja && deja.empreinte === cle) dire(`${libelle} : refaite avec le code courant (le journal gardait celle d'avant).`);
      const dureeMs = horloge() - t0;
      dire(`${libelle} : faite en ${(dureeMs / 1000).toFixed(1).replace(".", ",")} s.`);
      store.etapes[nom] = { empreinte: cle, dureeMs, sortie };
      // Même clé que la reconstruction (`etape:<nom>:<empreinte>`) : écrite ici d'abord, avec l'heure de début.
      await tracer({ type: "etape", cle: `etape:${nom}:${cle}`, date: new Date(t0).toISOString(), donnees: { etape: nom, nom: LIBELLES_ETAPES[nom], resultat: "faite", debut: new Date(t0).toISOString(), dureeMs, ...enPlus } });
      await o.journal.ecrire(journal);
      etapes.push({ etape: nom, statut: "faite", dureeMs, ...enPlus });
      return sortie;
    } catch (err) {
      if (err instanceof ErreurFabrication) throw err;
      throw new ErreurFabrication(nom, [raisonDe(err)], true);
    }
  }

  /** Avancement lisible (lanceur) ; une ligne qui échoue n'arrête jamais la fabrication. */
  function dire(ligne: string): void {
    try {
      o.avancement?.(ligne);
    } catch {
      // Affichage seul.
    }
  }

  /**
   * Fait tourner une étape suivie jusqu'à `fini`, en gardant l'état après chaque tour. `decrire` (facultatif) : où en
   * est l'étape, dit à l'avancement chaque fois que la phrase change.
   */
  async function suivre<E>(nom: EtapeFabrication, depart: E, tour: (e: E) => Promise<E>, fini: (e: E) => boolean, garder: (e: E) => Promise<void>, decrire?: (e: E) => string | null): Promise<E> {
    let e = depart;
    let dit: string | null = null;
    for (let n = 0; !fini(e); n++) {
      if (n >= TOURS_MAX) throw new ErreurFabrication(nom, [`L'étape ne s'est pas terminée après ${TOURS_MAX} tours.`]);
      const suivant = await tour(e);
      if (stable(suivant) === stable(e)) await attendre();
      e = suivant;
      await garder(e);
      const phrase = decrire?.(e) ?? null;
      if (phrase && phrase !== dit) dire(`  ${LIBELLES_ETAPES[nom]} : ${(dit = phrase)}`);
    }
    return e;
  }

  /** Ajoute une alerte au journal (sans doublon : même code, sortie, entrée, clé et message). */
  function noterAlerte(a: Omit<AlerteJournal, "le">): void {
    const liste = (journal.alertes ??= []);
    if (liste.some((x) => x.code === a.code && x.sortie === a.sortie && x.entree === a.entree && x.cle === a.cle && x.message === a.message)) return;
    liste.push({ ...a, le: new Date(horloge()).toISOString() });
  }

  // 1. Fiche.
  const brute = await o.lireFiche();
  const fiche = await etape("fiche", empreinte("fiche", brute, o.contexte), async () => {
    // « reference/3 » : une page qui ne tient pas dans le style du tableau passe d'elle-même à une page de plus (la
    // fiche gardée a pu être mise en forme avant ce contrôle, vidéo v-6616b3800357), avant toute relecture.
    const r = validerFicheTableau(pagesDuStyle(brute), o.contexte);
    if (!r.ok) throw new ErreurFabrication("fiche", r.problemes.map((p) => p.message));
    // Trois styles du tableau (16/10/2026) : le style de la série, si la fiche n'en a pas.
    return avecStyleTableau(r.fiche);
  });
  const commit = o.versionCode?.trim() || "inconnu";
  await tracer({ type: "code", cle: `code:${VERSION_FABRICATION}@${commit}`, donnees: { chaine: VERSION_FABRICATION, commit, stylo: fiche.stylo, style: fiche.habillage } });
  if (o.traceScriptId) await tracer({ type: "script", cle: `script-genere:${o.traceScriptId}`, donnees: { origine: "generateur", traceScriptId: o.traceScriptId, lien: `/tableau/traces/${encodeURIComponent(o.traceScriptId)}` } });

  // Sorties et fin de chacune (fin tirée de `fiche.appelId` ; le vertical de TikTok et Shorts passe le garde-fou).
  const sorties = lireSorties(o.sorties);
  const fins = new Map<IdSortie, FinRetenue | undefined>(sorties.map((id) => [id, finDeLaSortie(id, o.choisirFin ? o.choisirFin(fiche.appelId ?? null, id) : o.fin?.trim() ? { id: "phrase", ecran: o.fin.trim() } : undefined, fiche)]));
  const finDe = (id: IdSortie): FinRetenue | undefined => fins.get(id);

  // 2. Relecture d'avant la voix (aucun appel payant n'est encore fait) : LA MÊME que l'écran de création
  // (`relireFicheTableau`), mise en page de chaque sortie comprise.
  await etape("script", empreinte("script", fiche, o.contexte, o.historique ?? [], o.dejaVu, o.leveeVariete, sorties, [...fins], o.contenusPreuves ?? {}), async () => {
    const { rapport } = await relireFicheTableau({
      fiche,
      contexte: o.contexte,
      historique: o.historique ?? [],
      sorties,
      choisirFin: (_appelId, id) => fins.get(id),
      ...(o.dejaVu ? { dejaVu: o.dejaVu } : {}),
      ...(o.leveeVariete ? { leveeVariete: o.leveeVariete } : {}),
      ...(o.contenusPreuves ? { contenusPreuves: o.contenusPreuves } : {}),
    });
    if (rapport.verdict === "bloque") throw new ErreurFabrication("script", rapport.bloquants.map((l) => `${l.libelle} : ${l.raison}`));
    return { resume: rapport.resume };
  });

  // Une voix unique (comportement d'avant), ou des lectures raccordées quand la fin d'une sortie diffère.
  const planVoix: PlanVoixSorties = planVoixSorties(fiche, sorties.map((id) => ({ id, fin: fins.get(id) })));
  const principale: VarianteVoix | null = planVoix.mode === "unique" ? null : (planVoix.variantes.find((v) => v.sorties.includes(sorties[0])) ?? planVoix.variantes[0]);

  // 3. Voix maître (payée une fois ; budget vérifié et réservé juste avant), puis la recette du tableau.
  const texte = texteVoixTableau(fiche, prononciations);
  // 14/10 : contrôle de ressemblance (réglage figé au lancement) : le prix réservé couvre toutes les lectures possibles.
  const lecturesMax = lecturesVoixMax(o.voix.ressemblance);
  const estimation = estimerFabrication(fiche, o.budget.tarifCentimesParCaractere, prononciations, { ...(planVoix.mode === "unique" ? {} : { sorties: sorties.map((id) => ({ id, fin: fins.get(id) })) }), lecturesVoixMax: lecturesMax });
  if (estimation.phraseSurcout) dire(estimation.phraseSurcout);
  // Recette : la vitesse de lecture est la sienne (moteur et langue sont posés par le fournisseur).
  const reglagesLecture = { ...(o.voix.reglages ?? { vitesse: 1, stabilite: 45, emotion: 30 }), vitesse: RECETTE_VOIX_TABLEAU.synthese.vitesse };
  /** Clé d'une lecture brute (corps, phrase de fin, voix complète) : son texte lu, la voix et ses réglages. */
  const cleLecture = (l: LectureVoix) => empreinte("lecture", texteLu(l.texte, prononciations), o.voix.idVoix, reglagesLecture, o.voix.fournisseurVoix);
  const lectureDe = (id: string) => (planVoix.mode === "unique" ? undefined : planVoix.lectures.find((l) => l.id === id));
  /** Clé d'une variante de voix : ses lectures et la recette. */
  const cleVariante = (v: VarianteVoix) => empreinte("voix-variante", cleLecture(lectureDe(v.base)!), v.fin ? cleLecture(lectureDe(v.fin)!) : null, reglagesRecette());
  const cleVoix =
    planVoix.mode === "unique"
      ? empreinte("voix", texte, o.voix.idVoix, reglagesLecture, o.voix.fournisseurVoix, reglagesRecette())
      : empreinte("voix-sorties", planVoix.mode, cleVariante(principale!), planVoix.variantes.map((v) => [v.id, cleVariante(v)]));
  const voixDejaFaite = journal.etapes.voix?.empreinte === cleVoix;
  const audioRacine = await etape("voix", cleVoix, async (): Promise<AudioVoixTableau & { variantes?: Record<string, AudioVoixTableau> }> => {
    if (planVoix.mode !== "unique") return voixParLectures(planVoix);
    const outils: OutilsVoixMaitre = {
      ...o.voix,
      reglages: reglagesLecture,
      // La recette suit l'horodatage des mots de la voix (jamais un calage par l'aligneur).
      caler: () => false,
      idBase: `tb-voix-${cleVoix.slice(0, 12)}`,
      texte: () => texte,
      empreinte: () => cleVoix,
      avantLecture: () => o.budget.verifierEtReserver(estimation),
    };
    const depart: EtatVoixTableau = journal.voix?.empreinte === cleVoix ? journal.voix.etat : { phase: "a-lire" };
    const fin = await suivre<EtatVoixTableau>(
      "voix",
      depart,
      (e) => avancerVoixTableau(e, outils),
      (e) => e.phase === "faite",
      async (e) => {
        journal.voix = { empreinte: cleVoix, etat: e };
        await o.journal.ecrire(journal);
      },
    );
    const a = (fin as Extract<EtatVoixTableau, { phase: "faite" }>).audio;
    // Payée pendant CE lancement seulement si la lecture est partie d'ici (sinon : reprise d'une voix déjà payée).
    if (depart.phase === "a-lire" && !a.reutilise) coutCentimes += a.coutCentimes;
    return a;
  });
  const { variantes: audiosVariantes = {}, ...audio } = audioRacine;
  if (!voixDejaFaite) {
    for (const a of [audio, ...Object.values(audiosVariantes)]) {
      await tracer({
        type: "voix",
        cle: `recette-voix:${a.empreinte}`,
        donnees: { idVoix: o.voix.idVoix, fournisseur: o.voix.fournisseurVoix, reglages: reglagesLecture, recette: reglagesRecette(), recetteAppliquee: a.recette?.appliquee ?? null, ...(a.recette?.raison ? { raison: a.recette.raison } : {}), dureeSec: a.dureeSec, motsParSeconde: a.motsParSeconde, motsParMinute: Math.round(a.motsParSeconde * 60), reutilisee: a.reutilise, ...(a.ressemblance ? { ressemblance: a.ressemblance } : {}) },
      });
      await tracer({ type: "fichier", cle: `fichier:${a.fichierCle}`, donnees: { role: "voix", chemin: a.fichierCle, format: "audio", empreinte: a.empreinte } });
    }
  }

  // 4. Calage (celui de la variante principale ; chaque autre variante a le sien, dans sa sortie).
  const fichePrincipale = principale?.fiche ?? fiche;
  const contexteDe = (f: FicheTableau): ContexteTableau => (f === fiche ? o.contexte : { ...o.contexte, texteScript: texteDitDe(f) });
  const calage = await etape("calage", empreinte("calage", fichePrincipale, audio.mots, audio.dureeSec, prononciations, contexteDe(fichePrincipale)), async () => caler(fichePrincipale, audio));

  // 5 à 9, pour CHAQUE sortie (format d'image) : la voix et le calage ci-dessus servent à toutes. La sortie
  // « vertical » garde les clés de journal et les empreintes d'avant (reprise d'un journal d'avant intacte).
  const preuves = preuvesDeLaFiche(calage.fiche, o.contenusPreuves);
  // Écran d'appel de chaque sortie : celui de la relecture (`sortiesRelues`), une seule vérité.
  const preparees = new Map(sortiesRelues(fiche, sorties, finDe).map((x) => [x.id, x] as const));
  /** Propriétés des scènes de chaque sortie faite (le vertical « liens » reprend les scènes communes du vertical). */
  const proprietesFaites = new Map<IdSortie, ProprietesScene[]>();
  const faites: SortieFaite[] = [];
  // Une sortie refusée par la chaîne n'emporte pas les autres : elle manque, les fichiers prêts restent (blocage réel
  // du 14/10 : le vertical des Reels était prêt, la vidéo entière était pourtant en échec). Une panne, une attente ou
  // une pause (`imprevue`) arrête tout, comme avant ; aucune sortie prête : l'arrêt est rendu tel quel.
  const refus: { id: IdSortie; err: ErreurFabrication }[] = [];
  for (const id of sorties) {
    try {
      faites.push(await fabriquerSortie(id));
    } catch (err) {
      if (!(err instanceof ErreurFabrication) || err.imprevue) throw err;
      refus.push({ id, err });
    }
  }
  if (!faites.length) throw refus[0].err;
  const manquantes: SortieManquante[] = refus.map(({ id, err }) => ({ format: id, libelle: descriptionSortie(id, sorties).libelle, etape: err.etape, raisons: [...err.raisons] }));
  const alertesManque: AlerteQualite[] = manquantes.map((m) => ({
    code: m.format === VERTICAL_LIENS ? "fin" : "export",
    gravite: "attention",
    message: `Il manque : ${m.libelle}. ${m.raisons.join(" ")}${m.format === VERTICAL_LIENS ? " Le fichier vertical prêt finit par l'appel au mot : ne le publiez ni sur TikTok ni sur YouTube Shorts." : ""}`,
  }));
  for (const m of manquantes) {
    const a = alertesManque[manquantes.indexOf(m)];
    noterAlerte({ etape: m.etape, sortie: m.format, code: "sortie-manquante", message: a.message });
    dire(`Alerte : ${a.message}`);
    await tracer({ type: "etape", cle: `etape:${m.etape}:sortie-manquante:${m.format}`, donnees: { etape: m.etape, nom: LIBELLES_ETAPES[m.etape], resultat: "echec", raison: m.raisons.join(" "), sortie: m.format } });
  }
  // Chaque fichier prêt porte l'alerte (la fiche de la vidéo l'affiche sous la sortie).
  for (const f of faites) if (alertesManque.length) f.alertes = [...(f.alertes ?? []), ...alertesManque];

  // Journal : chaque sortie (format, dimensions, chemin, durée, taille), pour la reprise et le relevé.
  journal.resume = faites.map((f) => ({ format: f.format, largeur: f.largeur, hauteur: f.hauteur, chemin: f.cles.video, dureeSec: f.dureeSec, tailleOctets: f.tailleOctets ?? null }));
  await o.journal.ecrire(journal);

  const [premiere] = faites;
  // Rapport : les alertes de la première sortie, et celle de la fin sans appel de TikTok et Shorts (sans doublon).
  const alertesRapport = [...(premiere.alertes ?? [])];
  for (const a of alertesManque) if (!alertesRapport.some((x) => x.message === a.message)) alertesRapport.push(a);
  for (const a of faites.flatMap((f) => (f.format === VERTICAL_LIENS ? (f.alertes ?? []).filter((x) => x.code === "fin") : []))) if (!alertesRapport.some((x) => x.message === a.message)) alertesRapport.push(a);
  return {
    videoId: o.videoId,
    estimation,
    coutCentimes,
    coutVoixCentimes: audio.coutCentimes,
    etapes,
    scenes: premiere.scenes,
    cles: { voix: audio.fichierCle, ...premiere.cles },
    dureeSec: premiere.dureeSec,
    controles: premiere.controles,
    ...(premiere.fin ? { fin: premiere.fin } : {}),
    ...(audio.recette ? { recetteVoix: audio.recette } : {}),
    ...(alertesRapport.length ? { alertes: alertesRapport } : {}),
    sorties: faites,
    ...(manquantes.length ? { manquantes } : {}),
  };

  /** Cale une fiche (celle de la vidéo ou d'une variante) sur les mots de sa voix. */
  async function caler(f: FicheTableau, a: Pick<AudioVoixTableau, "mots" | "dureeSec">): Promise<{ fiche: FicheTableau; elements: ElementCale[] }> {
    const r = calerFicheTableau(f, a.mots, { contexte: contexteDe(f), prononciations, dureeSec: a.dureeSec });
    if (!r.ok) throw new ErreurFabrication("calage", f === fiche ? r.problemes : r.problemes.map((x) => `Fin propre à TikTok et Shorts · ${x}`));
    return { fiche: r.fiche, elements: r.elements };
  }

  /**
   * Voix par LECTURES (fins propres à chaque sortie) : chaque lecture brute (le corps une fois, chaque phrase de fin, ou
   * une voix complète par variante en repli) est payée une fois, budget réservé juste avant elle, état gardé au
   * journal (jamais relue), tracée avec son coût exact ; puis chaque variante passe par la recette (raccord du corps et
   * de sa fin, traitement final commun). Rend la voix de la variante principale (son coût : celui de TOUTES les
   * lectures, compté une seule fois) et celles des autres variantes (coût nul : déjà compté).
   */
  async function voixParLectures(plan: Exclude<PlanVoixSorties, { mode: "unique" }>): Promise<AudioVoixTableau & { variantes: Record<string, AudioVoixTableau> }> {
    const bruts = new Map<string, AudioBrut>();
    for (const l of plan.lectures) bruts.set(l.id, await lireBrute(l));
    const total = { coutCentimes: [...bruts.values()].reduce((x, b) => x + b.coutCentimes, 0), caracteres: [...bruts.values()].reduce((x, b) => x + b.caracteres, 0) };
    const audios: Record<string, AudioVoixTableau> = {};
    for (const v of plan.variantes) {
      const lues = [v.base, ...(v.fin ? [v.fin] : [])].map((id) => bruts.get(id)!);
      audios[v.id] = await recetteDe(v, bruts, v === principale ? total : { coutCentimes: 0, caracteres: lues.reduce((x, b) => x + b.caracteres, 0) });
    }
    const { [principale!.id]: a, ...autres } = audios;
    return { ...a, variantes: autres };
  }

  /** Une lecture brute, payée une fois (budget réservé juste avant), gardée au journal, tracée avec son coût exact. */
  async function lireBrute(l: LectureVoix): Promise<AudioBrut> {
    const cle = cleLecture(l);
    const texteL = texteLu(l.texte, prononciations);
    const prix: EstimationFabrication = { caracteres: texteL.length, centimes: Math.ceil(texteL.length * o.budget.tarifCentimesParCaractere * lecturesMax - 1e-9) };
    const outils: OutilsVoixMaitre = {
      ...o.voix,
      reglages: reglagesLecture,
      caler: () => false,
      idBase: `tb-lecture-${cle.slice(0, 12)}`,
      texte: () => texteL,
      empreinte: () => cle,
      avantLecture: () => o.budget.verifierEtReserver(prix),
      cle: (nom) => o.voix.cle(`lecture-${cle.slice(0, 12)}-${nom}`),
    };
    const lectures = (journal.lectures ??= {});
    const depart: EtatLectureBrute = lectures[cle]?.etat ?? { phase: "a-lire" };
    const fin = await suivre<EtatLectureBrute>(
      "voix",
      depart,
      (e) => avancerLectureBrute(e, outils),
      lectureFaite,
      async (e) => {
        lectures[cle] = { empreinte: cle, etat: e };
        await o.journal.ecrire(journal);
      },
      () => `lecture « ${l.role === "corps" ? "corps de la vidéo" : l.role === "fin" ? "phrase de fin" : "voix complète"} »`,
    );
    const brut = (fin as Extract<EtatLectureBrute, { phase: "a-analyser" }>).brut;
    if (!lectureFaite(depart)) {
      // Payée pendant CE lancement (une lecture reprise du journal n'est jamais recomptée).
      if (depart.phase === "a-lire") coutCentimes += brut.coutCentimes;
      await tracer({
        type: "voix",
        cle: `voix-morceau:${cle}`,
        donnees: { morceau: l.role, lecture: l.id, texte: l.texte, caracteres: brut.caracteres, coutCentimes: brut.coutCentimes, idVoix: o.voix.idVoix, fournisseur: o.voix.fournisseurVoix, reglages: reglagesLecture, dureeSec: brut.dureeSec, fichier: brut.fichierCle, mode: planVoix.mode, ...(brut.ressemblance ? { ressemblance: brut.ressemblance } : {}) },
      });
    }
    return brut;
  }

  /** La recette d'une variante (raccord de sa fin au corps, traitement final commun), état gardé au journal. */
  async function recetteDe(v: VarianteVoix, bruts: Map<string, AudioBrut>, compte: { coutCentimes: number; caracteres: number }): Promise<AudioVoixTableau> {
    const cle = cleVariante(v);
    const outils: OutilsVoixMaitre = {
      ...o.voix,
      reglages: reglagesLecture,
      caler: () => false,
      idBase: `tb-voix-${cle.slice(0, 12)}`,
      texte: () => texteDitDe(v.fiche),
      empreinte: () => cle,
      // La voix de la variante principale garde le nom d'avant ; les autres portent le nom de leur sortie.
      cle: (nom) => o.voix.cle(v === principale ? nom : `${v.id}-${nom}`),
    };
    const recettes = (journal.recettes ??= {});
    const depart: EtatRecetteVariante = recettes[cle]?.etat ?? { phase: "a-soumettre" };
    const sources = { corps: bruts.get(v.base)!, ...(v.fin ? { fin: bruts.get(v.fin)! } : {}) };
    const fin = await suivre<EtatRecetteVariante>(
      "voix",
      depart,
      (e) => avancerRecetteVariante(e, sources, compte, outils),
      (e) => e.phase === "faite",
      async (e) => {
        recettes[cle] = { empreinte: cle, etat: e };
        await o.journal.ecrire(journal);
      },
    );
    return { ...(fin as Extract<EtatRecetteVariante, { phase: "faite" }>).audio, coutCentimes: compte.coutCentimes, caracteres: compte.caracteres };
  }

  /**
   * Arrêt DÉFINITIF de la composition (`ErreurRendu` levée par la brique : série d'essais épuisée, ou refus). Pour un
   * `fichier-inaccessible`, chaque entrée de la demande est revérifiée (`lisible`) pour nommer celle qui manque (nom et
   * clé, jamais l'adresse signée). L'état en cours est oublié (une relance repart d'une demande neuve), l'alerte est
   * écrite au journal et à la traçabilité, et la raison revient en français.
   */
  async function arretComposition(err: ErreurRendu, x: { c: CommandeFabrication; base: BaseComposition; idBase: string; outils: OutilsMontage; id: IdSortie; nomEtape?: IdSortie; store: Pick<JournalSortie, "composition">; cleCompo: string }): Promise<ErreurFabrication> {
    const format = descriptionSortie(x.id, sorties);
    const fautives: { entree: string; cle: string }[] = [];
    const inaccessible = err.erreur.code === "fichier-inaccessible";
    if (inaccessible && o.montage.lisible) {
      let lectures: Record<string, string> = {};
      try {
        // Les entrées de la demande (nom → clé), recalculées sans rien signer.
        await demandeComposition(x.c, format.ratio, x.base, "complet", x.idBase, { ...x.outils, signer: async (l) => ((lectures = l), { lectures: {}, depots: {} }) });
      } catch {
        lectures = {};
      }
      for (const [entree, cle] of Object.entries(lectures)) if (!(await o.montage.lisible(cle).catch(() => false))) fautives.push({ entree, cle });
    }
    const suffixe = x.nomEtape ? ` (${format.libelle})` : "";
    const message = inaccessible
      ? `Le montage${suffixe} est arrêté : studio-rendu n'a pas pu lire une entrée après une série d'essais (${err.erreur.message.replace(/\.$/, "")}). ${
          fautives.length ? `Introuvable dans le stockage : ${fautives.map((f) => `${f.entree} (${f.cle})`).join(", ")}.` : "L'entrée en cause n'a pas pu être identifiée."
        } Relancez une fois le fichier rétabli : les étapes réussies sont reprises.`
      : `Le montage${suffixe} est arrêté : ${err.erreur.message}`;
    delete x.store.composition;
    const enPlus = x.nomEtape ? { sortie: x.nomEtape } : {};
    for (const f of fautives) noterAlerte({ etape: "composition", ...enPlus, code: "entree-introuvable", message: `Entrée introuvable : ${f.entree} (${f.cle}).`, entree: f.entree, cle: f.cle });
    noterAlerte({ etape: "composition", ...enPlus, code: "composition-arretee", message });
    dire(`Alerte : ${message}`);
    try {
      await o.journal.ecrire(journal);
    } catch {
      // Le journal reste celui du dernier tour : l'arrêt est rendu quand même.
    }
    await tracer({ type: "etape", cle: `etape:composition:arret:${x.id}:${x.cleCompo}:${err.erreur.code}`, donnees: { etape: "composition", nom: LIBELLES_ETAPES.composition, resultat: "echec", raison: message, code: err.erreur.code, entrees: fautives, ...enPlus } });
    return new ErreurFabrication("composition", [message]);
  }

  /** Mise en page, fin, scènes, composition et contrôles d'UNE sortie. */
  async function fabriquerSortie(id: IdSortie): Promise<SortieFaite> {
    const format = descriptionSortie(id, sorties);
    const vertical = id === "vertical";
    // Le vertical de TikTok et Shorts est un vertical : mêmes dimensions, même mise en page, mêmes scènes communes.
    const image = formatImage(id);
    const imageVerticale = image === "vertical";
    // Le vertical vit à la racine du journal (forme d'avant) ; les autres sorties, chacune dans `journal.sorties`.
    const store: JournalSortie = vertical ? (journal as JournalSortie) : ((journal.sorties ??= {})[id] ??= { etapes: {} });
    const enPlus = vertical ? [] : [id];
    const nomEtape = vertical ? undefined : id;
    const finRetenue = finDe(id);
    // Fin propre (vertical de TikTok et Shorts) : la fiche et la voix de sa variante, calées à part ; sinon celles d'avant.
    const variante = principale && planVoix.mode !== "unique" ? (planVoix.variantes.find((v) => v.sorties.includes(id)) ?? principale) : null;
    const autreVoix = !!variante && variante !== principale;
    const audioS: AudioVoixTableau = autreVoix ? audiosVariantes[variante.id] : audio;
    const ficheS = variante?.fiche ?? fiche;
    const calageS = autreVoix ? await etape("calage", empreinte("calage", ficheS, audioS.mots, audioS.dureeSec, prononciations, contexteDe(ficheS), id), async () => caler(ficheS, audioS), store, nomEtape) : calage;
    const finVoixMs = calageS.fiche.scenes.at(-1)?.finMs ?? 0;
    const blocs2 = estStyleBlocs2(calageS.fiche);
    // « blocs/2 » et « reference/1 » : pas de scène de fin ajoutée, la dernière scène (écran d'appel, dernière page) en
    // tient lieu.
    const finDansFiche = appelEnFinDeFiche(calageS.fiche);
    const phraseFin = !finDansFiche && finRetenue && "ecran" in finRetenue ? finRetenue.ecran.trim() || null : null;
    // TikTok et Shorts : jamais l'écran du mot à commenter ; le site en grand (sous la phrase de leur fin validée).
    const appel: AppelFinV2 | undefined = finDansFiche ? preparees.get(id)?.appel : undefined;

    // 5. Mise en page (avec le contenu des bulles de preuve : leur place dépend de la phrase testée et de la date).
    const mise = await etape(
      "mise-en-page",
      empreinte("mise-en-page", calageS.fiche, preuves, ...enPlus, ...(appel ? [{ appel }] : [])),
      async () => {
        try {
          return mettreEnPage(calageS.fiche, { preuves, ...(imageVerticale ? {} : { format: image }), ...(appel ? { appel } : {}) });
        } catch (err) {
          if (err instanceof ErreurMiseEnPage) throw new ErreurFabrication("mise-en-page", [vertical ? err.message : `${format.libelle} · ${err.message}`]);
          throw err;
        }
      },
      store,
      nomEtape,
    );

    // 6. Fin : celle de `fiche.appelId` si les services la fournissent (non validée = pas de fin), sinon la phrase donnée.
    const fin = await etape("fin", empreinte("fin", phraseFin, finVoixMs, calageS.fiche.stylo, ...enPlus), async () => (phraseFin ? proprietesFin(o.preparation, calageS.fiche, phraseFin, finVoixMs, vertical ? undefined : id) : null), store, nomEtape);

    // 7. Scènes, une à une, clé par empreinte (le nom du fichier d'une sortie autre que verticale porte son format).
    // « blocs/2 » : les mots de la voix (sous-titres dessinés par la scène, blocs qui claquent sur le mot dit), 30 i/s.
    // « reference/2 » : les mots de la voix aussi (la phrase de la fin de TikTok et Shorts s'écrit quand la voix la dit).
    // « reference/3 » : les mots de la voix et les heures fines qu'on en lit (fin dite de chaque bloc, mots importants).
    const enPlusV2 = blocs2 ? { mots: audioS.mots, fps: FPS_BLOCS_2 } : estStyleReference3(calageS.fiche) ? { mots: audioS.mots, temps3: tempsReference3(calageS.fiche, audioS.mots, prononciations) } : estStyleReference2(calageS.fiche) ? { mots: audioS.mots } : {};
    const proprietes = [...o.preparation.proprietesScenes({ miseEnPage: mise, scenes: calageS.fiche.scenes, heures: calageS.elements as ElementCale[], stylo: calageS.fiche.stylo, preuves, ...enPlusV2 }), ...(fin ? [fin] : [])];
    // Voix propre au vertical de TikTok et Shorts : ses scènes communes sont celles du vertical (mêmes images) ; seule
    // la dernière diffère, et son fil de progression repart d'où il en était.
    const reference = autreVoix && imageVerticale ? proprietesFaites.get("vertical") : undefined;
    if (reference) proprietes.splice(0, proprietes.length, ...alignerSurReference(proprietes, reference));
    proprietesFaites.set(id, proprietes);
    // « reference/3 » : contrôles de l'animation (accroche pleine à 0 s, blocs écrits à l'heure, aucune page vide, appel lisible).
    const problemes = [...proprietes.flatMap((p) => o.preparation.controlerProprietes(p)), ...(estStyleReference3(calageS.fiche) ? problemesAnimation3(proprietes as unknown as Parameters<typeof problemesAnimation3>[0]) : []), ...controlerAnimationTableau(proprietes as unknown as Parameters<typeof controlerAnimationTableau>[0]).map((x) => `${x.page ? `Page ${x.page} · ` : ""}${x.detail}`)];
    if (problemes.length) throw new ErreurFabrication("scenes", problemes);
    // Clé d'une scène : son empreinte (préfixée du format hors vertical) ; une scène commune aux deux verticaux a la même.
    const empreintes = Object.fromEntries(proprietes.map((p) => [p.scene.id, `${imageVerticale ? "" : `${id}-`}${empreinte("scene", COMPOSITION_SCENE, CRF_SCENE, p)}`]));
    const cleScenes = empreinte("scenes", o.env, o.videoId, empreintes);
    const scenes = await etape(
      "scenes",
      cleScenes,
      async () => {
        const cartes = proprietes.map(
          (p) =>
            ({
              id: p.scene.id,
              ratio: format.ratio,
              debutSec: p.scene.debutMs / 1000,
              finSec: p.scene.finMs / 1000,
              modele: COMPOSITION_SCENE,
              parametres: { composition: COMPOSITION_SCENE, proprietes: p, crf: CRF_SCENE },
            }) as unknown as CarteFormat,
        );
        // Seuls les champs lus par `rendu-cartes.ts` (id, ratio, temps, modèle, paramètres) sont posés.
        const enCours = store.scenes?.empreinte === cleScenes ? store.scenes : null;
        const rendues = new Set(enCours?.rendues ?? []);
        const depart = enCours?.etat ?? etatInitialCartesMotion(cartes, (c) => `scene-${vertical ? "" : `${id}-`}${c.id}`, { bloquant: true, parEmpreinte: { env: o.env, videoId: o.videoId, empreinte: (c) => empreintes[c.id] } });
        const finies = await suivre<EtatCartesMotion>(
          "scenes",
          depart,
          (e) => avancerCartesMotion(e, o.scenes),
          (e) => cartesMotionFinies(e),
          async (e) => {
            for (const c of e.cartes) if (c.statut === "soumise") rendues.add(c.id);
            store.scenes = { empreinte: cleScenes, etat: e, rendues: [...rendues] };
            await o.journal.ecrire(journal);
          },
          (e) => `${e.cartes.filter((c) => c.statut === "faite").length} / ${e.cartes.length} scènes dessinées`,
        );
        return {
          cles: Object.fromEntries(finies.cartes.map((c) => [c.id, c.cle])) as Record<string, string>,
          temps: finies.cartes.map((c) => ({ id: c.id, debutSec: c.debutSec, finSec: c.finSec, cle: c.cle })),
          rendues: finies.cartes.filter((c) => rendues.has(c.id)).map((c) => c.id),
          reprises: finies.cartes.filter((c) => !rendues.has(c.id)).map((c) => c.id),
        };
      },
      store,
      nomEtape,
    );
    const scenesReprises = etapes.some((e) => e.etape === "scenes" && e.sortie === nomEtape && e.statut === "reprise");

    // 8. Composition complète.
    const dureeSec = +(((fin?.scene.finMs ?? finVoixMs) as number) / 1000).toFixed(3);
    // Repli sûr : un bruitage dont le fichier est introuvable est retiré (la vidéo se fabrique sans lui, avec une alerte).
    const sons = blocs2 ? await retirerBruitagesIntrouvables(bruitagesTableau(proprietes, dureeSec), o.montage.lisible) : null;
    const alertesSortie: AlerteQualite[] = [];
    // TikTok et Shorts sans fin validée, LinkedIn : la vidéo se termine sans appel, et le rapport le dit.
    if (sansAppelAuMot(id) && finRetenue && "absente" in finRetenue) {
      alertesSortie.push({ code: "fin", gravite: "attention", message: finRetenue.absente });
      noterAlerte({ etape: "fin", sortie: id, code: "fin-sans-appel", message: finRetenue.absente });
      dire(`Alerte : ${finRetenue.absente}`);
    }
    if (sons?.manquants.length) {
      for (const m of sons.manquants) {
        const message = `Bruitage « ${m.entree.replace(/^son:tableau-/, "")} » introuvable (${m.cle}) : la vidéo est fabriquée sans ce son.`;
        alertesSortie.push({ code: "bruitage", gravite: "attention", message });
        noterAlerte({ etape: "composition", ...(nomEtape ? { sortie: nomEtape } : {}), code: "bruitage-introuvable", message, entree: m.entree, cle: m.cle });
        dire(`Alerte : ${message}`);
      }
      await o.journal.ecrire(journal);
      await tracer({ type: "controle", cle: `controle:bruitages:${id}:${sons.manquants.map((m) => m.cle).join(",")}`, donnees: { moment: "avant-montage", formatSortie: id, alertes: sons.manquants.length, manquants: sons.manquants } });
    }
    const instantsBords = blocs2 ? instantsBordsClairs(proprietes) : [];
    // 17/10 : style des sous-titres choisi dans le studio, garde-fous du tableau ; un repli (illisible sur ce fond, hors
    // charte) est dit dans le rapport, sans bloquer.
    const stTableau = sousTitresTableau({ fiche: ficheS, choisi: o.styleSousTitres, positionPct: centreBandePct(mise), bande: bandeDe(mise, format.ratio, imageVerticale, imageVerticale ? reseauxVerticaux() : reseauxDuRatio(format.ratio)) });
    if (stTableau.alerte) {
      alertesSortie.push(stTableau.alerte);
      noterAlerte({ etape: "composition", ...(nomEtape ? { sortie: nomEtape } : {}), code: "sous-titres-repli", message: stTableau.alerte.message });
      dire(`Alerte : ${stTableau.alerte.message}`);
    }
    // 17/10 : sous-titres dynamiques (mélange central, garde-fous du tableau) pour la charte Axion et les styles choisis ;
    // les anciens styles « Encre » gardent leurs groupes d'avant.
    const dynamiques = stTableau.personnalise || estStyleReference3(ficheS);
    const intensiteST: IntensiteSousTitres = o.intensiteSousTitres ?? "equilibre";
    const cleCompo = empreinte("composition", scenes.temps, audioS.fichierCle, audioS.mots, dureeSec, centreBandePct(mise), ficheS.scenes.map((s) => s.texteDit), PROFIL_SON_TABLEAU, ...enPlus, ...(sons ? [{ style: calage.fiche.habillage, bruitages: sons.places, instantsBords }] : []), ...(stTableau.personnalise ? [{ sousTitres: stTableau.style, gabarit: stTableau.gabarit }] : []), ...(dynamiques ? [{ sousTitresDynamiques: 1, intensite: intensiteST }] : []));
    const composition = await etape(
      "composition",
      cleCompo,
      async () => {
        const texteScript = ficheS.scenes.map((s) => s.texteDit).join(" ");
        const c = commandeTableau({ videoId: o.videoId, fiche: ficheS, texteScript, dureeSec, centreSousTitresPct: centreBandePct(mise), scenes: scenes.temps, personnageId: o.personnageId, prononciations, ratio: format.ratio, ...(sons ? { mediasSons: sons.medias } : {}), ...(o.styleSousTitres ? { styleSousTitres: o.styleSousTitres } : {}), bandeSousTitres: bandeDe(mise, format.ratio, imageVerticale, imageVerticale ? reseauxVerticaux() : reseauxDuRatio(format.ratio)), intensite: intensiteST });
        // Sous-titres dynamiques : les accents entrent sans glisser (jamais hors de la bande).
        // Design central (17/10) : centre de la ligne, échelle, accents sans glissement, bande de fond sur les fonds clairs.
        const { positionSousTitresPct, ...echelleST } = supplementsSousTitresTableau({ st: stTableau, mise, ratio: format.ratio, verticale: imageVerticale, dynamiques });
        const segments = segmentsSousTitresTableau({ c, st: stTableau, dynamiques, texte: texteScript, dureeSec: audioS.dureeSec, mots: audioS.mots, prononciations, ratio: format.ratio, reseaux: imageVerticale ? reseauxVerticaux() : reseauxDuRatio(format.ratio), scenes: scenes.temps, mise, dureeVideoSec: dureeSec, supplements: { positionSousTitresPct, ...echelleST } });
        const premiere = scenes.temps[0];
        const base: BaseComposition = {
          plans: plansTableau(scenes.temps),
          segments,
          dureeSec,
          mots: audioS.mots,
          audioCle: audioS.fichierCle,
          // Jamais montée (toute la durée est couverte par les scènes) : garde le chemin FFmpeg (voir l'en-tête).
          pistesDouble: { face: premiere.cle },
          ...(sons?.places.length ? { bruitages: sons.places } : {}),
          // Hors du vertical : la lettre des sous-titres garde la taille de la référence (16:9 : sinon × 1,78).
          supplements: { positionSousTitresPct, ...echelleST, ...(blocs2 && instantsBords.length ? { instantsBords } : {}) },
        };
        const outils: OutilsMontage = { ...o.montage, recette: blocs2 ? { ...RECETTE_COMPOSITION_TABLEAU, ...RECETTE_STYLE_BLOCS_2 } : RECETTE_COMPOSITION_TABLEAU, seriesFichierInaccessible: SERIES_FICHIER_INACCESSIBLE_TABLEAU };
        const idBase = `tb-${vertical ? "" : `${id}-`}${cleCompo.slice(0, 12)}`;
        const depart: EtatMontage = store.composition?.empreinte === cleCompo ? { [format.ratio]: store.composition.etat } : {};
        let etat: EtatMontage;
        try {
          etat = await suivre<EtatMontage>(
            "composition",
            depart,
            (e) => avancerCompositions(e, c, [format.ratio], base, "complet", idBase, outils),
            (e) => montageFini(e, [format.ratio]),
            async (e) => {
              const en = e[format.ratio];
              if (en) store.composition = { empreinte: cleCompo, etat: en };
              await o.journal.ecrire(journal);
            },
            (e) => {
              const en = e[format.ratio];
              if (!en || en.phase === "faite") return null;
              if (en.relanceApres) return `nouvelle série d'essais à ${en.relanceApres.slice(11, 16)} (UTC)`;
              return `${Math.round(en.progression ?? 0)} %${en.essai ? ` (essai ${en.essai + 1}${en.serie && en.serie > 1 ? `, série ${en.serie}` : ""})` : ""}`;
            },
          );
        } catch (err) {
          // Seul un arrêt DÉFINITIF de la brique (série épuisée, refus) est traité ici ; une panne passagère suit son cours.
          if (!(err instanceof ErreurRendu) || err.erreur.reessayable) throw err;
          throw await arretComposition(err, { c, base, idBase, outils, id, nomEtape, store, cleCompo });
        }
        const faite = etat[format.ratio] as Extract<EtatComposition, { phase: "faite" }>;
        dire(`  Montage (${format.libelle}) : vidéo déposée.`);
        return { sortieCle: faite.sortieCle, masterCle: faite.masterCle, vignetteCle: faite.vignetteCle, mesures: faite.mesures ?? {}, alertes: faite.alertes };
      },
      store,
      nomEtape,
    );

    // 9. Contrôles finaux (toujours refaits : ils ne coûtent rien) : ceux du format, puis dimensions et bords du fichier.
    const t9 = horloge();
    await tracer({ type: "etape", cle: `etape:controles:${id}:${cleCompo}`, date: new Date(t9).toISOString(), donnees: { etape: "controles", nom: LIBELLES_ETAPES.controles, resultat: "faite", debut: new Date(t9).toISOString(), sortie: id } });
    const controles = await controlerVideoTableau(
      {
        fiche: calageS.fiche,
        contexte: contexteDe(ficheS),
        historique: o.historique ?? [],
        ...(o.dejaVu ? { dejaVu: o.dejaVu } : {}),
        ...(o.leveeVariete ? { leveeVariete: o.leveeVariete } : {}),
        mesures: composition.mesures,
        // La mise en page de CETTE sortie (format, écran d'appel, bulles), celle qui a été rendue.
        sorties: [{ id, libelle: format.libelle, fiche: calageS.fiche, options: { preuves, ...(imageVerticale ? {} : { format: image }), ...(appel ? { appel } : {}) } }],
      },
      o.relireImagesCles ? { relireImagesCles: o.relireImagesCles } : {},
    );
    const controleFichier = controlerSortie(image, composition.mesures as Record<string, number | undefined>, { finPropre: !!RECETTE_COMPOSITION_TABLEAU.finPropre });
    // 14/10 : une fin qui s'arrête net est dite (alerte de la sortie), sans bloquer l'export.
    if (RECETTE_COMPOSITION_TABLEAU.finPropre && controleFinDesMesures(composition.mesures as Record<string, number | undefined>).defauts.length) {
      alertesSortie.push({ code: "fin", gravite: "attention", message: ALERTE_FIN_NON_PROPRE });
      noterAlerte({ etape: "controles", ...(nomEtape ? { sortie: nomEtape } : {}), code: "fin-non-propre", message: ALERTE_FIN_NON_PROPRE });
      dire(`Alerte : ${ALERTE_FIN_NON_PROPRE}`);
    }
    etapes.push({ etape: "controles", statut: "faite", dureeMs: horloge() - t9, ...(nomEtape ? { sortie: nomEtape } : {}) });

    const tailleOctets = (composition.mesures as Record<string, number | undefined>).taille;
    // Traçabilité : chaque fichier (format, empreinte) et le verdict des contrôles de cette sortie.
    const fichier = (role: string, chemin: string | undefined, en: Record<string, unknown> = {}) =>
      chemin ? tracer({ type: "fichier", cle: `fichier:${chemin}`, donnees: { role, chemin, format: format.ratio, formatSortie: id, largeur: format.largeur, hauteur: format.hauteur, empreinte: cleCompo, ...en } }) : Promise.resolve();
    // Code de la fin dite et son objectif (base 7), tracés avec la vidéo de la sortie.
    const finTracee = finRetenue && "ecran" in finRetenue ? { codeFin: finRetenue.id, ...(finRetenue.objectif ? { objectifFin: finRetenue.objectif } : {}) } : {};
    await fichier("video", composition.sortieCle, { ...finTracee, ...(typeof tailleOctets === "number" && tailleOctets > 0 ? { tailleOctets } : {}) });
    await fichier("master", composition.masterCle);
    await fichier("vignette", composition.vignetteCle);
    for (const [i, [sceneId, chemin]] of Object.entries(scenes.cles).entries()) await fichier("scene", chemin, { scene: sceneId === ID_SCENE_FIN ? "de fin" : String(i + 1), empreinte: empreintes[sceneId] ?? cleScenes });
    await tracer({
      type: "controle",
      cle: `controle:sortie:${id}:${cleCompo}`,
      donnees: { moment: "apres-montage", formatSortie: id, verdict: controles.verdict, resume: controles.resume, alertes: controles.indicatifs.length + controles.nonFaits.length + controles.bloquants.length, fichier: controleFichier },
    });
    return {
      ...(alertesSortie.length ? { alertes: alertesSortie } : {}),
      format: id,
      libelle: format.libelle,
      ratio: format.ratio,
      largeur: format.largeur,
      hauteur: format.hauteur,
      reseaux: format.reseaux.map((r) => r.libelle),
      ...(finRetenue ? { fin: finRetenue } : {}),
      scenes: { rendues: scenesReprises ? [] : scenes.rendues, reprises: scenesReprises ? Object.keys(scenes.cles) : scenes.reprises },
      cles: { scenes: scenes.cles, video: composition.sortieCle, ...(composition.masterCle ? { master: composition.masterCle } : {}), vignette: composition.vignetteCle },
      dureeSec,
      ...(typeof tailleOctets === "number" && tailleOctets > 0 ? { tailleOctets } : {}),
      controles,
      controleFichier,
    };
  }
}

/**
 * Scènes du vertical de TikTok et Shorts (voix propre) alignées sur celles du vertical. Une scène « blocs/2 » ne dessine
 * que d'après `scene`, `fps`, `stylo`, ses dimensions et `v2` (lu dans `EcranV2.tsx`) : quand tout cela est égal, hors
 * les fins de voix et de vidéo (qui ne changent que le fil de progression et la fin), c'est la MÊME image, et la scène
 * du vertical est reprise telle quelle (même empreinte : rien n'est rendu). La dernière scène garde les siennes, et son
 * fil de progression repart de la part atteinte dans le vertical. Rend les propriétés alignées.
 */
export function alignerSurReference<P extends ProprietesScene>(ps: readonly P[], reference: readonly ProprietesScene[]): P[] {
  const derniere = ps.length - 1;
  const visible = (p: ProprietesScene) => {
    const t = p as unknown as ProprietesTableauScene;
    if (!t.v2) return null;
    const v2: Partial<NonNullable<ProprietesTableauScene["v2"]>> = { ...t.v2 };
    delete v2.finVoixMs;
    delete v2.finVideoMs;
    delete v2.filDepart;
    return stable({ scene: t.scene, fps: t.fps, stylo: t.stylo, largeur: t.largeur, hauteur: t.hauteur, v2 });
  };
  return ps.map((p, i) => {
    const ref = reference[i] && reference[i].scene.id === p.scene.id ? reference[i] : undefined;
    const r = (ref as unknown as ProprietesTableauScene | undefined)?.v2;
    const v2 = (p as unknown as ProprietesTableauScene).v2;
    if (!ref || !r || !v2) return p;
    if (i < derniere) return visible(p) === visible(ref) ? (structuredClone(ref) as P) : p;
    return { ...p, v2: { ...v2, filDepart: { ms: p.scene.debutMs, part: Math.min(1, p.scene.debutMs / Math.max(1, r.finVoixMs)) } } } as P;
  });
}
