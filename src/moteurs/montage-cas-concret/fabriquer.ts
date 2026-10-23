/**
 * CHAÎNE DE FABRICATION DU CAS CONCRET (tâche M8, plan cas concret § 5). Du cas à un fichier par fin, en ASSEMBLANT les
 * pièces du moteur et les briques communes, sans rien réécrire :
 *
 *   1. ecriture  `ecrireFiche` (M3) : coût réservé au pire, une relance au plus ; sautée quand une fiche est fournie ;
 *   2. fiche     `validerFicheEcrans` (schéma, R02 à R22) ; le plan des fins (`planDesFins`, M2) est regroupé par contenu :
 *                deux réseaux qui disent et montrent la même fin partagent un fichier ; un refus arrête AVANT toute voix ;
 *   3. captures  `planCaptures`, `avancerCaptures`, `appliquerCaptures` (M6) : une capture ratée prend son repli ;
 *   4. voix      `avancerVoixCasConcret` (M4) : corps, puis une prise par fin ; budget vérifié et réservé juste avant chaque
 *                lecture payante ; reformulation d'une phrase rejetée par le rôle borné de M3 (`reformulerPhrase`) ; puis
 *                le raccord corps + fin de chaque fin par la recette de la voix (`recette-voix.ts`, X4) ;
 *   5. calage    `calerFiche` (M5) pour chaque fin, après report du texte reformulé dans les `texteDit` ; le corps finit au
 *                même instant pour toutes les fins (ses écrans ne sont rendus qu'une fois) ;
 *   6. ecrans    propriétés de la brique `ecrans-motion`, contrôlées, puis rendues une à une par `rendu-cartes`
 *                (`bloquant`, `parEmpreinte`, composition `CasConcretEcran`, CRF 12) ; les adresses signées des captures
 *                sont dans les propriétés mais HORS de l'empreinte (qui porte leur clé) ;
 *   7. montage   une composition `complet` par fin (scènes posées par `plansDesScenes`, commande par `commandeMinimale`,
 *                décor nuit, sous-titres de la charte, aucune musique, bruitages validés seulement) ;
 *   8. controle  `controlerVideoCasConcret` (M7), toujours refait, puis le compte rendu.
 *
 * L2 (variété) : après le calage, la vidéo reçoit sa MISE (`variete.ts`) : celle de la fiche si elle en a une, sinon celle
 * d'une version précédente, sinon un tirage neuf (graine = la vidéo, historique des 42 derniers) ajouté à l'historique.
 * Elle est gardée au journal (une reprise ne retire jamais) et écrite dans la fiche du compte rendu. Seules les dimensions
 * actives (`DIMENSIONS_ACTIVES`, vide en L2) entrent dans les propriétés des écrans : sans elles, rendu et empreintes v4.
 *
 * Reprise : chaque étape porte l'empreinte de ses entrées (`creerSuivi` de la brique `chaine-scenes`) ; captures, voix,
 * écrans et compositions gardent aussi leur état en cours. Une voix payée n'est jamais relue, un écran déposé jamais rendu
 * de nouveau. Tout ce qui touche l'extérieur est INJECTÉ (`OutilsFabricationCasConcret`). N'importe AUCUN autre moteur.
 *
 * S1e : une capture, un assemblage ou une mesure des blancs dont le rendu n'est pas fini lève `RenduEnCours` (soumis,
 * relu au tour suivant) : le tour garde son état et attend, sans jamais tenir la boucle de fond. Une entrée absente du
 * stockage arrête les finitions après une seule série d'essais (`seriesFichierInaccessible`), avec une phrase.
 *
 * X2 : l'écriture, sa relance et la reformulation d'une phrase sont des appels DÉTACHÉS (`appels.ts`) : lancés sans être
 * attendus, notés au journal, relus aux passages suivants ; jamais payés deux fois.
 *
 * X10 (incident du tableau animé du 12/10) : un rendu raté (écran, raccord de la voix, composition d'une fin) arrête son
 * étape avec une phrase lisible qui nomme la fin, jamais l'identifiant ni le message brut du serveur (gardés en détail
 * technique). Un raccord de voix fini est gardé même si celui d'une autre fin rate dans le même tour. « Réessayer »
 * passe le journal par `relancerRendusCasConcret` : seuls les rendus restés en cours ou ratés repartent.
 */
import { FIN_PROPRE_COMMUNE } from "@/briques/composition/fin-propre";
import { creerSuivi, empreinteStable, plansDesScenes, commandeMinimale, type EtapeComptee, type Journal, type ScenePosee } from "@/briques/chaine-scenes";
import { avancerCompositions, montageFini, type BaseComposition, type EtatComposition, type EtatMontage, type OutilsMontage } from "@/briques/composition/montage";
import { GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT, type RecetteComposition } from "@/briques/composition/recette";
import { REDUCTION_LARGE_PAR_DEFAUT } from "@/briques/composition/scene";
import { centreSousTitresPleineImagePct, proprietesPleineImage, zonePleineImage } from "./zone-objets";
import { controlerProprietes, zonesEcran, type CaptureEcran, type EcranCale, type ProprietesEcran } from "@/briques/ecrans-motion";
import { COULEURS_DUO, VERSION_CHARTE_DUO } from "@/briques/habillage/charte-duo";
import type { BruitagePlace } from "@/briques/intensite/types";
import { avancerCartesMotion, cartesMotionFinies, ErreurSceneRatee, etatInitialCartesMotion, type EtatCartesMotion } from "@/briques/motion/rendu-cartes";
import type { CarteFormat } from "@/briques/motion/pourFormat";
import { fabriquerSousTitres } from "@/briques/sous-titres";
import { STYLE_SOUS_TITRES_MINIMAL } from "@/donnees/elements-avocat";
import { substituerPrononciations } from "@/domaine/prononciations";
import type { MediaCommande, SegmentSousTitres, ValeurDecor, ValeurStyleSousTitres } from "@/domaine/types";
import { BANDE_SOUS_TITRES_CAS_CONCRET, FIN_APRES_DERNIER_MOT_SEC, TEMPO_VOIX, type ReseauCas } from "@/formats/cas-concret";
import type { CasConcret } from "@/formats/cas-concret/cas";
import { surTitreDuCas } from "@/formats/cas-concret/recette";
import { centimes, formaterMontant } from "@/lib/montants";
import { ecritureDetachee, type AppelSuivi } from "./appels";
import { figerMemoireCommune } from "./memoire-commune";
import { poserBruitages } from "./bruitages";
import { calerFiche, IMAGE_MS, type EvenementCale } from "./calage";
import { appliquerCaptures, avancerCaptures, etatInitialCaptures, planCaptures, type EtatCaptures } from "./captures";
import { clesImagesDuCas, imagesDuCas } from "./visuels-du-cas";
import { controlerFinDeVoix, lireWav, recalerCoupesSurSilences, silencesMesures, type Silence, type Son } from "./fin-de-voix";
import { controlerVideoCasConcret, type MesuresFin, type RapportControleCasConcret } from "./controles";
import { defautsVisuels, type DefautVisuel } from "./defauts-visuels";
import { ecrireFiche, PREFIXE_APPEL_ECRITURE, reformulerPhrase, type ResultatEcriture } from "./ecriture";
import { ficheDuScriptValide, PHRASE_SCRIPT_A_VALIDER, PHRASE_SCRIPT_VALIDE_REFUSE, problemesScriptValide, type ScriptValide } from "./script-valide";
import { departDePage, ecransCales, LIBELLES_ETAPES_CAS_CONCRET, motsOrange, regrouperFins, reporterTexteDit, type CaptureVraiEcran, type EntreesCasConcret } from "./etapes";
import { FORMAT_CAS_CONCRET, texteDuCorps, validerSchemaFiche, type EcranFin, type FicheEcrans, type FinPlanifiee, type PlanDesFins } from "./fiche";
import { activiteDuPublic } from "@/domaine/mesures";
import { liensSuivis, planDesFins } from "./fins";
import type { DemandeCapture, EstimationVoixCasConcret, EtapeCasConcret, OutilsCaptures, OutilsFabricationCasConcret, OutilsVoixCasConcret, ResultatAssemblage, ResultatCapture } from "./outils";
import { textesDePublication, type TextePublication } from "./publication";
import { validerFicheEcrans } from "./regles";
import { parametresRaccord, planRaccordVoix, RECETTE_VOIX_CAS_CONCRET, reglagesRecette } from "./recette-voix";
import { centreSousTitresHautPct, surlignageCasConcret, variationSousTitresCasConcret } from "./sous-titres-variete";
import { entreeHistorique, jeuDeLEcran, lireHistorique, lireMise, mettre, STRUCTURES, tirer, type Mise, type Structure, type Tirage } from "./variete";
import { structureEffective } from "@/formats/cas-concret/recette";
import { avancerVoixCasConcret, empreintePriseVoix, rapportVoix, repriseVoixCasConcret, rouvrirApresArret, type EtatVoixCasConcret, type OutilsAvancerVoix, type PrisePayee, type PriseVoix, type SonAssemble } from "./voix";

/** Version de la chaîne (entre dans chaque empreinte : une chaîne changée refait tout). */
export const VERSION_FABRICATION_CAS_CONCRET = "fabrication-cas-concret/1";
export const MOTEUR_CAS_CONCRET = "montage-cas-concret";
/** Composition d'un écran (`COMPOSITIONS_CAS_CONCRET.ecran`, non importé : il tire Remotion). */
export const COMPOSITION_ECRAN = "CasConcretEcran";
/** Qualité d'encodage des écrans (BT.709 plage TV, comme la composition `complet` la lit ; quasi sans perte). */
export const CRF_ECRAN = 12;
const RATIO = "9:16" as const;

/**
 * Signal d'un outil de rendu « soumettre puis relire » : la demande est soumise (ou relue), elle n'est pas finie. La
 * chaîne garde son état et rend la main ; le passage suivant relit le même rendu (jamais une nouvelle dépense).
 */
export class RenduEnCours extends Error {
  constructor(readonly quoi: string) {
    super(`${quoi} : rendu en cours.`);
    this.name = "RenduEnCours";
  }
}

