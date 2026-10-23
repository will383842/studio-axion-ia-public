/**
 * MOTEUR « MONTAGE AVOCAT » (plan du moteur avocat v3.2, B.1 ; lot M1).
 *
 * Un seul chemin, « le son d'abord » : texte validé → prononciations substituées → voix (son seul + horodatage par
 * mot) → nettoyage des blancs (`studio-rendu`, file courte) = audio maître → découpage en plans sur ce son → visage,
 * montage, sous-titres, couleurs, son, export, vérification.
 *
 * Construit au lot M1 : voix, nettoyage, report des horodatages, découpage (réels derrière les fournisseurs et
 * `studio-rendu`, simulés par défaut). Lot M4 : montage, couleurs, son et export dans `studio-rendu` (une
 * composition par format d'image, `montage.ts`, paramètres purs dans `composition.ts`, scène partagée avec Remotion
 * dans `scene.ts`), contrôles sur le fichier exporté (`controles.ts`), format ajouté et recalque GRATUITS. Sans
 * `studio-rendu` (défaut), ces étapes suivent l'horloge simulée avec les vidéos de démonstration. Le visage reste
 * simulé jusqu'au lot M6 (le montage pose alors le webm transparent réel à la place du double d'essai).
 *
 * Il ne lit que la commande. Fournisseurs par injection (`creerMoteurMontageAvocat`), pour les tests ; par défaut :
 * la voix de la distribution (`resoudreFournisseur("voix", Voix.fournisseur)`), le stockage de l'environnement, et
 * `studio-rendu` si `STUDIO_RENDU_URL` existe, sinon un service de rendu simulé réglé sur l'horloge du moteur.
 * Aucun appel n'est fait sous le verrou : `avancer` est appelé hors verrou par la boucle de fond (lot M1b).
 */
