/**
 * IMAGE → VIDÉO · L15 · Machine à états de la fabrication (plan 50 § 1, § 9 ; fiche L15 de `51-TACHES`).
 *
 *   lecture → carte-a-valider → ecriture → script-a-valider → voix → mise-en-scene → rendu → controles → livraison
 *           → prete | refusee
 *
 * - Chaque pas (`avancerIV`) fait UNE chose (un tour de voix, un rendu soumis…) et rend un NOUVEL état, sérialisable
 *   (JSON) : le service le garde dans le travail, le script d'essai dans un fichier. Mêmes entrées = même état : aucune
 *   date ni aucun hasard ici (l'heure d'une validation vient des outils).
 * - Deux portes de Will : la CARTE (obligatoire tant que moins de 10 cartes ont été validées ; ensuite selon le réglage
 *   `validationCarte` : « toujours », ou « si-doute » — écart entre les deux lectures, alerte, chiffre lu une seule fois,
 *   formule absolue non tranchée) ; le SCRIPT (toujours). Aucune voix, aucune transcription, aucune relecture avant la
 *   validation du script : avant elle, seules la lecture et l'écriture dépensent.
 * - ARGENT : une CAISSE par vidéo tient le plafond (centimes d'euro). Avant CHAQUE appel payant (lecture, écriture,
 *   lecture de voix, transcription, relecture), elle compte le pire coût (dollars convertis au taux PRUDENT : jamais
 *   moins d'1 € pour 1 $, le tarif de la voix est majoré de même) ; s'il dépasse le plafond, l'appel ne part pas et la
 *   fabrication s'arrête net (« plafond atteint »). Sinon elle passe la main au budget réel des services (pré-vol ou
 *   réservation : la réservation des appels Claude est faite par `executerRolePourVideo`, jamais deux fois). Un appel
 *   déjà compté (même identifiant, même tentative) ne l'est jamais deux fois.
 * - REPRISE sans repayer : les lectures payées, la carte, le script, chaque prise de voix, chaque piste, chaque fichier
 *   rendu, chaque transcription et relecture restent dans l'état ; `reprendreIV` ne relance que l'étape arrêtée.
 * - Rendu : l'opération EXISTANTE du serveur (branchée par les services) ; une attente rend la main (`attente`).
 * - FORMATS (lot F45, décisions de Will du 16/10) : une version par (groupe de fins × format) : TikTok, Shorts, Reels
 *   Instagram en 9:16 ; LinkedIn en 4:5 (décision de Will du 24/10, qui remplace celle du 19/10 « LinkedIn en 9:16 ») ;
 *   Facebook en DEUX fichiers (Reel 9:16 et fil 4:5, même fin).
 *   Même voix, mêmes pistes : le 4:5 est une autre mise en page, jamais une autre lecture ; sa transcription est celle
 *   de sa piste (déjà payée par le 9:16), seule sa relecture d'images s'ajoute.
 * - VARIÉTÉ (lot F, doc 80 § 5) : une recette (un code par axe) est tirée APRÈS la validation de la carte et AVANT
 *   l'écriture (graine = identifiant de la vidéo, historique = recettes des 10 dernières vidéos IV prêtes, la plus
 *   récente d'abord) ; elle est gardée dans l'état (une reprise ne retire jamais). Le récit est donné à l'écriture : il
 *   vit dans le script, donc dans la voix, le même pour tous les réseaux. Will peut changer les autres axes avant de
 *   payer la voix (« Votre script ») ; chaque version reçoit `recettePourVersion` (son format, l'ouverture de ses réseaux).
 *
 * Ce fichier n'importe aucun service, aucun fournisseur et rien de `studio-rendu/`.
 */
import { createHash } from "node:crypto";
import { completerCarte, controlerCarte, reparerOrphelinsDeBranche, schemaCarteImage, type CarteImage, type ControleCarte, type TypeImage } from "@/domaine/image-video/carte";
import { ecrireAdaptations, reparerEtSignaler } from "@/domaine/image-video/reparation";
import { adapterCarteAutomatiquement } from "@/domaine/image-video/analyste/chaine-auto";
import { schemaFicheImage, type FicheImage } from "@/domaine/image-video/fiche";
import { formulesAbsoluesDe } from "@/domaine/image-video/formules";
import { RESEAUX_IV, type ReseauIV } from "@/domaine/image-video/plafonds";
import type { DeclencheurBruitage } from "@/domaine/types";
import { AXES_VARIETE, tirablesDe, type AxeVariete, type FormatIV, type RecetteVarieteIV } from "@/briques/schema-motion/variete";
import type { MesuresExport } from "@/briques/controle-image";
import { cleBruitage, idElementBruitage, SONS_BANQUE } from "@/donnees/bruitages";
import { assemblerVersionCourteIV, assemblerVersionsIV, planMixageIV, type DemandeMixageIV, type OutilsAssemblageIV, type PisteVoixSeuleIV, type VersionCourteIV } from "./assemblage";
import type { BruitageValideIV } from "./bruitages";
import { carteSansRetires, type VersionAControlerIV } from "./controles";
import { ecrireScriptIV, type OutilsEcritureIV } from "./ecriture";
import type { DemandeReservationControleIV } from "./ecoute";
import type { Offre } from "./emprunts";
import type { ActiviteLien } from "@/domaine/mesures";
import { liensSuivisIV, planDesFinsIV, refusQuestion, type AppelCommentaire, type FinIV, type PlanDesFinsIV } from "./fins";
import { lireImage, PHRASE_TYPE_INCONNU, type LectureImage, type OutilsLecture } from "./lecture";
import { ficheAdapteeIV, mettreEnSceneAvecFiletIV } from "./adaptation-scene";
import { mettreEnSceneIV, type EntreeMiseEnSceneIV, type LigneDeTempsIV } from "./mise-en-scene";
import { porteUniqueIV, type EntreePorteIV, type OutilsPorteIV, type VerdictPorteIV } from "./porte";
import { texteFilFacebookIV, textesDePublicationIV, type PublicationIV } from "./publication";
import { chapitresDetachables } from "./recettes";
import { aTrancherParWill, cleFormule, phraseChocAttendue, verifierScript, type ChoixFormule, type Manquement } from "./regles";
import { verdictReseau } from "./reseaux";
import { phraseDeRepliIV, planDeSecoursIV, secoursApresArretIV, type SecoursIV } from "./secours";
import { AXES_APPLIQUES_IV } from "./variete";
import { RECETTE_REFERENCE_IV, recettePourVersion, tirerVarieteIV } from "./variete/tirage";
import { avancerVoixIV, ErreurPlafondLecturesIV, ErreurVoixIV, etatInitialVoixIV, LECTURE_UNIQUE_IV, rapportVoixIV, relireLaVoixIV, repriseVoixIV, REPARATIONS_VOIX_MAX_IV, segmentsVoixIV, type EtatVoixIV, type OutilsVoixIV } from "./voix";

/* ------------------------------------------------------------------ */
/* Étapes                                                                */
/* ------------------------------------------------------------------ */

/** Les étapes de la chaîne, dans l'ordre. */
export const ETAPES_IV = ["lecture", "carte-a-valider", "ecriture", "script-a-valider", "voix", "mise-en-scene", "rendu", "controles", "livraison"] as const;
export type EtapeChaineIV = (typeof ETAPES_IV)[number];
/** État d'une fabrication : une étape de la chaîne, ou l'une des deux fins. */
export type EtapeIV = EtapeChaineIV | "prete" | "refusee";

/** Cartes validées par Will au-delà desquelles le réglage `validationCarte` s'applique (B6). */
export const CARTES_OBLIGATOIRES = 10;
/** Plafond par défaut d'une vidéo, en centimes d'euro (plan § 9 : au plus ≈ 2,20 € ; très complexe ≈ 3 €). */
export const PLAFOND_VIDEO_IV_CENTIMES = 300;

/**
 * `automatique` (défaut, R5) : le code répare et adapte la carte, la carte et le script sont validés par le réglage, rien
 * n'attend Will tant que le prix reste dans le prix accordé. `si-doute` et `toujours` : les portes de Will (B6).
 */
export type ValidationCarte = "automatique" | "toujours" | "si-doute";

/* ------------------------------------------------------------------ */
/* Bruitages validés                                                     */
/* ------------------------------------------------------------------ */

/**
 * Sons validés pour ce format (décision de la direction, 15/10) : les sons de `public/bruitages` que la v4 utilise —
 * les cinq familles, variantes 1 à 4 (`v4.html`, `window.SONS` : `${famille}-${(tour % 4) + 1}.wav`) — comptent comme
 * validés, la v4 étant jugée parfaite par Will. Aucun autre son (verre, tableau) n'est posé.
 */
export const BRUITAGES_V4_IV: readonly (BruitageValideIV & { cle: string; mime: "audio/wav" })[] = Object.freeze(
  SONS_BANQUE.map((s) => ({ elementId: idElementBruitage(s), declencheur: s.declencheur as DeclencheurBruitage, variante: s.variante, dureeSec: s.dureeSec, cle: cleBruitage(s), mime: "audio/wav" as const })),
);

/* ------------------------------------------------------------------ */
/* Demande et état                                                       */
/* ------------------------------------------------------------------ */

export interface DemandeFabricationIV {
  videoId: string;
  versionId: string;
  /** Image déposée (clé de stockage ; jamais transmise à Claude). `empreinte` : celle du fichier, sinon calculée. */
  image: { cle: string; empreinte?: string };
  /**
   * MODE TEXTE (R6b) : description libre de Will à la place d'une image (la clé d'image est alors `texte:<empreinte>`,
   * aucun fichier n'existe). L'étape « lecture » conçoit le workflow depuis ce texte au lieu de lire une image.
   */
  texte?: string;
  /** Réseaux cochés (tous les quatre par défaut). */
  reseaux: ReseauIV[];
  /** Offre corrigée par Will au dépôt ; absente : déduite du type de l'image. */
  offre?: Offre;
  /** Type imposé par Will (après « Je ne reconnais pas ce type d'image »). */
  typeImpose?: TypeImage;
  validationCarte: ValidationCarte;
  appelCommentaire: AppelCommentaire;
  /** Plafond de dépense de CETTE vidéo, en centimes d'euro : jamais dépassé. */
  plafondCentimes: number;
  /** Taux dollar → euro du lancement ; la caisse ne compte jamais moins d'1 € pour 1 $. */
  tauxUsdEur: number;
  /** Numéro de la version (code « 0042-IV-YS », `utm_campaign` des liens suivis) ; absent : aucun lien suivi. */
  numeroVersion?: number;
  /** Activité visée par les liens suivis (`utm_content`, ADR 0002) ; absente : « clients ». */
  activite?: ActiviteLien;
  /** Code de suivi propre à la commande (n'entre plus dans les liens : le rattachement se fait par le code de version). */
  codeSuivi: string;
  /** Mots interdits de Will (contexte de marque), en plus de ceux du format. */
  interdits?: string[];
  /**
   * Formats livrés à chaque réseau (lot F45), figés au lancement ; absent (états d'avant le 24/10) : tout en 9:16.
   * Posé par `etatInitialIV` (`FORMAT_4X5_PRET_IV`, allumé le 24/10/2026).
   */
  formats?: Partial<Record<ReseauIV, readonly FormatIV[]>>;
  /**
   * Fabrication d'un LOT d'images (décision de Will, 17/10) : aucune porte n'attend Will, un contrôle automatique la
   * remplace ; une vidéo douteuse est mise de côté sans payer la suite. Absent : le parcours d'une image seule.
   */
  lot?: { id: string; rang: number };
}

/** Une réservation comptée par la caisse (pire coût, centimes d'euro). */
export interface ReservationIV {
  cle: string;
  etape: EtapeDepenseIV;
  fournisseur: FournisseurDepenseIV;
  centimes: number;
}

export type EtapeDepenseIV = "lecture" | "ecriture" | "voix" | "ecoute" | "relecture";
export type FournisseurDepenseIV = "anthropic" | "heygen" | "transcription";

export interface RefusIV {
  /** Étape arrêtée (celle que `reprendreIV` relance). */
  etape: EtapeChaineIV;
  code: CodeRefusIV;
  /** Phrase simple pour Will. */
  message: string;
  /** Détail (phrases des contrôles), jamais un message technique brut. */
  phrases?: string[];
  /** Faux : relancer telle quelle donnerait le même refus ; Will doit changer quelque chose (carte, script, réseau). */
  reessayable: boolean;
}

export type CodeRefusIV =
  | "IV_PLAFOND"
  | "IV_BUDGET"
  | "IV_IMAGE"
  | "IV_TYPE_A_CHOISIR"
  | "IV_ECRITURE"
  | "IV_VOIX"
  | "IV_MISE_EN_SCENE"
  | "IV_RENDU"
  | "IV_CONTROLES"
  | "IV_PANNE";

/** Proposition de carte montrée à Will (« Voici ce que j'ai compris »). */
export interface PropositionCarteIV {
  carte: CarteImage;
  controle: ControleCarte;
  /** Ce qui fait douter (écarts, alertes, chiffres lus une fois, formules absolues non tranchées). */
  doutes: string[];
  /** Empreinte de la proposition : une décision de Will ne vaut que pour elle. */
  empreinte: string;
}

/** Proposition de script montrée à Will (« Votre script »). */
export interface PropositionScriptIV {
  fiche: FicheImage;
  /** Ce que seul Will tranche (formules absolues, phrase-choc à reformuler), avec une proposition. */
  aTrancher: Manquement[];
  /** Formules absolues du script, chacune avec sa clé de choix (`choixFormules[cle]` = « garder » ou « reformuler »). */
  formules: FormuleATrancherIV[];
  empreinte: string;
  /** Prix de la suite (voix, contrôles), annoncé AVANT le clic « Valider et fabriquer ». */
  prix: PrixIV;
}

export interface FormuleATrancherIV {
  cle: string;
  texte: string;
  proposition: string;
  ecranId: string;
}

/** Formules absolues du script (une par clé), dans l'ordre des écrans : ce que Will garde ou reformule. PUR. */
export function formulesDuScript(fiche: Pick<FicheImage, "ecrans">): FormuleATrancherIV[] {
  const vues = new Map<string, FormuleATrancherIV>();
  for (const e of fiche.ecrans) {
    for (const t of [e.texteDit, ...e.textesEcran.map((x) => x.replace(/\*/g, ""))]) {
      for (const f of formulesAbsoluesDe(t, e.id)) {
        const cle = cleFormule(f.texte);
        if (!vues.has(cle)) vues.set(cle, { cle, texte: f.texte, proposition: f.proposition, ecranId: e.id });
      }
    }
  }
  return [...vues.values()];
}

export interface PrixIV {
  /** Déjà compté par la caisse (pire coût). */
  engageCentimes: number;
  /** Coût habituel de la suite (une lecture par texte, une transcription et une relecture par version). */
  habituelCentimes: number;
  /** Coût au pire de la suite (relectures de voix et relances comprises). */
  auPlusCentimes: number;
  plafondCentimes: number;
}

export interface CourteIV {
  /** Version longue d'où elle est taillée. */
  version: string;
  /** Réseaux qui la demandent (plafond dépassé). */
  reseaux: ReseauIV[];
  /** Chapitres retirés ; `null` : aucune version courte possible (le réseau ne sera pas livré). */
  resultat: VersionCourteIV | null;
  raison?: string;
}