/**
 * « Pas encore fini » reconnu à son NOM autant qu'à sa classe. Essai réel du 14/10 (v-e99a49ee86cb) : en production, le
 * signal levé par les branchements de la mesure des blancs n'a pas été reconnu par `instanceof` (deux copies du module
 * dans le serveur compilé) ; la voix, déjà payée, a été arrêtée en échec au lieu d'attendre.
 */
export function estRenduEnCours(err: unknown): boolean {
  return err instanceof RenduEnCours || (err instanceof Error && err.name === "RenduEnCours");
}

/** Phrase des finitions arrêtées sur une entrée absente du stockage. */
export const ENTREE_INTROUVABLE = "Un fichier de la vidéo (voix, écran ou bruitage) est introuvable pour le serveur de rendu : le montage s'est arrêté après une série d'essais.";

/** Arrêt de la chaîne : l'étape et ses raisons, en français ; `detail` : le message brut (détail technique, jamais montré). */
export class ErreurFabricationCasConcret extends Error {
  constructor(
    readonly etape: EtapeCasConcret,
    readonly raisons: readonly string[],
    /** X9 : ce qu'il faut pour comprendre l'échec sans aller en base (réponse brute du dernier essai d'écriture). */
    readonly detail?: string,
  ) {
    super(`Fabrication arrêtée à l'étape « ${LIBELLES_ETAPES_CAS_CONCRET[etape] ?? etape} » : ${raisons.join(" ")}`);
    this.name = "ErreurFabricationCasConcret";
  }
}

/** Journal gardé entre deux lancements : étapes faites, états en cours, pannes d'essai déjà jouées. */
export interface JournalCasConcret extends Journal<EtapeCasConcret> {
  captures?: { empreinte: string; etat: EtatCaptures };
  /** Captures soumises dont le rendu a été attendu : relues par le rendu (leurs mesures), jamais par leur seul fichier. */
  capturesSoumises?: string[];
  voix?: { empreinte: string; etat: EtatVoixCasConcret };
  /** Assemblages corps + fin déjà finis, par fin. */
  assemblages?: { empreinte: string; faits: Record<string, ResultatAssemblage> };
  ecrans?: { empreinte: string; etat: EtatCartesMotion; rendues: string[] };
  /** État de la composition de chaque fin. */
  montage?: Record<string, { empreinte: string; etat: EtatComposition }>;
  /** Essai seulement : échecs déjà joués par étape (`panneDEssai`). */
  pannesDEssai?: Partial<Record<EtapeCasConcret, number>>;
  /** X2 : appels Claude détachés (écriture, relance, reformulation), par identifiant d'appel. */
  appels?: Record<string, AppelSuivi>;
  /** X12 : nombre de « Réessayer » de l'écriture arrêtée (relire les réponses payées, puis UN nouvel appel). */
  reprisesEcriture?: number;
  /** Lot C4 : le bloc de la mémoire commune envoyé à l'écriture, figé au premier passage (un appel détaché est reconnu à son entrée : elle ne doit pas changer). */
  memoireCommune?: string;
  /** L2 : la mise de la vidéo, tirée une seule fois ; `notee` : sa ligne est déjà dans l'historique. */
  mise?: { mise: Mise; notee: boolean };
  /**
   * D2 : le tirage de la vidéo, fait AVANT l'écriture (la structure tirée dicte l'ordre des écrans) et gardé : une reprise
   * ne le retire jamais ; `notee` : sa ligne est déjà dans l'historique. Absent : écriture d'avant ce lot, ou sans variété.
   */
  tirage?: { tirage: Tirage; notee: boolean };
}

export interface OptionsFabricationCasConcret {
  videoId: string;
  versionId: string;
  /** Numéro de la version (« 0042 » dans « 0042-CC-FB ») : `utm_campaign` des liens suivis ; obligatoire (sans lui la fabrication s'arrête avant toute dépense). */
  numeroVersion?: number;
  /** Environnement des clés (`dev`, `prod`). */
  env: string;
  cas: CasConcret;
  entrees: EntreesCasConcret;
  outils: OutilsFabricationCasConcret<JournalCasConcret>;
  /** Fiche brute fournie (`entrees.ficheCle`) : l'écriture est sautée. */
  lireFiche?: () => Promise<unknown>;
  /**
   * V4-3 : le script validé du cas (catalogue, ou validé par Will depuis le studio) : l'écriture ne fait AUCUN appel, la
   * relecture le contrôle comme une fiche écrite ; refusé, la fabrication s'arrête (jamais réparé en silence).
   */
  scriptValide?: ScriptValide | null;
  /**
   * LOT F · « Nouveau script (autre structure) » : structure du script validé que cette vidéo n'a pas rejoué. Le tirage
   * (fait avant l'écriture) n'en reprend pas la même ; la v4 s'il s'agit d'un script sans structure.
   */
  structureEcartee?: Structure;
  /** 18/10 : lit le texte dit des scripts déjà écrits ou validés (mémoire anti-copie de l'écriture) ; appelé seulement quand Claude écrit. */
  lireScriptsAnterieurs?: () => Promise<readonly string[]>;
  /** Personnage qui prête sa voix (inscrit dans la distribution de la commande). */
  personnageId?: string;
  /** Prononciations substituées avant la voix (même liste au calage et aux sous-titres). */
  prononciations?: readonly { mot: string; prononciation: string }[];
  horloge?: () => number;
  /** Heure des appels détachés (X2 ; défaut : `horloge`). */
  horlogeAppels?: () => number;
  /** Attente entre deux tours d'une étape suivie restés sans changement (tests : rien). */
  attendre?: () => Promise<void>;
}

/** Une fin fabriquée. */
export interface FinFaite {
  id: string;
  reseaux: ReseauCas[];
  /** Son assemblé (corps + fin). */
  voixCle: string;
  fichierCle: string;
  masterCle?: string;
  vignetteCle: string;
  dureeSec: number;
  mesures: Record<string, number>;
  bruitages: number;
  /** L0d (15/10) : les sous-titres de CETTE fin (corps + sa phrase de fin), pour l'export .srt / .vtt de ses réseaux. */
  sousTitres?: SegmentSousTitres[];
}

/** Compte rendu d'un lancement. */
export interface CompteRenduCasConcret {
  videoId: string;
  version: typeof VERSION_FABRICATION_CAS_CONCRET;
  /** Voix au pire, montrée et réservée lecture par lecture. */
  estimation: EstimationVoixCasConcret;
  /** Voix payée pendant CE lancement (0 si toutes les prises sont reprises). */
  coutCentimes: number;
  /** Voix de la vidéo, quel que soit le lancement qui l'a payée. */
  coutVoixCentimes: number;
  /** Chaque lecture payée, avec son coût. */
  prises: PrisePayee[];
  /**
   * Appels de l'écriture (absent : fiche fournie) ; `coutUsd` : coût réel rendu par les appels, chacun compté une fois ;
   * `notes` : écarts corrigés par les champs tirés du cas (X9).
   */
  ecriture?: { appels: number; simule: boolean; coutUsd?: number; notes?: string[]; scriptValide?: boolean };
  etapes: EtapeComptee<EtapeCasConcret>[];
  ecrans: { rendus: string[]; repris: string[] };
  /** Fiche calée (le corps), version de la fiche et de la charte comprises. */
  fiche: FicheEcrans;
  /** Plan des fins, fins calées et regroupées. */
  plan: PlanDesFins;
  fins: FinFaite[];
  liens: Record<string, string>;
  publication: TextePublication[];
  journalCaptures: string[];
  voix: ReturnType<typeof rapportVoix> & { idVoix: string; fournisseur?: string; reglages?: unknown };
  rapport: RapportControleCasConcret;
  pannesDEssai: Partial<Record<EtapeCasConcret, number>>;
  /** Bruitages retirés avant la fabrication (fichier illisible par le rendu), en phrases. */
  bruitagesRetires: string[];
  /** X9 : sous-titres de la première fin (le texte réellement dit), montrés dans l'onglet « Sous-titres ». */
  sousTitres?: SegmentSousTitres[];
  /** V4-3 : défauts visibles « brouillon » mesurés sur la mise en page (texte sur texte, objet vide…), en indicatif. */
  defautsVisuels: DefautVisuel[];
}

/* ------------------------------------------------------------------ */
/* Réglages du format                                                    */
/* ------------------------------------------------------------------ */

/** Empreinte d'un ensemble d'entrées (version de la chaîne comprise). */
export const empreinte = (...parts: unknown[]) => empreinteStable(VERSION_FABRICATION_CAS_CONCRET, ...parts);

/**
 * Sous-titres de la charte duo : gabarit Minimal, texte clair, contour 7, accent orange, police de la charte ; la ligne
 * est centrée dans la bande réservée (`positionPct` posé par la chaîne).
 */
export const STYLE_SOUS_TITRES_DUO: ValeurStyleSousTitres = Object.freeze({
  ...STYLE_SOUS_TITRES_MINIMAL,
  police: "Inter Bold",
  couleurAccent: "orange",
  jetonEmphase: "orange-vif",
  contourPx: 7,
  ombrePx: 0,
});

/**
 * Le haut de l'image est TOUJOURS occupé par le titre de l'écran : le mélange des sous-titres n'y pose jamais rien (un
 * Bandeau descend en bas). Les autres accents (Impact incliné dans la bande, soulignement) restent, comme dans la v4.
 * Essai réel du 15/10 (v-52c3dd9b4f37) : un bandeau « DE DROITS EST CHOISIE » posé en haut couvrait le titre « LA PHOTO ».
 */
export function zonesOccupeesSousTitres(dureeSec: number): { debutSec: number; finSec: number; zone: "haut" }[] {
  return [{ debutSec: 0, finSec: dureeSec, zone: "haut" }];
}

/** Texte des sous-titres sur un écran ivoire : la couleur de la v4 (`.I { color: #15100c }`). */
export const ENCRE_SOUS_TITRES_IVOIRE = "#15100c";

/** V4-2 : largeur des sous-titres, en % de l'image : 960 px, comme la v4 (`#st` sur 60–1 020 px). */
export const LARGEUR_SOUS_TITRES_PCT = +((960 / 1080) * 100).toFixed(2);