import { MESSAGE_VOIX_ESSAI } from "@/domaine/voix-essai";
import { alertesDuree, BRIQUES, briqueSousTitres, versionsBriques } from "@/briques";
import { avecChoixBruitages, ENTREE_BRUITAGES_PLANS, orchestrerMontage, type BruitagePlace, type SortieOrchestrationMontage } from "@/briques/intensite";
import { alertesIntensite } from "@/briques/composition/controles";
import { assembler, commandePartielle, coupesImposees, etapesVariante, MARGE_PRISE_SEC, reseauxDeCommande, tempsDesSegments, textesDitsParId, type Jointure, type MorceauPlace, type SourceAssemblage, type TempsSegment } from "@/briques/declinaison";
import { horodaterTexte } from "@/domaine/derivations";
import { anglePrincipalDe, visagePrincipalResolu } from "@/domaine/distribution";
import type { AlerteQualite, CauseApproximation, ChoixBruitagePlan, CommandeFabrication, EtapeTravail, LigneCout, MediaCommande, MotHorodate, NoteQualite, PriseCommande, RapportAlignement, RapportIntensite, Ratio, SegmentSousTitres, Travail, VoixBrutePayee } from "@/domaine/types";
import { trouverFormat } from "@/formats";
import { RECETTE_MONTAGE_AVOCAT } from "@/formats/avocat";
import type { RecetteMontage } from "@/formats/types";
import { resoudreFournisseur } from "@/fournisseurs";
import { ErreurRendu, obtenirServiceRendu, renduSimule, suivreRendu } from "@/fournisseurs/rendu/client";
import { creerServiceRenduSimule } from "@/fournisseurs/simulation/rendu";
import type { DemandeAlignement, DemandeRendu, FournisseurAlignement, FournisseurVoix, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import { alerteSousTitresApproximatifs, appliquerAlignement, calerLaVoix, causeApproximation, demandeAlignement, ESSAIS_ALIGNEMENT, optionsCalage } from "./alignement";
import { avancerDouble, compositionDuDouble, principalDejaRendu, doubleEnEchec, doubleFini, etatInitialDouble, lignesDouble, MESSAGE_DELAI_RENDU_DOUBLE, MESSAGE_DOUBLE_TOUJOURS_EN_COURS, pistesPourComposition, PLAFOND_DEPASSEMENT, progressionDouble, refusDouble, renduAllumeDans, renduARelire, secondesAnnonceesDouble, type EtatDoubleMoteur } from "./double";
import type { FournisseurVisage } from "@/fournisseurs/types";
import { additionner, centimes, multiplier } from "@/lib/montants";
import { cleEtapeDeLigne, coutDeLEtape, lignesDesEtapesPayees } from "../couts-etapes";
import { moteurSimulation } from "../simulation";
import type { ContexteLancement, DefinitionEtapeMoteur, Estimation, MoteurVideo, ParentRetouche, PlanProduit, ResultatFabrication, ResultatMaquette, SortieProduite } from "../types";
import { parametresComposition, RECETTE_COMPOSITION_AVOCAT } from "./composition";
import { noteDepuisAlertes } from "./controles";
import { avancerCompositions, montageFini, PLAGES_ETAPES, progressionMontage, type BaseComposition, type EtatComposition, type EtatMontage, type OutilsMontage, type ModeComposition } from "./montage";
import { controlerRythme, decouperEnPlans, type SegmentDecoupage } from "./decoupage";
import { empreinteAudioMaitre } from "./empreinte";
import { debitEtVitesseConseillee, REGLES_NETTOYAGE_PAR_DEFAUT } from "./nettoyage";
import { preparerTexteVoix, preparerTexteVoixDit, reporterHorodatages, type MotReporte, type SegmentTexte, type TexteVoix } from "./report";
import {
  avancerIllustrations,
  avecIllustrationsFabriquees,
  coutReelCentimes,
  elementsCrees as elementsCreesDe,
  etatInitial as etatInitialIllustrations,
  fini as illustrationsFinies,
  ligneEstimeeFabrication,
  ligneReelle as ligneReelleIllustrations,
  plansAFabriquer,
  progressionIllustrations,
  type EtatIllustrations,
} from "./fabrication-illustrations";
import type { FournisseurIllustration } from "@/fournisseurs/types";
import { textesAffichesDesCartes } from "@/briques/habillage-facecam/sous-titres";
import { avancerCartesMotion, cartesMotionEcartees, cartesMotionFinies, cartesPleinEcranDuRatio, etatInitialCartesMotion, type EtatCartesMotion } from "@/briques/motion/rendu-cartes";
import { multicameraPourComposition, type PisteMulticamera } from "@/briques/multicamera";
import { multicameraDemandeeAvocat, servicesAvocat, type PasseMulticameraAvocat } from "./branchements";
import { appliquerZoomsAvocat, deciderMonteurAvocat, optionMonteurAvocat, type DecisionsMonteurAvocat } from "./monteur";
import { optionMotionAvocat, poserMotionAvocat, resumeMotionAvocat } from "./motion";
import { cartesPourFormat, ratiosMotion } from "@/briques/motion";

export { empreinteAudioMaitre } from "./empreinte";

/**
 * Étapes menées par `studio-rendu` quand le montage est réel (lot M4) : jamais planifiées à l'horloge. Audit 4.12 : les
 * sous-titres sont gravés dans la composition, leur étape suit donc le vrai travail, plus l'horloge.
 */
const ETAPES_REELLES = ["montage", "etalonnage", "son", "sous-titres", "export", "controle-qualite"];
/** Étapes dont le coût est nul en réel (calcul sur notre serveur). */
const ETAPES_MONTAGE = ETAPES_REELLES;
/** Avancement d'une fabrication complète : les sous-titres (calque texte) avancent avec les couleurs. */
const PLAGES_FABRICATION: Record<string, [number, number]> = { ...PLAGES_ETAPES, "sous-titres": [45, 55] };
/** Recalque : texte (sous-titres, encadré) puis export. */
const PLAGES_RECALQUE: Record<string, [number, number]> = { "sous-titres": [3, 70], export: [70, 100] };
/** Lot « bruitages » : remixage (son refait sous l'image gardée, puis sous-titres et export). */
const PLAGES_REMIXAGE: Record<string, [number, number]> = { son: [3, 30], "sous-titres": [30, 70], export: [70, 100] };

type CompositionFaite = Extract<EtatComposition, { phase: "faite" }>;

/** Alertes sans doublon (même code et même message). */
function dedoublonner(alertes: AlerteQualite[]): AlerteQualite[] {
  const vues = new Set<string>();
  return alertes.filter((a) => {
    const cle = `${a.code}|${a.message}`;
    if (vues.has(cle)) return false;
    vues.add(cle);
    return true;
  });
}

/**
 * Projet de montage d'une version (opaque pour les écrans) : ce que le moteur relit pour un format ajouté ou un
 * recalque, sans rien refaire (lot M4).
 */
export interface ProjetMontageAvocat {
  versionContrat: number;
  moteur: "montage-avocat";
  briques: Record<string, string>;
  recetteMontage: number;
  plans: number;
  audioMaitre: { fichierCle: string; dureeSec: number; reutilise: boolean; coupures: number; respirations: number; motsParSeconde: number; vitesseConseillee: number } | null;
  plansProduits?: PlanProduit[];
  dureeSec?: number;
  motsAudio?: MotHorodate[];
  noteQualite?: NoteQualite;
  /** Mesures du fichier exporté, par format d'image. */
  mesures?: Record<string, Record<string, number>>;
  /** Lot M5 : clips fabriqués (identifiant provisoire `fab-N` → fichier), pour recomposer un format ajouté. */
  mediasFabriques?: Record<string, MediaCommande>;
  /** Lot « intensité · bruitages » (02/10) : sons posés (format ajouté, remixage) et rapport du chef d'orchestre. */
  bruitages?: BruitagePlace[];
  rapportIntensite?: RapportIntensite;
  /**
   * Générateur G6 (ajouts purs) : début et fin de chaque segment du texte validé sur l'audio maître (une version par
   * réseau s'y raccorde ; contrôles relancés sur l'horodatage réel) ; morceaux et raccords d'une version assemblée.
   */
  segmentsHorodates?: TempsSegment[];
  assemblage?: { morceaux: MorceauPlace[]; jointures: Jointure[]; source: "mere" | "prises" };
  /** Lot R7d : passages du second angle (un webm par passage), pour recomposer un format ajouté. */
  tranchesDouble?: BaseComposition["tranchesDouble"];
  /** Lot R7e : pistes du double opaques (repli « fond uni ») : de même au format ajouté. */
  doubleFondUni?: boolean;
  /** Correcteur réel 2 : pistes du double rendues sur le look du décor (le décor est dans la vidéo) : de même. */
  doubleDecorDuLook?: boolean;
  /**
   * Mission H (ajouts purs, options coupées par défaut) : cartes de la brique commune `motion` posées à la place des
   * illustrations et titres ; piste multicaméra (brique `multicamera`, prises filmées) ; consignes lues par le
   * monteur commun (brique `monteur`). Absents : projet identique à avant.
   */
  motionCommune?: { cartes: ReturnType<typeof resumeMotionAvocat> };
  multicamera?: PisteMulticamera;
  monteur?: Pick<DecisionsMonteurAvocat, "consignes" | "reponse">;
}

/** Erreur typée du moteur : `reessayable: false` = refus définitif (message clair pour Will). */
export class ErreurMoteurAvocat extends Error {
  constructor(
    public readonly code: "VOIX_INCOMPATIBLE" | "STOCKAGE_NON_RELIE" | "MASTER_ABSENT" | "DOUBLE_PAS_PRET" | "VOIX_ESSAI" | "PLAFOND_VOIX",
    public readonly messagePourWill: string,
    public readonly reessayable = false,
  ) {
    super(messagePourWill);
    this.name = "ErreurMoteurAvocat";
  }
}

/** ORG-07a : `AudioBrut` et `AudioMaitre` vivent dans la brique commune `voix-maitre` (définitions inchangées). */
import type { AudioBrut, AudioMaitre } from "@/briques/voix-maitre";
/** ORG-07b : la sous-machine « texte → son maître » vit dans la brique ; l'avocat lui délègue ces phases. */
import { avancerVoixMaitre, DUREE_ADRESSE_CALAGE_SEC, ESSAIS_RENDU, versAnalyse as versAnalyseMaitre, type EtatVoixMaitre, type OutilsVoixMaitre } from "@/briques/voix-maitre/machine";
import { lecturesVoixMax, ressemblanceDeLaCommande } from "@/briques/voix-maitre/reference";
import type { PriseVoixMesuree } from "@/briques/voix-maitre/types";
export type { AudioMaitre } from "@/briques/voix-maitre";

/** G6b : où en est le calage d'une prise filmée sur son texte. */
export interface EtatPrise {
  id: string;
  phase: "a-aligner" | "alignement" | "calee";
  demande?: DemandeAlignement;
  essai?: number;
  /** Mots DITS calés sur le son de la prise. */
  mots?: MotHorodate[];
  rapport?: RapportAlignement;
  /** Lot R6 : mots restés sur l'estimation (aligneur non relié, ou calage sans succès). */
  approximatif?: CauseApproximation;
}

/** G6 / G6b : un assemblage en cours (morceaux calculés par la brique `declinaison`, mis bout à bout par `studio-rendu`). */
interface PlanAssemblage {
  sortie: "wav" | "mp4";
  morceaux: MorceauPlace[];
  dureeSec: number;
  motsPrononces: MotHorodate[];
  plans: PlanProduit[];
  jointures: Jointure[];
  /** Nom d'entrée → clé de stockage. */
  entrees: Record<string, string>;
}

/**
 * Où en est la voix d'un travail (gardé dans `Travail.parametres.voix` entre deux tours de la boucle). ORG-07b : les
 * phases `a-lire` … `nettoyage` et `faite` sont celles de la brique `voix-maitre` (texte → son maître) ; les trois
 * autres sont propres à l'avocat.
 */
export type EtatVoix =
  | EtatVoixMaitre
  /* Générateur G6 : son neuf du début et de la fin fait, reste à le raccorder au corps de la mère. */
  | { phase: "a-assembler"; partiel: AudioMaitre }
  /* G6b : prises filmées calées une à une sur leur texte (alignement forcé). */
  | { phase: "prises"; prises: EtatPrise[] }
  /* G6 / G6b : morceaux mis bout à bout (`studio-rendu`, opération `assemblage`). */
  | { phase: "assemblage"; base: AudioMaitre; plan: PlanAssemblage; demande?: DemandeRendu; essai?: number };

const PROGRESSION_VOIX: Record<EtatVoix["phase"], number> = { "a-lire": 0, "a-copier": 15, "a-mesurer": 16, mesure: 17, "a-relire": 18, "a-aligner": 20, alignement: 25, "a-analyser": 30, analyse: 40, nettoyage: 70, "a-assembler": 80, prises: 40, assemblage: 90, faite: 100, "a-remesurer": 100, remesure: 100 };

const RESOLUTIONS: Record<Ratio, string> = { "9:16": "1080x1920", "1:1": "1080x1080", "4:5": "1080x1350", "16:9": "1920x1080" };
const VIDEOS_DEMO = ["/demo/avocat-droits", "/demo/avocat-licenciement"];

/** Délais simulés des étapes encore simulées (visage, montage…, lots M4 et M6). */
const DUREES: Record<string, number> = { voix: 8, decoupage: 1, visage: 7, montage: 4, "sous-titres": 3, etalonnage: 2, son: 3, export: 3, "controle-qualite": 1.5 };

/** Délai maximal d'attente d'une opération de la file courte pendant une maquette (Will attend devant l'écran). */
const ATTENTE_MAQUETTE_MS = 45_000;

export interface DependancesMoteurAvocat {
  /** Voix d'après le fournisseur de la VOIX de la distribution (jamais le réglage global). */
  voix?: (fournisseur?: string) => FournisseurVoix;
  stockage?: () => StockageFichiers;
  /** Service de rendu imposé (tests). Absent : `studio-rendu` réel si `STUDIO_RENDU_URL`, sinon simulé. */
  rendu?: ServiceRendu;
  environnement?: Record<string, string | undefined>;
  /** Attente entre deux interrogations pendant une maquette (tests : 0). */
  pauseMs?: number;
  /** Lot M5 : fournisseur d'illustrations imposé (tests). Absent : celui de la commande (`entrees.fournisseurIllustration`). */
  illustration?: () => FournisseurIllustration;
  /** Lot « calage » (02/10) : aligneur imposé (tests). Absent : le registre (simulation = calage sauté). */
  alignement?: () => FournisseurAlignement;
  /** Lot R7d : fournisseur du double imposé (tests). Absent : celui de la commande (`VisageResolu.fournisseur`). */
  visage?: (fournisseur?: string) => FournisseurVisage;
  /** Tests seulement : force le réglage « Votre avatar parle dans le studio » (sinon celui figé dans la commande). */
  renduDoubleAutorise?: boolean;
  /** Mission H : passe multicaméra imposée (tests). Absente : celle branchée par les services (si la commande la demande). */
  multicamera?: PasseMulticameraAvocat;
}

function hache(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

const recetteDe = (c: CommandeFabrication): RecetteMontage => c.recetteMontage ?? RECETTE_MONTAGE_AVOCAT;

/** G6b : la vidéo vient de prises filmées (« je lis »), pas d'une voix de synthèse. */
/** Correcteur 4 (audit A, B4) : message quand un montage réel partirait avec une voix d'essai (module neutre). */
export { MESSAGE_VOIX_ESSAI };

/**
 * Correcteur 4 (audit A, B4) : la voix de la vidéo est celle du personnage ; une voix d'essai (fournisseur absent ou
 * « simulation ») ferait échouer un montage réel au nettoyage du son. Null : rien à refuser. PUR.
 */
export function refusVoixEssai(c: Pick<CommandeFabrication, "distribution" | "prises">): string | null {
  if (!c.distribution.length || estPrisesFilmees(c)) return null;
  const f = c.distribution[0]?.fournisseurVoix;
  return !f || f === "simulation" ? MESSAGE_VOIX_ESSAI : null;
}

export const estPrisesFilmees = (c: Pick<CommandeFabrication, "distribution" | "prises">): boolean => c.distribution[0]?.source === "rush" && !!c.prises?.length;

/** G6 : version par réseau dont le corps est repris de la mère. */
const estVarianteSurMere = (c: Pick<CommandeFabrication, "variante">): boolean => !!c.variante?.mere && !!c.variante.segmentsRefaits?.length;

/**
 * Texte envoyé à la voix : le texte DIT transmis (G6, prononciations appliquées une seule fois, liste `prononciations`
 * vide), sinon le texte validé avec les prononciations substituées ici (comme avant G6).
 */
export function texteVoixDe(c: Pick<CommandeFabrication, "script" | "texteDitParSegment" | "prononciations">, segments: SegmentTexte[] = segmentsDe(c)): TexteVoix {
  return c.texteDitParSegment ? preparerTexteVoixDit(segments, textesDitsParId(c)) : preparerTexteVoix(segments, c.prononciations);
}

/** Segments non vides du script, avec leur bloc (le découpage reconnaît l'accroche). */
export function segmentsDe(c: Pick<CommandeFabrication, "script">): SegmentDecoupage[] {
  return c.script.blocs.flatMap((b) =>
    b.segments.filter((s) => s.texte.trim()).map((s) => ({ id: s.id, texte: s.texte, bloc: b.blocRecette, emphase: s.emphase, intentionIllustration: s.intentionIllustration, incrustation: s.incrustation })),
  );
}

/** L'audio maître de la commande est-il réutilisable sans le repayer ? */
export function audioReutilisable(c: CommandeFabrication): boolean {
  return !!c.audioMaitre && c.audioMaitre.empreinte === empreinteAudioMaitre(c);
}

function etapesDe(c: CommandeFabrication): DefinitionEtapeMoteur[] {
  const avecVoix = c.distribution.length > 0;
  const avecDouble = c.distribution.some((d) => d.source === "double");
  const b = c.briques;
  const e: DefinitionEtapeMoteur[] = [];
  const def = (cle: string, nom: string, icone: string, dependDe: string[]) => e.push({ cle, nom, icone, dependDe, dureeEstimeeSec: DUREES[cle] });
  // G6b : la voix est celle des prises filmées (calées sur le texte) ; G6 : seuls le début et la fin sont lus.
  if (avecVoix) def("voix", estPrisesFilmees(c) ? "Vos prises" : estVarianteSurMere(c) || c.variante?.segmentsRefaits?.length ? "Votre voix · début et fin" : "Votre voix", estPrisesFilmees(c) ? "camera" : "micro", []);
  def("decoupage", "Plans", "film", avecVoix ? ["voix"] : []);
  if (avecDouble) def("visage", "Vous", "visage", ["decoupage"]);
  // Lot M5 : illustrations « à fabriquer » (fal.ai), au moteur, avant le montage. Aucune : pas d'étape.
  const avecFabrication = plansAFabriquer(c).length > 0;
  if (avecFabrication) e.push({ cle: "illustrations", nom: "Illustrations", icone: "images", dependDe: ["decoupage"], dureeEstimeeSec: 90 });
  def("montage", "Montage", "ciseaux", [...(avecDouble ? ["decoupage", "visage"] : ["decoupage"]), ...(avecFabrication ? ["illustrations"] : [])]);
  if (avecVoix && b["sous-titres"]) def("sous-titres", "Sous-titres", "sous-titres", ["decoupage"]);
  if (b.etalonnage) def("etalonnage", "Couleurs", "contraste", ["montage"]);
  if (b.son) def("son", "Son", "son", avecVoix ? ["voix"] : []);
  else if (avecVoix) def("son", "Niveau de la voix", "son", ["voix"]);
  def("export", "Formats d'image", "telecharger", ["montage", ...e.filter((x) => ["son", "etalonnage", "sous-titres"].includes(x.cle)).map((x) => x.cle)]);
  def("controle-qualite", "Vérification", "bouclier", ["export"]);
  return e;
}

/** Lignes estimées (briques communes). La voix déjà fabriquée par la maquette n'est pas repayée. */
function lignesEstimees(commande: CommandeFabrication): LigneCout[] {
  // G6 : une version par réseau ne paie que ce qui est refait (début et fin) ; le corps vient de la mère.
  const c = commande.variante?.segmentsRefaits?.length ? commandePartielle(commande, new Set(commande.variante.segmentsRefaits)) : commande;
  // Lot M5 : la ligne d'essai « Illustrations » de la brique est remplacée par le coût RÉEL à fabriquer (fal.ai) ;
  // réutilisées, Mes images et banques : 0 €.
  const fabrication = ligneEstimeeFabrication(c);
  const lignes = [...BRIQUES.flatMap((b) => b.estimer(c)).filter((l) => l.etape !== "Illustrations"), ...(fabrication ? [fabrication] : [])];
  // G6b : prises filmées par Will, aucune voix ni aucun double à payer ; le reste (calage, assemblage, montage, export)
  // tourne sur notre serveur. Seules des illustrations à fabriquer coûteraient (aucune par défaut) : 0 €.
  if (estPrisesFilmees(c)) return lignes.filter((l) => l.etape === "Illustrations à fabriquer");
  // Correcteur réel 2 : l'avatar déjà rendu sur cette voix n'est pas repayé (angle principal repris tel quel).
  const sansDouble = audioReutilisable(c) && principalDejaRendu(c, recetteDe(c)) ? lignes.filter((l) => l.etape !== "Double, angle principal") : lignes;
  if (audioReutilisable(c)) return sansDouble.filter((l) => l.etape !== "Voix");
  // 14/10 (voix de référence, avocat seulement) : contrôle actif, le texte peut être lu 2 fois par défaut (3 au plus, réglage à
  // 2 relances) : le prix annoncé (et confirmé) est ce maximum. Commande d'avant (réglage absent) : 1 lecture, prix d'avant.
  const k = lecturesVoixMax(ressemblanceDeLaCommande(commande.entrees));
  return k > 1 ? sansDouble.map((l) => (l.etape === "Voix" ? { ...l, quantite: l.quantite * k, total: multiplier(l.total, k) } : l)) : sansDouble;
}

/** Coûts « réels » des étapes encore simulées : l'estimation à ±10 %, stable pour une même vidéo. */
function lignesSimuleesReelles(c: CommandeFabrication): LigneCout[] {
  return lignesEstimees(c)
    .filter((l) => l.etape !== "Voix" && cleEtapeDeLigne(l.etape) !== "illustrations")
    .map((l) => ({ ...l, total: multiplier(l.total, 0.9 + (hache(l.etape + c.videoId) % 20) / 100), nature: "reel" as const }));
}

function ligneVoix(audio: AudioMaitre): LigneCout[] {
  // Son repris d'une maquette en panne (coût 0, déjà compté) : aucune ligne.
  if (audio.reutilise || !audio.caracteres || !audio.coutCentimes) return [];
  const total = centimes(audio.coutCentimes);
  return [{ etape: "Voix", fournisseur: audio.fournisseur, unite: "caractere", quantite: audio.caracteres, prixUnitaire: centimes(audio.coutCentimes / audio.caracteres), total, nature: "reel" }];
}

/** Ligne de la voix LUE (son brut payé), avant même que son étape soit finie. */
function ligneVoixBrute(brut: AudioBrut): LigneCout[] {
  if (!brut.caracteres || !brut.coutCentimes) return [];
  const total = centimes(brut.coutCentimes);
  return [{ etape: "Voix", fournisseur: brut.fournisseur, unite: "caractere", quantite: brut.caracteres, prixUnitaire: centimes(brut.coutCentimes / brut.caracteres), total, nature: "reel" }];
}

/**
 * 14/10 (voix de référence) : les lectures déjà payées ET mesurées de ce texte, gardées tant que la prise n'est pas
 * choisie (`a-copier` d'une relecture, `a-mesurer`, `mesure`, `a-relire`). Ensuite le son brut retenu les compte toutes.
 */
function prisesPayees(etat: EtatVoix): PriseVoixMesuree[] {
  return etat.phase === "a-copier" || etat.phase === "a-mesurer" || etat.phase === "mesure" || etat.phase === "a-relire" ? (etat.prises ?? []) : [];
}

/** Lectures déjà payées de ce texte (prises mesurées + la lecture en cours) : le plafond est revérifié avant chaque relecture. */
function lecturesDejaPayees(etat: EtatVoix): number {
  return prisesPayees(etat).length + ("brut" in etat ? 1 : 0);
}

/**
 * La voix déjà payée d'après l'état de la voix (son brut lu, audio maître, son partiel d'une version). 14/10 : TOUTES
 * les lectures payées comptent (prises déjà mesurées + lecture en cours), même entre deux relectures.
 */
export function lignesVoixPayee(etat: EtatVoix | undefined): LigneCout[] {
  if (!etat) return [];
  if (etat.phase === "faite") return ligneVoix(etat.audio);
  if (etat.phase === "a-assembler") return ligneVoix(etat.partiel);
  if (etat.phase === "assemblage") return ligneVoix(etat.base);
  const brut = "brut" in etat ? etat.brut : undefined;
  const lectures = [...prisesPayees(etat).map((p) => p.brut), ...(brut ? [brut] : [])];
  if (lectures.length <= 1) return lectures.length ? ligneVoixBrute(lectures[0]) : [];
  return ligneVoixBrute({ ...lectures[lectures.length - 1], coutCentimes: lectures.reduce((s, l) => s + l.coutCentimes, 0), caracteres: lectures.reduce((s, l) => s + l.caracteres, 0) });
}

/**
 * E2E-1 n° 3 et n° 8 (03/10) : ce qui est déjà payé pour un travail de fabrication. La voix compte dès qu'elle est lue
 * (son brut gardé dans l'état de la voix), au nom de SON fournisseur (HeyGen…) ; les illustrations à leur coût réel
 * (fal.ai) ; les autres étapes terminées au nom du fournisseur de leur ligne. Un travail de composition : rien.
 */
export function lignesPayeesAvocat(travail: Travail, c: CommandeFabrication): LigneCout[] {
  if (travail.parametres?.composition) return [];
  const voix = lignesVoixPayee(travail.parametres?.voix as EtatVoix | undefined);
  const illus = travail.parametres?.illustrations as EtatIllustrations | undefined;
  // Lot R7d : le double réel compte ce qui est soumis chez son fournisseur (rendu même si l'on arrête), jamais deux fois.
  const double = travail.parametres?.double as EtatDoubleMoteur | undefined;
  return [...voix, ...(illus ? ligneReelleIllustrations(illus) : []), ...lignesDouble(double, c.tauxUsdEur), ...lignesDesEtapesPayees(travail.etapes, lignesSimuleesReelles(c), travail.fournisseurUtilise, ["voix", "illustrations", ...(double ? ["visage"] : [])])];
}

/**
 * Planifie (horloge) les étapes encore simulées, une fois la voix et le découpage faits. `reelles` : étapes menées
 * par `studio-rendu` (lot M4 : montage, couleurs, son, formats d'image, vérification), jamais planifiées à l'horloge.
 */
function planifierSuite(etapes: EtapeTravail[], depart: number, echec?: string, reelles: string[] = []): EtapeTravail[] {
  const fin: Record<string, number> = {};
  for (const e of etapes) if (e.statut === "terminee" || e.statut === "ignoree") fin[e.cle] = depart;
  // Lot M5 : les illustrations suivent leur propre état (fal.ai) ; pour l'horloge, on compte quelques secondes.
  if (etapes.some((e) => e.cle === "illustrations") && fin.illustrations === undefined) fin.illustrations = depart + 5000;
  const sortie = etapes.map((e) => ({ ...e }));
  let restantes = sortie.filter((e) => e.statut !== "terminee" && e.statut !== "ignoree" && e.cle !== "voix" && e.cle !== "decoupage" && e.cle !== "illustrations" && !reelles.includes(e.cle));
  for (let garde = 0; restantes.length && garde < 100; garde++) {
    for (const e of restantes) {
      if (!e.dependDe.every((d) => fin[d] !== undefined)) continue;
      const debut = Math.max(depart, ...e.dependDe.map((d) => fin[d]));
      const duree = (DUREES[e.cle] ?? 3) * 1000;
      e.planifie = { debut, fin: debut + duree, echecA: echec === e.cle ? debut + duree * 0.6 : undefined };
      e.statut = "en_attente";
      e.progression = 0;
      e.erreur = undefined;
      fin[e.cle] = debut + duree;
    }
    restantes = restantes.filter((e) => fin[e.cle] === undefined);
  }
  return sortie;
}

function bloquee(e: EtapeTravail, etapes: EtapeTravail[]): boolean {
  return e.dependDe.some((d) => {
    const dep = etapes.find((x) => x.cle === d);
    return !dep || dep.statut === "echec" || bloquee(dep, etapes);
  });
}

function dureeTotaleEstimee(defs: DefinitionEtapeMoteur[]): number {
  const fin: Record<string, number> = {};
  for (let garde = 0; garde < 50 && Object.keys(fin).length < defs.length; garde++) {
    for (const d of defs) if (fin[d.cle] === undefined && d.dependDe.every((x) => fin[x] !== undefined)) fin[d.cle] = Math.max(0, ...d.dependDe.map((x) => fin[x])) + d.dureeEstimeeSec;
  }
  return Math.round(Math.max(0, ...Object.values(fin)));
}

export function creerMoteurMontageAvocat(deps: DependancesMoteurAvocat = {}): MoteurVideo & {
  /** Fait avancer la voix d'UNE phase (utilisé par `avancer` et par la maquette). */
  avancerVoix(etat: EtatVoix, c: CommandeFabrication, idBase: string, maintenant: number): Promise<EtatVoix>;
} {
  const env = deps.environnement ?? process.env;
  // Service de rendu simulé réglé sur l'horloge du moteur (les tests avancent le temps sans attendre).
  const horloge = { t: Date.now() };
  const renduInterne = creerServiceRenduSimule(() => horloge.t);
  const rendu = (): ServiceRendu => deps.rendu ?? (renduSimule(env) ? renduInterne : obtenirServiceRendu(env));
  const renduEstSimule = () => !deps.rendu && renduSimule(env);
  const stockage = () => deps.stockage?.() ?? resoudreFournisseur("stockage");
  const voixDe = (c: CommandeFabrication) => deps.voix?.(c.distribution[0]?.fournisseurVoix) ?? resoudreFournisseur("voix", c.distribution[0]?.fournisseurVoix);
  const illustrationDe = (c: CommandeFabrication) => deps.illustration?.() ?? resoudreFournisseur("illustration", typeof c.entrees?.fournisseurIllustration === "string" ? c.entrees.fournisseurIllustration : undefined);
  // Lot R6 : le calage choisi dans Réglages > Connexions, figé dans la commande (sinon la variable du serveur).
  const aligneurDe = (c: CommandeFabrication) => deps.alignement?.() ?? resoudreFournisseur("alignement", optionsCalage(c).fournisseur);
  /** Lot R6 (C6) : la voix de synthèse n'est calée que sur demande, ou si elle n'a pas horodaté ses mots. */
  const calerVoix = (c: CommandeFabrication, motsEstimes: boolean) => calerLaVoix({ aligneurReel: aligneurDe(c).mode !== "simulation", voixSynthese: optionsCalage(c).voixSynthese, motsEstimes });
  /**
   * Lot R6 : la voix passe à l'analyse, sa cause d'approximation décidée UNE fois (`causeApproximation`) et gardée dans
   * l'état (puis dans `voixBrute`) : `motsEstimes` ne sert plus, rien n'est recalculé à la reprise.
   */
  function versAnalyse(c: CommandeFabrication, brut: AudioBrut, rapport?: RapportAlignement): EtatVoix {
    return versAnalyseMaitre(brut, aligneurDe(c).mode !== "simulation", rapport);
  }
  // Lot R7d : le double. Montage VRAIMENT réel = `studio-rendu` configuré (production) ; un double réel = fournisseur
  // réel branché, double validé (« prêt ») et identifiant chez le fournisseur, pour chaque angle utilisé.
  const visageDe = (f?: string): FournisseurVisage => deps.visage?.(f) ?? resoudreFournisseur("visage", f);
  const fournisseurReel = (f: string) => visageDe(f).mode === "reel";
  const montageVraimentReel = () => !renduSimule(env);
  const avecDouble = (c: CommandeFabrication) => c.distribution.some((d) => d.source === "double");
  // GARDE-FOU : un montage SIMULÉ ne paie jamais le double (aucun envoi chez le fournisseur, simulation par défaut).
  // Lot R7e : le réglage de Will figé dans la commande (éteint par défaut).
  const renduAutorise = (c: CommandeFabrication) => deps.renduDoubleAutorise ?? renduAllumeDans(c);
  const doubleReel = (c: CommandeFabrication) => montageReel() && avecDouble(c) && !estPrisesFilmees(c) && refusDouble(c, recetteDe(c), fournisseurReel, renduAutorise(c)) === null;
  /** GARDE-FOU : un montage réel ne part jamais avec le double d'essai ni un double non validé. */
  function refusDuDouble(c: CommandeFabrication): string | null {
    if (!montageVraimentReel() || !avecDouble(c) || estPrisesFilmees(c)) return null;
    return refusDouble(c, recetteDe(c), fournisseurReel, renduAutorise(c));
  }

  /** Lot R7d : « Votre double n'est pas prêt » (erreur typée, message clair). */
  function verifierDouble(c: CommandeFabrication) {
    const refus = refusDuDouble(c);
    if (refus) throw new ErreurMoteurAvocat("DOUBLE_PAS_PRET", refus);
  }

  /** GARDE-FOU (correcteur 4, B4) : un montage VRAIMENT réel ne part jamais avec une voix d'essai. */
  const refusDeLaVoix = (c: CommandeFabrication): string | null => (montageVraimentReel() ? refusVoixEssai(c) : null);

  /**
   * Une voix sans son seul est refusée (B.0 §9) : erreur typée, message clair. 14/10 (voix de référence) : revérifié
   * juste AVANT chaque lecture payée, relectures comprises (`lecturesPayees` : lectures déjà payées de ce texte) ; le
   * prix confirmé couvre `lecturesVoixMax` lectures (réglage figé dans la commande), jamais une de plus.
   */
  function verifierVoix(c: CommandeFabrication, lecturesPayees?: number) {
    if (!c.distribution.length || estPrisesFilmees(c)) return;
    const v = voixDe(c);
    if (!v.capacites.audioSeul) {
      throw new ErreurMoteurAvocat("VOIX_INCOMPATIBLE", "Cette voix ne sait pas produire un son seul : choisissez une autre voix dans Personnages.");
    }
    if (lecturesPayees !== undefined && lecturesPayees >= lecturesVoixMax(ressemblanceDeLaCommande(c.entrees))) {
      throw new ErreurMoteurAvocat("PLAFOND_VOIX", "La voix a déjà été lue autant de fois que le prix confirmé le permet : aucune lecture de plus n'est payée.");
    }
  }

  function cleDe(c: CommandeFabrication, idBase: string, nom: string): string {
    const e = env.NODE_ENV === "production" ? "prod" : "dev";
    return `studio/${e}/audio-maitre/${c.videoId}/${idBase}-${nom}`;
  }

  /* ---------------- G6 / G6b : assemblage (version par réseau, prises « je lis ») ---------------- */

  /** Fin de la voix : une version par réseau doit encore être raccordée au corps de la mère (G6). */
  function apresVoix(c: CommandeFabrication, audio: AudioMaitre): EtatVoix {
    return estVarianteSurMere(c) && !audio.assemble ? { phase: "a-assembler", partiel: audio } : { phase: "faite", audio };
  }

  /** Demande d'assemblage à `studio-rendu` (adresses signées des entrées, dépôt du résultat). */
  async function soumettreAssemblage(c: CommandeFabrication, idBase: string, plan: PlanAssemblage, essai = 0): Promise<DemandeRendu> {
    const s = stockage();
    const sortieCle = cleDe(c, idBase, plan.sortie === "wav" ? "assemblage.wav" : "prises-assemblees.mp4");
    const entrees: Record<string, string> = {};
    for (const [nom, cle] of Object.entries(plan.entrees)) {
      const url = s.urlLectureDuree ? await s.urlLectureDuree(cle, 3600) : await s.urlLecture(cle);
      if (!renduEstSimule() && !/^https?:\/\//.test(url)) throw new ErreurMoteurAvocat("STOCKAGE_NON_RELIE", "Le stockage des fichiers n'est pas relié : la vidéo ne peut pas être assemblée. Vérifiez Réglages > Connexions.");
      entrees[nom] = /^https?:\/\//.test(url) ? url : `https://simulation.invalid${url.startsWith("/") ? "" : "/"}${url}`;
    }
    const depot = s.urlDepotDuree ? await s.urlDepotDuree(sortieCle, 3600, plan.sortie === "wav" ? "audio/wav" : "video/mp4") : "";
    const demande: DemandeRendu = {
      idRendu: essai ? `${idBase}-assemblage-e${essai}` : `${idBase}-assemblage`,
      operation: "assemblage",
      file: "courte",
      entrees,
      sortie: { urlDepot: depot, cle: sortieCle },
      parametres: { sortie: plan.sortie, morceaux: plan.morceaux.map(({ entree, deSec, aSec }) => ({ entree, deSec, aSec })), fonduMs: 12, ...(plan.sortie === "mp4" ? { video: { largeur: 1080, hauteur: 1920, fps: 25 } } : {}) },
    };
    await rendu().soumettre(demande);
    return demande;
  }

  /** Audio maître d'un assemblage terminé (le son, ses mots replacés, ses plans et ses raccords). */
  function audioAssemble(c: CommandeFabrication, base: AudioMaitre, plan: PlanAssemblage, fichierCle: string): AudioMaitre {
    const d = debitEtVitesseConseillee(plan.motsPrononces, c.distribution[0]?.reglagesVoix?.vitesse ?? 1);
    return {
      ...base,
      fichierCle,
      dureeSec: plan.dureeSec,
      mots: plan.motsPrononces,
      empreinte: empreinteAudioMaitre(c),
      assemble: true,
      plansAssembles: plan.plans.length ? plan.plans : undefined,
      morceaux: plan.morceaux,
      jointures: plan.jointures,
      ...(plan.sortie === "mp4" ? { pisteVideo: fichierCle } : {}),
      ...d,
    };
  }

  /** G6 : morceaux d'une version par réseau (début et fin neufs, corps de la mère), calculés par la brique commune. */
  function planVariante(c: CommandeFabrication, partiel: AudioMaitre): PlanAssemblage {
    const v = c.variante!;
    const mere = v.mere!;
    const refaits = new Set(v.segmentsRefaits);
    const cp = commandePartielle(c, refaits);
    const motsP = reporterHorodatages(texteVoixDe(cp), partiel.mots);
    const tempsP = tempsDesSegments(motsP);
    const plansP = decouper(cp, motsP, partiel.dureeSec);
    const sources: SourceAssemblage[] = [
      { nom: "mere", dureeSec: mere.dureeSec, segments: mere.segments, motsPrononces: mere.motsPrononces, plans: mere.plans },
      { nom: "partiel", dureeSec: partiel.dureeSec, segments: tempsP, motsPrononces: partiel.mots, plans: plansP },
    ];
    const etapes = etapesVariante({ ordreVersion: segmentsDe(c).map((s) => s.id), refaits, ordreMere: mere.segments.map((s) => s.segmentId) });
    const r = assembler(sources, etapes);
    // Le son neuf a été découpé seul (son temps 0 n'est pas celui de la vidéo) : une incrustation de la fin (appel)
    // que la règle des 3 premières secondes a écartée est reposée sur le 1er plan du double de son segment.
    for (const s of segmentsDe(c)) {
      if (!s.incrustation || r.plans.some((p) => p.segmentId === s.id && p.incrustation)) continue;
      const cible = r.plans.find((p) => p.segmentId === s.id && p.sourceImage !== "illustration" && p.debutSec >= 3);
      if (cible) cible.incrustation = s.incrustation;
    }
    return { sortie: "wav", morceaux: r.morceaux, dureeSec: r.dureeSec, motsPrononces: r.motsPrononces, plans: r.plans, jointures: r.jointures, entrees: { mere: mere.audioCle, partiel: partiel.fichierCle } };
  }

  /** G6b : morceaux des prises calées (sans plans : coupés dans les blancs, avant le premier mot et après le dernier). */
  function planPrises(c: CommandeFabrication, prises: PriseCommande[], etats: EtatPrise[]): PlanAssemblage {
    const sources: SourceAssemblage[] = prises.map((p) => {
      const e = etats.find((x) => x.id === p.id)!;
      const segs = segmentsDe(c).filter((s) => p.segmentIds.includes(s.id));
      const motsV = reporterHorodatages(texteVoixDe(c, segs), e.mots ?? []);
      return { nom: `prise-${p.id}`, dureeSec: p.dureeSec, segments: tempsDesSegments(motsV), motsPrononces: e.mots ?? [] };
    });
    // Ordre de la version : chaque segment est pris dans la prise qui le couvre (début, corps, fin).
    const etapes: { source: string; segmentIds: string[] }[] = [];
    for (const id of segmentsDe(c).map((s) => s.id)) {
      const p = prises.find((x) => x.segmentIds.includes(id));
      if (!p) continue;
      const nom = `prise-${p.id}`;
      const derniere = etapes.at(-1);
      if (derniere?.source === nom) derniere.segmentIds.push(id);
      else etapes.push({ source: nom, segmentIds: [id] });
    }
    const r = assembler(sources, etapes);
    return { sortie: "mp4", morceaux: r.morceaux, dureeSec: r.dureeSec, motsPrononces: r.motsPrononces, plans: [], jointures: r.jointures, entrees: Object.fromEntries(prises.map((p) => [`prise-${p.id}`, p.cle])) };
  }

  /** G6b : horodatage estimé d'une prise (référence du calage, repli si l'aligneur échoue) : le texte réparti sur la prise. */
  function estimationPrise(texte: string, dureeSec: number): MotHorodate[] {
    const brut = horodaterTexte(texte, 2.9);
    const fin = brut.at(-1)?.finSec ?? 1;
    const utile = Math.max(0.5, dureeSec - MARGE_PRISE_SEC.avant - MARGE_PRISE_SEC.apres);
    const k = utile / fin;
    return brut.map((m) => ({ mot: m.mot, debutSec: +(MARGE_PRISE_SEC.avant + m.debutSec * k).toFixed(3), finSec: +(MARGE_PRISE_SEC.avant + m.finSec * k).toFixed(3) }));
  }

  /** ORG-07b : dépendances de la brique `voix-maitre`, tirées de la commande (mêmes fournisseurs, mêmes clés). */
  function outilsVoixMaitre(c: CommandeFabrication, idBase: string, regles: OutilsVoixMaitre["regles"], lecturesPayees = 0): OutilsVoixMaitre {
    const d = c.distribution[0];
    // 14/10 : contrôle de ressemblance à la voix de référence, figé dans la commande au lancement (absent : coupé).
    const ressemblance = ressemblanceDeLaCommande(c.entrees);
    // G6 : une version sur mère ne lit QUE son début et sa fin (texte dit transmis, prononciations appliquées une fois).
    const texte = () => {
      const refaits = estVarianteSurMere(c) ? new Set(c.variante!.segmentsRefaits) : null;
      return texteVoixDe(c, refaits ? segmentsDe(c).filter((s) => refaits.has(s.id)) : segmentsDe(c)).texte;
    };
    return {
      voix: () => voixDe(c),
      stockage,
      aligneur: () => aligneurDe(c),
      rendu,
      renduEstSimule,
      cle: (nom) => cleDe(c, idBase, nom),
      idBase,
      texte,
      empreinte: () => empreinteAudioMaitre(c),
      existant: c.audioMaitre,
      idVoix: d?.idVoixFournisseur ?? "",
      reglages: d?.reglagesVoix,
      tauxUsdEur: c.tauxUsdEur,
      fournisseurVoix: d?.fournisseurVoix,
      caler: (motsEstimes) => calerVoix(c, motsEstimes),
      regles,
      // 14/10 : voix et plafond des lectures revérifiés avant CHAQUE lecture payée (relectures comprises).
      avantLecture: () => verifierVoix(c, lecturesPayees),
      erreurStockage: (message) => new ErreurMoteurAvocat("STOCKAGE_NON_RELIE", message),
      ...(ressemblance ? { ressemblance } : {}),
    };
  }

  /** Une phase de la voix. Lève une erreur typée (réessayable ou non) que la boucle de fond sait reprendre. */
  async function avancerVoix(etat: EtatVoix, c: CommandeFabrication, idBase: string, maintenant: number): Promise<EtatVoix> {
    horloge.t = maintenant;
    const aligneur = () => aligneurDe(c); // le calage figé dans la commande
    const regles = recetteDe(c).nettoyageBlancs ?? REGLES_NETTOYAGE_PAR_DEFAUT;
    // G6b : prises filmées, calées une à une sur leur texte (aucune voix de synthèse).
    if (etat.phase === "a-lire" && estPrisesFilmees(c)) return avancerVoix({ phase: "prises", prises: c.prises!.map((p) => ({ id: p.id, phase: "a-aligner" as const })) }, c, idBase, maintenant);
    // ORG-07b : texte → son maître délégué à la brique `voix-maitre` (code déplacé tel quel) ; la fin d'une version
    // par réseau (raccord au corps de la mère) reste ici (`apresVoix`).
    if (etat.phase !== "a-assembler" && etat.phase !== "prises" && etat.phase !== "assemblage" && etat.phase !== "faite") {
      const r = await avancerVoixMaitre(etat, outilsVoixMaitre(c, idBase, regles, lecturesDejaPayees(etat)));
      return r.phase === "faite" ? apresVoix(c, r.audio) : r;
    }
    // G6 : le son neuf est fait ; les morceaux (début, corps de la mère, fin) sont calculés puis mis bout à bout.
    if (etat.phase === "a-assembler") {
      const plan = planVariante(c, etat.partiel);
      if (renduEstSimule()) return { phase: "faite", audio: audioAssemble(c, etat.partiel, plan, etat.partiel.fichierCle) };
      return { phase: "assemblage", base: etat.partiel, plan, demande: await soumettreAssemblage(c, idBase, plan) };
    }
    // G6b : chaque prise est calée sur son texte (aligneur réel ; simulation : le texte réparti sur la prise).
    // Lot R6 (C5) : TOUJOURS calée quand l'aligneur est relié (réglage de la voix sans effet ici) ; sinon l'estimation
    // est gardée et la vidéo le dit (« Sous-titres approximatifs »).
    if (etat.phase === "prises") {
      const causePrise = (rapport?: RapportAlignement) => causeApproximation({ motsEstimes: true, aligneurReel: aligneur().mode !== "simulation", rapport });
      const prises: EtatPrise[] = [];
      for (const e of etat.prises) {
        const p = c.prises!.find((x) => x.id === e.id)!;
        const texte = texteVoixDe(c, segmentsDe(c).filter((s) => p.segmentIds.includes(s.id))).texte;
        const reference = estimationPrise(texte, p.dureeSec);
        if (e.phase === "calee") prises.push(e);
        else if (aligneur().mode === "simulation") prises.push({ ...e, phase: "calee", mots: reference, approximatif: causePrise() });
        else if (e.phase === "a-aligner") {
          const s = stockage();
          const audio = s.urlLectureDuree ? await s.urlLectureDuree(p.cle, DUREE_ADRESSE_CALAGE_SEC) : await s.urlLecture(p.cle);
          const demande = demandeAlignement({ idBase: `${idBase}-${p.id}`, essai: e.essai, audio, texte, reference });
          await aligneur().soumettre(demande);
          prises.push({ ...e, phase: "alignement", demande });
        } else {
          const r = await aligneur().suivre(e.demande!.idAlignement);
          if (r.statut === "en_file" || r.statut === "en_cours") prises.push(e);
          else if (r.statut === "echec") {
            const essai = (e.essai ?? 0) + 1;
            if (r.erreur.reessayable && essai < ESSAIS_ALIGNEMENT) prises.push({ id: e.id, phase: "a-aligner", essai });
            else {
              const { mots, rapport } = appliquerAlignement(reference, null, p.dureeSec);
              prises.push({ id: e.id, phase: "calee", mots, rapport, approximatif: causePrise(rapport) });
            }
          } else {
            const { mots, rapport } = appliquerAlignement(reference, r.resultat, p.dureeSec);
            const approximatif = causePrise(rapport);
            prises.push({ id: e.id, phase: "calee", mots, rapport, ...(approximatif ? { approximatif } : {}) });
          }
        }
      }
      if (!prises.every((e) => e.phase === "calee")) return { phase: "prises", prises };
      const plan = planPrises(c, c.prises!, prises);
      const rapports = prises.flatMap((e) => (e.rapport ? [e.rapport] : []));
      // « non relié » l'emporte : c'est la cause que Will peut corriger (Réglages > Connexions).
      const approximatif: CauseApproximation | undefined = prises.some((e) => e.approximatif === "non-relie") ? "non-relie" : prises.some((e) => e.approximatif) ? "echec" : undefined;
      const base: AudioMaitre = { fichierCle: c.prises![0].cle, dureeSec: plan.dureeSec, mots: plan.motsPrononces, empreinte: empreinteAudioMaitre(c), reutilise: false, coutCentimes: 0, fournisseur: "prises", caracteres: 0, coupures: 0, respirations: 0, motsParSeconde: 0, vitesseConseillee: 1, ...(rapports[0] ? { alignement: rapports[0] } : {}), ...(approximatif ? { sousTitresApproximatifs: approximatif } : {}) };
      if (renduEstSimule()) return { phase: "faite", audio: audioAssemble(c, base, plan, c.prises![0].cle) };
      return { phase: "assemblage", base, plan, demande: await soumettreAssemblage(c, idBase, plan) };
    }
    if (etat.phase === "assemblage") {
      const e = await suivreRendu(rendu(), etat.demande!);
      if (e.statut === "echec") {
        const essai = (etat.essai ?? 0) + 1;
        if (!e.erreur.reessayable || essai > ESSAIS_RENDU) throw new ErreurRendu(e.erreur);
        return { ...etat, essai, demande: await soumettreAssemblage(c, idBase, etat.plan, essai) };
      }
      if (e.statut !== "termine") return etat;
      return { phase: "faite", audio: audioAssemble(c, etat.base, etat.plan, e.sortieCle) };
    }
    return etat;
  }

  /** Mots du texte VALIDÉ sur l'audio maître (ou, sans voix, sur une estimation du texte). */
  function motsAffiches(c: CommandeFabrication, audio?: AudioMaitre): MotReporte[] {
    const texte = texteVoixDe(c);
    const prononces = audio?.mots ?? horodaterTexte(texte.texte, 4.4);
    return reporterHorodatages(texte, prononces);
  }

  function decouper(c: CommandeFabrication, mots: MotReporte[], dureeAudioSec?: number): PlanProduit[] {
    // G6 : une coupe à chaque frontière ouverture | corps | facultatif | fin (raccord des versions par réseau).
    const coupes = coupesImposees(tempsDesSegments(mots), c.partiesDeclinaison);
    const d = c.distribution[0];
    // Correcteur 4 : l'angle principal est celui de la recette (plus « trois-quarts » en dur).
    const principal = visagePrincipalResolu(d?.visagesResolus, anglePrincipalDe(recetteDe(c)));
    return decouperEnPlans({
      mots,
      segments: segmentsDe(c),
      plansIndicatifs: c.plans,
      recette: recetteDe(c),
      style: c.styles.styleMontage?.valeur,
      repartition: d?.repartitionAngles ?? recetteDe(c).angles.repartitionParDefaut,
      deuxAngles: d?.modeAngles === "deux-angles",
      ouvertureSurIllustration: c.reglages.ouvertureSurIllustration === true,
      illustrations: c.briques.illustrations,
      levresNote: principal?.levresNote,
      personnageId: d?.personnageId,
      dureeAudioSec,
      // Lot « intensité » (02/10) : la structure respecte le plafond (R14). Absent : commande d'avant le lot.
      intensite: c.intensite?.niveau,
      ...(coupes.length ? { coupesImposeesSec: coupes } : {}),
      // Correcteur réel 2 : avatar filmé en pied → cadrages mi-cuisse / poitrine / visage.
      ...(c.reglages.cadrageDouble === "en-pied" ? { sujetEnPied: true } : {}),
      ...(c.reglages.finEnBoucle === true ? { finEnBoucle: true } : {}),
    });
  }

  /**
   * Lot « intensité · bruitages » (02/10) : la courbe UNIQUE (brique commune `intensite`) arbitre le zoom lent, les
   * incrustations, les accents des sous-titres et place les bruitages validés. Commande d'avant le lot : rien.
   */
  /** Choix « retirer / ajouter le son » faits après fabrication (par ordre de plan), rangés par le service. */
  function choixApres(c: CommandeFabrication): Record<string, ChoixBruitagePlan | null> | undefined {
    const x = c.entrees?.[ENTREE_BRUITAGES_PLANS];
    return x && typeof x === "object" ? (x as Record<string, ChoixBruitagePlan | null>) : undefined;
  }

  function orchestrer(c: CommandeFabrication, plans: PlanProduit[], segments: SegmentSousTitres[], mots: MotReporte[], dureeSec: number): SortieOrchestrationMontage | null {
    if (!c.intensite || !plans.length) return null;
    const segs = segmentsDe(c);
    const relancesSec = segs.filter((s, i) => i > 0 && s.bloc !== segs[i - 1].bloc).flatMap((s) => mots.find((m) => m.segmentId === s.id)?.debutSec ?? []);
    return orchestrerMontage({
      niveau: c.intensite.niveau,
      dureeSec,
      // « Retirer / ajouter le son » choisi à l'Aperçu (par phrase) ou après fabrication (par plan).
      plans: avecChoixBruitages(plans, c.plans, choixApres(c)),
      segments,
      angleSecond: recetteDe(c).angles.second,
      relancesSec,
      bruitages: { reglage: c.intensite.bruitages, disponibles: c.bruitagesDisponibles ?? [], graine: hache(c.videoId) % 1000 },
    });
  }

  async function sousTitresDe(c: CommandeFabrication, mots: MotReporte[], dureeSec: number, plans?: PlanProduit[]): Promise<SegmentSousTitres[] | undefined> {
    if (!c.briques["sous-titres"] || !c.distribution.length) return undefined;
    const texte = segmentsDe(c).map((s) => s.texte).join(" ");
    const emphase = segmentsDe(c).flatMap((s) => s.emphase ?? []);
    // Lot M4 : style, base, mélange, calage sur les coupes et zones des réseaux conseillés (ceux que la vidéo affiche).
    return briqueSousTitres.executer({
      texte,
      dureeSec,
      motsParLigne: Math.min(4, c.styles.sousTitres?.valeur?.motsParLigne ?? 3),
      prononciations: c.prononciations,
      emphase,
      mots,
      style: c.styles.sousTitres?.valeur,
      base: c.sousTitres?.base,
      intensite: c.sousTitres?.intensite,
      coupesSec: plans?.slice(1).map((p) => p.debutSec),
      // G6 : les sous-titres restent hors de TOUTES les zones protégées des réseaux cochés (union).
      reseaux: reseauxDeCommande(c, trouverFormat(c.formatId)?.reseauxConseilles),
    });
  }

  function sorties(c: CommandeFabrication, dureeSec: number, note: number, alertes: SortieProduite["rapportQualite"]["alertes"], ratios: Ratio[] = c.ratios): SortieProduite[] {
    const base = VIDEOS_DEMO[hache(c.videoId) % VIDEOS_DEMO.length];
    return ratios.map((ratio) => ({
      ratio,
      fichierCle: `${base}.mp4`,
      vignetteCle: `${base}.jpg`,
      resolution: RESOLUTIONS[ratio],
      dureeSec,
      taille: 900_000 + (hache(c.videoId) % 400_000),
      rapportQualite: { note, verifie: { image: true, son: true, sousTitres: true, mentionIA: !!c.briques["mention-ia"], droits: false }, alertes, niveauSonoreLufs: -14 },
    }));
  }

  /* ---------------- Lot M4 : montage, couleurs, son, export dans studio-rendu ---------------- */

  /** Le montage passe par `studio-rendu` quand il est réel (ou injecté) ; sinon, l'horloge simulée. */
  const montageReel = () => !renduEstSimule();
  const estHttp = (u: string) => /^https?:\/\//.test(u);

  const outils: OutilsMontage = {
    rendu,
    recette: RECETTE_COMPOSITION_AVOCAT,
    async signer(lectures, depots) {
      const s = stockage();
      const sortie = { lectures: {} as Record<string, string>, depots: {} as Record<string, string> };
      for (const [nom, cle] of Object.entries(lectures)) {
        const url = s.urlLectureDuree ? await s.urlLectureDuree(cle, 3600) : await s.urlLecture(cle);
        if (!renduEstSimule() && !estHttp(url)) throw new ErreurMoteurAvocat("STOCKAGE_NON_RELIE", "Le stockage des fichiers n'est pas relié : la vidéo ne peut pas être montée. Vérifiez Réglages > Connexions.");
        sortie.lectures[nom] = estHttp(url) ? url : `https://simulation.invalid${url.startsWith("/") ? "" : "/"}${url}`;
      }
      for (const d of depots) {
        const url = s.urlDepotDuree ? await s.urlDepotDuree(d.cle, 3600, d.mime) : "";
        if (!renduEstSimule() && !url) throw new ErreurMoteurAvocat("STOCKAGE_NON_RELIE", "Le stockage des fichiers n'est pas relié : la vidéo ne peut pas être déposée. Vérifiez Réglages > Connexions.");
        sortie.depots[d.cle] = url;
      }
      return sortie;
    },
    cle: (c, nom) => `studio/${env.NODE_ENV === "production" ? "prod" : "dev"}/videos/${c.videoId}/${nom}`,
  };

  /** Ce que la fabrication compose : plans, sous-titres, durée, mots et audio maître du travail. */
  async function baseDuTravail(c: CommandeFabrication, travail: Travail): Promise<BaseComposition> {
    const etat = travail.parametres?.voix as EtatVoix | undefined;
    const audio = etat?.phase === "faite" ? etat.audio : undefined;
    const mots = motsAffiches(c, audio);
    const brutPlans = (travail.parametres?.plans as PlanProduit[] | undefined) ?? audio?.plansAssembles ?? decouper(c, mots, audio?.dureeSec);
    // Lot M5 : un plan fabriqué pointe vers son clip (identifiant provisoire, remplacé par l'élément créé).
    const { plans } = avecIllustrationsFabriquees(c, brutPlans, travail.parametres?.illustrations as EtatIllustrations | undefined);
    const dureeSec = plans.at(-1)?.finSec ?? c.dureeCibleSec;
    const segments = (await sousTitresDe(c, mots, dureeSec, plans)) ?? [];
    // G6b : la vidéo des prises assemblées tient lieu de double (image opaque, décor compris).
    // Lot R7d : sinon, les webm transparents du double réel (piste principale continue, passages du second angle).
    // Lot R7e : repli « fond uni » : les pistes sont opaques, sans liseré (`doubleFondUni`).
    // Correcteur réel 2 : décor relié à un look HeyGen : les pistes PORTENT le décor (chemin `lookReel`, `pistesDepuisLook`).
    const double = travail.parametres?.double as EtatDoubleMoteur | undefined;
    const prises = audio?.pisteVideo ? { pistesDouble: { [recetteDe(c).angles.principal]: audio.pisteVideo }, pistesDepuisLook: true } : double ? compositionDuDouble(double) : {};
    const o = orchestrer(c, plans, segments, mots, dureeSec);
    const h = supplementsMissionH(c, travail.parametres);
    if (!o) return { plans, segments, dureeSec, mots: audio?.mots, audioCle: audio?.fichierCle, ...prises, ...h };
    return { plans: o.plans, segments: o.segments, dureeSec, mots: audio?.mots, audioCle: audio?.fichierCle, bruitages: o.bruitages, rapportIntensite: o.rapport, ...prises, ...h };
  }

  /** Base d'un format ajouté ou d'un recalque : relue dans le projet de montage de la version (rien n'est refait). */
  function baseDuParent(parent: ParentRetouche | undefined, segments: SegmentSousTitres[] | undefined): BaseComposition | null {
    const projet = parent?.projetMontage as ProjetMontageAvocat | undefined;
    if (!projet?.plansProduits?.length) return null;
    const masters: Partial<Record<Ratio, string>> = {};
    const pistesDouble: NonNullable<BaseComposition["pistesDouble"]> = {};
    for (const p of parent?.pistes ?? []) {
      if (p.type === "master-sans-texte" && p.ratio) masters[p.ratio] = p.fichierCle;
      if (p.type === "plan-double" && (p.planId === "trois-quarts" || p.planId === "face")) pistesDouble[p.planId] = p.fichierCle;
    }
    const base: BaseComposition & { projet: ProjetMontageAvocat } = { plans: projet.plansProduits, segments: segments ?? [], dureeSec: projet.dureeSec ?? projet.plansProduits.at(-1)!.finSec, mots: projet.motsAudio, audioCle: projet.audioMaitre?.fichierCle, pistesDouble, masters, projet, ...(projet.tranchesDouble ? { tranchesDouble: projet.tranchesDouble } : {}), ...(projet.doubleFondUni ? { doubleFondUni: true } : {}), ...(projet.doubleDecorDuLook ? { pistesDepuisLook: true } : {}), ...(projet.bruitages?.length ? { bruitages: projet.bruitages } : {}), ...(projet.rapportIntensite ? { rapportIntensite: projet.rapportIntensite } : {}) };
    // Mission H : la multicaméra d'une version suit ses formats ajoutés et ses recalques (angles déjà fabriqués).
    const mc = multicameraPourComposition(projet.multicamera, montageReel());
    if (mc) base.multicamera = mc;
    return base;
  }

  /**
   * Lot « bruitages » (02/10) : sons replacés d'après les choix « retirer / ajouter » des plans de la commande (plans
   * reconnus par leur ordre), tout le reste figé. Renvoie la base à remixer, ou null si les sons ne changent pas.
   */
  function remixageDes(c: CommandeFabrication, base: BaseComposition): BaseComposition | null {
    if (!c.intensite || !base.plans.length) return null;
    const apres = choixApres(c);
    // Plans de la version : leur choix courant, remplacé par ceux faits après fabrication.
    const plans = apres ? avecChoixBruitages(base.plans, [], { ...Object.fromEntries(base.plans.map((p) => [String(p.ordre), p.bruitage ?? null])), ...apres }) : base.plans;
    const o = orchestrerMontage({ niveau: c.intensite.niveau, dureeSec: base.dureeSec, plans, segments: base.segments, angleSecond: recetteDe(c).angles.second, fige: true, bruitages: { reglage: c.intensite.bruitages, disponibles: c.bruitagesDisponibles ?? [], graine: hache(c.videoId) % 1000 } });
    const avant = JSON.stringify(base.bruitages ?? []);
    if (JSON.stringify(o.bruitages) === avant) return null;
    return { ...base, plans, bruitages: o.bruitages, rapportIntensite: o.rapport };
  }

  /** Alertes de composition gardées en simulation (celles qui ne dépendent pas d'un fichier). */
  function alertesDeComposition(c: CommandeFabrication, base: BaseComposition): AlerteQualite[] {
    const sortie: AlerteQualite[] = [];
    for (const ratio of c.ratios) {
      if (ratio === "16:9") continue;
      const p = parametresComposition(c, { ratio, plans: base.plans, segments: base.segments, dureeSec: base.dureeSec, mots: base.mots, audioCle: base.audioCle });
      sortie.push(...p.alertes.filter((a) => ["chevauchement", "montant", "zone-protegee"].includes(a.code)));
    }
    return dedoublonner(sortie);
  }

  /* ---------------- Mission H : briques communes (options coupées par défaut) ---------------- */

  /**
   * Après le découpage, une seule fois : (1) le monteur commun lit les consignes de la vidéo (`entrees.avocatMonteur`) ;
   * (2) la multicaméra (prises filmées, `entrees.avocatMulticamera` ou consigne « 3 caméras ») ; (3) les cartes de la
   * brique `motion` aux places des illustrations et titres (`entrees.avocatMotionCommune`). Aucune option : rien n'est
   * lu ni écrit, les plans restent ceux du découpage. Une panne d'une passe laisse la vidéo comme avant.
   */
  async function passesMissionH(c: CommandeFabrication, travail: Travail, parametres: Record<string, unknown>, audio?: AudioMaitre): Promise<void> {
    const motion = optionMotionAvocat(c);
    const monteurOpt = optionMonteurAvocat(c);
    const multicam = multicameraDemandeeAvocat(c);
    if (!motion && !monteurOpt && !multicam) return;
    let plans = (parametres.plans as PlanProduit[] | undefined) ?? [];
    const mots = audio?.mots ?? motsAffiches(c, audio);
    const dureeSec = audio?.dureeSec ?? plans.at(-1)?.finSec ?? c.dureeCibleSec;
    // (1) Monteur : ce que l'avocat sait faire est appliqué, le reste reçoit une réponse claire (gardée au projet).
    const decisions = monteurOpt ? deciderMonteurAvocat(monteurOpt, mots, plans, !!motion, { prisesFilmees: estPrisesFilmees(c) }) : null;
    if (decisions) {
      plans = appliquerZoomsAvocat(plans, decisions.plansZoom);
      parametres.monteur = { consignes: decisions.consignes, reponse: decisions.reponse };
    }
    // (2) Multicaméra : prises filmées seulement (la face = la vidéo des prises assemblées, même son).
    const consignes3 = decisions?.multicamera === true ? decisions.consignes.filter((x) => x.comprise).map((x) => x.texte) : [];
    const veutMulticam = decisions?.multicamera === false ? false : multicam || decisions?.multicamera === true;
    const passe = deps.multicamera ?? servicesAvocat().multicamera;
    if (veutMulticam && passe && estPrisesFilmees(c) && audio?.pisteVideo) {
      try {
        const segments = segmentsDe(c).map((x) => ({ id: x.id, bloc: x.bloc, ...(x.emphase?.length ? { emphase: x.emphase } : {}) }));
        const piste = await passe({ travailId: travail.id, commande: c, priseCle: audio.pisteVideo, audioCle: audio.fichierCle, dureeSec, ratio: c.ratios[0] ?? "9:16", plans, mots, segments, consignes: consignes3 });
        if (piste) parametres.multicamera = piste;
      } catch {
        // Règle de panne : la vidéo reste à une caméra.
      }
    }
    // (3) Motion commune : cartes de la brique, à rendre par l'opération `composition` existante.
    if (motion) {
      const segmentsScript = c.script.blocs.flatMap((b) => b.segments);
      const pose = poserMotionAvocat(c, { ...motion, demandes: [...(motion.demandes ?? []), ...(decisions?.demandesStyle ?? [])] }, plans, segmentsScript, mots, dureeSec);
      // Cartes demandées au Monteur (posées en plus, mêmes règles : jamais deux cartes l'une sur l'autre).
      const cartes = [...pose.cartes, ...(decisions?.cartes.length ? cartesDemandeesAvocat(c, decisions, mots, dureeSec, pose.cartes) : [])];
      plans = pose.plans;
      if (cartes.length) parametres.motion = etatInitialCartesMotion(cartes, (x) => outils.cle(c, `motion/${idBaseDe(travail, c)}-${x.id}.mp4`));
    }
    parametres.plans = plans;
  }

  /** Cartes demandées par le Monteur (titre, carte), par l'API unique de la brique, hors des cartes déjà posées. */
  function cartesDemandeesAvocat(c: CommandeFabrication, d: DecisionsMonteurAvocat, mots: MotHorodate[], dureeSec: number, deja: { ratio: string; debutSec: number; finSec: number }[]) {
    return ratiosMotion(c.ratios).flatMap((ratio) =>
      cartesPourFormat({ format: "avocat", ratio, phrases: d.cartes, intensite: c.intensite?.niveau ?? null, demandes: d.demandesStyle, mots: mots.map((m) => ({ mot: m.mot, debutSec: m.debutSec, finSec: m.finSec })), dureeVideoSec: dureeSec }).filter(
        (x) => !deja.some((y) => y.ratio === x.ratio && x.debutSec < y.finSec + 0.5 && y.debutSec < x.finSec + 0.5),
      ),
    );
  }

  /** Ce que la composition reçoit des passes de la mission H (rien quand les options sont coupées). */
  function supplementsMissionH(c: CommandeFabrication, parametres: Record<string, unknown> | undefined): Pick<BaseComposition, "supplementsParRatio" | "multicamera"> {
    const sortie: Pick<BaseComposition, "supplementsParRatio" | "multicamera"> = {};
    const motion = parametres?.motion as EtatCartesMotion | undefined;
    if (motion) {
      const parRatio: NonNullable<BaseComposition["supplementsParRatio"]> = {};
      for (const r of c.ratios) {
        const cartes = cartesPleinEcranDuRatio(motion, r);
        // Vérif A2 (10/10) : le texte d'une carte plein écran n'est pas réécrit en sous-titre au même instant (règle du
        // face caméra, `textesAffiches`) ; avant, « tout de suite. » restait dessiné au milieu de la carte titre.
        const textesAffiches = textesAffichesDesCartes(
          motion.cartes
            .filter((x) => x.ratio === r && x.statut === "faite")
            .map((x) => ({ debutSec: x.debutSec, finSec: x.finSec, disposition: "plein-ecran" as const, carte: (x.demande.parametres as { proprietes?: { modele: string; donnees: unknown } } | undefined)?.proprietes })),
        );
        if (cartes.length) parRatio[r] = { cartesPleinEcran: cartes, ...(textesAffiches.length ? { textesAffiches } : {}) };
      }
      if (Object.keys(parRatio).length) sortie.supplementsParRatio = parRatio;
    }
    // Jamais une clé simulée dans une composition réelle : la vidéo reste alors à une caméra.
    const mc = multicameraPourComposition(parametres?.multicamera as PisteMulticamera | undefined, montageReel());
    if (mc) sortie.multicamera = mc;
    return sortie;
  }

  async function resultat(c: CommandeFabrication, travail: Travail, maintenant: number): Promise<ResultatFabrication> {
    const etat = travail.parametres?.voix as EtatVoix | undefined;
    const audio = etat?.phase === "faite" ? etat.audio : undefined;
    const mots = motsAffiches(c, audio);
    const base = await baseDuTravail(c, travail);
    const { plans, dureeSec } = base;
    const rythme = controlerRythme(plans, { recette: recetteDe(c), style: c.styles.styleMontage?.valeur, mots, segments: segmentsDe(c), ouvertureSurIllustration: c.reglages.ouvertureSurIllustration === true, finEnBoucle: c.reglages.finEnBoucle === true });
    const montage = travail.parametres?.montage as EtatMontage | undefined;
    const faites = montage && montageFini(montage, c.ratios) ? c.ratios.map((r) => montage[r] as CompositionFaite) : null;
    // Alertes de la composition : en réel, celles de chaque format et des mesures du fichier exporté.
    const alertesCompo = faites ? dedoublonner(faites.flatMap((f) => f.alertes)) : alertesDeComposition(c, base);
    // G6 / G6b : un raccord sans coupe se verrait (signalé ; le service bascule en corps distinct avant d'en arriver là).
    const alertesRaccord: AlerteQualite[] = (audio?.jointures ?? []).filter((j) => j.visible).map((j) => ({ code: "defaut-visuel", gravite: "attention", message: `Raccord à ${j.t.toFixed(1)} s sans coupe : il peut se voir.` }));
    // Lot R6 (C5) : des mots restés sur une estimation se disent (prises sans calage relié, ou calage sans succès).
    const alertesCalage: AlerteQualite[] = audio?.sousTitresApproximatifs ? [alerteSousTitresApproximatifs(audio.sousTitresApproximatifs)] : [];
    const note = noteDepuisAlertes(92, [...rythme, ...alertesCompo, ...alertesIntensite(base.rapportIntensite), ...alertesRaccord, ...alertesCalage]);
    // Lot « intensité » : un plafond dépassé (deux choix verrouillés empilés) est signalé, jamais bloquant.
    const alertesCourbe = alertesIntensite(base.rapportIntensite);
    // Mission H : une carte motion ratée est écartée (la vidéo sort sans elle), jamais bloquante.
    const ecartees = cartesMotionEcartees(travail.parametres?.motion as EtatCartesMotion | undefined);
    const alertesMotion: AlerteQualite[] = ecartees ? [{ code: "defaut-visuel", gravite: "info", message: `${ecartees} animation${ecartees > 1 ? "s n'ont" : " n'a"} pas pu être rendue${ecartees > 1 ? "s" : ""} : la vidéo sort sans elle${ecartees > 1 ? "s" : ""}.` }] : [];
    const alertes = [...alertesDuree({ dureeSec, dureeCibleSec: c.dureeCibleSec, ratios: c.ratios, formatId: c.formatId }), ...alertesCompo, ...alertesCourbe, ...alertesRaccord, ...alertesCalage, ...alertesMotion];
    // En réel, le montage, les couleurs, le son et l'export tournent sur notre serveur : rien à payer.
    const etatIllus = travail.parametres?.illustrations as EtatIllustrations | undefined;
    // Lot R7d : le double réel à la durée rendue par son fournisseur (la ligne d'essai du visage est retirée).
    const etatDouble = travail.parametres?.double as EtatDoubleMoteur | undefined;
    const lignesReelles = [...(audio ? ligneVoix(audio) : []), ...(etatIllus ? ligneReelleIllustrations(etatIllus) : []), ...lignesDouble(etatDouble, c.tauxUsdEur), ...lignesSimuleesReelles(c).filter((l) => (!faites || !ETAPES_MONTAGE.includes(cleEtapeDeLigne(l.etape))) && !(etatDouble && cleEtapeDeLigne(l.etape) === "visage"))];
    void maintenant;
    const verifie = { image: true, son: true, sousTitres: true, mentionIA: !!c.briques["mention-ia"], droits: false };
    const sortiesProduites: SortieProduite[] = faites
      ? faites.map((f, i) => {
          const m = f.mesures ?? {};
          return {
            ratio: c.ratios[i],
            fichierCle: f.sortieCle,
            vignetteCle: f.vignetteCle,
            resolution: RESOLUTIONS[c.ratios[i]],
            dureeSec: Math.round(m.dureeSec || dureeSec),
            taille: m.taille || 0,
            rapportQualite: { note, verifie, alertes, niveauSonoreLufs: Number.isFinite(m.lufs) ? m.lufs : -14 },
          };
        })
      : sorties(c, Math.round(dureeSec), note, alertes);
    // Audit 4.3 : seulement la note globale (estimation tirée des alertes) et les alertes ; aucune sous-note inventée.
    const noteQualite: NoteQualite = { globale: note, alertes: [...rythme, ...alertesCompo, ...alertesIntensite(base.rapportIntensite), ...alertesCalage] };
    const projet: ProjetMontageAvocat = {
      versionContrat: c.versionContrat,
      moteur: "montage-avocat",
      briques: versionsBriques(),
      recetteMontage: recetteDe(c).version,
      plans: plans.length,
      audioMaitre: audio ? { fichierCle: audio.fichierCle, dureeSec: audio.dureeSec, reutilise: audio.reutilise, coupures: audio.coupures, respirations: audio.respirations, motsParSeconde: audio.motsParSeconde, vitesseConseillee: audio.vitesseConseillee } : null,
      // Lot M4 : de quoi recomposer un format ajouté ou recalquer les sous-titres sans rien refaire.
      plansProduits: plans,
      dureeSec,
      motsAudio: audio?.mots,
      noteQualite,
      mesures: faites ? Object.fromEntries(faites.map((f, i) => [c.ratios[i], f.mesures ?? {}])) : undefined,
      mediasFabriques: etatIllus ? Object.fromEntries(Object.entries(avecIllustrationsFabriquees(c, plans, etatIllus).commande.medias ?? {}).filter(([k]) => k.startsWith("fab-"))) : undefined,
      ...(base.bruitages?.length ? { bruitages: base.bruitages } : {}),
      ...(base.rapportIntensite ? { rapportIntensite: base.rapportIntensite } : {}),
      // G6 : début et fin de chaque segment sur l'audio maître (raccord des versions, contrôles sur l'horodatage réel).
      ...(audio ? { segmentsHorodates: tempsDesSegments(mots) } : {}),
      ...(audio?.morceaux ? { assemblage: { morceaux: audio.morceaux, jointures: audio.jointures ?? [], source: audio.pisteVideo ? ("prises" as const) : ("mere" as const) } } : {}),
      ...(base.tranchesDouble ? { tranchesDouble: base.tranchesDouble } : {}),
      ...(base.doubleFondUni ? { doubleFondUni: true } : {}),
      ...(base.pistesDepuisLook && !audio?.pisteVideo ? { doubleDecorDuLook: true } : {}),
      // Mission H (absents quand les options sont coupées) : cartes motion, multicaméra, monteur.
      ...(travail.parametres?.motion ? { motionCommune: { cartes: resumeMotionAvocat((travail.parametres.motion as EtatCartesMotion).cartes) } } : {}),
      ...(travail.parametres?.multicamera ? { multicamera: travail.parametres.multicamera as PisteMulticamera } : {}),
      ...(travail.parametres?.monteur ? { monteur: travail.parametres.monteur as ProjetMontageAvocat["monteur"] } : {}),
    };
    return {
      sorties: sortiesProduites,
      noteQualite,
      lignesReelles,
      projetMontage: projet as unknown as Record<string, unknown>,
      plans,
      // Lot M5 : les illustrations fabriquées et payées rejoignent la Bibliothèque (réutilisables à 0 €).
      elementsCrees: elementsCreesDe(plans, etatIllus),
      sousTitres: base.segments.length ? base.segments : undefined,
      ...(base.rapportIntensite ? { rapportIntensite: base.rapportIntensite } : {}),
      pistes: [
        ...(audio ? [{ type: "audio-maitre" as const, fournisseur: audio.fournisseur, fichierCle: audio.fichierCle, empreinte: audio.empreinte, mots: audio.mots, cout: centimes(audio.reutilise ? 0 : audio.coutCentimes), ...(audio.sousTitresApproximatifs ? { sousTitresApproximatifs: audio.sousTitresApproximatifs } : {}) }] : []),
        ...(faites ? faites.flatMap((f, i) => (f.masterCle ? [{ type: "master-sans-texte" as const, fournisseur: "studio-rendu", fichierCle: f.masterCle, ratio: c.ratios[i], cout: centimes(0) }] : [])) : []),
        // Lot R7d : la piste continue du double par angle (un format ajouté la reprend sans rien repayer).
        ...(etatDouble ? Object.entries(pistesPourComposition(etatDouble).pistesDouble).map(([angle, cle]) => ({ type: "plan-double" as const, planId: angle, fournisseur: etatDouble.fournisseur, fichierCle: cle as string, cout: centimes(0) })) : []),
      ],
    };
  }

  const idBaseDe = (t: Travail, c: CommandeFabrication) => `${t.id}-${hache(c.construiteLe + c.videoId).toString(36)}-t${t.tentatives}`;

  /** Reporte la progression des compositions sur les étapes vues par Will (une étape n'est finie qu'avec tout le reste). */
  function appliquerAvancement(etapes: EtapeTravail[], etat: EtatMontage, ratios: Ratio[], plages: Record<string, [number, number]>): void {
    const p = progressionMontage(etat, ratios);
    const fini = montageFini(etat, ratios);
    for (const e of etapes) {
      if (e.statut === "terminee" || e.statut === "echec") continue;
      const plage = plages[e.cle];
      const av = fini ? 100 : plage ? Math.round(Math.min(100, Math.max(0, ((p - plage[0]) / (plage[1] - plage[0])) * 100))) : 0;
      if (av >= 100 && (fini || (e.cle !== "export" && e.cle !== "controle-qualite"))) {
        e.statut = "terminee";
        e.progression = 100;
        e.coutReel = centimes(0);
      } else {
        e.progression = Math.min(99, av);
        e.statut = av > 0 || p > 0 ? "en_cours" : "en_attente";
      }
    }
  }

  /** Paramètres d'un travail de composition seule (format ajouté, recalque). */
  interface ParametresTravailComposition {
    mode: ModeComposition;
    ratios: Ratio[];
    base: BaseComposition;
    sousTitresId?: string;
  }

  function travailDeComposition(type: Travail["type"], ctx: ContexteLancement, c: CommandeFabrication, defs: DefinitionEtapeMoteur[], composition: ParametresTravailComposition): Travail {
    const maintenant = ctx.maintenant ?? Date.now();
    const iso = new Date(maintenant).toISOString();
    return {
      id: ctx.travailId,
      type,
      cibleId: c.videoId,
      versionId: ctx.versionId,
      titre: ctx.titre,
      etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente", progression: 0, sortieFichierIds: [], coutReel: centimes(0) })),
      statut: "en_file",
      progression: 0,
      tentatives: 1,
      cleIdempotence: `${c.videoId}:${ctx.versionId}:${type}:${composition.ratios.join(",")}:${composition.sousTitresId ?? ""}`,
      fournisseurUtilise: "montage-avocat",
      parametres: { composition, montage: {} },
      creeLe: iso,
      modifieLe: iso,
      debuteLe: iso,
      finEstimee: new Date(maintenant + dureeTotaleEstimee(defs) * 1000).toISOString(),
    };
  }

  /** Fait avancer un format ajouté ou un recalque : compositions seules, coût nul. */
  async function avancerComposition(travail: Travail, c: CommandeFabrication, maintenant: number): Promise<{ travail: Travail; resultat?: ResultatFabrication }> {
    horloge.t = maintenant;
    const comp = travail.parametres!.composition as ParametresTravailComposition;
    const fabriques = (comp.base as BaseComposition & { projet?: ProjetMontageAvocat }).projet?.mediasFabriques ?? {};
    const etat = await avancerCompositions((travail.parametres?.montage as EtatMontage | undefined) ?? {}, { ...c, ratios: comp.ratios, medias: { ...(c.medias ?? {}), ...fabriques } }, comp.ratios, comp.base, comp.mode, idBaseDe(travail, c), outils);
    const etapes = travail.etapes.map((e) => ({ ...e }));
    appliquerAvancement(etapes, etat, comp.ratios, comp.mode === "complet" ? PLAGES_FABRICATION : comp.mode === "remixage" ? PLAGES_REMIXAGE : PLAGES_RECALQUE);
    const fini = montageFini(etat, comp.ratios);
    const iso = new Date(maintenant).toISOString();
    const suivant: Travail = {
      ...travail,
      etapes,
      parametres: { ...travail.parametres, montage: etat },
      progression: fini ? 100 : Math.round(progressionMontage(etat, comp.ratios)),
      statut: fini ? "termine" : "en_cours",
      modifieLe: iso,
      termineLe: fini ? iso : undefined,
    };
    if (!fini) return { travail: suivant };
    const faites = comp.ratios.map((r) => etat[r] as CompositionFaite);
    const alertes = dedoublonner(faites.flatMap((f) => f.alertes));
    const projet = (comp.base as BaseComposition & { projet?: ProjetMontageAvocat }).projet;
    const note = noteDepuisAlertes(projet?.noteQualite?.globale ?? 92, alertes.filter((a) => a.code !== "chevauchement"));
    const noteQualite: NoteQualite = projet?.noteQualite ? { globale: note, alertes: projet.noteQualite.alertes } : { globale: note, alertes };
    const verifie = { image: true, son: true, sousTitres: true, mentionIA: !!c.briques["mention-ia"], droits: false };
    const sortiesProduites: SortieProduite[] = renduEstSimule()
      ? sorties(c, Math.round(comp.base.dureeSec), note, alertes, comp.ratios)
      : faites.map((f, i) => ({
          ratio: comp.ratios[i],
          fichierCle: f.sortieCle,
          vignetteCle: f.vignetteCle,
          resolution: RESOLUTIONS[comp.ratios[i]],
          dureeSec: Math.round(f.mesures?.dureeSec || comp.base.dureeSec),
          taille: f.mesures?.taille || 0,
          rapportQualite: { note, verifie, alertes, niveauSonoreLufs: Number.isFinite(f.mesures?.lufs) ? f.mesures!.lufs : -14 },
        }));
    return {
      travail: suivant,
      resultat: {
        sorties: sortiesProduites,
        noteQualite,
        // Rien n'est repayé : la voix, le visage et les illustrations sont ceux de la version.
        lignesReelles: [],
        projetMontage: {
          ...(projet ?? {}),
          moteur: "montage-avocat",
          recalque: comp.mode !== "complet" ? { sousTitresId: comp.sousTitresId } : undefined,
          // Lot « bruitages » : le remixage remplace les sons posés (le reste du projet est celui de la version).
          ...(comp.mode === "remixage" ? { bruitages: comp.base.bruitages ?? [] } : {}),
        },
        pistes: renduEstSimule() ? [] : faites.flatMap((f, i) => (f.masterCle ? [{ type: "master-sans-texte" as const, fournisseur: "studio-rendu", fichierCle: f.masterCle, ratio: comp.ratios[i], cout: centimes(0) }] : [])),
        ...(comp.mode === "remixage" && projet?.rapportIntensite ? { rapportIntensite: comp.base.rapportIntensite ?? projet.rapportIntensite } : {}),
      },
    };
  }

  const moteur = {
    id: "montage-avocat",
    nom: "Montage avocat",
    // CORRECTEUR 1 — B1 : la retouche d'un passage n'existe pas encore pour ce moteur (elle passait par le moteur
    // d'essai, qui rend une vidéo de démonstration) : `retoucheParPlan: false`, le service la refuse avant tout paiement.
    capacites: { dureeMaxSec: 120, ratios: ["9:16", "4:5", "1:1"] as Ratio[], langues: ["fr-FR"], retoucheParPlan: false, asynchrone: true, accordExige: true, maquette: true },

    async estimer(c: CommandeFabrication) {
      // Audit 4.13 : en montage réel, sous-titres, couleurs, son, habillage et formats d'image tournent sur notre serveur
      // (0 €) : leurs prix d'essai ne sont jamais annoncés. En essai, l'estimation d'essai reste.
      const lignes = montageReel() ? lignesEstimees(c).filter((l) => !(l.fournisseur === "simulation" && ETAPES_MONTAGE.includes(cleEtapeDeLigne(l.etape)))) : lignesEstimees(c);
      return { dureeFabricationSec: dureeTotaleEstimee(etapesDe(c)), lignes, total: additionner(...lignes.map((l) => l.total)) };
    },
    // Retouches : encore celles du moteur d'essai (retouche réelle des plans au lot M6).
    estimerRetouche: (c: CommandeFabrication, planIds: string[]) => moteurSimulation.estimerRetouche(c, planIds),
    // Format ajouté (lot M4) : recomposé sur notre serveur depuis les pistes gardées, aucun fournisseur payant (B.9).
    async estimerReexport(c: CommandeFabrication, ratio: Ratio): Promise<Estimation> {
      void ratio;
      return { dureeFabricationSec: Math.round(60 + c.dureeCibleSec * 4), lignes: [], total: centimes(0) };
    },
    etapes: etapesDe,

    refusAuLancement(c: CommandeFabrication) {
      const refus = refusDuDouble(c);
      if (refus) return { code: "DOUBLE_PAS_PRET", message: refus };
      const voix = refusDeLaVoix(c);
      return voix ? { code: "VOIX_ESSAI", message: voix } : null;
    },

    async lancer(c: CommandeFabrication, ctx: ContexteLancement): Promise<Travail> {
      verifierVoix(c);
      verifierDouble(c);
      const voixEssai = refusDeLaVoix(c);
      if (voixEssai) throw new ErreurMoteurAvocat("VOIX_ESSAI", voixEssai);
      const maintenant = ctx.maintenant ?? Date.now();
      const iso = new Date(maintenant).toISOString();
      const defs = etapesDe(c);
      return {
        id: ctx.travailId,
        type: ctx.type ?? "fabrication",
        cibleId: c.videoId,
        versionId: ctx.versionId,
        titre: ctx.titre,
        etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente", progression: 0, sortieFichierIds: [] })),
        statut: "en_file",
        progression: 0,
        tentatives: 1,
        cleIdempotence: `${c.videoId}:${ctx.versionId}:${ctx.type ?? "fabrication"}`,
        fournisseurUtilise: "montage-avocat",
        parametres: { voix: { phase: "a-lire" } satisfies EtatVoix },
        creeLe: iso,
        modifieLe: iso,
        debuteLe: iso,
        finEstimee: new Date(maintenant + dureeTotaleEstimee(defs) * 1000).toISOString(),
      };
    },

    async avancer(travail: Travail, c: CommandeFabrication, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return { travail };
      // Format ajouté et recalque des sous-titres (lot M4) : composition seule, rien n'est repayé.
      if (travail.parametres?.composition) return avancerComposition(travail, c, maintenant);
      if (travail.type !== "fabrication") return moteurSimulation.avancer(travail, c, maintenant);
      horloge.t = maintenant;
      let etapes = travail.etapes.map((e) => ({ ...e }));
      const parametres: Record<string, unknown> = { ...travail.parametres };
      const iso = new Date(maintenant).toISOString();
      const reel = montageReel();

      // 1. La voix (vraie, derrière le fournisseur) puis le nettoyage (studio-rendu).
      const voix = etapes.find((e) => e.cle === "voix");
      if (voix && voix.statut !== "terminee" && voix.statut !== "ignoree" && voix.statut !== "echec") {
        const etat = await avancerVoix((parametres.voix as EtatVoix | undefined) ?? { phase: "a-lire" }, c, idBaseDe(travail, c), maintenant);
        parametres.voix = etat;
        voix.statut = etat.phase === "faite" ? "terminee" : "en_cours";
        voix.progression = PROGRESSION_VOIX[etat.phase];
        if (etat.phase === "faite") voix.coutReel = centimes(etat.audio.reutilise ? 0 : etat.audio.coutCentimes);
      }
      // 2. Le découpage, dès que l'audio maître existe (calcul pur, instantané).
      const decoupage = etapes.find((e) => e.cle === "decoupage");
      if (decoupage && decoupage.statut !== "terminee" && (!voix || voix.statut === "terminee")) {
        const etat = parametres.voix as EtatVoix | undefined;
        const audio = etat?.phase === "faite" ? etat.audio : undefined;
        // G6 / G6b : plans de la version assemblée (corps repris de la mère, coupes gardées) ; sinon le découpage.
        parametres.plans = audio?.plansAssembles ?? decouper(c, motsAffiches(c, audio), audio?.dureeSec);
        // Mission H : monteur, motion commune et multicaméra — options coupées par défaut (absentes : rien ne change).
        await passesMissionH(c, travail, parametres, audio);
        decoupage.statut = "terminee";
        decoupage.progression = 100;
        decoupage.coutReel = centimes(0);
        // 3. La suite encore simulée (visage : lot M6) est planifiée à partir de maintenant ; l'échec d'essai seulement
        // au 1er essai. En réel, montage, couleurs, son, formats et vérification suivent `studio-rendu` (lot M4).
        etapes = planifierSuite(etapes, maintenant, travail.tentatives === 1 ? c.simulerEchecEtape : undefined, [...(reel ? ETAPES_REELLES : []), ...(doubleReel(c) ? ["visage"] : [])]);
      }
      // 3 ter. Lot R7d : le double réel (piste principale, passages du second angle), dès que les plans existent.
      const etapeVisage = etapes.find((e) => e.cle === "visage");
      if (etapeVisage && decoupage?.statut === "terminee" && etapeVisage.statut !== "terminee" && etapeVisage.statut !== "echec") {
        const refus = refusDuDouble(c);
        if (refus) {
          // Travail lancé avant le garde-fou : jamais le double d'essai dans une vraie vidéo.
          Object.assign(etapeVisage, { statut: "echec", planifie: undefined, erreur: { code: "DOUBLE_PAS_PRET", reessayable: false, messagePourWill: refus } });
        } else if (doubleReel(c)) {
          const etatVoix = parametres.voix as EtatVoix | undefined;
          const audio = etatVoix?.phase === "faite" ? etatVoix.audio : undefined;
          if (audio) {
            const s = stockage();
            const lecture = async (cle: string, sec: number) => {
              const u = s.urlLectureDuree ? await s.urlLectureDuree(cle, sec) : await s.urlLecture(cle);
              if (!/^https:/.test(u)) throw new ErreurMoteurAvocat("STOCKAGE_NON_RELIE", "Le stockage des fichiers n'est pas relié : votre double ne peut pas recevoir le son. Vérifiez Réglages > Connexions.");
              return u;
            };
            const principal = c.distribution[0]?.visagesResolus?.[recetteDe(c).angles.principal];
            let etat = (parametres.double as EtatDoubleMoteur | undefined) ?? etatInitialDouble(c, recetteDe(c), (parametres.plans as PlanProduit[] | undefined) ?? [], audio);
            etat = await avancerDouble(etat, {
              visage: visageDe(principal?.fournisseur),
              rendu: rendu(),
              lecture,
              depot: async (cle, mime) => (s.urlDepotDuree ? await s.urlDepotDuree(cle, 3600, mime) : ""),
              cle: (nom) => outils.cle(c, nom),
              travailId: travail.id,
              idBase: idBaseDe(travail, c),
              titre: travail.titre || "Vidéo",
              audioMaitreCle: audio.fichierCle,
              consigne: (angle) => recetteDe(c).motionPrompt?.[angle as "trois-quarts" | "face"],
              plafondSec: secondesAnnonceesDouble(c) * PLAFOND_DEPASSEMENT,
            });
            parametres.double = etat;
            // Crochet « réveil » : les identifiants de rappel attendus par ce travail.
            parametres.callbackIds = etat.pieces.flatMap((p) => (p.callbackId && p.phase === "rendu" ? [p.callbackId] : []));
            const echec = doubleEnEchec(etat);
            // La phrase de la pièce est déjà pour Will ; le texte brut du fournisseur ne va qu'en détail technique.
            if (echec) Object.assign(etapeVisage, { statut: "echec", erreur: { code: "DOUBLE_ECHEC", reessayable: true, messagePourWill: echec.toujoursEnCours ? MESSAGE_DOUBLE_TOUJOURS_EN_COURS : echec.suiviRefuse && echec.erreur ? echec.erreur : echec.delaiDepasse ? MESSAGE_DELAI_RENDU_DOUBLE : `Votre double n'a pas pu être rendu : ${echec.erreur ?? "HeyGen n'a pas réussi ce rendu."}`, ...(echec.detail ? { detailTechnique: echec.detail } : {}) } });
            else if (doubleFini(etat)) Object.assign(etapeVisage, { statut: "terminee", progression: 100, planifie: undefined, coutReel: additionner(...lignesDouble(etat, c.tauxUsdEur).map((l) => l.total)) });
            else Object.assign(etapeVisage, { statut: "en_cours", progression: progressionDouble(etat), planifie: undefined });
          }
        }
      }
      // 3 bis. Lot M5 : illustrations « à fabriquer » (fal.ai), par étapes, dès que les plans définitifs existent.
      const etapeIllus = etapes.find((e) => e.cle === "illustrations");
      if (etapeIllus && decoupage?.statut === "terminee" && etapeIllus.statut !== "terminee" && etapeIllus.statut !== "ignoree") {
        const fournisseurIllus = illustrationDe(c);
        let etat = (parametres.illustrations as EtatIllustrations | undefined) ?? etatInitialIllustrations(c, (parametres.plans as PlanProduit[] | undefined) ?? []);
        // Essai (simulation sans injection) : rien n'est fabriqué ni payé, le double garde ces plans.
        if (fournisseurIllus.mode === "simulation" && !deps.illustration) etat = { plans: Object.fromEntries(Object.keys(etat.plans).map((k) => [k, { phase: "abandon" as const, raison: "Essai : aucune illustration fabriquée." }])) };
        else etat = await avancerIllustrations(etat, fournisseurIllus, c.ratios[0] ?? "9:16", idBaseDe(travail, c), c.tauxUsdEur);
        parametres.illustrations = etat;
        const termine = illustrationsFinies(etat);
        etapeIllus.statut = termine ? "terminee" : "en_cours";
        etapeIllus.progression = progressionIllustrations(etat);
        etapeIllus.coutReel = centimes(coutReelCentimes(etat));
      }
      // 4. Étapes simulées : selon l'horloge.
      const reelles = lignesSimuleesReelles(c);
      for (const e of etapes) {
        if (e.statut === "terminee" || e.statut === "ignoree" || e.statut === "echec" || !e.planifie) continue;
        if (bloquee(e, etapes)) continue;
        // Le montage attend les illustrations fabriquées (lot M5).
        if (e.dependDe.includes("illustrations") && etapes.find((x) => x.cle === "illustrations")?.statut !== "terminee") continue;
        const { debut, fin, echecA } = e.planifie;
        if (echecA !== undefined && maintenant >= echecA) {
          e.statut = "echec";
          e.progression = 60;
          e.erreur = { code: "SIMULATION_ECHEC", reessayable: true, messagePourWill: `${e.nom} n'a pas abouti. Vous pouvez réessayer cette étape seule.`, detailTechnique: `Échec simulé de l'étape « ${e.cle} ».` };
        } else if (maintenant >= fin) {
          e.statut = "terminee";
          e.progression = 100;
          e.coutReel = coutDeLEtape(reelles, e.cle);
        } else if (maintenant >= debut) {
          e.statut = "en_cours";
          e.progression = Math.min(99, Math.round(((maintenant - debut) / (fin - debut)) * 100));
        }
      }
      // 5. Lot M4 : la composition réelle de chaque format d'image, dès que le découpage et le visage sont faits.
      if (reel && decoupage?.statut === "terminee") {
        const etapeMontage = etapes.find((e) => e.cle === "montage");
        const pretes = !!etapeMontage && etapeMontage.dependDe.every((d) => etapes.find((x) => x.cle === d)?.statut === "terminee");
        const suivies = etapes.filter((e) => ETAPES_REELLES.includes(e.cle));
        // Mission H : les cartes motion se rendent d'abord (une carte ratée est écartée, jamais bloquante).
        if (pretes && parametres.motion && !cartesMotionFinies(parametres.motion as EtatCartesMotion)) {
          parametres.motion = await avancerCartesMotion(parametres.motion as EtatCartesMotion, { rendu, depot: async (cle) => (await outils.signer({}, [{ cle, mime: "video/mp4" }])).depots[cle] ?? "" });
        }
        if (pretes && cartesMotionFinies(parametres.motion as EtatCartesMotion | undefined) && !suivies.some((e) => e.statut === "echec")) {
          const base = await baseDuTravail(c, { ...travail, parametres });
          const cc = avecIllustrationsFabriquees(c, base.plans, parametres.illustrations as EtatIllustrations | undefined).commande;
          const etat = await avancerCompositions((parametres.montage as EtatMontage | undefined) ?? {}, cc, c.ratios, base, "complet", idBaseDe(travail, c), outils);
          parametres.montage = etat;
          appliquerAvancement(suivies, etat, c.ratios, PLAGES_FABRICATION);
          // Échec d'essai (contrat des moteurs) : seulement au 1er essai, en cours de composition.
          const forcee = travail.tentatives === 1 ? suivies.find((e) => e.cle === c.simulerEchecEtape && e.statut !== "terminee") : undefined;
          if (forcee && progressionMontage(etat, c.ratios) >= 10) {
            forcee.statut = "echec";
            forcee.erreur = { code: "SIMULATION_ECHEC", reessayable: true, messagePourWill: `${forcee.nom} n'a pas abouti. Vous pouvez réessayer cette étape seule.`, detailTechnique: `Échec simulé de l'étape « ${forcee.cle} ».` };
          }
        }
      }
      const enEchec = etapes.find((e) => e.statut === "echec");
      const fini = etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree");
      const progression = Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(etapes.length, 1));
      const finPlanifiee = Math.max(0, ...etapes.map((e) => e.planifie?.fin ?? 0));
      const suivant: Travail = {
        ...travail,
        etapes,
        parametres,
        progression: fini ? 100 : progression,
        statut: enEchec ? "echec" : fini ? "termine" : etapes.some((e) => e.statut !== "en_attente") ? "en_cours" : "en_file",
        erreur: enEchec?.erreur,
        modifieLe: iso,
        termineLe: fini ? iso : undefined,
        finEstimee: finPlanifiee ? new Date(finPlanifiee).toISOString() : travail.finEstimee,
      };
      return fini ? { travail: suivant, resultat: await resultat(c, suivant, maintenant) } : { travail: suivant };
    },

    async reessayer(travail: Travail, maintenant = Date.now()) {
      if (travail.type !== "fabrication" && !travail.parametres?.composition) return moteurSimulation.reessayer(travail, maintenant);
      const parametres: Record<string, unknown> = { ...travail.parametres };
      const enEchec = new Set(travail.etapes.filter((e) => e.statut === "echec").map((e) => e.cle));
      // L'étape en échec et ce qui en dépend repartent ; ce qui est terminé ne bouge pas (rien n'est repayé).
      const touchees = new Set(enEchec);
      for (let garde = 0; garde < 10; garde++) for (const e of travail.etapes) if (e.statut !== "terminee" && e.dependDe.some((d) => touchees.has(d))) touchees.add(e.cle);
      let etapes = travail.etapes.map((e) => (touchees.has(e.cle) && e.statut !== "terminee" ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined, planifie: undefined } : { ...e }));
      if (enEchec.has("voix")) {
        // Le son déjà payé n'est pas relu : seul le nettoyage repart (nouvel identifiant de rendu, tentative suivante).
        const etat = parametres.voix as EtatVoix | undefined;
        // Lot « calage » : une panne pendant le calage le relance (le son n'est pas relu ni repayé).
        // 14/10 (voix de référence) : une panne pendant la mesure reprend la MESURE de la lecture payée ; pendant une
        // relecture (ou la copie d'une relecture), les lectures déjà payées et mesurées (`prises`) sont gardées : aucune
        // n'est relue ni repayée, la mesure n'est jamais sautée.
        parametres.voix =
          etat && (etat.phase === "a-aligner" || etat.phase === "alignement")
            ? ({ phase: "a-aligner", brut: etat.brut, texte: etat.texte } satisfies EtatVoix)
            : etat && (etat.phase === "a-mesurer" || etat.phase === "mesure")
              ? ({ phase: "a-mesurer", brut: etat.brut, texte: etat.texte, prises: etat.prises } satisfies EtatVoix)
              : etat && (etat.phase === "a-relire" || (etat.phase === "a-copier" && etat.prises))
                ? etat
                : etat && "brut" in etat
                  ? ({ phase: "a-analyser", brut: etat.brut } satisfies EtatVoix)
                  : ({ phase: "a-lire" } satisfies EtatVoix);
      }
      // Lot R7d : les passages du double déjà rendus sont gardés ; une pièce en échec repart (clé neuve si un rendu
      // échoué est connu, sinon la même : rien n'est payé deux fois).
      if (enEchec.has("visage") && parametres.double) {
        const d = parametres.double as EtatDoubleMoteur;
        // Rendu trop long (`delaiDepasse`) ou suivi refusé (`suiviRefuse`, D1) : la pièce repart en suivi de l'ANCIEN rendu
        // (`reverifier`) ; fini entre-temps, il est gardé sans nouvelle soumission ; toujours en cours, rien n'est renvoyé ;
        // échoué chez HeyGen, seule cette pièce est renvoyée (clé neuve, plafond gardé).
        parametres.double = { ...d, pieces: d.pieces.map((p) => (p.phase !== "echec" ? p : renduARelire(p) ? { ...p, phase: "rendu" as const, reverifier: true, delaiDepasse: undefined, suiviRefuse: undefined, toujoursEnCours: undefined, erreur: undefined, detail: undefined } : p.audioCle ? { ...p, phase: "a-rendre" as const, essai: p.idExterne ? p.essai + 1 : p.essai, idExterne: undefined, callbackId: undefined, titreRendu: undefined, erreur: undefined, detail: undefined } : { ...p, phase: "a-trancher" as const, erreur: undefined, detail: undefined })) };
      }
      // Composition : les formats déjà faits sont gardés, les autres repartent (nouvel identifiant de rendu).
      if ([...touchees].some((cle) => ETAPES_REELLES.includes(cle) || cle === "sous-titres") && parametres.montage) {
        parametres.montage = Object.fromEntries(Object.entries(parametres.montage as EtatMontage).filter(([, e]) => e?.phase === "faite"));
      }
      if (travail.type === "fabrication" && etapes.find((e) => e.cle === "decoupage")?.statut === "terminee") etapes = planifierSuite(etapes, maintenant + 300, undefined, [...(montageReel() ? ETAPES_REELLES : []), ...(parametres.double ? ["visage"] : [])]);
      return { ...travail, etapes, parametres, statut: "en_cours" as const, erreur: undefined, reprise: undefined, tentatives: travail.tentatives + 1, modifieLe: new Date(maintenant).toISOString() };
    },

    retoucher: (demande: Parameters<MoteurVideo["retoucher"]>[0]) => moteurSimulation.retoucher(demande),

    /**
     * Format ajouté (B.9) : recomposé depuis ce qui est déjà fabriqué (audio maître, plans, doubles), aucun fournisseur
     * payant, gratuit. Une version fabriquée avant le lot M4 (sans projet de montage) passe par le moteur d'essai.
     */
    async reexporter(demande: Parameters<MoteurVideo["reexporter"]>[0]) {
      const base = baseDuParent(demande.parent, demande.segments);
      if (!base || !("ratio" in demande.cible)) return moteurSimulation.reexporter(demande);
      const ratio = demande.cible.ratio;
      const etapes: DefinitionEtapeMoteur[] = [
        { cle: "montage", nom: "Montage", icone: "ciseaux", dependDe: [], dureeEstimeeSec: 60 },
        { cle: "etalonnage", nom: "Couleurs", icone: "contraste", dependDe: ["montage"], dureeEstimeeSec: 10 },
        { cle: "son", nom: "Son", icone: "son", dependDe: [], dureeEstimeeSec: 5 },
        { cle: "export", nom: "Formats d'image", icone: "telecharger", dependDe: ["etalonnage", "son"], dureeEstimeeSec: 30 },
      ];
      return travailDeComposition("reexport", demande.contexte, demande.commande, etapes, { mode: "complet", ratios: [ratio], base });
    },

    /** Recalque gratuit (B.0 §20) : encadré et sous-titres corrigés recomposés sur la piste `master-sans-texte`. */
    async recalquer(demande: Parameters<NonNullable<MoteurVideo["recalquer"]>>[0]) {
      const base = baseDuParent(demande.parent, demande.segments) ?? { plans: [], segments: demande.segments, dureeSec: demande.commande.dureeCibleSec, masters: {} };
      const ratios = demande.commande.ratios.filter((r) => r !== "16:9");
      // En essai (sans studio-rendu), aucun master réel n'existe : le recalque simulé n'en lit pas.
      if (renduEstSimule()) for (const r of ratios) base.masters = { ...base.masters, [r]: base.masters?.[r] ?? `simulation/master-${r.replace(":", "x")}.mov` };
      const manquant = ratios.find((r) => !base.masters?.[r]);
      if (manquant) throw new ErreurMoteurAvocat("MASTER_ABSENT", `Le format ${manquant} n'a pas d'image sans texte : il faut refaire ce format pour appliquer la correction.`);
      // Lot « bruitages » (02/10) : « retirer / ajouter le son » d'un plan ne refait QUE le mixage. Les sons sont
      // replacés sur ce qui est à l'image (rien d'autre ne bouge) ; s'ils changent, le son du master est refait.
      const remix = remixageDes(demande.commande, base);
      if (remix) {
        const etapesRemix: DefinitionEtapeMoteur[] = [
          { cle: "son", nom: "Son", icone: "son", dependDe: [], dureeEstimeeSec: 10 },
          { cle: "sous-titres", nom: "Sous-titres", icone: "sous-titres", dependDe: ["son"], dureeEstimeeSec: 30 },
          { cle: "export", nom: "Formats d'image", icone: "telecharger", dependDe: ["sous-titres"], dureeEstimeeSec: 30 },
        ];
        return travailDeComposition("recalque-sous-titres", demande.contexte, demande.commande, etapesRemix, { mode: "remixage", ratios, base: remix, sousTitresId: demande.sousTitresId });
      }
      const etapes: DefinitionEtapeMoteur[] = [
        { cle: "sous-titres", nom: "Sous-titres", icone: "sous-titres", dependDe: [], dureeEstimeeSec: 30 },
        { cle: "export", nom: "Formats d'image", icone: "telecharger", dependDe: ["sous-titres"], dureeEstimeeSec: 30 },
      ];
      return travailDeComposition("recalque-sous-titres", demande.contexte, demande.commande, etapes, { mode: "recalque", ratios, base, sousTitresId: demande.sousTitresId });
    },

    /**
     * Maquette (B.1) : la vraie voix (le service a vérifié le budget avant), le nettoyage et le découpage exact ;
     * AUCUN fichier vidéo (elle est composée dans le navigateur). Renvoie la piste `audio-maitre`, réutilisée ensuite.
     */
    async maquette(c: CommandeFabrication, options?: { voixBrute?: VoixBrutePayee }): Promise<ResultatMaquette> {
      const debut = Date.now();
      const empreinte = empreinteAudioMaitre(c);
      const idBase = `maquette-${c.videoId}-${empreinte}-${debut.toString(36)}`;
      let etat: EtatVoix = { phase: "a-lire" };
      // Son brut déjà lu ET payé par une maquette tombée en panne ensuite : repris tel quel, la voix n'est pas relue
      // (ni repayée). Seulement si texte, voix et prononciations n'ont pas changé, et sans réutilisation d'audio maître.
      const vb = options?.voixBrute;
      if (vb && vb.empreinte === empreinte && c.distribution.length && !estPrisesFilmees(c) && !(c.audioMaitre && audioReutilisable(c))) {
        const brut: AudioBrut = { fichierCle: vb.fichierCle, dureeSec: vb.dureeSec, mots: vb.mots, coutCentimes: 0, fournisseur: vb.fournisseur, caracteres: vb.caracteres, ...(vb.motsEstimes ? { motsEstimes: true } : {}), ...(vb.approximatif ? { approximatif: vb.approximatif } : {}), ...(vb.copieEnAttente ? { copieEnAttente: vb.copieEnAttente } : {}), ...(vb.ressemblance ? { ressemblance: vb.ressemblance } : {}) };
        // 14/10 (voix de référence) : contrôle pas fini. Les lectures déjà payées et mesurées sont reprises à coût 0
        // (comptées en dépense par la maquette tombée en panne) : jamais relues ni recomptées ; seule une relecture
        // encore permise par le prix confirmé peut être payée.
        const cv = vb.controleVoix;
        const prises = cv?.prises.map((p) => ({ ...p, brut: { ...p.brut, coutCentimes: 0 } }));
        if (cv && prises) etat = cv.phase === "a-relire" ? { phase: "a-relire", texte: vb.texte ?? "", prises } : { phase: cv.phase, brut, texte: vb.texte ?? "", prises };
        // CORRECTEUR 1 — B2 : son payé pas encore rangé : la copie reprend, la voix n'est pas relue.
        else if (vb.copieEnAttente) etat = { phase: "a-copier", brut, texte: vb.texte ?? "" };
        // Lot R6 : texte présent = arrêtée AVANT le calage (décision à prendre) ; sinon, la cause gardée est reprise telle quelle.
        else if (!vb.texte) etat = { phase: "a-analyser", brut };
        else etat = calerVoix(c, !!vb.motsEstimes) ? { phase: "a-aligner", brut, texte: vb.texte } : versAnalyse(c, brut);
      }
      let audio: AudioMaitre | undefined;
      if (c.distribution.length) {
        let t = debut;
        for (;;) {
          try {
            etat = await avancerVoix(etat, c, idBase, t);
            if (etat.phase !== "faite" && Date.now() - debut > ATTENTE_MAQUETTE_MS) throw new ErreurRendu({ code: "indisponible", reessayable: true, message: "La préparation du son prend trop de temps." });
          } catch (e) {
            // E2E-1 n° 3 : la voix déjà lue (payée) accompagne l'erreur, le service l'enregistre en dépense.
            const lignes = lignesVoixPayee(etat);
            if (lignes.length && e && typeof e === "object") Object.assign(e, { lignesPayees: lignes });
            // Le son brut accompagne aussi l'erreur : le service le garde sur la vidéo, la maquette suivante le reprend.
            // 14/10 (voix de référence) : les lectures déjà mesurées (`controleVoix`) et le rapport de la prise retenue
            // (`ressemblance`) l'accompagnent : la maquette suivante les reprend, aucune n'est relue.
            const son: AudioBrut | undefined = "brut" in etat ? etat.brut : etat.phase === "a-relire" ? etat.prises.at(-1)?.brut : undefined;
            if (son && e && typeof e === "object") {
              const enCours = etat.phase === "a-mesurer" || etat.phase === "mesure" || etat.phase === "a-relire" || (etat.phase === "a-copier" && etat.prises) ? { phase: etat.phase === "mesure" ? ("a-mesurer" as const) : etat.phase, prises: prisesPayees(etat) } : undefined;
              const voixBrute: VoixBrutePayee = { fichierCle: son.fichierCle, dureeSec: son.dureeSec, mots: son.mots, fournisseur: son.fournisseur, caracteres: son.caracteres, empreinte, ...("texte" in etat ? { texte: etat.texte } : {}), ...(son.motsEstimes ? { motsEstimes: true } : {}), ...(son.approximatif ? { approximatif: son.approximatif } : {}), ...(son.copieEnAttente ? { copieEnAttente: son.copieEnAttente } : {}), ...(son.ressemblance ? { ressemblance: son.ressemblance } : {}), ...(enCours ? { controleVoix: enCours } : {}) };
              Object.assign(e, { voixBrute });
            }
            throw e;
          }
          if (etat.phase === "faite") {
            audio = etat.audio;
            break;
          }
          // Rendu simulé : l'horloge du moteur avance d'elle-même ; rendu réel : courte attente avant d'interroger.
          if (renduEstSimule() || deps.rendu) t += 1000;
          else t = Date.now();
          const pause = deps.pauseMs ?? (renduEstSimule() || deps.rendu ? 0 : 500);
          if (pause) await new Promise((r) => setTimeout(r, pause));
        }
      }
      const mots = motsAffiches(c, audio);
      const decoupes = decouper(c, mots, audio?.dureeSec);
      const dureeSec = decoupes.at(-1)?.finSec ?? Math.round(mots.at(-1)?.finSec ?? c.dureeCibleSec);
      const sousTitres = await sousTitresDe(c, mots, dureeSec);
      // Lot « intensité » : la maquette montre le montage tel que la courbe l'a arbitré.
      const o = orchestrer(c, decoupes, sousTitres ?? [], mots, dureeSec);
      const plans = o?.plans ?? decoupes;
      return {
        dureeSec: +dureeSec.toFixed(2),
        plans,
        sousTitres: o && sousTitres ? o.segments : sousTitres,
        pistes: audio ? [{ type: "audio-maitre", fournisseur: audio.fournisseur, fichierCle: audio.fichierCle, empreinte: audio.empreinte, mots: audio.mots, cout: centimes(audio.reutilise ? 0 : audio.coutCentimes), ...(audio.sousTitresApproximatifs ? { sousTitresApproximatifs: audio.sousTitresApproximatifs } : {}) }] : [],
        lignesReelles: audio ? ligneVoix(audio) : [],
      };
    },

    /** « Arrêter » : les étapes terminées gardent leur coût (seules payées), les autres ne se feront pas. Idempotent. */
    async annuler(travail: Travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return {
        ...travail,
        statut: "annule" as const,
        etapes: travail.etapes.map((e) => (e.statut === "terminee" ? { ...e } : { ...e, statut: "ignoree" as const, planifie: undefined, erreur: undefined, coutReel: undefined })),
        erreur: undefined,
        modifieLe: iso,
        termineLe: iso,
      };
    },

    /** G6 : la mère d'une version par réseau, lue dans le projet de montage (audio maître, mots, segments, plans). */
    lignesPayees: lignesPayeesAvocat,

    mereDeclinaison(projetMontage: Record<string, unknown> | undefined, ids: { videoId: string; versionId: string }) {
      const p = projetMontage as ProjetMontageAvocat | undefined;
      if (!p?.audioMaitre?.fichierCle || !p.plansProduits?.length || !p.motsAudio?.length || !p.segmentsHorodates?.length) return null;
      return { videoId: ids.videoId, versionId: ids.versionId, audioCle: p.audioMaitre.fichierCle, dureeSec: p.dureeSec ?? p.plansProduits.at(-1)!.finSec, motsPrononces: p.motsAudio, segments: p.segmentsHorodates, plans: p.plansProduits };
    },

    avancerVoix,
  };
  return moteur;
}

export const moteurMontageAvocat = creerMoteurMontageAvocat();