export interface RenduFaitIV {
  cle: string;
  /** Empreinte des octets du fichier final (une relecture n'est reprise que pour le même fichier). */
  empreinte?: string;
  dureeSec: number;
  mesures?: MesuresExport;
  /** Empreinte de la demande rendue (ligne de temps + mixage) : un rendu d'une autre demande n'est pas repris. */
  demande: string;
}

export interface LivraisonReseauIV {
  reseau: ReseauIV;
  /** Version qui part : longue ou courte ; « aucune » = réseau non livré. */
  version: "longue" | "courte" | "aucune";
  /** Fichier principal (Facebook : le Reel 9:16). */
  fichierCle?: string;
  dureeSec?: number;
  /** Format du fichier principal, s'il n'est pas le 9:16 (LinkedIn seul : 4:5). */
  format?: "4:5";
  /** Facebook : second fichier, la vidéo du fil en 4:5 (1080 × 1350), même fin. */
  fichierCleFil?: string;
  dureeSecFil?: number;
  /** Facebook : texte et consigne de la publication du fil (même texte que le Reel). */
  texteFil?: string;
  consigneLienFil?: string;
  /** Phrase orange (« un peu longue ») ou raison du refus. */
  mention?: string;
  texte?: string;
  premierCommentaire?: string;
  titre?: string;
  consigneLien?: string;
  lien?: string;
}

export interface EtatFabricationIV {
  version: "fabrication-iv/1";
  etape: EtapeIV;
  demande: DemandeFabricationIV;
  caisse: { plafondCentimes: number; reservations: ReservationIV[] };
  /** Nombre de passages de chaque étape (une reprise en ouvre un nouveau : ses appels sont comptés à part). */
  tentatives: Partial<Record<EtapeChaineIV, number>>;
  /** Relances automatiques de chaque étape dans la tentative en cours : chacune réserve de nouveau (l'appel qui repart est un appel réel de plus). */
  relances?: Partial<Record<EtapeChaineIV, number>>;
  /** Compteur des identifiants d'appel donnés aux contrôles (jamais deux fois le même, d'une exécution à l'autre). */
  compteurAppels?: number;
  /** Lectures payées, gardées même après un refus (reprise sans relire). */
  lectures?: Partial<Record<"a" | "b", LectureImage>>;
  propositionCarte?: PropositionCarteIV;
  carte?: { carte: CarteImage; par: "will" | "reglage" };
  /**
   * Recette de variété de la vidéo : tirée avant l'écriture (`par: "tirage"`), changée par Will avant la voix
   * (`par: "will"`) ; `historique` : nombre de recettes passées vues au tirage. Absente (fabrication d'avant) : le rendu
   * de référence.
   */
  variete?: { recette: RecetteVarieteIV; par: "tirage" | "will"; historique: number };
  propositionScript?: PropositionScriptIV;
  script?: { fiche: FicheImage; choixFormules: Record<string, ChoixFormule>; ajoutsWill: string[] };
  plan?: PlanDesFinsIV;
  voix?: EtatVoixIV;
  pistes?: PisteVoixSeuleIV[];
  courtes?: CourteIV[];
  scenes?: { version: string; dureeSec: number; empreinte: string }[];
  /** 25/10 : écrans passés en scène « titre » par le filet de la mise en scène (défaut de détail Q13/Q14), PAR VERSION (id de version) ; rendu et contrôles relisent la même fiche. */
  ecransAdaptes?: Record<string, string[]>;
  /**
   * Écrans de la fiche (ids « e01 »…) passés en TEXTE SEUL parce que le rendu ne savait pas les montrer, PAR VERSION. Champ à part
   * (`ecransAdaptes` est recalculé de zéro à chaque mise en scène) : la mise en scène le fusionne aux écrans du filet. Posé au 1er
   * échec de rendu d'une version ; s'il existe déjà, un 2e échec est `IV_RENDU`. Effacé avec `ecransAdaptes`.
   */
  ecransImposesRendu?: Record<string, string[]>;
  /** Versions dont l'imposition du texte seul est un repli « tous les écrans » (le rendu n'a nommé aucun écran retrouvé). */
  ecransImposesRepli?: Record<string, true>;
  /** Remarques pour Will (non bloquantes) nées de la fabrication, reprises dans les mentions de la livraison ; recalculées à chaque mise en scène. */
  remarques?: string[];
  rendus?: Record<string, RenduFaitIV>;
  /** Transcriptions et relectures déjà payées (reprise de la porte sans repayer). */
  controles?: { transcriptions: VerdictPorteIV["transcriptions"]; relectures: VerdictPorteIV["relectures"]; verdict?: ResumePorteIV };
  livraison?: LivraisonReseauIV[];
  /** Attente d'un fournisseur (rendu en cours) : le prochain pas reprend au même endroit. */
  attente?: string;
  refus?: RefusIV;
  /** Lot : la vidéo est mise de côté à une porte, sans rien payer de la suite (motif pour Will). Effacé par sa validation. */
  miseDeCote?: { porte: "carte" | "script"; motif: string; phrases: string[] };
  /** Ce qui s'est passé, dans l'ordre (phrases simples, sans date). */
  journal: string[];
}

export interface ResumePorteIV {
  ok: boolean;
  phrase: string;
  phrases: string[];
  mentions: string[];
}

/* ------------------------------------------------------------------ */
/* Outils                                                                */
/* ------------------------------------------------------------------ */

/** Dépense sur le point de partir, en centimes d'euro (pire coût), soumise au budget réel des services. */
export interface DemandeDepenseIV {
  appelId: string;
  videoId: string;
  etape: EtapeDepenseIV;
  fournisseur: FournisseurDepenseIV;
  centimes: number;
  /** Appels Claude et transcription : le pire coût en dollars. */
  coutEstimeUsd?: number;
  modele?: string;
  /** Voix : caractères lus. */
  caracteres?: number;
}

/** Une décision de Will sur la carte : la carte corrigée (absente : telle que proposée). */
export interface DecisionCarteIV {
  /** Empreinte de la proposition validée (une décision sur une autre proposition est ignorée). */
  proposition: string;
  carte?: CarteImage;
  /** Heure de la validation (ISO), posée par les services. */
  le: string;
}

/** Une décision de Will sur le script : script modifié, choix sur les formules, textes ajoutés par lui. */
export interface DecisionScriptIV {
  proposition: string;
  fiche?: FicheImage;
  choixFormules?: Record<string, ChoixFormule>;
  ajoutsWill?: string[];
  /** Variantes changées par Will (tous les axes sauf le récit, déjà dans le script). */
  variete?: Partial<RecetteVarieteIV>;
}

export class RenduEnCoursIV extends Error {
  readonly enCours = true;
  constructor(quoi: string) {
    super(`${quoi} est en cours.`);
    this.name = "RenduEnCoursIV";
  }
}

/**
 * Rendu impossible TEL QUEL (une scène que la composition ne sait pas montrer) : rien n'est envoyé ; relancer donnerait
 * le même refus (`reessayable: false`), il faut changer le script.
 */
export class ErreurRenduDefinitifIV extends Error {
  constructor(
    message: string,
    readonly phrases: string[] = [],
    /** Identifiants (bloc de la ligne de temps, ou écran de la fiche) des écrans irrendables, quand on les connaît. */
    readonly ecransIrrendables?: string[],
  ) {
    super(message);
    this.name = "ErreurRenduDefinitifIV";
  }
}

/** Une attente de fournisseur (rendu soumis, pas fini) : la nôtre, ou celle des briques communes (`RenduEnCours`). */
export function estAttenteIV(err: unknown): boolean {
  return !!err && typeof err === "object" && ((err as { enCours?: unknown }).enCours === true || (err as { name?: unknown }).name === "RenduEnCours");
}

export interface DemandeRenduIV {
  /** Empreinte de la demande : même ligne de temps et même mixage = même rendu repris. */
  id: string;
  videoId: string;
  version: string;
  reseaux: ReseauIV[];
  ligne: LigneDeTempsIV;
  mixage: DemandeMixageIV;
  /** Piste voix seule de la version (son, mots à l'heure finale). */
  piste: PisteVoixSeuleIV;
  /**
   * Passage de l'étape « rendu » (1 au premier ; « Réessayer » l'augmente) : un rendu raté repart sous un autre
   * identifiant (le serveur garde un échec), ce qui est déjà rendu est repris tel quel.
   */
  essai?: number;
}

export interface OutilsFabricationIV {
  /** Octets de l'image déposée (`null` : introuvable). */
  lireImageSource: (cle: string) => Promise<Uint8Array | null>;
  lecture: Omit<OutilsLecture, "budget">;
  ecriture: Omit<OutilsEcritureIV, "budget">;
  /** Voix : tout sauf la réservation, posée par la caisse. */
  voix: Omit<OutilsVoixIV, "avantLecture">;
  /** Faux : la fin de secours à lire n'est pas posée automatiquement, elle attend « Refaire cette partie » (parcours des tests d'avant). Défaut : vrai. */
  secoursAutomatique?: boolean;
  assemblage: OutilsAssemblageIV;
  /** Rendu du fichier final d'une version (opération existante du serveur) ; pas fini : lève une attente. */
  rendre: (d: DemandeRenduIV) => Promise<{ cle: string; empreinte?: string; dureeSec: number; mesures?: MesuresExport }>;
  /** Porte unique : tout sauf la réservation et les identifiants d'appel, posés par la machine. */
  controles: Omit<OutilsPorteIV, "budget" | "idAppel">;
  /** Budget réel du studio (pré-vol ou réservation), appelé APRÈS le contrôle du plafond par la caisse. */
  budget: {
    reserver: (d: DemandeDepenseIV) => Promise<{ ok: true } | { ok: false; message: string }>;
    /**
     * MODE INDICATIF (`budget.mode`, posé par le service) : le plafond de la vidéo n'est qu'un repère. Au-dessus, la caisse
     * appelle `signaler` (journal + cloche) et laisse passer ; les chemins Claude et le lot d'images n'ont plus d'arrêt de sécurité
     * (`facteurSecurite` ne sert que là où le service le demande encore).
     * Absent : mode bloquant, comportement d'avant.
     */
    indicatif?: { facteurSecurite: number; signaler: (message: string) => Promise<void> };
    /** Prévient Will d'un prix annoncé dépassé quand il n'y a pas d'outil indicatif (même canal que `indicatif.signaler`). */
    avertir?: (message: string) => Promise<void>;
  };
  /** Sons validés (défaut : ceux de la v4, `BRUITAGES_V4_IV`). */
  bruitagesValides?: readonly BruitageValideIV[];
  /** Nombre de cartes déjà validées par Will (compteur du studio). */
  cartesValidees: () => Promise<number>;
  /** Recettes des dernières vidéos IV prêtes, la plus récente d'abord (absent : aucun historique). */
  historiqueVariete?: () => Promise<readonly RecetteVarieteIV[]>;
  /** Décisions de Will en attente (services : gardées hors du travail) ; absentes : seules les fonctions pures s'appliquent. */
  decisions?: { carte?: () => Promise<DecisionCarteIV | null>; script?: () => Promise<DecisionScriptIV | null> };
  /** Heure ISO (validation automatique de la carte en « si-doute »). */
  maintenant: () => string;
  /** Attente avant l'unique relance automatique d'une panne (défaut : attente réelle ; les essais injectent une attente vide). */
  pause?: (ms: number) => Promise<void>;
  /** Faux : aucune relance automatique (défaut : vrai). Les essais qui comptent chaque appel payé le coupent. */
  relancesAuto?: boolean;
}

/* ------------------------------------------------------------------ */
/* Formats par réseau (lot F45)                                          */
/* ------------------------------------------------------------------ */

/** Formats livrés à chaque réseau (décisions de Will du 16/10 ; pas de version 30 s). */
export const FORMATS_PAR_RESEAU_IV: Readonly<Record<ReseauIV, readonly FormatIV[]>> = Object.freeze({
  tiktok: Object.freeze(["9:16"] as const),
  "youtube-shorts": Object.freeze(["9:16"] as const),
  instagram: Object.freeze(["9:16"] as const),
  linkedin: Object.freeze(["4:5"] as const),
  facebook: Object.freeze(["9:16", "4:5"] as const),
});
const ORDRE_FORMATS_IV: readonly FormatIV[] = ["9:16", "4:5"];

/**
 * Le 4:5 part-il par défaut ? OUI depuis le 24/10/2026 (décision de Will « fais tout selon tes recommandations » :
 * LinkedIn et fil Facebook en 4:5, Instagram et Reel Facebook en 9:16 ; surcoût du fil Facebook accepté, environ
 * 0,25 € par vidéo, 1 € au plus). La mise en scène passe le format aux sous-titres et le contrôle Q22 mesure la bande
 * du format. Une demande peut porter ses formats (`demande.formats`) ; sans eux, ce sont ceux-ci.
 */
export const FORMAT_4X5_PRET_IV = true;

/** Formats d'un réseau pour cette fabrication (absent : 9:16 seul, comme avant). */
const formatsDe = (demande: Pick<DemandeFabricationIV, "formats">, r: ReseauIV): readonly FormatIV[] => demande.formats?.[r] ?? ["9:16"];

/** Identifiant d'une version dans un format : le 9:16 garde celui d'avant (états et rendus repris), le 4:5 prend « -4x5 ». */
export const idVersionFormatIV = (id: string, format: FormatIV) => (format === "9:16" ? id : `${id}-4x5`);

/**
 * Un groupe de réseaux (une fin) réparti par format, dans l'ordre 9:16 puis 4:5 ; un format sans réseau n'a pas de
 * version (PUR). `formats` : ceux de la demande (défaut : la décision de Will, `FORMATS_PAR_RESEAU_IV`).
 */
export function reseauxParFormatIV(reseaux: readonly ReseauIV[], formats: Pick<DemandeFabricationIV, "formats"> = { formats: FORMATS_PAR_RESEAU_IV }): { format: FormatIV; reseaux: ReseauIV[] }[] {
  return ORDRE_FORMATS_IV.map((format) => ({ format, reseaux: reseaux.filter((r) => formatsDe(formats, r).includes(format)) })).filter((x) => x.reseaux.length > 0);
}

/* ------------------------------------------------------------------ */
/* Outils purs                                                           */
/* ------------------------------------------------------------------ */

const empreinteDe = (x: unknown) => createHash("sha256").update(JSON.stringify(x)).digest("hex").slice(0, 32);
/** Centimes d'euro → « 1,23 € » (phrases du moteur et de l'écran : une seule source, RM-01). */
export const euros = (c: number) => `${(c / 100).toFixed(2).replace(".", ",")} €`;
const tauxPrudent = (taux: number) => (Number.isFinite(taux) && taux > 1 ? taux : 1);
/** Dollars → centimes d'euro, au taux prudent (jamais moins d'1 € pour 1 $), arrondi au centime supérieur. */
export const centimesEurDeUsd = (usd: number, taux: number) => Math.ceil(usd * 100 * tauxPrudent(taux) - 1e-9);
/** Tarif de la voix en centimes d'euro par caractère, majoré au taux prudent. */
export const tarifVoixCentimesEur = (centimesUsdParCaractere: number, taux: number) => centimesUsdParCaractere * tauxPrudent(taux);