/** Décor : la teinte nuit de la charte (jamais vu : les écrans couvrent toute la durée). */
export const DECOR_NUIT: ValeurDecor = Object.freeze({ type: "decor", mode: "teinte", teinte: COULEURS_DUO.nuit, profondeurFlou: 0, directionLumiere: "face", positionSujet: 0.5, clair: false });

/** Recette de composition : teinte nuit, ni grain, ni vignette, ni LUT, export aux bords sûrs. */
export const RECETTE_COMPOSITION_CAS_CONCRET: RecetteComposition = {
  id: FORMAT_CAS_CONCRET,
  angles: { principal: "face" },
  decorRepli: { teinte: COULEURS_DUO.nuit, directionLumiere: "face", flouPx: 0, clair: false },
  nomDecorRepli: "Nuit de la charte",
  reductionLarge: { ...REDUCTION_LARGE_PAR_DEFAUT, "16:9": 1 },
  centreSousTitres: { "9:16": 80, "4:5": 80, "1:1": 80, "16:9": 80 },
  tailleSousTitresPx: STYLE_SOUS_TITRES_MINIMAL.taillePx ?? 60,
  incrustations: GEOMETRIE_INCRUSTATIONS_PAR_DEFAUT,
  realisme: { grainPct: 0, grainTaillePx: 1, vignettePct: 0 },
  lutIntensiteParDefaut: 0,
  exportBordsSurs: true,
  // 14/10 : fin propre commune (image finale tenue puis fondu image + son) — le fond de la dernière carte, mesuré.
  finPropre: FIN_PROPRE_COMMUNE,
};

/** Centre de la bande des sous-titres du format (8 %, au bas de la zone de texte, sous la zone utile), en % de la hauteur. */
export function centreBandePct(zoneProtegee: Parameters<typeof zonesEcran>[0], hauteur = 1920): number {
  const { sousTitres } = zonesEcran(zoneProtegee, 1080, hauteur, BANDE_SOUS_TITRES_CAS_CONCRET);
  return +(((sousTitres.y + sousTitres.hauteur / 2) / hauteur) * 100).toFixed(2);
}

/** Estimation de la voix (corps et fins, prononciations substituées), au tarif donné. */
export function estimerVoixCasConcret(textes: readonly string[], tarifCentimesParCaractere: number): EstimationVoixCasConcret {
  const caracteres = textes.reduce((n, t) => n + t.length, 0);
  return { caracteres, centimes: Math.ceil(caracteres * tarifCentimesParCaractere - 1e-9) };
}

/** 17/10 : arrêt avant une lecture qui dépasserait le prix confirmé de la voix. PUR. */
export function phrasePlafondVoix(plafondCentimes: number, dejaCentimes: number): string {
  return `Une lecture de plus dépasserait le prix confirmé de la voix (au plus ${formaterMontant(centimes(plafondCentimes))}, ${formaterMontant(centimes(dejaCentimes))} déjà payés) : rien de plus n'est payé. Relancez la vidéo pour confirmer un nouveau prix.`;
}

/** Mode indicatif : lectures payées au plus, par texte et par tentative (comme `lecturesVoixMax` de l'avocat). */
export const LECTURES_VOIX_MAX_INDICATIF = 3;

/**
 * Contrôle avant une lecture payée. Bloquant : la part « voix » du prix confirmé n'est pas dépassée (17/10). Indicatif
 * (`budget.indicatif`, posé par le service) : le montant n'arrête plus rien, un COMPTEUR le remplace : au plus
 * `lecturesVoixMax` lectures payées par texte (prise) et par tentative, sinon arrêt anti-boucle. PUR.
 */
export function verifierPartVoix(
  budget: { plafondVoix?: { centimes: number; prixLecture: (texte: string) => number }; indicatif?: { lecturesVoixMax: number; facteurSecurite?: number } },
  payees: readonly PrisePayee[],
  l: { prise: string; texte: string },
): void {
  if (budget.indicatif) {
    const deja = payees.filter((p) => p.prise === l.prise).length;
    if (deja >= budget.indicatif.lecturesVoixMax) {
      throw new ErreurFabricationCasConcret("voix", [`Cette voix a déjà été lue ${deja} fois pour ce texte : rien de plus n'est payé. Changez le texte pour le relire.`]);
    }
    // DEUXIÈME borne, gardée : arrêt de sécurité à `facteurSecurite` × la part voix du prix confirmé (compteur ET 5 ×).
    const p = budget.plafondVoix;
    const facteur = budget.indicatif.facteurSecurite;
    if (p && facteur) {
      const paye = payees.reduce((n, x) => n + x.coutCentimes, 0);
      if (paye + p.prixLecture(l.texte) > p.centimes * facteur) throw new ErreurFabricationCasConcret("voix", [`Arrêt de sécurité : cette voix dépasserait ${facteur} fois le prix confirmé (${formaterMontant(centimes(p.centimes))}, ${formaterMontant(centimes(paye))} déjà payés) : rien de plus n'est payé.`]);
    }
    return;
  }
  const plafond = budget.plafondVoix;
  const deja = payees.reduce((n, x) => n + x.coutCentimes, 0);
  if (plafond && deja + plafond.prixLecture(l.texte) > plafond.centimes) throw new ErreurFabricationCasConcret("voix", [phrasePlafondVoix(plafond.centimes, deja)]);
}

/* ------------------------------------------------------------------ */
/* Petites pièces                                                        */
/* ------------------------------------------------------------------ */

const raisonDe = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** Un tour qui attend un rendu (`RenduEnCours`) rend l'état d'avant, inchangé : le suivi attend puis relit. */
async function ouAttente<S>(etat: S, tour: () => Promise<S>): Promise<S> {
  try {
    return await tour();
  } catch (err) {
    if (estRenduEnCours(err)) return etat;
    throw err;
  }
}

/** Échec définitif d'une composition sur une entrée absente (`ErreurRendu` de la brique, lue par sa forme). */
const entreeAbsente = (err: unknown) => !!err && typeof err === "object" && (err as { erreur?: { code?: unknown } }).erreur?.code === "fichier-inaccessible";

/** Échec d'un rendu (`ErreurRendu`, lue par sa forme : elle porte l'erreur du serveur) : son message n'est jamais montré. */
const panneDeRendu = (err: unknown) => !!err && typeof err === "object" && typeof (err as { erreur?: { code?: unknown } }).erreur?.code === "string";

/** Le rendu n'a plus donné de nouvelle (délai de garde, `fournisseurs/rendu/garde.ts`) : dit à Will en clair. */
const sansNouvelle = (err: unknown) => /sans nouvelle/i.test(raisonDe(err));
const suiteSansNouvelle = (err: unknown) => (sansNouvelle(err) ? " Le serveur de rendu n'a plus donné de nouvelle." : "");

/**
 * X12 · « Réessayer » d'une écriture arrêtée (refus, panne, délai, budget) : la reprise suivante relit d'abord les réponses
 * déjà payées avec les règles du jour, puis fait au plus UN nouvel appel (`ecrireFiche`, `reprise`). Sans journal (aucun
 * appel n'est parti) : rien à marquer, le passage suivant est un premier passage. PUR.
 */
export function marquerRepriseEcriture(j: JournalCasConcret | null): JournalCasConcret | null {
  return j ? { ...j, reprisesEcriture: (j.reprisesEcriture ?? 0) + 1 } : j;
}

/**
 * X10 · « Réessayer » (`relance` : n° de la tentative qui commence) : les rendus suivis restés en cours ou ratés repartent
 * sous un AUTRE identifiant, sinon la chaîne relirait le même échec (gardé 24 h par `studio-rendu`), ou attendrait encore
 * un rendu figé que le serveur ne relance pas (il ne relance qu'une demande ratée). Écrans : à soumettre de nouveau, sous
 * `-r<relance>` ; composition d'une fin pas faite : la série suivante part tout de suite (identifiant `-e<n>` suivant,
 * nouveaux essais et nouveau délai de garde) ; voix dont le traitement du son a raté : reprise à l'analyse, le son PAYÉ
 * gardé (ses identifiants changent avec la relance, `serviceRenduCasConcret`). Tout ce qui est fait (écrans, fins,
 * prises, raccords) reste : rien n'est repayé. PUR.
 */
export function relancerRendusCasConcret(j: JournalCasConcret | null, relance: number): JournalCasConcret | null {
  if (!j) return j;
  const copie = structuredClone(j);
  const autreId = (id: string) => `${id.replace(/(-[er]\d+)+$/, "")}-r${relance}`;
  // X12 : un journal écrit par une version antérieure du code (ou incomplet) ne fait jamais échouer « Réessayer ».
  if (Array.isArray(copie.ecrans?.etat?.cartes)) {
    copie.ecrans.etat.cartes = copie.ecrans.etat.cartes.map((c) => (c.statut === "soumise" || c.statut === "echec" ? { ...c, statut: "a-soumettre" as const, essais: 0, veille: undefined, demande: { ...c.demande, idRendu: autreId(c.demande.idRendu) } } : c));
  }
  for (const m of Object.values(copie.montage ?? {})) {
    if (m?.etat?.phase !== "soumise") continue;
    m.etat = { ...m.etat, relanceApres: new Date(0).toISOString(), serie: 1, debutSerie: m.etat.essai ?? 0, relancesGarde: 0, veille: undefined, progression: 0 };
  }
  const relancer = (p: PriseVoix | undefined) => {
    if (p?.etat && (p.etat.phase === "analyse" || p.etat.phase === "nettoyage")) p.etat = { phase: "a-analyser", brut: p.etat.brut };
  };
  if (copie.voix?.etat) {
    relancer(copie.voix.etat.corps?.prise);
    for (const f of copie.voix.etat.fins ?? []) relancer(f?.prise);
  }
  return copie;
}

/** Le son BRUT d'une prise finie (celui que la recette resserre), à défaut le son de la voix maître. */
function brutDe(prise: PriseVoix | undefined, nom: string): SonAssemble {
  if (!prise || prise.etat.phase !== "faite") throw new ErreurFabricationCasConcret("voix", [`La prise « ${nom} » n'est pas finie.`]);
  const son = prise.brut ?? prise.etat.audio;
  return { fichierCle: son.fichierCle, dureeSec: son.dureeSec, mots: son.mots };
}