export function etatInitialIV(demande: DemandeFabricationIV): EtatFabricationIV {
  const reseaux = RESEAUX_IV.filter((r) => demande.reseaux.includes(r));
  return {
    version: "fabrication-iv/1",
    etape: "lecture",
    demande: { ...demande, reseaux, ...(FORMAT_4X5_PRET_IV && !demande.formats ? { formats: FORMATS_PAR_RESEAU_IV } : {}) },
    caisse: { plafondCentimes: Math.max(0, Math.floor(demande.plafondCentimes)), reservations: [] },
    tentatives: { lecture: 1 },
    journal: [],
  };
}

export const engageCentimes = (e: Pick<EtatFabricationIV, "caisse">) => e.caisse.reservations.reduce((s, r) => s + r.centimes, 0);

/** Ce qui fait douter d'une carte (B6) : une raison par point. */
export function doutesDeLaCarte(carte: CarteImage, controle: ControleCarte): string[] {
  const d: string[] = [];
  if (carte.lecture.ecarts.length) d.push(`${carte.lecture.ecarts.length} écart(s) entre les deux lectures.`);
  d.push(...controle.erreurs, ...controle.alertes);
  const unFois = carte.chiffres.filter((c) => c.lu === "une-seule").map((c) => c.brut);
  if (unFois.length) d.push(`Chiffre(s) lu(s) une seule fois : ${[...new Set(unFois)].join(", ")}.`);
  const formules = carte.formulesAbsolues.filter((f) => !f.choixWill).map((f) => `« ${f.texte} »`);
  if (formules.length) d.push(`Formule(s) trop affirmative(s) à trancher : ${formules.join(", ")}.`);
  return [...new Set(d)];
}

/**
 * Lot, porte « carte » (plan § d.1) : la raison de mettre la vidéo de côté, ou `null` si la carte est sans doute. PUR.
 * Ordre : défaut bloquant, écarts entre les lectures, alertes du contrôle, chiffre lu une fois, formule à trancher.
 * `phrases` : ce qui fait douter (les `doutes`), pour la page de Will.
 */
export function miseDeCoteCarteIV(carte: CarteImage, controle: ControleCarte, doutes: string[]): { motif: string; phrases: string[] } | null {
  const phrases = [...new Set([...controle.erreurs, ...doutes])];
  if (!controle.ok) return { motif: "Ce que j'ai compris de l'image a un défaut.", phrases };
  if (carte.lecture.ecarts.length) return { motif: "Les deux lectures de l'image ne disent pas la même chose.", phrases };
  // Une alerte « chiffre lu une fois » ou « formule » a son propre motif, plus bas.
  const alertesPropres = controle.alertes.filter((a) => !a.includes("n'a été lu qu'une fois") && !a.startsWith("Formule très affirmative"));
  if (alertesPropres.length) return { motif: "Un point de l'image est incertain.", phrases };
  const unFois = [...new Set(carte.chiffres.filter((c) => c.lu === "une-seule").map((c) => c.brut))];
  if (unFois.length) return { motif: `Un chiffre n'a été lu qu'une fois : ${unFois.join(", ")}.`, phrases };
  const formules = carte.formulesAbsolues.filter((f) => !f.choixWill).map((f) => `« ${f.texte} »`);
  if (formules.length) return { motif: `Une formule trop affirmative est à trancher : ${formules.join(", ")}.`, phrases };
  return doutes.length ? { motif: "Un point de l'image est incertain.", phrases } : null;
}

/** L'étape est-elle une attente de Will ? */
export function attendWillIV(e: Pick<EtatFabricationIV, "etape">): "carte" | "script" | null {
  return e.etape === "carte-a-valider" ? "carte" : e.etape === "script-a-valider" ? "script" : null;
}

export const estFinieIV = (e: Pick<EtatFabricationIV, "etape">) => e.etape === "prete" || e.etape === "refusee";

/* ------------------------------------------------------------------ */
/* Variété (lot F)                                                       */
/* ------------------------------------------------------------------ */

/** Recettes passées gardées par le tirage (doc 72 § 5 : les 10 dernières vidéos). */
export const HISTORIQUE_VARIETE_IV = 10;

/**
 * Historique du tirage (PUR) : les recettes des fabrications IV PRÊTES, dans l'ordre reçu (la plus récente d'abord),
 * sans la vidéo en cours, au plus `HISTORIQUE_VARIETE_IV`. Une fabrication sans recette (d'avant la variété) est sautée.
 */
export function historiqueVarieteIV(etats: readonly (Pick<EtatFabricationIV, "etape" | "variete"> & { demande: Pick<DemandeFabricationIV, "videoId"> })[], videoId?: string): RecetteVarieteIV[] {
  return etats.filter((e) => e.etape === "prete" && e.variete && e.demande.videoId !== videoId).slice(0, HISTORIQUE_VARIETE_IV).map((e) => e.variete!.recette);
}

/** Codes que Will peut choisir sur cette image, axe par axe (PUR) : les tirables que l'image permet (9:16), sinon la référence. */
export function variantesPossiblesIV(carte: CarteImage): Record<AxeVariete, string[]> {
  return Object.fromEntries(
    AXES_VARIETE.map((axe) => {
      const tirables = tirablesDe(axe) as readonly string[];
      const a = AXES_APPLIQUES_IV.find((x) => x.axe === axe);
      const p = a ? a.possibles(carte, "9:16").filter((c) => tirables.includes(c)) : [...tirables];
      return [axe, p];
    }),
  ) as Record<AxeVariete, string[]>;
}

/** Recette changée par Will (PUR) : le récit ne bouge plus (il est dans le script) ; chaque code doit être possible ici. */
export function changerVarieteIV(recette: RecetteVarieteIV, changes: Partial<RecetteVarieteIV>, carte: CarteImage): RecetteVarieteIV {
  const possibles = variantesPossiblesIV(carte);
  const phrases: string[] = [];
  const r: Record<string, string> = { ...recette };
  for (const axe of AXES_VARIETE) {
    const code = changes[axe];
    if (code === undefined || code === recette[axe]) continue;
    if (axe === "recit") phrases.push("Le déroulé du récit est déjà dans le script : il ne change plus après l'écriture.");
    else if (!possibles[axe].includes(code)) phrases.push(`La variante ${code} n'est pas possible sur cette image.`);
    else r[axe] = code;
  }
  if (phrases.length) throw new ErreurDecisionIV("Cette variante ne peut pas être choisie.", phrases);
  return r as RecetteVarieteIV;
}

/** La recette en une ligne pour le journal (« OUV-A · REC-B · … »). */
const ligneRecette = (r: RecetteVarieteIV) => AXES_VARIETE.map((a) => r[a]).join(" · ");

/** Recette de chaque version à fabriquer (PUR) : `recettePourVersion` (format, ouverture des réseaux) ; vide sans recette. */
export function recettesDesVersionsIV(e: EtatFabricationIV): { version: string; reseaux: ReseauIV[]; format: FormatIV; recette: RecetteVarieteIV }[] {
  if (!e.variete) return [];
  return versionsDe(e).map((v) => ({ version: v.id, reseaux: [...v.reseaux], format: v.format ?? "9:16", recette: recettePourVersion(e.variete!.recette, v.reseaux, v.format ?? "9:16") }));
}

/* ------------------------------------------------------------------ */
/* Caisse                                                                */
/* ------------------------------------------------------------------ */

class Caisse {
  constructor(
    private readonly etat: EtatFabricationIV,
    private readonly outils: OutilsFabricationIV,
    private readonly etape: EtapeChaineIV,
  ) {}

  /** Réserve un appel ; refus (plafond ou budget du studio) : rien ne part. Idempotent par appel et par tentative. */
  async reserver(d: Omit<DemandeDepenseIV, "videoId">): Promise<{ ok: true } | { ok: false; message: string }> {
    // Une relance automatique (même tentative) ouvre une série de clés neuve : l'appel qui repart est réservé de nouveau, jamais « déjà fait ».
    const relance = this.etat.relances?.[this.etape] ?? 0;
    const serie = `${this.etape}#${this.etat.tentatives[this.etape] ?? 1}${relance ? `.r${relance}` : ""}`;
    const cle = `${serie}:${d.appelId}`;
    if (relance) d = { ...d, appelId: `${d.appelId}.r${relance}` };
    if (this.etat.caisse.reservations.some((r) => r.cle === cle)) return { ok: true };
    const engage = engageCentimes(this.etat);
    const centimes = Math.max(0, Math.ceil(d.centimes));
    const plafond = this.etat.caisse.plafondCentimes;
    const depasse = engage + centimes > plafond;
    const phrase = `Cette vidéo dépasse son prix annoncé (${euros(plafond)}, engagé ${euros(engage)}, ${euros(centimes)} de plus).`;
    // Règle du 25/10 : le prix ne bloque jamais. Mode indicatif : le repère dépassé est signalé avant la réservation ; sinon Will est prévenu seulement après une réservation acceptée.
    if (depasse && this.outils.budget.indicatif?.signaler) await this.outils.budget.indicatif.signaler(phrase).catch(() => undefined);
    const r = await this.outils.budget.reserver({ ...d, videoId: this.etat.demande.videoId, centimes });
    if (!r.ok) return r;
    // Seul le crédit réel du studio peut refuser ; le journal garde la trace du dépassement une fois la réservation acceptée.
    if (depasse && !this.outils.budget.indicatif) {
      this.etat.journal.push(`Avertissement : ${phrase} Le crédit réel suffit, la fabrication continue.`);
      if (this.outils.budget.avertir) await this.outils.budget.avertir(phrase).catch(() => undefined);
    }
    this.etat.caisse.reservations.push({ cle, etape: d.etape, fournisseur: d.fournisseur, centimes });
    return { ok: true };
  }

  /** Forme attendue par la lecture et l'écriture (dollars, modèle). */
  claude(etape: "lecture" | "ecriture") {
    return {
      reserver: (d: { appelId: string; modele: string; coutEstimeUsd: number }) =>
        this.reserver({ appelId: d.appelId, etape, fournisseur: "anthropic", centimes: centimesEurDeUsd(d.coutEstimeUsd, this.etat.demande.tauxUsdEur), coutEstimeUsd: d.coutEstimeUsd, modele: d.modele }),
    };
  }

  /** Forme attendue par la porte (transcription ou Claude). */
  controles() {
    return {
      reserver: (d: DemandeReservationControleIV) =>
        this.reserver({
          appelId: d.appelId,
          etape: d.fournisseur === "claude" ? "relecture" : "ecoute",
          fournisseur: d.fournisseur === "claude" ? "anthropic" : "transcription",
          centimes: centimesEurDeUsd(d.coutEstimeUsd, this.etat.demande.tauxUsdEur),
          coutEstimeUsd: d.coutEstimeUsd,
          ...(d.modele ? { modele: d.modele } : {}),
        }),
    };
  }
}

/* ------------------------------------------------------------------ */
/* Décisions de Will (pures)                                             */
/* ------------------------------------------------------------------ */

export class ErreurDecisionIV extends Error {
  constructor(
    message: string,
    readonly phrases: string[] = [],
  ) {
    super(message);
    this.name = "ErreurDecisionIV";
  }
}

/** La carte que Will a corrigée : recalculée par le code (chiffres, formules), ses choix gardés (types, offre, formules tranchées). */
function carteCorrigee(proposee: CarteImage, corrigee: CarteImage): CarteImage {
  const lue = schemaCarteImage.parse(corrigee);
  const recalculee = completerCarte(lue);
  const choix = new Map(lue.formulesAbsolues.filter((f) => f.choixWill).map((f) => [`${f.ou}|${f.texte}`, f.choixWill!]));
  return schemaCarteImage.parse({
    ...recalculee,
    types: lue.types,
    offre: lue.offre,
    automatisation: lue.automatisation,
    // L'image reste celle qui a été lue : Will corrige la carte, pas le fichier.
    image: proposee.image,
    formulesAbsolues: recalculee.formulesAbsolues.map((f) => (choix.has(`${f.ou}|${f.texte}`) ? { ...f, choixWill: choix.get(`${f.ou}|${f.texte}`)! } : f)),
  });
}

/**
 * « Valider la carte » (Will) : la carte corrigée (ou proposée) est contrôlée, puis figée avec sa validation
 * (empreinte de l'image, convention du script et de Q03). Refus en phrases si elle a une erreur bloquante.
 */
export function validerCarteIV(etat: EtatFabricationIV, d: DecisionCarteIV): EtatFabricationIV {
  const p = etat.propositionCarte;
  if (etat.etape !== "carte-a-valider" || !p) throw new ErreurDecisionIV("Aucune carte n'attend votre validation.");
  if (d.proposition !== p.empreinte) throw new ErreurDecisionIV("Cette carte a changé depuis votre relecture : relisez-la.");
  let carte: CarteImage;
  try {
    carte = d.carte ? carteCorrigee(p.carte, d.carte) : p.carte;
  } catch {
    throw new ErreurDecisionIV("La carte corrigée est incomplète : vérifiez chaque bloc, puis validez de nouveau.");
  }
  // R2 : une carte incohérente ne bloque pas la vidéo, le code la répare seul (dit à Will dans les alertes et le journal).
  const reparee = reparerEtSignaler(carte, { typeChoisi: !!d.carte });
  carte = reparee.carte;
  // Puis les blocs sans flèche rangés dans une branche : lien déduit de la mise en page (marqué, signalé), sinon blocage expliqué.
  const { carte: reliee, deduits } = reparerOrphelinsDeBranche(carte);
  const vusDeduits = new Set(deduits.map((l) => l.vers));
  carte = reliee;
  // R5 : puis le réalisme (calculs, chiffres absurdes, parts, ordre), sans rien demander à Will ni à l'IA.
  const auto = adapterCarteAutomatiquement(carte, { typeChoisi: !!d.carte });
  carte = auto.carte;
  const controle = controlerCarte(carte);
  if (!controle.ok) {
    const aide = " Ce bloc n'a aucune flèche et le code ne peut pas deviner où le relier : relancez la lecture avec une image où il est relié.";
    throw new ErreurDecisionIV("La carte corrigée a encore un défaut bloquant.", controle.erreurs.map((m) => (m.endsWith("n'est relié à rien.") ? m + aide : m)));
  }
  const validee: CarteImage = { ...carte, validation: { par: "will", le: d.le.slice(0, 40), empreinteCarte: carte.image.empreinte } };
  const e = structuredClone(etat);
  delete e.propositionCarte;
  delete e.miseDeCote;
  e.carte = { carte: validee, par: "will" };
  e.journal.push(`Carte validée par Will${d.carte ? " (corrigée)" : ""}.`);
  if (vusDeduits.size > 0) e.journal.push(`Liens déduits de la mise en page (aucune flèche sur l'image) : ${deduits.map((l) => `${l.de} → ${l.vers}`).join(", ")}.`);
  if (reparee.reparations.length > 0) e.journal.push(`Carte réparée par le code avant validation : ${reparee.reparations.map((x) => x.detail).join(" ")}`);
  if (auto.phrases.length > 0) e.journal.push(`Carte adaptée automatiquement avant validation : ${auto.phrases.join(" ")}`);
  return passerA(e, "ecriture");
}

/**
 * « Valider et fabriquer » (Will) : le script (modifié ou non), ses choix sur les formules et ses ajouts repassent TOUS
 * les contrôles ; la question de commentaire passe ceux du plan des fins. Refus en phrases, rien n'est gardé.
 */
export function validerScriptIV(etat: EtatFabricationIV, d: DecisionScriptIV): EtatFabricationIV {
  const p = etat.propositionScript;
  const carte = etat.carte?.carte;
  if (etat.etape !== "script-a-valider" || !p || !carte) throw new ErreurDecisionIV("Aucun script n'attend votre validation.");
  if (d.proposition !== p.empreinte) throw new ErreurDecisionIV("Ce script a changé depuis votre relecture : relisez-le.");
  const lu = schemaFicheImage.safeParse(d.fiche ?? p.fiche);
  if (!lu.success) throw new ErreurDecisionIV("Le script modifié est incomplet.", lu.error.issues.slice(0, 10).map((i) => `${i.path.join(".") || "script"} : ${i.message}`));
  const fiche = lu.data;
  const choixFormules = { ...(d.choixFormules ?? {}) };
  const ajoutsWill = [...(d.ajoutsWill ?? [])];
  const verdict = verifierScript(fiche, { carte, choixFormules, ajoutsWill, interdits: etat.demande.interdits ?? [], ...recitDe(etat) });
  if (!verdict.ok) throw new ErreurDecisionIV(`Le script ne passe pas encore les contrôles (${verdict.manquements.length} point(s)).`, verdict.manquements.map((m) => m.message));
  const question = etat.demande.appelCommentaire === "question-puis-fin" ? fiche.questionCommentaire.texteDit : undefined;
  if (question) {
    const refus = refusQuestion(question);
    if (refus) throw new ErreurDecisionIV(refus, [refus]);
  }
  const plan = planDesFinsIV({ reseaux: etat.demande.reseaux, offre: carte.offre, appelCommentaire: etat.demande.appelCommentaire, ...(question ? { questionCommentaire: question } : {}) });
  const variete = etat.variete && d.variete ? changerVarieteIV(etat.variete.recette, d.variete, carte) : etat.variete?.recette;
  const e = structuredClone(etat);
  delete e.propositionScript;
  delete e.miseDeCote;
  e.script = { fiche, choixFormules, ajoutsWill };
  if (e.variete && variete && JSON.stringify(variete) !== JSON.stringify(e.variete.recette)) {
    e.variete = { ...e.variete, recette: variete, par: "will" };
    e.journal.push(`Variété changée par Will : ${ligneRecette(variete)}.`);
  }
  e.plan = plan;
  // Un script changé après une première voix : les prises de même texte seront reprises, jamais relues.
  delete e.pistes;
  delete e.courtes;
  delete e.scenes;
  delete e.ecransAdaptes;
  delete e.ecransImposesRendu;
  delete e.ecransImposesRepli;
  delete e.remarques;
  e.journal.push(`Script validé par Will${d.fiche ? " (modifié)" : ""} : la voix peut être payée.`);
  return passerA(e, "voix");
}

/** Will impose le type de l'image après « Je ne reconnais pas ce type d'image » : les lectures payées sont reprises. */
export function imposerTypeIV(etat: EtatFabricationIV, type: TypeImage): EtatFabricationIV {
  const e = structuredClone(etat);
  e.demande.typeImpose = type;
  e.journal.push(`Type d'image imposé par Will : ${type}.`);
  return reprendreIV(e);
}

/**
 * « Réessayer » : seule l'étape arrêtée repart, dans une nouvelle tentative ; tout ce qui est payé reste. `plafondCentimes`
 * : Will relève le plafond de la vidéo (arrêt « plafond atteint »).
 */
export function reprendreIV(etat: EtatFabricationIV, o: { plafondCentimes?: number } = {}): EtatFabricationIV {
  const e = o.plafondCentimes !== undefined ? releverPlafondIV(etat, o.plafondCentimes) : structuredClone(etat);
  if (!e.refus) return e;
  // 15/10 (v-dd3049053f88) : voix d'une fin de la chaîne de secours refusée : l'étape suivante remplace la fin refusée
  // dans le plan ; seule une fin de secours sera lue (le corps et les autres fins payés sont repris, jamais relus).
  const secours = planDeSecoursIV(e);
  if (secours) poserSecoursIV(e, secours);
  // Travail monté AVANT la variété (trav-f2b26bba35ac) : relancer les contrôles relirait les anciens fichiers et
  // referait le même refus. On repart de la mise en scène (la variété y est tirée) ; script, voix et caisse restent.
  // Même chose quand les contrôles ont refusé la VIDÉO elle-même (refus non réessayable, 18/10 : mise en page de la
  // toile et queue de fin corrigées dans le moteur) : relancer « controles » mesurerait les anciens fichiers. La mise
  // en scène est refaite avec les règles à jour ; un rendu dont l'identifiant (ligne de temps + mixage) n'a pas changé
  // est gardé, les autres sont refaits (gratuit, sur le serveur) ; les lectures payées restent dans l'état.
  const avantVariete = !e.variete;
  const defautDeLaVideo = e.refus.etape === "controles" && e.refus.reessayable === false;
  if ((e.refus.etape === "rendu" || e.refus.etape === "controles") && e.script && (avantVariete || defautDeLaVideo)) {
    delete e.refus;
    delete e.attente;
    delete e.scenes;
    delete e.ecransAdaptes;
    delete e.ecransImposesRendu;
    delete e.ecransImposesRepli;
    delete e.remarques;
    if (avantVariete) delete e.rendus;
    e.etape = "mise-en-scene";
    delete e.tentatives.livraison;
    e.tentatives["mise-en-scene"] = (e.tentatives["mise-en-scene"] ?? 1) + 1;
    e.journal.push(
      avantVariete
        ? "Reprise à la mise en scène : la vidéo a été montée avant la variété, elle est refaite avec la variété (script et voix gardés, rien de repayé)."
        : "Reprise à la mise en scène : les contrôles ont refusé la vidéo, elle est remontée avec les règles à jour (script, voix et lectures payées gardés, rien de repayé).",
    );
    return e;
  }
  // Aucun fichier rendu pour aucun réseau : la livraison ne se rejoue pas à vide, on repart du rendu.
  if (e.refus.etape === "livraison" && e.refus.code === "IV_RENDU") {
    delete e.refus;
    delete e.attente;
    delete e.livraison;
    delete e.rendus;
    delete e.tentatives.livraison;
    e.etape = "rendu";
    e.tentatives.rendu = (e.tentatives.rendu ?? 1) + 1;
    e.journal.push("Reprise du rendu : aucun fichier n'avait été rendu pour aucun réseau.");
    return e;
  }
  const etape = e.refus.etape;
  // R1 : une lecture refusée APRÈS les deux lectures payées (carte « incomplète » ou « illisible » d'origine fusion, refus réessayable ; « sans texte » ou « trop chargée » ne relisent pas) donnerait
  // le même refus si on rendait les mêmes lectures : on les efface pour relire vraiment. (« Type à choisir » d'un ancien
  // état : les lectures restent, Will impose le type sans repayer.)
  const relireVraiment = etape === "lecture" && e.refus.code === "IV_IMAGE" && e.refus.reessayable !== false && !!e.lectures?.a && !!e.lectures?.b;
  if (relireVraiment) delete e.lectures;
  delete e.refus;
  delete e.attente;
  e.etape = etape;
  e.tentatives[etape] = (e.tentatives[etape] ?? 1) + 1;
  e.journal.push(relireVraiment ? `Reprise de l'étape « ${etape} » : relecture neuve, comptée dans le prix accordé.` : `Reprise de l'étape « ${etape} ».`);
  return e;
}

/** Pose l'étape suivante de la chaîne de secours (`secours.ts`) dans le plan ; ce qui en dépendait sera refait. */
function poserSecoursIV(e: EtatFabricationIV, secours: SecoursIV): void {
  e.plan = secours.plan;
  delete e.pistes;
  delete e.courtes;
  delete e.scenes;
  delete e.ecransAdaptes;
  delete e.ecransImposesRendu;
  delete e.ecransImposesRepli;
  delete e.remarques;
  delete e.tentatives.livraison;
  if (secours.phrases.length) e.journal.push(`Fin de secours pour ${secours.reseaux.join(", ")} : « ${secours.phrases.join(" ")} » (validée par Will).`);
  // 19/10 (v-6a3b74364711) : relecture de la seule fin de secours refusée (une lecture neuve du même texte, une seule fois) ;
  // la voix la prépare au tour suivant AVANT toute lecture, le corps et les autres fins payés sont gardés.
  if (secours.relire.length && e.voix) {
    e.voix.relire = [...secours.relire];
    e.journal.push(`Relecture de la seule fin pour ${secours.reseauxRelire.join(", ")} (lecture neuve du même texte) : corps et autres fins payés gardés.`);
  }
  for (const r of secours.replis) e.journal.push(`${r} Aucune lecture : le son déjà payé et validé est repris.`);
}

/**
 * Nouveau plafond de la vidéo (centimes d'euro), sans rien relancer : l'arrêt éventuel reste, « Réessayer » reprend
 * ensuite l'étape arrêtée. Jamais sous ce qui est déjà engagé (la caisse ne rend rien).
 */
export function releverPlafondIV(etat: EtatFabricationIV, plafondCentimes: number): EtatFabricationIV {
  const e = structuredClone(etat);
  const avant = e.caisse.plafondCentimes;
  e.caisse.plafondCentimes = Math.max(0, Math.floor(plafondCentimes), engageCentimes(e));
  e.demande.plafondCentimes = e.caisse.plafondCentimes;
  if (e.caisse.plafondCentimes !== avant) e.journal.push(`Plafond de la vidéo : ${euros(avant)} → ${euros(e.caisse.plafondCentimes)}.`);
  return e;
}

/** « Refaire le script » après un refus des contrôles : le script validé redevient une proposition, la voix est gardée. */
export function rouvrirScriptIV(etat: EtatFabricationIV): EtatFabricationIV {
  if (!etat.script || !etat.carte) throw new ErreurDecisionIV("Aucun script validé à reprendre.");
  const e = structuredClone(etat);
  const fiche = e.script!.fiche;
  delete e.refus;
  delete e.script;
  delete e.rendus;
  delete e.controles;
  delete e.livraison;
  e.propositionScript = propositionScript(e, fiche, aTrancherParWill(verifierScript(fiche, { carte: e.carte!.carte, ...recitDe(e) })));
  e.journal.push("Script rouvert pour correction.");
  return passerA(e, "script-a-valider");
}

/* ------------------------------------------------------------------ */
/* Prix                                                                  */
/* ------------------------------------------------------------------ */

/** Plan § 9 : transcription au pire, et relecture finale au pire, PAR VERSION (dollars). */
const TRANSCRIPTION_USD_PAR_VERSION = 0.012;
const RELECTURE_USD_PAR_VERSION = { habituel: 0.25, auPlus: 0.5 };
/** Lectures payées au plus par texte (relectures neuves, puis une relance de ressemblance chacune). */
const LECTURES_VOIX_AU_PLUS = { corps: 3 * 2, fin: 2 * 2 };

/**
 * 20/10 : la voix est lue d'UN trait (corps, partie commune des fins, phrase propre à chaque réseau) pour une vidéo neuve ;
 * une voix déjà payée en segments séparés (« voix-iv/1 ») garde ses segments, JAMAIS relue : sans cette garde, la reprise
 * relirait en payant le corps de toute vidéo reprise.
 */
// Un état déjà payé suit SA version, jamais le drapeau (le remettre à `false` ne doit pas relire les voix « voix-iv/2 »).
const lectureUniqueDe = (voix: Pick<EtatVoixIV, "version"> | undefined) => (voix ? voix.version === "voix-iv/2" : LECTURE_UNIQUE_IV);

/** Prix de la suite après la validation du script : voix (au caractère), écoute et relecture de chaque version. */
export function prixSuiteIV(etat: Pick<EtatFabricationIV, "demande" | "caisse" | "voix">, fiche: FicheImage, plan: PlanDesFinsIV, tarifVoixCentimesParCaractere: number): PrixIV {
  const segments = segmentsVoixIV(fiche, plan, { lectureUnique: lectureUniqueDe(etat.voix) });
  const taux = etat.demande.tauxUsdEur;
  const voix = (n: number, k: number) => Math.ceil(n * k * tarifVoixCentimesParCaractere - 1e-9);
  const caracteresFins = segments.fins.reduce((s, f) => s + f.texte.length, 0);
  // Une transcription par piste (le 4:5 reprend celle de sa piste), une relecture d'images par FICHIER (Facebook : deux).
  const pistes = segments.versions.length;
  const fichiers = segments.versions.reduce((n, v) => n + reseauxParFormatIV(v.reseaux, etat.demande).length, 0);
  const controles = (relecture: number) => pistes * centimesEurDeUsd(TRANSCRIPTION_USD_PAR_VERSION, taux) + fichiers * centimesEurDeUsd(relecture, taux);
  return {
    engageCentimes: engageCentimes(etat),
    habituelCentimes: voix(segments.corps.length, 1) + voix(caracteresFins, 1) + controles(RELECTURE_USD_PAR_VERSION.habituel),
    // Au pire, des versions courtes s'ajoutent (au plus une par version) : contrôles comptés deux fois.
    auPlusCentimes: voix(segments.corps.length, LECTURES_VOIX_AU_PLUS.corps) + voix(caracteresFins, LECTURES_VOIX_AU_PLUS.fin) + 2 * controles(RELECTURE_USD_PAR_VERSION.auPlus),
    plafondCentimes: etat.caisse.plafondCentimes,
  };
}

/* ------------------------------------------------------------------ */
/* Le pas                                                                */
/* ------------------------------------------------------------------ */

function passerA(e: EtatFabricationIV, etape: EtapeIV): EtatFabricationIV {
  e.etape = etape;
  delete e.attente;
  if ((ETAPES_IV as readonly string[]).includes(etape) && !e.tentatives[etape as EtapeChaineIV]) e.tentatives[etape as EtapeChaineIV] = 1;
  return e;
}

function refuser(e: EtatFabricationIV, etape: EtapeChaineIV, code: CodeRefusIV, message: string, o: { phrases?: string[]; reessayable?: boolean } = {}): EtatFabricationIV {
  e.refus = { etape, code, message, ...(o.phrases?.length ? { phrases: o.phrases } : {}), reessayable: o.reessayable ?? true };
  e.journal.push(`Arrêt à l'étape « ${etape} » : ${message}`);
  e.etape = "refusee";
  delete e.attente;
  return e;
}

/** Le récit tiré (règles du script et écriture) ; rien sans recette (REC-A d'aujourd'hui). */
const recitDe = (e: Pick<EtatFabricationIV, "variete">) => (e.variete ? { recit: e.variete.recette.recit } : {});

/** Fiche simulée du script ; refus des cartes et scripts : jamais un message brut. */
const raisonDe = (err: unknown) => (err instanceof Error ? err.message : String(err));

function propositionScript(e: EtatFabricationIV, fiche: FicheImage, aTrancher: Manquement[], tarif?: number): PropositionScriptIV {
  const question = e.demande.appelCommentaire === "question-puis-fin" ? fiche.questionCommentaire.texteDit : undefined;
  let prix: PrixIV = { engageCentimes: engageCentimes(e), habituelCentimes: 0, auPlusCentimes: 0, plafondCentimes: e.caisse.plafondCentimes };
  try {
    const plan = planDesFinsIV({ reseaux: e.demande.reseaux, offre: e.carte!.carte.offre, appelCommentaire: e.demande.appelCommentaire, ...(question && !refusQuestion(question) ? { questionCommentaire: question } : {}) });
    if (tarif !== undefined) prix = prixSuiteIV(e, fiche, plan, tarif);
  } catch {
    // Prix inconnu tant que la question n'est pas corrigée : Will la corrige avant de valider.
  }
  return { fiche, aTrancher, formules: formulesDuScript(fiche), empreinte: empreinteDe({ fiche, aTrancher }), prix };
}