/** Son WAV rangé sous `cle`, lu par l'outil `lireSon` ; `null` : outil absent, son illisible ou pas en WAV (rien à mesurer). */
async function sonDe(v: Pick<OutilsVoixCasConcret, "lireSon">, cle: string): Promise<Son | null> {
  if (!v.lireSon) return null;
  try {
    const octets = await v.lireSon(cle);
    return octets ? lireWav(octets) : null;
  } catch {
    return null;
  }
}

/** Blancs mesurés d'un son brut (`null` : pas mesurables). */
async function blancsDe(v: Pick<OutilsVoixCasConcret, "lireSon">, cle: string): Promise<Silence[] | null> {
  const son = await sonDe(v, cle);
  return son ? silencesMesures(son) : null;
}

const NOM_RESEAU: Record<ReseauCas, string> = { facebook: "Facebook", instagram: "Instagram", tiktok: "TikTok", linkedin: "LinkedIn" };
const nomsReseaux = (r: readonly ReseauCas[]) => r.map((x) => NOM_RESEAU[x]).join(", ");

/**
 * Un tour des captures « soumettre puis relire » (S1e). Une capture dont le rendu n'est pas fini (`RenduEnCours`) reste
 * à faire (ni résultat, ni essai compté) et est notée soumise ; une capture soumise est relue par le rendu, jamais par son
 * seul fichier (ses mesures : hauteur de la page, durée). Rien en cours : le tour de M6 tel quel.
 */
async function tourDeCaptures(e: EtatCaptures, outils: OutilsCaptures, soumises: Set<string>): Promise<EtatCaptures> {
  const enCours = new Set<string>();
  const capturer = async (d: DemandeCapture): Promise<ResultatCapture> => {
    try {
      return await outils.capturer(d);
    } catch (err) {
      if (!estRenduEnCours(err)) throw err;
      enCours.add(d.cle);
      soumises.add(d.cle);
      return { ok: false, raison: "rendu en cours", reessayable: false };
    }
  };
  const suivant = await avancerCaptures(e, { capturer, existe: async (cle) => !soumises.has(cle) && outils.existe(cle) });
  if (!enCours.size) return suivant;
  const resultats = { ...suivant.resultats };
  const essais = { ...suivant.essais };
  for (const d of suivant.demandes) {
    if (!enCours.has(d.cle) || e.resultats[d.id]) continue;
    delete resultats[d.id];
    if (e.essais[d.id] === undefined) delete essais[d.id];
    else essais[d.id] = e.essais[d.id];
  }
  return { ...suivant, resultats, essais, termine: false };
}

/** Les propriétés sans les adresses signées des captures (elles changent à chaque signature) : base de l'empreinte. */
function sansAdresse(p: ProprietesEcran): ProprietesEcran {
  if ((p.type === "etape" || p.type === "objet") && "capture" in p.visuel) return { ...p, visuel: { capture: { ...p.visuel.capture, src: "" } } } as ProprietesEcran;
  return p;
}

/* ------------------------------------------------------------------ */
/* La chaîne                                                             */
/* ------------------------------------------------------------------ */