/** Une version à fabriquer : longue (une par fin du plan) ou courte (taillée dans la même voix), dans un format. */
interface VersionIV {
  id: string;
  reseaux: ReseauIV[];
  courte: boolean;
  /** Absent : 9:16 (la version d'avant). */
  format?: FormatIV;
  fiche: FicheImage;
  fin: FinIV | null;
  piste: PisteVoixSeuleIV;
  retires?: string[];
  noeudsRetires?: string[];
}

function finDe(plan: PlanDesFinsIV, version: string): FinIV | null {
  const f = plan.fins.find((x) => x.id === version);
  return f && !f.muet ? f : null;
}

/** Nœuds de la carte que la version courte ne nomme plus (Q04, Q12). */
function noeudsRetiresDe(carte: CarteImage, longue: FicheImage, courte: FicheImage): string[] {
  const gardes = new Set(courte.ecrans.map((x) => x.id));
  const refsGardees = new Set(courte.ecrans.flatMap((x) => x.refs));
  return [...new Set(longue.ecrans.filter((x) => !gardes.has(x.id)).flatMap((x) => x.refs))].filter((r) => !refsGardees.has(r) && carte.noeuds.some((n) => n.id === r)).sort();
}

function versionsDe(e: EtatFabricationIV): VersionIV[] {
  const { script, plan, carte } = e;
  if (!script || !plan || !carte) return [];
  const longues = (e.pistes ?? []).map((p) => ({ id: p.version, reseaux: [...p.reseaux], courte: false, fiche: script.fiche, fin: finDe(plan, p.version), piste: p }));
  const courtes = (e.courtes ?? []).flatMap((c) =>
    c.resultat
      ? [{ id: c.resultat.piste.version, reseaux: [...c.reseaux], courte: true, fiche: c.resultat.fiche, fin: finDe(plan, c.version), piste: { ...c.resultat.piste, reseaux: [...c.reseaux] }, retires: c.resultat.retires, noeudsRetires: noeudsRetiresDe(carte.carte, script.fiche, c.resultat.fiche) }]
      : [],
  );
  // Chaque version, une fois par format de ses réseaux (même piste : une seule voix) ; le 9:16 d'abord, inchangé.
  return [...longues, ...courtes].flatMap((v: VersionIV) =>
    reseauxParFormatIV(v.reseaux, e.demande).map(({ format, reseaux }) => (format === "9:16" ? { ...v, reseaux } : { ...v, id: idVersionFormatIV(v.id, format), reseaux, format })),
  );
}

/** Lignes de temps des versions à fabriquer (PUR) : une par (groupe de fins × format), dans l'ordre des versions. */
export function lignesDesVersionsIV(e: EtatFabricationIV, bruitages: readonly BruitageValideIV[] = BRUITAGES_V4_IV): { version: string; reseaux: ReseauIV[]; courte: boolean; format: FormatIV; piste: string; ligne: LigneDeTempsIV }[] {
  return versionsDe(e).map((v) => ({ version: v.id, reseaux: [...v.reseaux], courte: v.courte, format: v.format ?? "9:16", piste: v.piste.version, ligne: mettreEnSceneIV(sceneDe(e, v, bruitages)).ligne }));
}

/** Une version dite pour Will : « LinkedIn », « Facebook (fil 4:5) », « TikTok (version courte) ». */
const nomVersion = (v: Pick<VersionIV, "reseaux" | "courte" | "format">) => `${v.reseaux.join(", ")}${v.format === "4:5" ? " (4:5)" : ""}${v.courte ? " (version courte)" : ""}`;

/** Entrées de la mise en scène d'une version ; version courte : la carte sans les blocs retirés (Q12 les attend absents). */
function sceneDe(e: EtatFabricationIV, v: VersionIV, bruitages: readonly BruitageValideIV[]): EntreeMiseEnSceneIV {
  return {
    carte: v.courte ? carteSansRetires(e.carte!.carte, v.noeudsRetires ?? []) : e.carte!.carte,
    fiche: ficheAdapteeIV(v.fiche, [...(e.ecransAdaptes?.[v.id] ?? []), ...(e.ecransImposesRendu?.[v.id] ?? [])]),
    voix: { mots: v.piste.mots, motsCorps: v.piste.motsCorps, dureeSec: v.piste.dureeSec, finVoixSec: v.piste.finVoixSec },
    fin: v.fin,
    reseaux: v.reseaux,
    bruitagesValides: bruitages,
    ...(v.format === "4:5" ? { format: v.format } : {}),
    // Variété : la recette de la version (son format, l'ouverture de ses réseaux) ; les bruitages partent de la graine.
    ...(e.variete ? { variete: recettePourVersion(e.variete.recette, v.reseaux, v.format ?? "9:16"), graine: e.demande.videoId } : {}),
  };
}

/** Entrées de la mise en scène de chaque version de l'état, telles que `pasMiseEnScene` les lit (diagnostic, lecture seule). PUR. */
export function entreesMiseEnSceneIV(e: EtatFabricationIV, bruitages: readonly BruitageValideIV[] = BRUITAGES_V4_IV): { version: string; reseaux: ReseauIV[]; courte: boolean; entree: EntreeMiseEnSceneIV }[] {
  return versionsDe(e).map((v) => ({ version: v.id, reseaux: [...v.reseaux], courte: v.courte, entree: sceneDe(e, v, bruitages) }));
}

function publicationDe(e: EtatFabricationIV): { publication: PublicationIV; liens: Record<string, string> } {
  const { script, plan, carte, demande } = e;
  const liens = liensSuivisIV(demande.reseaux, demande.numeroVersion, demande.activite);
  const question = demande.appelCommentaire === "question-puis-fin" ? script!.fiche.questionCommentaire.texteDit : undefined;
  const publication = textesDePublicationIV(
    { accroche: script!.fiche.accroches[0].texteDit, resultat: phraseChocAttendue(carte!.carte, script!.choixFormules), ...(question ? { questionCommentaire: question } : {}) },
    plan!,
    liens,
    demande.interdits ?? [],
  );
  return { publication, liens };
}

/**
 * Un pas de la fabrication (voir l'en-tête). Ne lève que pour une panne de programmation ; toute panne d'un outil
 * devient un refus réessayable (phrase simple), une attente de rendu devient `attente`.
 */
export async function avancerIV(entree: EtatFabricationIV, outils: OutilsFabricationIV): Promise<EtatFabricationIV> {
  let e = await avancerUnPasIV(entree, outils);
  if (outils.relancesAuto === false || !e.refus || e.etape !== "refusee" || !e.refus.reessayable) return e;
  const { etape, code } = e.refus;
  // Filet : UNE seule relance par tour, pause courte ; un refus IV_PANNE met le travail en échec (`apresPanne` ne sert qu'aux exceptions) : après cette relance unique, il faut « Refaire » à la main.
  // Chaque relance réserve de nouveau (`relances` entre dans la clé de la caisse) : un appel qui repart est toujours un appel réservé.
  // Les contrôles ne sont jamais relancés ici : leurs transcriptions et relectures payées ne remontent à l'état qu'au retour de la porte.
  // Pas de « mode réparé » : l'écriture rejoue déjà ses refus de forme dans sa consigne ; relancer un refus d'écriture est un simple nouvel essai.
  if (!(CODES_RELANCABLES_IV.includes(code) && !(code === "IV_PANNE" && etape === "controles"))) return e;
  await (outils.pause ?? ((t) => new Promise<void>((ok) => setTimeout(ok, t))))(PAUSE_RELANCE_IV_MS);
  const quoi = code === "IV_PANNE" ? "panne passagère" : "refus de forme";
  const phrase = `${quoi}, un nouvel essai automatique de ${NOMS_ETAPES_IV[etape]}`;
  const relance = structuredClone(e);
  delete relance.refus;
  relance.etape = etape;
  relance.journal.push(`${phrase}.`);
  // Panne : même tentative, nouvelle série de clés de caisse. Écriture refusée : nouvelle tentative (ses appels sont comptés à part).
  if (code === "IV_PANNE") relance.relances = { ...relance.relances, [etape]: (relance.relances?.[etape] ?? 0) + 1 };
  else relance.tentatives[etape] = (relance.tentatives[etape] ?? 1) + 1;
  e = await avancerUnPasIV(relance, outils);
  if (e.refus && e.etape === "refusee") {
    e.refus.message = `${e.refus.message} Essayé automatiquement : ${phrase}.${e.refus.reessayable ? " Vous pouvez aussi « Refaire cette partie »." : ""}`;
    e.journal.push(`Essai automatique sans succès : ${phrase}.`);
  }
  return e;
}

/** Pause avant l'unique relance automatique (courte : le tour de la boucle reste sous son délai ; au-delà, c'est « Refaire » à la main ; `apresPanne` ne sert qu'aux exceptions). */
const PAUSE_RELANCE_IV_MS = 1500;
/** Refus relancés automatiquement une fois : une panne passagère, ou une écriture refusée sur la forme (les autres refus de forme ne sont pas réessayables). */
const CODES_RELANCABLES_IV: readonly CodeRefusIV[] = ["IV_PANNE", "IV_ECRITURE"];
/** Noms des étapes pour Will (jamais l'identifiant interne). */
const NOMS_ETAPES_IV: Record<EtapeChaineIV, string> = {
  lecture: "la lecture de l'image",
  "carte-a-valider": "la validation de ce que j'ai compris",
  ecriture: "l'écriture du script",
  "script-a-valider": "la validation du script",
  voix: "la voix",
  "mise-en-scene": "la mise en scène",
  rendu: "le montage de la vidéo",
  controles: "les vérifications finales",
  livraison: "la livraison",
};

async function avancerUnPasIV(entree: EtatFabricationIV, outils: OutilsFabricationIV): Promise<EtatFabricationIV> {
  if (estFinieIV(entree)) return entree;
  const e = structuredClone(entree);
  delete e.attente;
  const etape = e.etape as EtapeChaineIV;
  const caisse = new Caisse(e, outils, etape);
  const plafond = (code: CodeRefusIV = "IV_BUDGET"): CodeRefusIV => code;
  try {
    switch (etape) {
      case "lecture":
        return await pasLecture(e, outils, caisse, plafond);
      case "carte-a-valider":
        return await pasCarte(e, outils);
      case "ecriture":
        return await pasEcriture(e, outils, caisse, plafond);
      case "script-a-valider":
        return await pasScript(e, outils);
      case "voix":
        return await pasVoix(e, outils, caisse, plafond);
      case "mise-en-scene":
        return await pasMiseEnScene(e, outils);
      case "rendu":
        return await pasRendu(e, outils);
      case "controles":
        return await pasControles(e, outils, caisse);
      case "livraison":
        return pasLivraison(e);
    }
  } catch (err) {
    if (estAttenteIV(err)) {
      // Une réservation faite pendant ce pas reste comptée (l'appel a pu partir) ; le reste reprend au même endroit.
      const garde = structuredClone(entree);
      garde.caisse = e.caisse;
      if (e.compteurAppels !== undefined) garde.compteurAppels = e.compteurAppels;
      garde.attente = raisonDe(err);
      // Le nouvel essai du rendu et sa remarque survivent à l'attente.
      if (etape === "rendu") {
        garde.tentatives = e.tentatives;
        garde.journal = e.journal;
      }
      return garde;
    }
    // Q17 (son brut pas lisible en WAV) : « Refaire » relance la conversion, gratuite, sans relire la voix.
    if (err instanceof ErreurVoixIV) return refuser(e, etape, err.controle === "budget" ? plafond() : "IV_VOIX", err.message, { reessayable: err.controle === "budget" || err.controle === "Q17" });
    if (err instanceof ErreurRenduDefinitifIV) return refuser(e, etape, "IV_RENDU", err.message, { phrases: err.phrases, reessayable: false });
    return refuser(e, etape, "IV_PANNE", `Panne pendant ${NOMS_ETAPES_IV[etape]} : ${raisonDe(err)} Rien de ce qui est payé n'est perdu ; réessayez.`);
  }
  return e;
}

async function pasLecture(e: EtatFabricationIV, o: OutilsFabricationIV, caisse: Caisse, plafond: (c?: CodeRefusIV) => CodeRefusIV): Promise<EtatFabricationIV> {
  const { demande } = e;
  if (demande.texte !== undefined) return pasConceptionTexte(e, o, caisse, plafond);
  const octets = await o.lireImageSource(demande.image.cle);
  if (!octets) return refuser(e, "lecture", "IV_IMAGE", "L'image déposée est introuvable : déposez-la de nouveau.", { reessayable: false });
  const r = await lireImage(
    { videoId: demande.videoId, source: { cle: demande.image.cle, octets, ...(demande.image.empreinte ? { empreinte: demande.image.empreinte } : {}) }, ...(demande.typeImpose ? { typeImpose: demande.typeImpose } : {}), ...(demande.offre ? { offre: demande.offre } : {}) },
    { ...o.lecture, budget: caisse.claude("lecture") },
    e.lectures,
  );
  if (!r.ok) {
    if (r.lectures && Object.keys(r.lectures).length) e.lectures = r.lectures;
    if (r.motif === "type-inconnu") return refuser(e, "lecture", "IV_TYPE_A_CHOISIR", PHRASE_TYPE_INCONNU, { reessayable: false });
    if (r.motif === "budget") return refuser(e, "lecture", plafond(), r.message);
    // Panne de Claude (appel) : passagère, code « panne » relancé une fois seul par `avancerIV` ; image illisible : « image ».
    if (r.motif === "appel") return refuser(e, "lecture", "IV_PANNE", r.message);
    const reessayable = r.motif === "illisible" || r.motif === "conversion" || r.motif === "incomplete";
    return refuser(e, "lecture", "IV_IMAGE", r.message, { reessayable });
  }
  // Lectures gardées : une correction de type ou une reprise ne relit jamais l'image.
  delete e.lectures;
  return suiteCarteLue(e, o, r.carte, r.controle, (doutes) => `Image lue (${r.appels} appel(s)${r.simule ? ", simulés" : ""}) : ${r.carte.types.join(" + ")}${doutes.length ? `, ${doutes.length} doute(s)` : ""}.`);
}

/**
 * MODE TEXTE (R6b) : l'étape « lecture » conçoit le workflow depuis le texte de Will (même chemin de dépense que la
 * lecture : la caisse réserve le pire coût avant l'appel), puis la carte suit la chaîne d'une image lue (réparation
 * automatique, doutes, porte « carte »). Aucun fichier n'est lu.
 */
async function pasConceptionTexte(e: EtatFabricationIV, o: OutilsFabricationIV, caisse: Caisse, plafond: (c?: CodeRefusIV) => CodeRefusIV): Promise<EtatFabricationIV> {
  const { concevoirWorkflow } = await import("./texte/conception");
  const { demande } = e;
  const t = await concevoirWorkflow({ videoId: demande.videoId, texte: demande.texte, reseaux: demande.reseaux }, { appeler: o.lecture.appeler, budget: caisse.claude("lecture") });
  if (!t.ok) {
    if (t.motif === "budget" || t.motif === "plafond") return refuser(e, "lecture", plafond(), t.message);
    // Texte à reformuler : relancer le même texte donnerait le même refus ; panne ou sortie illisible : « Refaire » réessaie.
    if (t.motif === "appel") return refuser(e, "lecture", "IV_PANNE", t.message);
    return refuser(e, "lecture", "IV_IMAGE", t.message, { reessayable: t.motif === "illisible" });
  }
  // Même réparation automatique que pour une image lue (R2).
  const carte = reparerEtSignaler(t.carte, { typeChoisi: false }).carte;
  return suiteCarteLue(e, o, carte, controlerCarte(carte), (doutes) => `Workflow conçu depuis votre texte (${t.appels} appel(s)${t.simule ? ", simulés" : ""}) : ${carte.types.join(" + ")}${doutes.length ? `, ${doutes.length} doute(s)` : ""}.`);
}

/** Suite commune de la lecture d'une image et de la conception d'un texte : la carte proposée, ses doutes, la porte « carte ». */
async function suiteCarteLue(e: EtatFabricationIV, o: OutilsFabricationIV, carteLue: CarteImage, controleLu: ControleCarte, ligne: (doutes: string[]) => string): Promise<EtatFabricationIV> {
  const { demande } = e;
  // R5 : AVANT la validation et le script (l'empreinte de la carte, lue par Q03, change avec elle), la carte est réparée puis
  // adaptée au réalisme par le code, sans appel IA. Si elle change, sa validation tombe (rien n'est encore validé ici).
  const adaptee = adapterCarteAutomatiquement(carteLue, { typeChoisi: !!demande.typeImpose });
  let lue = adaptee.carte;
  const controle = adaptee.changee ? controlerCarte(lue) : controleLu;
  const doutes = doutesDeLaCarte(lue, controle);
  // Mode automatique : chaque doute accepté sans relecture est écrit dans les adaptations (visible sur l'écran de résultat),
  // AVANT l'empreinte de la proposition.
  if (demande.validationCarte === "automatique" && doutes.length) lue = ecrireAdaptations(lue, doutes.map((d) => `Point accepté sans relecture, à vérifier : ${d}`));
  e.propositionCarte = { carte: lue, controle, doutes, empreinte: empreinteDe({ carte: lue, controle }) };
  e.journal.push(ligne(doutes));
  if (lue.adaptations?.length) e.journal.push(`Carte adaptée automatiquement (${lue.adaptations.length}) : ${lue.adaptations.map((x) => x.replace(/^Adapté automatiquement : /, "")).join(" ; ")}`);

  // Lot : aucune porte n'attend Will (ni B6, ni le réglage « toujours ») ; contrôle automatique à la place.
  if (demande.lot) return carteEnLot(e, o);
  // Mode automatique (défaut) : la carte réparée est validée par le réglage, même sous 10 cartes et malgré les doutes.
  // Seul un défaut bloquant que le code n'a pas su réparer garde la porte (Will peut alors corriger la carte).
  if (demande.validationCarte === "automatique" && controle.ok) {
    const carte: CarteImage = { ...lue, validation: { par: "reglage", le: o.maintenant().slice(0, 40), empreinteCarte: lue.image.empreinte } };
    delete e.propositionCarte;
    e.carte = { carte, par: "reglage" };
    e.journal.push(`Carte validée par le réglage « automatique »${doutes.length ? ` : ${doutes.length} point(s) accepté(s) sans relecture, écrit(s) dans « Adapté automatiquement, à vérifier »` : ""}.`);
    return passerA(e, "ecriture");
  }
  const validees = await o.cartesValidees();
  const obligatoire = validees < CARTES_OBLIGATOIRES;
  if (obligatoire || demande.validationCarte === "toujours" || doutes.length || !controle.ok) return passerA(e, "carte-a-valider");
  // « si-doute », 10 cartes validées, aucun doute : la carte est validée par le réglage de Will.
  const carte: CarteImage = { ...lue, validation: { par: "reglage", le: o.maintenant().slice(0, 40), empreinteCarte: lue.image.empreinte } };
  delete e.propositionCarte;
  e.carte = { carte, par: "reglage" };
  e.journal.push("Carte sans doute : validée par le réglage « si-doute » (10 cartes déjà validées).");
  return passerA(e, "ecriture");
}

/** Lot, porte « carte » : les mêmes fonctions que Will (`validerCarteIV`), avec la carte telle que proposée. */
function carteEnLot(e: EtatFabricationIV, o: OutilsFabricationIV): EtatFabricationIV {
  const p = e.propositionCarte!;
  // Mode automatique : plus de mise de côté sur doute ; seul un défaut bloquant resté après réparation met la vidéo de côté.
  const mise = e.demande.validationCarte === "automatique" ? (p.controle.ok ? null : { motif: "Ce que j'ai compris de l'image a un défaut.", phrases: [...new Set(p.controle.erreurs)] }) : miseDeCoteCarteIV(p.carte, p.controle, p.doutes);
  passerA(e, "carte-a-valider");
  if (mise) return mettreDeCote(e, "carte", mise.motif, mise.phrases);
  try {
    const valide = validerCarteIV(e, { proposition: p.empreinte, le: o.maintenant() });
    // Validée par le contrôle automatique, pas par Will : `par: "reglage"` ; elle ne compte pas parmi les cartes relues.
    valide.carte = { carte: { ...valide.carte!.carte, validation: { ...valide.carte!.carte.validation!, par: "reglage" } }, par: "reglage" };
    valide.journal = valide.journal.filter((l) => !l.startsWith("Carte validée par Will"));
    valide.journal.push(e.demande.validationCarte === "automatique" ? "Carte validée par le réglage « automatique » (lot)." : "Carte sans doute : validée par le contrôle automatique du lot.");
    return valide;
  } catch (err) {
    return mettreDeCote(e, "carte", raisonDe(err), err instanceof ErreurDecisionIV ? err.phrases : []);
  }
}

/** Lot : la vidéo reste à sa porte, marquée « mise de côté » (rien de la suite n'est payé). */
function mettreDeCote(e: EtatFabricationIV, porte: "carte" | "script", motif: string, phrases: string[]): EtatFabricationIV {
  e.miseDeCote = { porte, motif, phrases };
  e.journal.push(`Mise de côté (${porte === "carte" ? "ce que j'ai compris" : "le script"}) : ${motif}`);
  return e;
}

async function pasCarte(e: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  const d = await o.decisions?.carte?.();
  if (!d || d.proposition !== e.propositionCarte?.empreinte) return e;
  try {
    return validerCarteIV(e, d);
  } catch (err) {
    e.journal.push(`Validation de la carte refusée : ${raisonDe(err)}`);
    return e;
  }
}

async function pasEcriture(e: EtatFabricationIV, o: OutilsFabricationIV, caisse: Caisse, plafond: (c?: CodeRefusIV) => CodeRefusIV): Promise<EtatFabricationIV> {
  const carte = e.carte!.carte;
  const tentative = e.tentatives.ecriture ?? 1;
  // Variété : tirée une seule fois, avant la première écriture (une reprise garde la même recette).
  if (!e.variete) {
    const historique = [...((await o.historiqueVariete?.()) ?? [])].slice(0, HISTORIQUE_VARIETE_IV);
    const recette = tirerVarieteIV({ graine: e.demande.videoId, carte, format: "9:16", historique });
    e.variete = { recette, par: "tirage", historique: historique.length };
    e.journal.push(`Variété tirée (${historique.length} vidéo(s) d'historique) : ${ligneRecette(recette)}.`);
  }
  const r = await ecrireScriptIV(
    // L'identifiant des appels porte la tentative : un nouvel essai après un refus est compté à part.
    { videoId: e.demande.videoId, versionId: tentative > 1 ? `${e.demande.versionId}-t${tentative}` : e.demande.versionId, carte, interdits: e.demande.interdits ?? [], decoupage: "chapitres", ...recitDe(e) },
    { ...o.ecriture, budget: caisse.claude("ecriture") },
  );
  if (r.ok || r.motif === "a-trancher") {
    e.propositionScript = propositionScript(e, r.fiche, r.aTrancher, o.voix.tarifCentimesParCaractere);
    e.journal.push(`Script écrit (${r.appels} appel(s)${r.simule ? ", simulés" : ""})${r.aTrancher.length ? `, ${r.aTrancher.length} point(s) à trancher` : ""}.`);
    passerA(e, "script-a-valider");
    // Lot : aucune porte n'attend Will ; contrôle automatique avant de payer la voix.
    return e.demande.lot || e.demande.validationCarte === "automatique" ? controleAutomatiqueScriptIV(e, e.demande.lot ? o.budget.indicatif?.facteurSecurite : undefined, { prixIndicatif: !!o.budget.indicatif }) : e;
  }
  if (r.motif === "budget") return refuser(e, "ecriture", plafond(), r.message);
  return refuser(e, "ecriture", "IV_ECRITURE", r.message, { phrases: r.refus, reessayable: r.motif !== "reglage" });
}

/**
 * Lot, porte « script » (plan § d.2). PUR. `null` : le script est sans doute (rien à trancher, prix connu et dans le prix
 * accordé). Les formules absolues passent avant « à trancher » : B7, rien n'est changé sans Will.
 */
export function miseDeCoteScriptIV(p: PropositionScriptIV, facteurSecurite?: number, options: { formulesGardees?: boolean; prixIndicatif?: boolean } = {}): { motif: string; phrases: string[] } | null {
  // R5 (mode automatique) : les phrases affirmatives sont GARDÉES telles quelles ; elles ne mettent rien de côté.
  const aTrancher = options.formulesGardees ? p.aTrancher.filter((m) => m.regle !== "Q05bis") : p.aTrancher;
  if (p.formules.length && !options.formulesGardees) return { motif: `Une formule trop affirmative est dans le script : ${p.formules.map((f) => `« ${f.texte} »`).join(", ")}.`, phrases: p.aTrancher.map((m) => m.message) };
  if (aTrancher.length) return { motif: "Le script a une phrase à trancher.", phrases: aTrancher.map((m) => m.message) };
  if (!(p.prix.auPlusCentimes > 0)) return { motif: "Le prix de la voix n'a pas pu être calculé.", phrases: [] };
  // Mode indicatif (`prixIndicatif`, ordre du 25/10) : le prix ne met JAMAIS le script de côté (le prix de la voix inconnu, plus haut, reste un manque).
  if (options.prixIndicatif) return null;
  if (p.prix.engageCentimes + p.prix.auPlusCentimes > p.prix.plafondCentimes * (facteurSecurite ?? 1)) {
    return { motif: `La voix dépasserait le prix accordé pour cette vidéo (${(p.prix.plafondCentimes / 100).toFixed(2).replace(".", ",")} €).`, phrases: [] };
  }
  return null;
}

/**
 * Lot : le script est contrôlé et, s'il est sans doute, validé comme Will le ferait (`validerScriptIV`, script tel que
 * proposé) ; sinon la vidéo reste à la porte, mise de côté, sans payer la voix. PUR.
 */
export function controleAutomatiqueScriptIV(etat: EtatFabricationIV, facteurSecurite?: number, options: { prixIndicatif?: boolean } = {}): EtatFabricationIV {
  const p = etat.propositionScript!;
  // R5 : en mode automatique, les phrases affirmatives sont gardées (choix « garder » posé par le réglage, pas par Will).
  const auto = etat.demande.validationCarte === "automatique";
  const mise = miseDeCoteScriptIV(p, facteurSecurite, { formulesGardees: auto, prixIndicatif: options.prixIndicatif });
  if (mise) return mettreDeCote(etat, "script", mise.motif, mise.phrases);
  try {
    const choixFormules: Record<string, ChoixFormule> = auto ? Object.fromEntries(p.formules.map((f) => [f.cle, "garder" as const])) : {};
    const valide = validerScriptIV(etat, { proposition: p.empreinte, choixFormules, ajoutsWill: [] });
    valide.journal.pop();
    valide.journal.push(auto ? `Script validé par le réglage « automatique » : le prix reste dans le prix accordé${p.formules.length ? `, ${p.formules.length} phrase(s) affirmative(s) gardée(s) telle(s) quelle(s)` : ""}.` : "Script sans doute : validé par le contrôle automatique du lot.");
    return valide;
  } catch (err) {
    return mettreDeCote(etat, "script", raisonDe(err), err instanceof ErreurDecisionIV ? err.phrases : []);
  }
}

async function pasScript(e: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  const d = await o.decisions?.script?.();
  if (!d || d.proposition !== e.propositionScript?.empreinte) return e;
  try {
    return validerScriptIV(e, d);
  } catch (err) {
    e.journal.push(`Validation du script refusée : ${raisonDe(err)}`);
    return e;
  }
}

/** Délai de base entre deux essais de conversion WAV (Q17) ; l'essai k attend k fois ce délai. */
const DELAI_ESSAI_WAV_MS = 250;