/** Fabrique les fichiers d'un cas concret. Lève `ErreurFabricationCasConcret` (étape et raisons) ; le journal permet la reprise. */
export async function fabriquerCasConcret(o: OptionsFabricationCasConcret): Promise<CompteRenduCasConcret> {
  const { outils, cas, entrees } = o;
  // Avant toute dépense : sans numéro de version, aucun lien suivi ne peut être posé (ADR 0002).
  if (o.numeroVersion === undefined) throw new ErreurFabricationCasConcret("ecriture", ["Le numéro de la version est introuvable : le lien suivi ne peut pas être posé."]);
  const ctx = outils.contexte;
  const horloge = o.horloge ?? Date.now;
  const prononciations = o.prononciations ?? [];
  const ecrireJournal = (j: JournalCasConcret) => outils.journal.ecrire(j);
  const suivi = creerSuivi<EtapeCasConcret, JournalCasConcret>({
    version: VERSION_FABRICATION_CAS_CONCRET,
    journal: { lu: await outils.journal.lire(), ecrire: ecrireJournal },
    horloge,
    ...(o.attendre ? { attendre: o.attendre } : {}),
    erreur: ErreurFabricationCasConcret,
  });
  const journal = suivi.journal;
  const ecrire = () => ecrireJournal(journal);

  /** Essai seulement : l'étape nommée échoue à son premier essai (compté dans le journal) et réussit au suivant. */
  async function panneDEssai(nom: EtapeCasConcret): Promise<void> {
    if (ctx.panneDEssai !== nom || journal.pannesDEssai?.[nom]) return;
    journal.pannesDEssai = { ...journal.pannesDEssai, [nom]: 1 };
    await ecrire();
    throw new ErreurFabricationCasConcret(nom, ["Panne d'essai : l'étape réussira au prochain essai."]);
  }
  /** X2 : outils d'écriture dont les appels sont détachés, pour l'étape dont c'est le libellé. */
  const ecritureDe = (nom: EtapeCasConcret) =>
    ecritureDetachee(outils.ecriture.memoireCommune ? { ...outils.ecriture, memoireCommune: figerMemoireCommune(outils.ecriture.memoireCommune, journal, ecrire) } : outils.ecriture, {
      journal,
      garder: ecrire,
      horloge: o.horlogeAppels ?? horloge,
      libelle: LIBELLES_ETAPES_CAS_CONCRET[nom],
      attente: (libelle) => new RenduEnCours(libelle),
      expire: (phrase) => new ErreurFabricationCasConcret(nom, [phrase]),
    });
  const etape = <T>(nom: EtapeCasConcret, cle: string, faire: () => Promise<T>) =>
    suivi.etape(nom, cle, async () => {
      await panneDEssai(nom);
      return faire();
    });

  // Plan des fins (pur) : lu par l'écriture (durée totale, R21), la relecture, la voix et le calage.
  const reseaux = [...new Set(ctx.reseaux.length ? ctx.reseaux : entrees.reseaux)];
  const mot = entrees.mot ?? cas.mot;
  const motDit = entrees.motDit ?? cas.motDit;
  const planBrut = planDesFins({ reseaux, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot, ...(motDit ? { motDit } : {}), avecMot: entrees.avecMot, motSur: entrees.motSur, table: ctx.tableDesFins });
  const plan = regrouperFins(planBrut);
  // R21 (durée totale) compte les fins réellement planifiées pour les réseaux cochés ; l'écriture les connaît et vise la
  // durée du corps qui les fait tenir. Même contexte pour l'écriture et la relecture : une fiche écrite n'est jamais
  // refusée ensuite pour une autre raison.
  const controleRegles = { motsInterdits: [...ctx.interdits], fins: plan.fins };

  // 0. D2 · le tirage de la vidéo, AVANT l'écriture : la structure tirée dicte l'ordre des écrans du script. Gardé au journal
  // (`journal.tirage`) : une reprise ne le retire jamais, et la partie variable de l'écriture ne change pas en cours de route
  // (sinon l'appel serait repayé). Jamais bloquant : sans outils de variété, rien ne change.
  const structureEcriture = await tirageAvantEcriture();

  // 1. Écriture (sautée quand une fiche est fournie).
  let brute: unknown;
  let ecriture: CompteRenduCasConcret["ecriture"];
  if (entrees.ficheCle) {
    if (!o.lireFiche) throw new ErreurFabricationCasConcret("fiche", ["La fiche d'écrans fournie n'a pas pu être lue."]);
    brute = await o.lireFiche();
  } else if (o.scriptValide) {
    // V4-3 : le script validé du cas, rejoué mot pour mot ; aucun appel d'écriture (contrôlé à la relecture).
    const script = o.scriptValide;
    const lu = await etape("ecriture", empreinte("ecriture-script-valide", cas, o.videoId, o.versionId, entrees.porte, script), async () => ({
      fiche: ficheDuScriptValide(script, { videoId: o.videoId, versionId: o.versionId, habillage: VERSION_CHARTE_DUO, origine: entrees.porte }, cas),
      appels: 0,
      scriptValide: true,
    }));
    brute = lu.fiche;
    ecriture = { appels: 0, simule: false, scriptValide: true };
  } else {
    const ecrite = await etape("ecriture", empreinte("ecriture", cas, o.videoId, o.versionId, entrees.porte, controleRegles), async () => {
      // X2 : appels détachés ; une réponse pas encore arrivée laisse le tour inchangé (le suivi rend la main).
      const outilsEcriture = ecritureDe("ecriture");
      // La mémoire n'est jamais bloquante : illisible, l'écriture se fait sans (comme avant).
      const scriptsAnterieurs = o.lireScriptsAnterieurs ? await o.lireScriptsAnterieurs().catch(() => []) : [];
      const entree = { videoId: o.videoId, versionId: o.versionId, habillage: VERSION_CHARTE_DUO, origine: entrees.porte, cas, controle: controleRegles, ...(structureEcriture ? { structure: structureEcriture } : {}), ...(journal.reprisesEcriture ? { reprise: journal.reprisesEcriture } : {}), ...(scriptsAnterieurs.length ? { scriptsAnterieurs } : {}) };
      const r = (await suivi.suivre<ResultatEcriture | null>(
        "ecriture",
        null,
        (e) => ouAttente(e, () => ecrireFiche(entree, outilsEcriture)),
        (e) => e !== null,
        async () => undefined,
      ))!;
      if (!r.ok) throw new ErreurFabricationCasConcret("ecriture", [r.message, ...r.refus], r.reponseBrute);
      // X9 : les écarts corrigés par les champs tirés du cas restent au journal de l'étape.
      // La simulation écrit toujours la v4 : elle ne porte jamais de structure (sinon un script faux la garderait).
      return { fiche: structureEcriture && !r.simule ? { ...r.fiche, structure: structureEcriture } : r.fiche, appels: r.appels, simule: r.simule, ...(r.coutUsd !== undefined ? { coutUsd: r.coutUsd } : {}), ...(r.notes.length ? { notes: r.notes } : {}) };
    });
    brute = ecrite.fiche;
    ecriture = { appels: ecrite.appels, simule: ecrite.simule, ...(ecrite.coutUsd !== undefined ? { coutUsd: ecrite.coutUsd } : {}), ...(ecrite.notes?.length ? { notes: ecrite.notes } : {}) };
  }

  // 2. Relecture : un refus arrête avant toute voix.
  const script = !entrees.ficheCle && o.scriptValide ? o.scriptValide : null;
  const { fiche } = await etape("fiche", empreinte("fiche", brute, cas, reseaux, controleRegles, script ? "script-valide" : "ecrite", !!ctx.exigerScriptValide), async () => {
    if (!reseaux.length) throw new ErreurFabricationCasConcret("fiche", ["Aucun réseau choisi : cochez au moins un réseau."]);
    if (!plan.fins.length) throw new ErreurFabricationCasConcret("fiche", plan.sansFin.length ? plan.sansFin.map((s) => s.raison) : ["Aucune fin possible pour ces réseaux."]);
    // V4-3 : un script validé refusé arrête la fabrication avec une phrase claire, suivie des refus exacts.
    const refus = (raisons: string[]) => new ErreurFabricationCasConcret("fiche", script ? [PHRASE_SCRIPT_VALIDE_REFUSE, ...raisons] : raisons);
    if (script) {
      const pb = problemesScriptValide(script, cas);
      if (pb.length) throw refus(pb);
    }
    const forme = validerSchemaFiche(brute);
    if (!forme.ok) throw refus(forme.problemes.map((p) => p.message));
    if (forme.fiche.casId !== cas.id) throw refus([`La fiche est écrite pour un autre cas (« ${forme.fiche.casId} »).`]);
    const v = validerFicheEcrans(brute, { cas, texteScript: texteDuCorps(forme.fiche), ...controleRegles });
    if (!v.ok) throw refus(v.problemes.map((p) => p.message));
    // V4-3 : un script écrit (ni validé, ni fourni) attend la validation de Will : aucune voix avant.
    if (ctx.exigerScriptValide && !script && !entrees.ficheCle) throw new ErreurFabricationCasConcret("fiche", [PHRASE_SCRIPT_A_VALIDER]);
    return { fiche: v.fiche };
  });

  // 3. Vrais écrans : une capture ratée prend son repli (jamais d'échec).
  // P2C : une étape dont Will a fourni l'image (écran derrière une connexion) ne demande aucune capture.
  const fournis = ctx.ecransFournis ?? [];
  const demandes = planCaptures(fiche, cas, fournis);
  const cleCaptures = empreinte("captures", fiche, demandes, ...(fournis.length ? [fournis] : []));
  const captures = await etape("captures", cleCaptures, async () => {
    const depart = journal.captures?.empreinte === cleCaptures ? journal.captures.etat : etatInitialCaptures(demandes);
    const soumises = new Set(journal.capturesSoumises ?? []);
    const finies = await suivi.suivre(
      "captures",
      depart,
      async (e) => {
        const suivant = await tourDeCaptures(e, outils.captures, soumises);
        if (soumises.size !== (journal.capturesSoumises?.length ?? 0)) {
          journal.capturesSoumises = [...soumises];
          await ecrire();
        }
        return suivant;
      },
      (e) => e.termine || e.demandes.length === 0,
      async (e) => {
        journal.captures = { empreinte: cleCaptures, etat: e };
        await ecrire();
      },
    );
    const appliquee = appliquerCaptures(fiche, finies, fournis, cas);
    const details: Record<string, Omit<CaptureVraiEcran, "src">> = {};
    for (const [id, c] of Object.entries(appliquee.captures)) {
      const d = demandes.find((x) => x.id === id);
      // Écran fourni : aucune demande, une image fixe (taille inconnue : celle de l'écran, la composition l'ajuste).
      if (!d) {
        details[id] = { cle: c.cle, sorte: "image", largeur: 1080, hauteur: 1920 };
        continue;
      }
      const r = finies.resultats[id];
      const m = r?.ok ? r.mesures : {};
      const dureeSec = m.dureeSec ?? (d.parametres.type === "video" ? d.parametres.dureeSec : undefined);
      // Page entière : la partie utile montrée d'emblée (décalage de départ porté par la fiche).
      const departY = d.parametres.type === "page-entiere" ? departDePage(appliquee.fiche, id) : undefined;
      details[id] = { cle: c.cle, sorte: d.parametres.type, largeur: m.largeur ?? 1080, hauteur: m.hauteur ?? 1920, ...(dureeSec !== undefined ? { dureeSec } : {}), ...(departY !== undefined ? { departY } : {}) };
    }
    // V4-1 : un téléphone montre l'image déclarée par le cas (l'annonce), sinon son repli dessiné ; jamais vide.
    const deposees = new Set<string>();
    for (const cle of clesImagesDuCas(cas)) if (await outils.captures.existe(cle).catch(() => false)) deposees.add(cle);
    const images = imagesDuCas(appliquee.fiche, cas, deposees);
    return { fiche: images.fiche, captures: { ...details, ...images.captures }, journal: [...appliquee.journal, ...images.journal] };
  });

  // 4. Voix : corps, une prise par fin, puis l'assemblage de chaque fin.
  const lire = (t: string) => (prononciations.length ? substituerPrononciations(t, [...prononciations]) : t);
  const texteCorps = lire(texteDuCorps(captures.fiche));
  const textesFins = plan.fins.map((f) => ({ id: f.id, texte: lire(f.ecrans.map((e) => e.texteDit.trim()).join(" ")) }));
  const tarif = outils.budget.tarifCentimesParCaractere;
  const estimation = estimerVoixCasConcret([texteCorps, ...textesFins.map((f) => f.texte)], tarif);
  const v = outils.voix;
  const cleVoix = empreinte("voix", texteCorps, textesFins, v.idVoix, v.reglages, v.fournisseurVoix, v.regles, TEMPO_VOIX, reglagesRecette());
  const payeesAvant = journal.voix?.empreinte === cleVoix ? journal.voix.etat.payees.length : 0;
  const ecritureVoix = ecritureDe("voix");
  const outilsVoix = (e: EtatVoixCasConcret): OutilsAvancerVoix => ({
    ...v,
    faits: cas.faits,
    // Le script validé par Will est dit tel quel : aucune reformulation.
    ...(script ? { texteFige: true } : {}),
    // Deux refus identiques sur la même phrase : arrêt expliqué, jamais une lecture payée de plus qui échouerait pareil.
    arretSiRefusIdentique: true,
    reformuler: (phrase, faits) => reformulerPhrase(phrase, faits, ecritureVoix, { videoId: o.videoId, appelId: `${o.videoId}-${o.versionId}-l${e.corps.lectures}` }),
    avantLecture: (l) => {
      // 17/10 : une lecture qui ferait dépasser la part « voix » du prix confirmé n'est pas faite (« au plus » reste vrai).
      // Mode indicatif : compteur de lectures à la place du montant (voir `verifierPartVoix`).
      verifierPartVoix(outils.budget, e.payees, l);
      return outils.budget.verifierEtReserver(estimerVoixCasConcret([l.texte], tarif));
    },
  });
  const voix = await etape("voix", cleVoix, async () => {
    // Entrées changées (une autre fin, X6) : le corps déjà retenu et les fins inchangées sont repris, jamais relus.
    // « Réessayer » après un arrêt : le contrôle de la prise gardée est refait avec les règles du moment (sans relecture).
    const depart =
      journal.voix?.empreinte === cleVoix
        ? rouvrirApresArret(journal.voix.etat)
        : repriseVoixCasConcret(journal.voix?.etat, { corps: texteCorps, fins: textesFins }, (texte) => empreintePriseVoix({ texte, ...(v.fournisseurVoix ? { fournisseurVoix: v.fournisseurVoix } : {}), idVoix: v.idVoix, ...(v.reglages ? { reglages: v.reglages } : {}), regles: v.regles }));
    const finie = await suivi.suivre(
      "voix",
      depart,
      (e) =>
        ouAttente(e, () =>
          avancerVoixCasConcret(e, outilsVoix(e)).catch((err: unknown) => {
            if (!panneDeRendu(err)) throw err;
            // X10 : le traitement du son (rendu) a raté ; la lecture payée est gardée dans l'état.
            const fin = e.corps.retenu ? plan.fins.find((f) => f.id === e.fins.find((x) => !x.prise?.controle)?.id) : undefined;
            throw new ErreurFabricationCasConcret("voix", [`Le traitement de la voix ${fin ? `de la fin pour ${nomsReseaux(fin.reseaux)}` : "du corps"} n'a pas abouti.${suiteSansNouvelle(err)}`], raisonDe(err));
          }),
        ),
      (e) => !!e.issue,
      async (e) => {
        journal.voix = { empreinte: cleVoix, etat: e };
        await ecrire();
      },
    );
    if (finie.issue?.statut === "arret") throw new ErreurFabricationCasConcret("voix", [finie.issue.message]);
    // Recette de la voix (X4) : les sons BRUTS du corps et de chaque fin, raccordés puis traités ensemble.
    const corps = brutDe(finie.corps.prise, "corps");
    const sons = finie.fins.map((f) => {
      const son = brutDe(f.prise, f.id);
      return { id: f.id, son, plan: planRaccordVoix(corps, son) };
    });
    // V4-1 : une coupe ne tombe jamais en plein son (heure de fin du fournisseur trop tôt) : elle va dans le blanc mesuré.
    // Essai réel du 14/10 (v-f17775b9177a) : le son brut de HeyGen est un MP3, illisible pour la mesure ; aucune coupe
    // n'était replacée et une fin de mot était rognée (« coupée net à 24,57 s »). Le son brut est d'abord copié en WAV
    // (assemblage d'un seul morceau, sans tempo : même horloge), puis mesuré.
    const mesurables = v.lireSon ? await suivi.suivre(
      "voix",
      {} as Record<string, string>,
      async (e) => {
        const suite = { ...e };
        for (const cle of [...new Set([corps.fichierCle, ...sons.map((x) => x.son.fichierCle)])]) {
          if (suite[cle]) continue;
          if (await sonDe(v, cle)) {
            suite[cle] = cle;
            continue;
          }
          const duree = cle === corps.fichierCle ? corps.dureeSec : sons.find((x) => x.son.fichierCle === cle)!.son.dureeSec;
          const id = `cc-brut-wav-${empreinte("brut-wav", cle).slice(0, 16)}`;
          try {
            suite[cle] = (await v.assembler({ id, sortieCle: v.cle(`${id}.wav`), morceaux: [{ entree: cle, deSec: 0, aSec: duree }] })).cle;
          } catch (err) {
            if (estRenduEnCours(err)) continue;
            suite[cle] = cle;
          }
        }
        return suite;
      },
      (e) => [corps.fichierCle, ...sons.map((x) => x.son.fichierCle)].every((cle) => e[cle]),
      async () => undefined,
    ) : {};
    const blancsCorps = await blancsDe(v, mesurables[corps.fichierCle] ?? corps.fichierCle);
    for (const x of sons) {
      const blancsFin = await blancsDe(v, mesurables[x.son.fichierCle] ?? x.son.fichierCle);
      if (blancsCorps || blancsFin) x.plan = recalerCoupesSurSilences(x.plan, { corps: corps.mots, fin: x.son.mots }, { ...(blancsCorps ? { 0: blancsCorps } : {}), ...(blancsFin ? { 1: blancsFin } : {}) }).plan;
    }
    // Assemblages soumis ensemble, relus à chaque tour : un rendu pas fini ne tient pas la main (S1e). Leur empreinte
    // porte les PLANS (coupes replacées dans les blancs) : un plan changé refait l'assemblage, jamais l'ancien son.
    const cleAssemblages = empreinte("assemblages", cleVoix, sons.map((x) => x.plan));
    const assembles = await suivi.suivre(
      "voix",
      journal.assemblages?.empreinte === cleAssemblages ? journal.assemblages.faits : ({} as Record<string, ResultatAssemblage>),
      async (e) => {
        const suite = { ...e };
        for (const { id: fin, son, plan: p } of sons) {
          if (suite[fin]) continue;
          const id = `cc-recette-${empreinte("recette", cleAssemblages, fin).slice(0, 16)}`;
          const morceaux = p.morceaux.filter((m) => !m.silence).map((m) => ({ entree: m.source === 1 ? son.fichierCle : corps.fichierCle, deSec: m.debutSec, aSec: m.finSec }));
          try {
            suite[fin] = await v.assembler({
              id,
              sortieCle: v.cle(`${id}.wav`),
              morceaux,
              tempo: RECETTE_VOIX_CAS_CONCRET.filtres.atempo,
              recette: { corps: corps.fichierCle, fin: son.fichierCle, parametres: parametresRaccord(p), dureeSec: p.dureeSec },
            });
          } catch (err) {
            if (estRenduEnCours(err)) continue;
            // X10 : les raccords déjà finis dans ce tour sont gardés (la reprise ne refait que celui qui a raté).
            journal.assemblages = { empreinte: cleAssemblages, faits: suite };
            await ecrire();
            const f = plan.fins.find((x) => x.id === fin);
            throw new ErreurFabricationCasConcret("voix", [`Le raccord de la voix de la fin pour ${f ? nomsReseaux(f.reseaux) : "un réseau"} n'a pas abouti.${suiteSansNouvelle(err)}`], raisonDe(err));
          }
        }
        return suite;
      },
      (e) => sons.every((x) => e[x.id]),
      async (e) => {
        journal.assemblages = { empreinte: cleAssemblages, faits: e };
        await ecrire();
      },
    );
    // Les mots recalés par la recette : resserrés, raccordés, divisés par `atempo` (le tempo final du calage).
    const fins = sons.map(({ id, plan: p }) => ({ id, cle: assembles[id].cle, dureeSec: assembles[id].dureeSec, mots: p.mots }));
    // V4-1 : contrôle BLOQUANT, la dernière phrase est dite jusqu'au bout (son final mesuré, pas l'heure du fournisseur).
    for (const f of fins) {
      const son = await sonDe(v, f.cle);
      const dernier = f.mots.at(-1);
      if (!son || !dernier) continue;
      const verdict = controlerFinDeVoix(son, dernier.finSec);
      if (!verdict.ok) {
        const fin = plan.fins.find((x) => x.id === f.id);
        throw new ErreurFabricationCasConcret("voix", [`Voix${fin && plan.fins.length > 1 ? ` de la fin pour ${nomsReseaux(fin.reseaux)}` : ""} · ${verdict.raison} Relancez la voix.`]);
      }
    }
    return { texteCorps: finie.corps.texte, reformule: finie.reformulations.length > 0, payees: finie.payees, rapport: rapportVoix(finie), fins };
  });
  const coutCentimes = voix.payees.slice(payeesAvant).reduce((s, p) => s + p.coutCentimes, 0);

  // 5. Calage, fin par fin ; le corps finit au même instant pour toutes (ses écrans sont rendus une fois).
  const reportee = voix.reformule ? reporterTexteDit(captures.fiche, voix.texteCorps) : captures.fiche;
  if (!reportee) throw new ErreurFabricationCasConcret("calage", ["La phrase reformulée ne se répartit plus sur ses écrans : reprenez la fiche."]);
  const calage = await etape("calage", empreinte("calage", reportee, plan.fins, voix.fins, prononciations), async () => {
    const parFin = plan.fins.map((f) => {
      const son = voix.fins.find((x) => x.id === f.id)!;
      const r = calerFiche(reportee, f, son.mots, { prononciations, finApresDernierMotSec: FIN_APRES_DERNIER_MOT_SEC });
      if (!r.ok) throw new ErreurFabricationCasConcret("calage", r.problemes.map((p) => (plan.fins.length > 1 ? `Fin pour ${nomsReseaux(f.reseaux)} · ${p}` : p)));
      return { r, f };
    });
    const commun = Math.min(...parFin.map(({ r }) => r.fin!.ecrans[0].debutMs!));
    const premier = parFin[0].r;
    const dernier = premier.fiche.ecrans.length - 1;
    const corps = premier.fiche.ecrans.map((e, i) => (i === dernier ? { ...e, finMs: commun } : e)) as FicheEcrans["ecrans"];
    const idsCorps = new Set(corps.map((e) => e.id));
    const borne = (ev: EvenementCale) => (ev.ecranId === corps[dernier].id ? { ...ev, debutMs: Math.min(ev.debutMs, commun - IMAGE_MS) } : ev);
    return {
      fiche: { ...premier.fiche, ecrans: corps },
      evenements: premier.evenements.filter((ev) => idsCorps.has(ev.ecranId)).map(borne),
      fins: parFin.map(({ r, f }) => ({
        fin: { ...f, ecrans: r.fin!.ecrans.map((e, i) => (i === 0 ? { ...e, debutMs: commun } : e)) as EcranFin[] },
        evenements: r.evenements.filter((ev) => !idsCorps.has(ev.ecranId)),
        dureeMs: r.dureeMs,
      })),
    };
  });

  // Sur-titre des écrans sans étiquette propre (lien, appel au mot, preuve) : celui du CAS, jamais celui d'un autre.
  const surTitre = surTitreDuCas(cas);
  // L6 : les écrans calés SANS jeu (contenu de chaque écran : la mise en page n'est tirée que si ses données sont là).
  const corpsSansJeu: EcranCale[] = ecransCales(calage.fiche.ecrans, calage.evenements, null, captures.captures, cas.faits, surTitre);
  const aMettre = corpsSansJeu.map((e) => ({ id: e.id, type: e.type, fond: e.fond, contenu: e }));

  // 5 bis. L2 · la mise de la vidéo (variété) ; jamais bloquante.
  const mise = await miseDeLaVideo();
  const ficheMise: FicheEcrans = mise ? { ...calage.fiche, mise } : calage.fiche;

  /**
   * D2 · tire (une seule fois) la vidéo AVANT l'écriture et rend la structure à suivre, `undefined` pour la v4 (rien n'est
   * ajouté à la partie variable). Ordre : le tirage du journal, sinon la mise du journal, sinon celle d'une version
   * précédente, sinon un tirage neuf. Structure IMPOSÉE (jamais tirée) : celle du script validé (v4 s'il n'en porte pas) ;
   * la v4 si l'écriture a déjà des appels au journal sans tirage (elle a été payée sans structure : la changer repayerait).
   * Sans outils de variété, ou avec une fiche fournie : rien ne change.
   */
  async function tirageAvantEcriture(): Promise<Structure | undefined> {
    const variete = outils.variete;
    if (!variete || entrees.ficheCle) return undefined;
    const sansPanne = async <T>(lire: () => Promise<T>, defaut: T): Promise<T> => {
      try {
        return await lire();
      } catch {
        return defaut;
      }
    };
    if (!journal.tirage) {
      const miseGardee = journal.mise?.mise;
      const commencee = Object.keys(journal.appels ?? {}).some((cle) => cle.startsWith(`${PREFIXE_APPEL_ECRITURE}-${o.videoId}-`));
      const imposee: Structure | undefined = o.scriptValide ? (o.scriptValide.structure ?? STRUCTURES[0]) : commencee ? STRUCTURES[0] : undefined;
      let tirage = miseGardee?.tirage;
      if (!tirage) {
        const heritee = variete.miseHeritee ? lireMise(await sansPanne(() => variete.miseHeritee!(o.videoId), null)) : null;
        const historique = lireHistorique(await sansPanne(() => variete.lireHistorique(), []));
        // LOT F : « autre structure » que celle du script écarté, SANS contourner les règles du tirage (v4 1 sur 4,
        // combinaison unique, écarts minimum) : le tirage lui-même exclut ces structures.
        const exclues = !imposee && o.structureEcartee ? STRUCTURES.filter((s) => structureEffective(cas.offre, s) === o.structureEcartee) : [];
        const heritable = heritee && !exclues.includes(heritee.tirage.structure) ? heritee : null;
        tirage = heritable?.tirage ?? tirer({ videoId: o.videoId, canaux: reseaux, historique, ...(imposee ? { structureImposee: imposee } : {}), ...(exclues.length ? { structuresExclues: exclues } : {}) });
        // Une structure imposée (script validé, écriture déjà commencée) l'emporte aussi sur celle d'un tirage hérité.
        if (imposee && tirage.structure !== imposee) tirage = { ...tirage, structure: imposee };
      }
      // Le journal dit la structure réellement suivie : coaching + « une-journee » = v4.
      tirage = { ...tirage, structure: structureEffective(cas.offre, tirage.structure) };
      journal.tirage = { tirage, notee: !!miseGardee };
      await ecrire();
    } else if (o.scriptValide) {
      // Script validé : sa structure fait foi (étiquette seulement ; l'écriture ne se refait pas).
      const attendue = structureEffective(cas.offre, o.scriptValide.structure ?? STRUCTURES[0]);
      if (journal.tirage.tirage.structure !== attendue) {
        journal.tirage = { ...journal.tirage, tirage: { ...journal.tirage.tirage, structure: attendue } };
        await ecrire();
      }
    }
    // La ligne complète (avec les mises en page) écrite par `miseDeLaVideo` ne se réécrit jamais sans elles.
    if (!journal.tirage.notee && journal.mise?.notee) {
      journal.tirage = { tirage: journal.tirage.tirage, notee: true };
      await ecrire();
    }
    if (!journal.tirage.notee) {
      const t = journal.tirage.tirage;
      const notee = await sansPanne(async () => {
        await variete.ajouter(entreeHistorique(o.videoId, reseaux, t, new Date(horloge()).toISOString()));
        return true;
      }, false);
      journal.tirage = { tirage: t, notee };
      await ecrire();
    }
    const structure = structureEffective(cas.offre, journal.tirage.tirage.structure);
    return structure === STRUCTURES[0] ? undefined : structure;
  }

  /** Mise de la fiche, sinon celle déjà tirée (journal), sinon héritée d'une version, sinon un tirage neuf. */
  async function miseDeLaVideo(): Promise<Mise | undefined> {
    const variete = outils.variete;
    const sansPanne = async <T>(lire: () => Promise<T>, defaut: T): Promise<T> => {
      try {
        return await lire();
      } catch {
        return defaut;
      }
    };
    let gardee = calage.fiche.mise ?? journal.mise?.mise;
    if (!gardee && variete) {
      const heritee = variete.miseHeritee ? lireMise(await sansPanne(() => variete.miseHeritee!(o.videoId), null)) : null;
      const historique = lireHistorique(await sansPanne(() => variete.lireHistorique(), []));
      const tirage = journal.tirage?.tirage ?? heritee?.tirage ?? tirer({ videoId: o.videoId, canaux: reseaux, historique });
      // La déclinaison suit les écrans de CETTE fiche (une version peut en avoir d'autres) ; L6 : leur contenu calé.
      gardee = mettre(tirage, aMettre, historique, reseaux);
    }
    if (!gardee) return undefined;
    if (variete && !journal.mise?.notee) {
      journal.mise = { mise: gardee, notee: false };
      await ecrire();
      const notee = await sansPanne(async () => {
        await variete.ajouter(entreeHistorique(o.videoId, reseaux, gardee!.tirage, new Date(horloge()).toISOString()));
        return true;
      }, false);
      journal.mise = { mise: gardee, notee };
      await ecrire();
    }
    return gardee;
  }

  // 6. Écrans : propriétés de la brique, contrôlées, puis rendues une à une (clé par empreinte).
  // V4-2 : zone pleine image, la même pour tous les réseaux (décision de Will, comme la v4) ; les boutons des réseaux
  // peuvent recouvrir une partie du bas.
  // L2 : le jeu de chaque écran (dimensions actives seulement) ; sans jeu, les écrans calés restent ceux de la v4.
  // L6 : un fond alterné remplace celui de la fiche (sous-titres et contrôles suivent le fond posé).
  const corpsCales: EcranCale[] = corpsSansJeu.map((e) => {
    const jeu = jeuDeLEcran(mise, e.id);
    if (!jeu) return e;
    return typeof jeu.fondAlterne === "string" ? ({ ...e, fond: jeu.fondAlterne as EcranCale["fond"], jeu } as EcranCale) : { ...e, jeu };
  });
  // L3a : composition et animation de l'écran final (tirage de la vidéo), posées sur le DERNIER écran `lien` de chaque fin,
  // seulement quand elles diffèrent de la v4 (0) : sans mise, ou à 0 et 0, les écrans calés restent ceux de la v4.
  const jeuFin = mise ? { ...(mise.tirage.fin.composition ? { finComposition: mise.tirage.fin.composition } : {}), ...(mise.tirage.fin.animation ? { finAnimation: mise.tirage.fin.animation } : {}) } : {};
  const finsCales = calage.fins.map((f) => {
    const cales = ecransCales(f.fin.ecrans, f.evenements, f.fin, {}, [], surTitre);
    const dernierLien = cales.map((e) => e.type).lastIndexOf("lien");
    return { id: f.fin.id, cales: Object.keys(jeuFin).length && dernierLien >= 0 ? cales.map((e, i) => (i === dernierLien ? { ...e, jeu: { ...e.jeu, ...jeuFin } } : e)) : cales };
  });
  const proprietes = (src: (cle: string) => string) => {
    const caps: Record<string, CaptureEcran> = Object.fromEntries(Object.values(captures.captures).map((c) => [c.cle, { ...c, src: src(c.cle) }]));
    return {
      corps: proprietesPleineImage({ ecrans: corpsCales, captures: caps }),
      fins: Object.fromEntries(finsCales.map((f) => [f.id, proprietesPleineImage({ ecrans: f.cales, captures: caps })])) as Record<string, ProprietesEcran[]>,
    };
  };
  const brouillon = proprietes(() => "");
  const refus = [...brouillon.corps, ...Object.values(brouillon.fins).flat()].flatMap((p) => controlerProprietes(p));
  if (refus.length) throw new ErreurFabricationCasConcret("ecrans", [...new Set(refus)]);
  const empreinteDe = (p: ProprietesEcran) => empreinte("ecran", COMPOSITION_ECRAN, CRF_ECRAN, sansAdresse(p));
  /** Écrans à rendre : le corps une fois, puis ceux de chaque fin ; deux écrans identiques ne sont rendus qu'une fois. */
  const aRendre = new Map<string, { id: string; rang: { fin: string | null; i: number } }>();
  const carteDe = (fin: string | null, i: number, p: ProprietesEcran) => {
    const e = empreinteDe(p);
    if (!aRendre.has(e)) aRendre.set(e, { id: fin ? `${fin}-${p.id}` : p.id, rang: { fin, i } });
    return e;
  };
  const empreintesCorps = brouillon.corps.map((p, i) => carteDe(null, i, p));
  const empreintesFins = Object.fromEntries(Object.entries(brouillon.fins).map(([id, ps]) => [id, ps.map((p, i) => carteDe(id, i, p))]));
  const cleEcrans = empreinte("ecrans", o.env, o.videoId, [...aRendre.keys()]);
  const ecrans = await etape("ecrans", cleEcrans, async () => {
    const lectures = Object.fromEntries(Object.values(captures.captures).map((c) => [c.cle, c.cle]));
    const signees = Object.keys(lectures).length ? await outils.montage.signer(lectures, []) : { lectures: {} as Record<string, string> };
    const props = proprietes((cle) => signees.lectures[cle] ?? "");
    const cartes = [...aRendre.entries()].map(([emp, { id, rang }]) => {
      const p = rang.fin ? props.fins[rang.fin][rang.i] : props.corps[rang.i];
      return { id, ratio: RATIO, debutSec: p.debutMs / 1000, finSec: p.finMs / 1000, modele: COMPOSITION_ECRAN, parametres: { composition: COMPOSITION_ECRAN, proprietes: p, crf: CRF_ECRAN }, empreinte: emp } as unknown as CarteFormat & { empreinte: string };
    });
    const enCours = journal.ecrans?.empreinte === cleEcrans ? journal.ecrans : null;
    const rendues = new Set(enCours?.rendues ?? []);
    const depart =
      enCours?.etat ??
      etatInitialCartesMotion(cartes, (c) => `cc-ecran-${c.id}`, { bloquant: true, parEmpreinte: { env: o.env, videoId: o.videoId, empreinte: (c) => (c as CarteFormat & { empreinte: string }).empreinte } });
    /** X10 : un écran raté est nommé par sa place (corps ou fin), jamais par son identifiant. */
    const ecranRate = (err: unknown) => {
      if (!(err instanceof ErreurSceneRatee)) throw err;
      const rang = [...aRendre.values()].find((x) => x.id === err.scene)?.rang;
      const fin = rang?.fin ? plan.fins.find((f) => f.id === rang.fin) : undefined;
      throw new ErreurFabricationCasConcret("ecrans", [`Le rendu d'un écran ${fin ? `de la fin pour ${nomsReseaux(fin.reseaux)}` : "du corps"} n'a pas abouti.${suiteSansNouvelle(err)}`], raisonDe(err));
    };
    const finies = await suivi.suivre(
      "ecrans",
      depart,
      (e) => avancerCartesMotion(e, outils.scenes).catch(ecranRate),
      (e) => cartesMotionFinies(e),
      async (e) => {
        for (const c of e.cartes) if (c.statut === "soumise") rendues.add(c.id);
        journal.ecrans = { empreinte: cleEcrans, etat: e, rendues: [...rendues] };
        await ecrire();
      },
    );
    return {
      cles: Object.fromEntries(finies.cartes.map((c) => [c.empreinte ?? c.id, c.cle])) as Record<string, string>,
      rendus: finies.cartes.filter((c) => rendues.has(c.id)).map((c) => c.id),
      repris: finies.cartes.filter((c) => !rendues.has(c.id)).map((c) => c.id),
    };
  });
  const ecransRepris = suivi.etapes.some((e) => e.etape === "ecrans" && e.statut === "reprise");

  // 7. Finitions : une composition complète par fin.
  // L3b : hauteur et accent des sous-titres tirés (`mise.tirage.sousTitres`) ; « v4 » ou aucune mise : la v4 exacte.
  const centre = mise?.tirage.sousTitres.hauteur === "haute" ? centreSousTitresHautPct() : centreSousTitresPleineImagePct();
  const style = { id: "sous-titres-duo", nom: "Charte duo", valeur: { ...STYLE_SOUS_TITRES_DUO, positionPct: centre, largeurMaxPct: LARGEUR_SOUS_TITRES_PCT, ...surlignageCasConcret(mise?.tirage.sousTitres) } };
  // L3b : la variation des sous-titres entre dans l'empreinte du montage (rien en v4 : empreinte inchangée).
  const variationDuMontage = [variationSousTitresCasConcret(mise?.tirage.sousTitres), surlignageCasConcret(mise?.tirage.sousTitres)].filter((x) => Object.keys(x).length);
  const emphase = [...new Set(calage.fiche.ecrans.flatMap(motsOrange))];
  const bruitagesDe = new Map<string, BruitagePlace[]>();
  const preparees = calage.fins.map((cf) => {
    const f = cf.fin;
    const son = voix.fins.find((x) => x.id === f.id)!;
    const props = [...brouillon.corps.map((p, i) => ({ p, e: empreintesCorps[i] })), ...brouillon.fins[f.id].map((p, i) => ({ p, e: empreintesFins[f.id][i] }))];
    const scenes: ScenePosee[] = props.map(({ p, e }, i) => ({ id: i < brouillon.corps.length ? p.id : `${f.id}-${p.id}`, debutSec: p.debutMs / 1000, finSec: p.finMs / 1000, cle: ecrans.cles[e] }));
    const dureeSec = +(cf.dureeMs / 1000).toFixed(3);
    const bruitages = poserBruitages({ ecrans: [...calage.fiche.ecrans, ...f.ecrans], cales: [...corpsCales, ...finsCales.find((x) => x.id === f.id)!.cales], mots: son.mots, dureeSec, valides: ctx.bruitagesValides, ...(mise && mise.tirage.bruitages.depart ? { graine: mise.tirage.bruitages.depart } : {}) });
    bruitagesDe.set(f.id, bruitages);
    const texteScript = `${texteDuCorps(calage.fiche)} ${f.ecrans.map((e) => e.texteDit.trim()).join(" ")}`;
    // Essai réel du 14/10 : sous-titres clairs illisibles sur l'ivoire ; la v4 les écrit en #15100c sur l'ivoire.
    const clairs = [...corpsCales, ...finsCales.find((x) => x.id === f.id)!.cales].filter((e) => e.fond === "ivoire").map((e) => ({ debutSec: e.debutMs / 1000, finSec: e.finMs / 1000, texte: ENCRE_SOUS_TITRES_IVOIRE }));
    const cle = empreinte("montage", scenes, son.cle, son.mots, dureeSec, centre, texteScript, bruitages, f.id, clairs, "haut-occupe", ...variationDuMontage);
    return { f, son, scenes, dureeSec, bruitages, texteScript, cle, clairs };
  });
  const sousTitresDe = (x: (typeof preparees)[number]) => fabriquerSousTitres({ texte: x.texteScript, dureeSec: x.son.dureeSec, mots: x.son.mots, prononciations: [...prononciations], emphase, style: style.valeur, base: "minimal", occupe: zonesOccupeesSousTitres(x.son.dureeSec), ratio: RATIO, reseaux: x.f.reseaux, ...variationSousTitresCasConcret(mise?.tirage.sousTitres) });
  const montage = await etape("montage", empreinte("montage", preparees.map((x) => x.cle)), async () => {
    const faites: { id: string; sortieCle: string; masterCle?: string; vignetteCle: string; mesures: Record<string, number> }[] = [];
    for (const x of preparees) {
      const c = commandeMinimale({
        moteurId: MOTEUR_CAS_CONCRET,
        formatId: FORMAT_CAS_CONCRET,
        versionFormat: 1,
        videoId: o.videoId,
        texteScript: x.texteScript,
        dureeSec: x.dureeSec,
        scenes: x.scenes,
        styleSousTitres: style,
        decor: { id: "teinte-nuit", nom: "Nuit de la charte", valeur: DECOR_NUIT },
        ...(o.personnageId ? { personnageId: o.personnageId } : {}),
        prononciations,
      });
      const sons: Record<string, MediaCommande> = Object.fromEntries(ctx.bruitagesValides.filter((b) => x.bruitages.some((p) => p.elementId === b.elementId)).map((b) => [b.elementId, { cle: b.cle, mime: b.mime, dureeSec: b.dureeSec }]));
      const commande = { ...c, medias: { ...c.medias, ...sons } };
      const segments = sousTitresDe(x);
      const base: BaseComposition = {
        plans: plansDesScenes(x.scenes),
        segments,
        dureeSec: x.dureeSec,
        mots: x.son.mots,
        audioCle: x.son.cle,
        // Jamais montée (les écrans couvrent toute la durée) : garde le chemin rapide du rendu.
        pistesDouble: { face: x.scenes[0].cle },
        supplements: { positionSousTitresPct: centre, ...(x.clairs.length ? { passagesClairs: x.clairs } : {}) },
        ...(x.bruitages.length ? { bruitages: x.bruitages } : {}),
      };
      const outilsMontage: OutilsMontage = { ...outils.montage, recette: RECETTE_COMPOSITION_CAS_CONCRET };
      const idBase = `cc-${x.f.id}-${x.cle.slice(0, 10)}`;
      const enCours = journal.montage?.[x.f.id];
      const depart: EtatMontage = enCours?.empreinte === x.cle ? { [RATIO]: enCours.etat } : {};
      let etat: EtatMontage;
      try {
        etat = await suivi.suivre(
          "montage",
          depart,
          (e) => avancerCompositions(e, commande, [RATIO], base, "complet", idBase, outilsMontage),
          (e) => montageFini(e, [RATIO]),
          async (e) => {
            const en = e[RATIO];
            if (en) journal.montage = { ...journal.montage, [x.f.id]: { empreinte: x.cle, etat: en } };
            await ecrire();
          },
        );
      } catch (err) {
        // X10 : une composition ratée nomme sa fin ; le message du serveur reste en détail technique.
        if (!entreeAbsente(err) && panneDeRendu(err)) throw new ErreurFabricationCasConcret("montage", [`Le montage de la fin pour ${nomsReseaux(x.f.reseaux)} n'a pas abouti.${suiteSansNouvelle(err)}`], raisonDe(err));
        if (!entreeAbsente(err)) throw err;
        // Entrée absente, série épuisée : l'état en cours est oublié, une relance repart d'une demande neuve.
        if (journal.montage?.[x.f.id]) {
          const { [x.f.id]: _oublie, ...reste } = journal.montage;
          void _oublie;
          journal.montage = reste;
          await ecrire();
        }
        throw new ErreurFabricationCasConcret("montage", [ENTREE_INTROUVABLE]);
      }
      const faite = etat[RATIO] as Extract<EtatComposition, { phase: "faite" }>;
      faites.push({ id: x.f.id, sortieCle: faite.sortieCle, ...(faite.masterCle ? { masterCle: faite.masterCle } : {}), vignetteCle: faite.vignetteCle, mesures: faite.mesures ?? {} });
    }
    return faites;
  });

  // 8. Vérification : toujours refaite (elle ne coûte rien).
  const t8 = horloge();
  await panneDEssai("controle");
  const planCale: PlanDesFins = { ...plan, fins: calage.fins.map((cf) => cf.fin as FinPlanifiee) };
  const mesuresParFin: Record<string, MesuresFin> = Object.fromEntries(
    montage.map((m) => {
      const son = voix.fins.find((x) => x.id === m.id)!;
      const fin = son.mots.at(-1)?.finSec;
      return [m.id, { ...m.mesures, ...(fin !== undefined ? { voixFinSec: fin } : {}) }];
    }),
  );
  let rapport: RapportControleCasConcret;
  try {
    rapport = controlerVideoCasConcret({
      fiche: calage.fiche,
      proprietes: brouillon,
      mesuresParFin,
      journalCaptures: captures.journal,
      planDesFins: planCale,
      bruitagesPoses: [...new Set([...bruitagesDe.values()].flat().map((b) => b.elementId))],
      zone: zonePleineImage(),
      finsGardeesMalgreRejet: voix.rapport.finsGardeesMalgreRejet,
    });
  } catch (err) {
    throw new ErreurFabricationCasConcret("controle", [raisonDe(err)]);
  }
  suivi.etapes.push({ etape: "controle", statut: "faite", dureeMs: horloge() - t8 });

  const liens = liensSuivis(reseaux, o.numeroVersion, activiteDuPublic(cas.cible));
  return {
    videoId: o.videoId,
    version: VERSION_FABRICATION_CAS_CONCRET,
    estimation,
    coutCentimes,
    coutVoixCentimes: voix.rapport.coutCentimes,
    prises: voix.payees,
    ...(ecriture ? { ecriture } : {}),
    etapes: suivi.etapes,
    ecrans: { rendus: ecransRepris ? [] : ecrans.rendus, repris: ecransRepris ? [...ecrans.rendus, ...ecrans.repris] : ecrans.repris },
    fiche: ficheMise,
    plan: planCale,
    fins: montage.map((m) => {
      const x = preparees.find((p) => p.f.id === m.id)!;
      return { id: m.id, reseaux: x.f.reseaux, voixCle: x.son.cle, fichierCle: m.sortieCle, ...(m.masterCle ? { masterCle: m.masterCle } : {}), vignetteCle: m.vignetteCle, dureeSec: x.dureeSec, mesures: m.mesures, bruitages: x.bruitages.length, sousTitres: sousTitresDe(x) };
    }),
    liens,
    publication: textesDePublication(calage.fiche, planBrut, liens, entrees.avecMot && entrees.motSur.length ? { mot } : {}),
    journalCaptures: captures.journal,
    voix: { ...voix.rapport, idVoix: v.idVoix, ...(v.fournisseurVoix ? { fournisseur: v.fournisseurVoix } : {}), ...(v.reglages ? { reglages: v.reglages } : {}) },
    rapport,
    pannesDEssai: { ...journal.pannesDEssai },
    bruitagesRetires: [...(ctx.bruitagesRetires ?? [])],
    ...(preparees[0] ? { sousTitres: sousTitresDe(preparees[0]) } : {}),
    // V4-3 : le corps une fois, puis l'écran de chaque fin (le texte dit de cet écran, pour la phrase en double).
    defautsVisuels: [
      ...defautsVisuels(brouillon.corps, Object.fromEntries(calage.fiche.ecrans.map((e) => [e.id, e.texteDit]))),
      ...calage.fins.flatMap((f) => defautsVisuels(brouillon.fins[f.fin.id] ?? [], Object.fromEntries(f.fin.ecrans.map((e) => [e.id, e.texteDit])))),
    ].filter((d, i, tous) => tous.findIndex((x) => x.ecranId === d.ecranId && x.detail === d.detail) === i),
  };
}