async function pasVoix(e: EtatFabricationIV, o: OutilsFabricationIV, caisse: Caisse, plafond: (c?: CodeRefusIV) => CodeRefusIV): Promise<EtatFabricationIV> {
  const { script, plan } = e;
  const segments = segmentsVoixIV(script!.fiche, plan!, { lectureUnique: lectureUniqueDe(e.voix) });
  // Lectures supplémentaires déjà réservées dans cette tentative : toute réservation voix au-delà des premières lectures du
  // plan de départ (le corps + chaque fin lue à part), quel que soit le texte (une fin de secours a un texte neuf).
  const premieresLectures = 1 + segments.fins.length;
  const reservationsVoix = () => e.caisse.reservations.filter((x) => x.cle.startsWith(`voix#${e.tentatives.voix ?? 1}:`) || x.cle.startsWith(`voix#${e.tentatives.voix ?? 1}.r`)).length;
  const lecturesSupplementairesRestantes = () => REPARATIONS_VOIX_MAX_IV - Math.max(0, reservationsVoix() - premieresLectures);
  const voixOutils: OutilsVoixIV = {
    ...o.voix,
    lecturesSupplementairesRestantes,
    avantLecture: async (l) => {
      // Le numéro de la lecture se compte sur la CAISSE, jamais sur les lectures payées de l'état : une reprise neuve (texte
      // modifié puis remis comme avant : A → B → A) a `payees` vide, et la clé `…-1` du texte A existe déjà dans la caisse, qui
      // répondrait « ok » sans rien réserver. L'empreinte du texte lu est dans toute clé (voix-iv/1 comme voix-iv/2).
      // Revers accepté : après une panne entre la réservation et la lecture, on réserve une fois de plus (sans risque).
      const marque = createHash("sha256").update(l.texte).digest("hex").slice(0, 10);
      const prefixe = `iv-voix-${l.prise}-${marque}-`;
      // Les relances automatiques (`.rN`) comptent aussi : une même série de clés ne revient jamais.
      const serie = `voix#${e.tentatives.voix ?? 1}`;
      const deja = e.caisse.reservations.filter((x) => (x.cle.startsWith(`${serie}:`) || x.cle.startsWith(`${serie}.r`)) && x.cle.includes(`:${prefixe}`)).length;
      // Plafond GLOBAL de la vidéo : 3 lectures payantes de plus que les premières lectures (relances de ressemblance comprises).
      // Filet : les décisions de la voix s'y arrêtent avant ; ici une lecture de trop n'est jamais réservée ni payée.
      if ((deja > 0 || reservationsVoix() >= premieresLectures) && lecturesSupplementairesRestantes() <= 0) throw new ErreurPlafondLecturesIV(`Plafond de ${REPARATIONS_VOIX_MAX_IV} lectures supplémentaires atteint pour cette vidéo : aucune lecture de plus n'est payée.`);
      const r = await caisse.reserver({ appelId: `${prefixe}${deja + 1}`, etape: "voix", fournisseur: "heygen", centimes: l.coutMaxCentimes, caracteres: l.caracteres });
      if (!r.ok) throw new Error(r.message);
    },
  };
  if (!e.voix || JSON.stringify(e.voix.segments) !== JSON.stringify(segments)) e.voix = e.voix ? repriseVoixIV(e.voix, segments, voixOutils) : etatInitialVoixIV(segments);

  // 1. La voix : un tour (une lecture payée au plus).
  if (!e.voix.issue) {
    e.voix = await avancerVoixIV(e.voix, voixOutils);
    if (e.voix.issue?.statut === "faite") {
      e.journal.push(`Voix lue : ${rapportVoixIV(e.voix).payees} lecture(s) payée(s).`);
      for (const r of e.voix.remarques ?? []) e.journal.push(r);
    }
    // Un refus se dit dans le même pas : la caisse sait encore si c'est le plafond.
    if (e.voix.issue?.statut !== "refus") return e;
  }
  if (e.voix.issue.statut === "refus") {
    // 15/10 : dernière fin de secours refusée et repli prévu (Facebook reprend Instagram) : posé dans le même passage,
    // sans lecture ni accord (rien n'est payé) ; la vidéo continue. Une fin de secours à LIRE est posée plus bas, automatiquement.
    const repli = e.voix.issue.controle === "Q16" ? secoursApresArretIV(e.voix, e.plan!) : null;
    if (repli && !repli.lecture) {
      e.journal.push(`Fin de secours refusée : ${e.voix.issue.message}`);
      delete e.voix.issue;
      poserSecoursIV(e, repli);
      return e;
    }
    // La fin de secours (ou la relecture de la seule fin) à LIRE est posée sans attendre « Refaire » : même réservation avant
    // la lecture, dans le plafond GLOBAL de réparations de la vidéo. Épuisé : l'arrêt reste (voix refusée, jamais gardée en silence).
    const faites = e.voix.reparations ?? 0;
    if (repli && o.secoursAutomatique !== false && faites < REPARATIONS_VOIX_MAX_IV && lecturesSupplementairesRestantes() > 0) {
      const raison = e.voix.issue.message;
      e.journal.push(`Fin de secours refusée : ${raison} Lecture de secours posée automatiquement (${faites + 1}/${REPARATIONS_VOIX_MAX_IV}).`);
      delete e.voix.issue;
      poserSecoursIV(e, repli);
      e.voix.reparations = faites + 1;
      e.voix.remarques = [...(e.voix.remarques ?? []), `Fin de secours lue automatiquement (${faites + 1}/${REPARATIONS_VOIX_MAX_IV}) : ${raison}`];
      return e;
    }
    const code = e.voix.issue.controle === "budget" ? plafond() : "IV_VOIX";
    const message = e.voix.issue.message;
    // La voix refusée repart de son état payé à la reprise (jamais relue en silence).
    const issue = e.voix.issue;
    delete e.voix.issue;
    return refuser(e, "voix", code, message, { reessayable: issue.controle === "budget" });
  }

  // 2. Une piste voix seule par version (aucune lecture).
  if (!e.pistes) {
    // Réparation sans validation : conversion WAV (Q17, gratuite) retentée 3 fois ; coupe ou mots qui ne collent pas :
    // voix relue en lecture neuve (3 fois au plus). Seul un échec après ces essais reste un arrêt.
    for (let essai = 1; !e.pistes; essai++) {
      try {
        e.pistes = await assemblerVersionsIV(e.voix, o.assemblage);
      } catch (err) {
        if (!(err instanceof ErreurVoixIV) || err.controle === "budget" || err.controle === "musique" || err.controle === "Q11bis") throw err;
        if (err.controle === "Q17") {
          if (essai >= 3) throw err;
          e.journal.push(`Son de la voix non converti en WAV (essai ${essai}/3) : nouvel essai automatique.`);
          // Court délai croissant : le rangement ou la conversion lente a le temps de finir (gratuit, aucune lecture).
          await new Promise((r) => setTimeout(r, DELAI_ESSAI_WAV_MS * essai));
          continue;
        }
        // Une lecture neuve (payante) ne règle que la coupe, la piste sans mot (Q19) et le décompte de mots différent ;
        // une erreur d'entrée qui ne dépend pas de la lecture (son d'une version absent…) est levée sans rien payer.
        if (err.controle !== "coupe" && err.controle !== "Q19" && !err.relire) throw err;
        const refaite = relireLaVoixIV(e.voix, voixOutils, err.message);
        if (!refaite) throw err;
        e.voix = refaite;
        delete e.pistes;
        e.journal.push(`Piste voix refusée : ${err.message} La voix est relue automatiquement (${refaite.reparations}/3).`);
        return e;
      }
    }
    e.journal.push(`Pistes voix seule : ${e.pistes.length}.`);
    for (const p of e.pistes) if (p.remarque) e.journal.push(p.remarque);
    return e;
  }

  // 3. Versions courtes : réseaux au-delà de leur plafond (même voix, aucune lecture).
  if (!e.courtes) {
    e.courtes = await versionsCourtes(e, o);
    for (const c of e.courtes) e.journal.push(c.resultat ? `Version courte pour ${c.reseaux.join(", ")} : ${c.resultat.retires.join(", ")} retiré(s).` : `Aucune version courte pour ${c.reseaux.join(", ")}${c.raison ? ` (${c.raison})` : ""}.`);
    return passerA(e, "mise-en-scene");
  }
  return passerA(e, "mise-en-scene");
}

async function versionsCourtes(e: EtatFabricationIV, o: OutilsFabricationIV): Promise<CourteIV[]> {
  const bruitages = o.bruitagesValides ?? BRUITAGES_V4_IV;
  const res: CourteIV[] = [];
  const fiche = e.script!.fiche;
  const detachables = chapitresDetachables(fiche).length;
  for (const piste of e.pistes!) {
    const longue: VersionIV = { id: piste.version, reseaux: piste.reseaux, courte: false, fiche, fin: finDe(e.plan!, piste.version), piste };
    const duree = mettreEnSceneIV(sceneDe(e, longue, bruitages)).ligne.dureeSec;
    const besoin = piste.reseaux.filter((r) => verdictReseau(r, duree).version === "courte");
    if (!besoin.length) continue;
    let trouvee: CourteIV | null = null;
    let raison = detachables ? undefined : "aucun chapitre détachable";
    for (let k = 1; k <= detachables && !trouvee; k++) {
      let c: VersionCourteIV;
      try {
        c = await assemblerVersionCourteIV({ etat: e.voix!, fiche, version: piste.version, retirer: k }, o.assemblage);
      } catch (err) {
        if (!(err instanceof ErreurVoixIV)) throw err;
        raison = err.message;
        break;
      }
      const courte: VersionIV = { id: c.piste.version, reseaux: besoin, courte: true, fiche: c.fiche, fin: longue.fin, piste: c.piste, noeudsRetires: noeudsRetiresDe(e.carte!.carte, fiche, c.fiche) };
      const dureeCourte = mettreEnSceneIV(sceneDe(e, courte, bruitages)).ligne.dureeSec;
      if (besoin.every((r) => verdictReseau(r, duree, dureeCourte).version !== "aucune")) trouvee = { version: piste.version, reseaux: besoin, resultat: c };
      else raison = `encore trop longue (${Math.round(dureeCourte)} s)`;
    }
    res.push(trouvee ?? { version: piste.version, reseaux: besoin, resultat: null, ...(raison ? { raison } : {}) });
  }
  return res;
}

export async function pasMiseEnScene(e: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  // Reprise d'un travail dont le script a été écrit avant la variété : recette tirée ici, une seule fois, sans rien
  // réécrire ni refaire la voix. Le script a été écrit sans recette, donc avec le récit de référence : le récit est
  // forcé à REC-A (les autres axes ne lisent que la carte et se replient d'eux-mêmes si le script ne s'y prête pas).
  if (!e.variete && e.script) {
    const historique = [...((await o.historiqueVariete?.()) ?? [])].slice(0, HISTORIQUE_VARIETE_IV);
    const recette: RecetteVarieteIV = { ...tirerVarieteIV({ graine: e.demande.videoId, carte: e.carte!.carte, format: "9:16", historique }), recit: RECETTE_REFERENCE_IV.recit };
    e.variete = { recette, par: "tirage", historique: historique.length };
    e.journal.push(`Variété tirée à la reprise (script déjà écrit, récit gardé ${recette.recit}) : ${ligneRecette(recette)}.`);
  }
  const bruitages = o.bruitagesValides ?? BRUITAGES_V4_IV;
  const scenes: NonNullable<EtatFabricationIV["scenes"]> = [];
  const phrases: string[] = [];
  // Remarques recalculées à chaque mise en scène : celles que le rendu a imposées (texte seul) sont redites d'après `ecransImposesRendu`.
  delete e.remarques;
  for (const v of versionsDe(e)) {
    const imposes = e.ecransImposesRendu?.[v.id] ?? [];
    if (imposes.length) (e.remarques ??= []).push(`${nomVersion(v)} : ${imposes.length} écran(s) que la vidéo ne savait pas montrer tels quels sont passés en texte seul (${imposes.join(", ")})${e.ecransImposesRepli?.[v.id] ? " : repli sur tous les écrans, le rendu n'en a nommé aucun retrouvé" : ""}.`);
    // 25/10 (zéro blocage, v-b54bb4798246) : un défaut de détail (Q13 chiffre non montré, Q14 rythme) ne refuse plus la vidéo :
    // les écrans cités passent en texte seul (3 essais au plus) ; s'il persiste, la vidéo continue et le défaut reste au journal.
    const mettre = (adaptes: readonly string[]) => mettreEnSceneIV({ ...sceneDe(e, v, bruitages), fiche: ficheAdapteeIV(v.fiche, [...imposes, ...adaptes]) });
    let issue: ReturnType<typeof mettreEnSceneAvecFiletIV> | undefined;
    let panne: string | undefined;
    try {
      issue = mettreEnSceneAvecFiletIV(mettre, [], nomVersion(v), ficheAdapteeIV(v.fiche, imposes));
    } catch (err) {
      panne = raisonDe(err);
    }
    // Zéro blocage : une mise en scène refusée (ou en panne) retombe sur une composition sûre de la même scène (tous les
    // écrans en texte seul) ; la raison reste en remarque. Le refus ne sort qu'en dernier.
    if (!issue || issue.refus.length) {
      const motif = panne ?? issue!.refus[0];
      const sures = v.fiche.ecrans.filter((x) => x.scene !== "titre" && x.textesEcran.length > 0).map((x) => x.id);
      let sure: ReturnType<typeof mettreEnSceneAvecFiletIV> | undefined;
      try {
        sure = mettreEnSceneAvecFiletIV(mettre, sures, nomVersion(v), v.fiche);
      } catch {
        sure = undefined;
      }
      if (sure && !sure.refus.length) {
        e.journal.push(`Remarque · mise en scène (${nomVersion(v)}) refusée (${motif}) : composition plus simple (texte seul) utilisée.`);
        sure.adaptes.unshift(...sures);
        issue = sure;
      } else if (sure) {
        // Un refus d'une autre nature (chiffre faux, etc.) n'est jamais effacé.
        phrases.push(...sure.refus.map((p) => `${nomVersion(v)} · ${p}`));
        continue;
      } else if (!issue) {
        phrases.push(`${nomVersion(v)} · ${motif}`);
        continue;
      }
    }
    // Recalculé de zéro à chaque passage ; un état par version (chaque version est vérifiée séparément).
    if (issue.adaptes.length) (e.ecransAdaptes ??= {})[v.id] = issue.adaptes;
    else if (e.ecransAdaptes) delete e.ecransAdaptes[v.id];
    e.journal.push(...issue.journal);
    const r = issue.resultat;
    if (issue.refus.length) phrases.push(...issue.refus.map((p) => `${nomVersion(v)} · ${p}`));
    scenes.push({ version: v.id, dureeSec: r.ligne.dureeSec, empreinte: empreinteDe(r.ligne) });
  }
  if (phrases.length) return refuser(e, "mise-en-scene", "IV_MISE_EN_SCENE", `La mise en scène est refusée : ${phrases[0]}`, { phrases, reessayable: false });
  e.scenes = scenes;
  e.journal.push(`Mise en scène : ${scenes.length} version(s).`);
  return passerA(e, "rendu");
}

/**
 * Version des compositions de rendu (studio-rendu/compositions/image-video). À CHANGER à chaque correction de ces compositions :
 * sans elle, une correction qui ne touche que l'affichage ne change ni la ligne de temps ni l'identifiant de rendu, et « Refaire
 * cette partie » reprend les anciens rendus (même refus, à 0 €). 23/10/2026 : bulle du récit, légende du chiffre, phrase de la fin.
 */
export const VERSION_COMPOSITIONS_IV = "compositions-iv/14"; // /14 (26/10/2026) : en-tête d'une paire « X · Y » avant le titre = étiquette X seule (elle ne recouvre plus le titre) ; /13 (25/10/2026, v-b54bb4798246) : vue d'ensemble, mot trop large abrégé, jamais de texte blanc hors pastille ; libellés courts sans « + » final ; /12 (25/10/2026, vidéo v-0339175a9f88) : pile des chiffres centrée sur la page, légende de l'anneau jamais sur le trait (dedans si elle tient dans la corde, sinon dessous), écrans de texte TYP-C sans trou entre rangées et « Au matin » gardé entier, vue d'ensemble avec 16 px au moins entre rangées (chiffres-clés retirés avant les paires, libellés raccourcis signalés, rendu dosé sur l'écart) ; /11 (25/10/2026) : affiche de la première image (l'accroche écrite en entier, posée 1 image sur le premier bloc, `affiche` dans les propriétés de la première scène) ; /10 (25/10/2026) : 4:5 sans surimpression d'accent (le badge sans place à côté du nœud n'est plus dessiné, son chiffre est déjà dans le libellé), 2e ligne de l'en-tête en étiquette seulement si elle précède le titre, étiquette de repli jamais égale à la marque, question de fin 4:5 à la taille du 9:16 ; /9 (25/10/2026) : badge d'accent dans le cadre 4:5 (au-dessus du rail, sous l'en-tête), décors et ombre hachurée évités, réserve de chasse 6 % des boîtes de la toile ; /8 (24/10/2026) : écran CHI-E centré avec écart sous la légende, pile des chiffres « 0 » + « demande perdue » ; /7 (24/10/2026) : liens sans part = ni pastille « 0 % » ni étiquette de part ; /6 : tracé au feutre APP-B posé en 0,3 s, vue d'ensemble sans paires dans le tronc ; /3 : dossier seul agrandi (remplissage vertical 70 %) ; /4 : entre aussi dans la clé des scènes de toile ; /5 : écrans v4 9:16 au-dessus de la bande des sous-titres

/**
 * Écrans de la fiche à passer en texte seul : ceux que le rendu a nommés (identifiant d'écran de la fiche, ou bloc de la ligne de
 * temps retrouvé par ses plans) ; à défaut, tous ceux qui ont un texte d'écran. PUR.
 */
export function ecransAAdapterIV(fiche: FicheImage, ligne: LigneDeTempsIV, nommes: readonly string[] | undefined): string[] {
  return choisirEcransAAdapterIV(fiche, ligne, nommes).ids;
}

/** Idem `ecransAAdapterIV`, et dit si c'est un repli « tous les écrans » (le rendu n'a nommé aucun écran retrouvé). PUR. */
export function choisirEcransAAdapterIV(fiche: FicheImage, ligne: LigneDeTempsIV, nommes: readonly string[] | undefined): { ids: string[]; repli: boolean } {
  const avecTexte = fiche.ecrans.filter((x) => x.textesEcran.length).map((x) => x.id);
  const trouves = new Set<string>();
  for (const id of nommes ?? []) {
    if (avecTexte.includes(id)) trouves.add(id);
    const bloc = ligne.blocs.find((b) => b.id === id);
    if (bloc) for (const p of ligne.plans) if (p.ecran && avecTexte.includes(p.ecran) && p.debut < bloc.fin - 1e-6 && p.fin > bloc.debut + 1e-6) trouves.add(p.ecran);
  }
  return trouves.size ? { ids: avecTexte.filter((x) => trouves.has(x)), repli: false } : { ids: avecTexte, repli: true };
}

async function pasRendu(e: EtatFabricationIV, o: OutilsFabricationIV): Promise<EtatFabricationIV> {
  const bruitages = o.bruitagesValides ?? BRUITAGES_V4_IV;
  e.rendus ??= {};
  for (const v of versionsDe(e)) {
    const ligne = mettreEnSceneIV(sceneDe(e, v, bruitages)).ligne;
    const mixage = planMixageIV(v.piste, ligne.bruitages, ligne.dureeSec);
    const id = `iv-rendu-${empreinteDe([v.id, empreinteDe(ligne), mixage.id, VERSION_COMPOSITIONS_IV])}`;
    if (e.rendus[v.id]?.demande === id) continue;
    const demandeRendu = { id, videoId: e.demande.videoId, version: v.id, reseaux: v.reseaux, ligne, mixage, piste: v.piste, essai: e.tentatives.rendu ?? 1 };
    let r: Awaited<ReturnType<OutilsFabricationIV["rendre"]>>;
    /** Écran irrendable : au 1er échec de la version, ses écrans passent en texte seul et la mise en scène est refaite ; au 2e : IV_RENDU. */
    const textesSeuls = (err: ErreurRenduDefinitifIV): EtatFabricationIV => {
      const { ids, repli } = choisirEcransAAdapterIV(v.fiche, ligne, err.ecransIrrendables);
      if (e.ecransImposesRendu?.[v.id] || !ids.length) throw err;
      e.ecransImposesRendu = { ...(e.ecransImposesRendu ?? {}), [v.id]: ids };
      if (repli) e.ecransImposesRepli = { ...(e.ecransImposesRepli ?? {}), [v.id]: true };
      e.journal.push(`Remarque · ${nomVersion(v)} : écran(s) irrendable(s) passé(s) en texte seul (${ids.join(", ")}${repli ? " : repli sur tous les écrans, le rendu n'en a nommé aucun retrouvé" : ""}) ; la mise en scène est refaite.`);
      delete e.scenes;
      return passerA(e, "mise-en-scene");
    };
    try {
      r = await o.rendre(demandeRendu);
    } catch (err) {
      if (estAttenteIV(err)) throw err;
      if (err instanceof ErreurRenduDefinitifIV) return textesSeuls(err);
      // Zéro blocage : une panne passagère du rendu est refaite une fois toute seule ; l'attente repart telle quelle.
      if ((e.tentatives.rendu ?? 1) >= 2) throw err;
      e.journal.push(`Remarque · rendu de ${nomVersion(v)} en panne (${raisonDe(err)}) : refait automatiquement une fois.`);
      // L'essai est noté avant de relancer : si le serveur répond « rendu en cours », la reprise demande directement le bon essai.
      e.tentatives.rendu = demandeRendu.essai + 1;
      try {
        r = await o.rendre({ ...demandeRendu, essai: demandeRendu.essai + 1 });
      } catch (err2) {
        if (err2 instanceof ErreurRenduDefinitifIV) {
          // La mise en scène refaite repart avec le compteur d'avant la relance : une simple panne passagère ensuite est encore refaite.
          e.tentatives.rendu = demandeRendu.essai;
          return textesSeuls(err2);
        }
        throw err2;
      }
    }
    e.rendus[v.id] = { cle: r.cle, ...(r.empreinte ? { empreinte: r.empreinte } : {}), dureeSec: r.dureeSec, ...(r.mesures ? { mesures: r.mesures } : {}), demande: id };
    e.journal.push(`Rendu de ${nomVersion(v)}.`);
    return e;
  }
  return passerA(e, "controles");
}

/** Versions à contrôler, telles que la porte les reçoit : mise en scène recalculée, piste, fichier rendu et mesures (PUR). */
export function miseEnSceneDesVersionsIV(e: EtatFabricationIV, bruitages: readonly BruitageValideIV[] = BRUITAGES_V4_IV): VersionAControlerIV[] {
  return versionsDe(e).map((v) => {
    const scene = sceneDe(e, v, bruitages);
    const ligne = mettreEnSceneIV(scene).ligne;
    const rendu = e.rendus?.[v.id];
    return {
      version: v.id,
      reseaux: v.reseaux,
      courte: v.courte,
      fiche: v.fiche,
      ...(v.courte ? { retires: v.retires ?? [], noeudsRetires: v.noeudsRetires ?? [] } : {}),
      fin: v.fin,
      piste: v.piste,
      scene,
      ligne,
      mixage: { voix: { empreinte: planMixageIV(v.piste, ligne.bruitages, ligne.dureeSec).voix.empreinte } },
      fichier: { cle: rendu?.cle ?? "", ...(rendu?.empreinte ? { empreinte: rendu.empreinte } : {}), ...(rendu?.mesures ? { mesures: rendu.mesures } : {}) },
    };
  });
}

/** Entrée de la porte unique pour l'état (PUR), avec la publication et les liens qu'elle contrôle. */
export function entreePorteIV(e: EtatFabricationIV, bruitages: readonly BruitageValideIV[] = BRUITAGES_V4_IV): { entree: EntreePorteIV; publication: PublicationIV; liens: Record<string, string> } {
  const { publication, liens } = publicationDe(e);
  const entree: EntreePorteIV = {
    videoId: e.demande.videoId,
    carte: e.carte!.carte,
    fiche: e.script!.fiche,
    reseaux: e.demande.reseaux,
    plan: e.plan!,
    versions: miseEnSceneDesVersionsIV(e, bruitages),
    regles: { choixFormules: e.script!.choixFormules, ajoutsWill: e.script!.ajoutsWill, interdits: e.demande.interdits ?? [], ...recitDe(e) },
    voix: { issue: e.voix?.issue ?? { statut: "faite" } },
    publication,
    liens,
    ...(e.controles ? { deja: { transcriptions: e.controles.transcriptions, relectures: e.controles.relectures } } : {}),
  };
  return { entree, publication, liens };
}

async function pasControles(e: EtatFabricationIV, o: OutilsFabricationIV, caisse: Caisse): Promise<EtatFabricationIV> {
  const { entree, publication, liens } = entreePorteIV(e, o.bruitagesValides ?? BRUITAGES_V4_IV);
  const verdict = await porteUniqueIV(
    entree,
    // Chaque tentative d'appel a son propre identifiant (compteur gardé dans l'état) : jamais la réservation d'un appel parti.
    { ...o.controles, budget: caisse.controles(), idAppel: (prefixe) => `${prefixe}-n${(e.compteurAppels = (e.compteurAppels ?? 0) + 1)}` },
  );
  // 15/10 : une version reprise d'un autre réseau (repli de secours) est dite dans le rapport.
  const replis = e.plan!.fins.flatMap((f) => (f.repli ? [phraseDeRepliIV(f.reseaux, f.repli)] : []));
  const resume: ResumePorteIV = { ok: verdict.ok, phrase: verdict.phrase, phrases: verdict.phrases, mentions: [...verdict.mentions, ...replis, ...(e.remarques ?? [])] };
  e.controles = { transcriptions: verdict.transcriptions, relectures: verdict.relectures, verdict: resume };
  e.journal.push(verdict.phrase);
  if (!verdict.ok) return refuser(e, "controles", "IV_CONTROLES", verdict.phrase, { phrases: verdict.phrases, reessayable: false });
  e.livraison = livraisonDe(e, verdict, publication, liens);
  return passerA(e, "livraison");
}

/** Livraison réseau par réseau (PUR) : fichier principal, fil Facebook 4:5, textes et liens. */
export function livraisonDe(e: EtatFabricationIV, verdict: Pick<VerdictPorteIV, "reseaux">, publication: PublicationIV, liens: Record<string, string>): LivraisonReseauIV[] {
  const versions = versionsDe(e);
  return e.demande.reseaux.map((reseau): LivraisonReseauIV => {
    const v = verdict.reseaux.find((x) => x.reseau === reseau);
    if (!v || v.version === "aucune") return { reseau, version: "aucune", mention: v?.phrase ?? (reseau === "tiktok" ? "TikTok n'est plus proposé pour Image → vidéo." : "Réseau non livré.") };
    // Fichier principal : le 9:16 s'il existe (Facebook : le Reel), sinon le 4:5 (LinkedIn seul) ; Facebook a en plus le fil 4:5.
    const siennes = versions.filter((x) => x.reseaux.includes(reseau) && x.courte === (v.version === "courte"));
    const version = siennes.find((x) => (x.format ?? "9:16") === "9:16") ?? siennes[0];
    const fil = version && (version.format ?? "9:16") === "9:16" ? siennes.find((x) => x.format === "4:5") : undefined;
    const rendu = version ? e.rendus?.[version.id] : undefined;
    const renduFil = fil ? e.rendus?.[fil.id] : undefined;
    const t = publication.textes.find((x) => x.reseau === reseau);
    const repli = e.plan!.fins.find((f) => f.repli && f.reseaux.includes(reseau));
    const mention = [v.phrase, repli ? phraseDeRepliIV(repli.reseaux, repli.repli!) : undefined].filter(Boolean).join(" ");
    return {
      reseau,
      version: v.version,
      ...(rendu ? { fichierCle: rendu.cle, dureeSec: rendu.dureeSec } : {}),
      ...(version?.format === "4:5" ? { format: "4:5" as const } : {}),
      ...(renduFil ? { fichierCleFil: renduFil.cle, dureeSecFil: renduFil.dureeSec } : {}),
      ...(fil && reseau === "facebook" ? textesDuFil(publication) : {}),
      ...(mention ? { mention } : {}),
      ...(t ? { texte: t.texte, consigneLien: t.consigneLien, ...(t.premierCommentaire ? { premierCommentaire: t.premierCommentaire } : {}), ...(t.titre ? { titre: t.titre } : {}) } : {}),
      ...(liens[reseau] ? { lien: liens[reseau] } : {}),
    };
  });
}

/** Texte du fil Facebook dans la livraison (`texteFilFacebookIV`). */
function textesDuFil(publication: PublicationIV): Pick<LivraisonReseauIV, "texteFil" | "consigneLienFil"> {
  const f = texteFilFacebookIV(publication);
  return f ? { texteFil: f.texte, consigneLienFil: f.consigneLien } : {};
}

function pasLivraison(e: EtatFabricationIV): EtatFabricationIV {
  // Zéro blocage : un réseau sans fichier principal est rendu à nouveau, une seule fois ; ensuite les autres partent avec une remarque.
  const manque = (e.livraison ?? []).filter((l) => l.version !== "aucune" && !l.fichierCle);
  if (manque.length) {
    const noms = manque.map((l) => l.reseau).join(", ");
    if ((e.tentatives.livraison ?? 1) < 2) {
      e.tentatives.livraison = 2;
      // Même identifiant, même essai = rien de refait côté serveur : l'essai passe à +1 pour les versions concernées.
      e.tentatives.rendu = (e.tentatives.rendu ?? 1) + 1;
      const concernees = versionsDe(e).filter((v) => v.reseaux.some((r) => manque.some((l) => l.reseau === r)));
      for (const v of concernees) delete e.rendus?.[v.id];
      e.journal.push(`Remarque · aucun fichier pour ${noms} : rendu refait automatiquement une fois.`);
      delete e.livraison;
      return passerA(e, "rendu");
    }
    e.livraison = (e.livraison ?? []).map((l): LivraisonReseauIV => (manque.includes(l) ? { reseau: l.reseau, version: "aucune", mention: `Aucun fichier pour ${l.reseau} après un second rendu : à refaire.` } : l));
    e.journal.push(`Remarque · aucun fichier pour ${noms} après un second rendu : les autres réseaux sont livrés.`);
    if (!e.livraison.some((l) => l.version !== "aucune")) return refuser(e, "livraison", "IV_RENDU", "Aucun fichier rendu pour aucun réseau, relancez le rendu.", { reessayable: true });
  }
  // Facebook : si seul le fil 4:5 manque, le Reel 9:16 qui existe est livré, avec une remarque sur le fil.
  const formatsFb = formatsDe(e.demande, "facebook");
  e.livraison = (e.livraison ?? []).map((l): LivraisonReseauIV => {
    if (l.reseau !== "facebook" || l.version === "aucune" || !l.fichierCle || l.fichierCleFil || !formatsFb.includes("9:16") || !formatsFb.includes("4:5")) return l;
    const remarque = "Le fil 4:5 n'a pas été rendu : le Reel 9:16 est livré, le fil est à refaire.";
    e.journal.push(`Remarque · Facebook : ${remarque}`);
    return { ...l, mention: [l.mention, remarque].filter(Boolean).join(" ") };
  });
  e.journal.push(`Vidéo prête : ${(e.livraison ?? []).filter((l) => l.version !== "aucune").length} réseau(x).`);
  return passerA(e, "prete");
}

/* ------------------------------------------------------------------ */
/* Boucle (tests, script d'essai)                                        */
/* ------------------------------------------------------------------ */

/**
 * Avance jusqu'à une porte de Will, une attente de rendu, la fin ou `pasMax` pas. Chaque état intermédiaire passe par
 * JSON (comme dans un travail gardé) ; `garder` le reçoit après chaque pas (fichier du script d'essai).
 */
export async function avancerJusquAArretIV(etat: EtatFabricationIV, outils: OutilsFabricationIV, o: { pasMax?: number; garder?: (e: EtatFabricationIV) => Promise<void> | void } = {}): Promise<EtatFabricationIV> {
  let e = etat;
  for (let pas = 0; pas < (o.pasMax ?? 500); pas++) {
    const suivant = JSON.parse(JSON.stringify(await avancerIV(e, outils))) as EtatFabricationIV;
    await o.garder?.(suivant);
    const immobile = JSON.stringify(suivant) === JSON.stringify(e);
    e = suivant;
    if (estFinieIV(e) || e.attente || immobile) return e;
  }
  return e;
}
