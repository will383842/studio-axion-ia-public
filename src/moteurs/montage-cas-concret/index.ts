/**
 * MOTEUR « CAS CONCRET MD » (tâche M9, plan cas concret § 5) : le contrat commun `MoteurVideo` posé sur la chaîne
 * `fabriquerCasConcret` (fabriquer.ts), sans rien réécrire :
 *   - la chaîne écriture → relecture → vrais écrans → voix → calage → écrans → finitions → vérification est PILOTÉE PAS À
 *     PAS : chaque `avancer` la relance sur son journal de reprise (gardé dans le travail) et l'arrête dès qu'une étape
 *     vient d'être faite ou qu'il faut attendre un fournisseur (jamais d'attente longue) ;
 *   - une voix payée n'est jamais relue, un écran déposé jamais rendu de nouveau (empreintes de la chaîne) ;
 *   - « Réessayer » ne refait que l'étape en échec : tout ce qui est fait reste dans le journal ; les rendus restés en
 *     cours ou ratés repartent sous un autre identifiant (`relancerRendusCasConcret`), sinon la reprise relirait le même
 *     échec ou attendrait le même rendu figé (X10) ;
 *   - un échec l'emporte toujours sur « déjà fait » (X10, incident du tableau animé du 12/10) : une étape déjà passée
 *     pendant ce travail, à refaire puis ratée, est montrée en échec ; le travail ne reste jamais « en cours » sans étape
 *     qui avance.
 * Où vivent les choses : la vidéo porte `entrees.casConcret` (recopié dans la commande), le journal de la chaîne est dans
 * `travail.parametres.casConcret`, puis dans le projet de montage de la version (`projetMontage.casConcret`).
 *
 * Les outils réels (voix désignée, stockage, `studio-rendu`, captures, Claude, budget) sont fournis par les SERVICES
 * (`brancherServicesCasConcret`) ou injectés (tests) : ce moteur n'importe aucun fournisseur, aucun service et aucun
 * autre moteur. L'estimation est en montants réels : l'écriture au pire (deux appels, sortie maximale), la voix au
 * caractère (corps estimé + fins des réseaux cochés) au tarif de la brique « Voix ».
 *
 * Retouche par opérations (P2-02, `retouches.ts`) : `retoucher` applique la liste fermée d'opérations à la fiche gardée
 * par la version d'avant, la revalide (R01 à R22) et refuse AVANT de rien lancer ; acceptée, la chaîne repart de cette
 * fiche (l'écriture est sautée) avec les prises de voix déjà payées : seules les prises dont le texte change sont relues,
 * seuls les écrans dont l'empreinte change sont rendus (clé par empreinte), et la mise de variété (L2/L6/L7) de la
 * version d'avant est gardée avec la fiche (jamais re-tirée). `estimerRetoucheCasConcret` donne l'aperçu et son coût ;
 * `estimerRetouche` (sans les opérations) réserve au pire « au plus » : la voix entière, jamais l'écriture.
 * Réglage `casConcret.retouches` (éteint par défaut) : tant que `retouchesAllumees()` rend faux, le moteur refuse toute
 * retouche comme avant (`refusRetouche`, `retoucher`), donc `retouchable()` reste faux et « Demander une modification »
 * garde la réponse commune.
 *
 * Version 2 (refus lisible aujourd'hui) : retouche libre (sans opérations), réexport, correction des sous-titres seule,
 * maquette.
 */
import type { EntreeRole } from "@/generateur/roles/types";
import { briqueVoix } from "@/briques";
import { lecturesVoixMax, ressemblanceDeLaCommande } from "@/briques/voix-maitre/reference";
import { VoixNonEpingleeError } from "@/briques/voix-maitre";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins";
import { substituerPrononciations } from "@/domaine/prononciations";
import type { AlerteQualite, CommandeFabrication, EtapeTravail, ErreurTravail, LigneCout, Travail } from "@/domaine/types";
import { TEMPO_VOIX, type ReseauCas } from "@/formats/cas-concret";
import { verifierCas, type CasConcret } from "@/formats/cas-concret/cas";
import { trouverCas } from "@/formats/cas-concret/catalogue";
import { refusAvantPrix } from "./avant-prix";
import { retenirCasPourSimulation } from "./cas-simules";
import { recettePour } from "@/formats/cas-concret/recette";
import { centimes, formaterMontant, TAUX_USD_EUR_PAR_DEFAUT, usdVersEur, ZERO } from "@/lib/montants";
import { APPELS_ECRITURE_MAX, contexteDuSocle, coutEstimeUsd, DEBUT_REFUS_ECRITURE, dureesDesFins, ficheParGabarit, MAX_TOKENS_ECRITURE, roleEcritureCasConcret, variableEcriture } from "./ecriture";
import { etapesCasConcret, lireEntreesCasConcret, regrouperFins, type EntreesCasConcret } from "./etapes";
import { empreinte, ErreurFabricationCasConcret, fabriquerCasConcret, marquerRepriseEcriture, MOTEUR_CAS_CONCRET, relancerRendusCasConcret, VERSION_FABRICATION_CAS_CONCRET, type CompteRenduCasConcret, type JournalCasConcret } from "./fabriquer";
import { texteDuCorps, validerSchemaFiche, type FicheEcrans } from "./fiche";
import { planDesFins } from "./fins";
import { LECTURES_CORPS_MAX, LECTURES_FIN_MAX } from "./voix";
import { ETAPES_CAS_CONCRET, type ContexteFabricationCasConcret, type EtapeCasConcret, type OutilsFabricationCasConcret } from "./outils";
import { apercuRetoucheCasConcret, estOperationRetoucheCasConcret, lireOperationRetoucheCasConcret, texteDeFin, type ApercuRetoucheCasConcret, type ContexteRetoucheCasConcret, type ReglagesFins } from "./retouches";
import { reglagesRecette } from "./recette-voix";
import { empreintePriseVoix, type EtatVoixCasConcret } from "./voix";
import { STRUCTURES } from "./variete";
import { CODE_SCRIPT_A_VALIDER, idSegmentEcran, lireScriptValide, PHRASE_SCRIPT_A_VALIDER, problemesScriptValide, scriptValideDuCatalogue, type ScriptValide } from "./script-valide";

/* Contrat commun des moteurs (TYPES seulement, `src/moteurs/types.ts`), lu par `import()` de type, comme le patron. */
type MoteurVideo = import("@/moteurs/types").MoteurVideo;
type ContexteLancement = import("@/moteurs/types").ContexteLancement;
type DefinitionEtapeMoteur = import("@/moteurs/types").DefinitionEtapeMoteur;
type Estimation = import("@/moteurs/types").Estimation;
type ResultatFabrication = import("@/moteurs/types").ResultatFabrication;
type PlanProduit = import("@/moteurs/types").PlanProduit;
type ParentRetouche = import("@/moteurs/types").ParentRetouche;

export { ENTREE_CAS_CONCRET, etapesCasConcret, lireEntreesCasConcret, type EntreesCasConcret } from "./etapes";
export { estRenduEnCours, RenduEnCours } from "./fabriquer";
export { apercuRetoucheCasConcret, CATALOGUE_RETOUCHES_CAS_CONCRET, lireOperationRetoucheCasConcret, type ApercuRetoucheCasConcret, type OperationRetoucheCasConcret } from "./retouches";

export const ID_MOTEUR_CAS_CONCRET = MOTEUR_CAS_CONCRET;

/* ------------------------------------------------------------------ */
/* Outils fournis par les services (ou les tests)                        */
/* ------------------------------------------------------------------ */

/** Ce que la chaîne reçoit pour une commande ; le moteur pose lui-même le journal, l'attente et les réseaux cochés. */
export interface OutilsCasConcret extends Omit<OutilsFabricationCasConcret<JournalCasConcret>, "journal" | "contexte"> {
  /** Environnement des clés (`dev`, `prod`). */
  env: string;
  /** Contexte de la chaîne ; les réseaux sont ceux de la commande (`entrees.casConcret.reseaux`). */
  contexte: Omit<ContexteFabricationCasConcret, "reseaux">;
  /** Lit la fiche d'écrans fournie (JSON brut) rangée sous cette clé ; absente : aucune fiche ne peut être fournie. */
  lireFiche?: (cle: string) => Promise<unknown>;
  /** Le cas de la vidéo (porte B, phase 2) ; absent : celui du catalogue désigné par `entrees.casConcret.casId`. */
  cas?: CasConcret;
  /** Numéro de la version fabriquée (code de version des liens suivis, X4) ; absent : liens sans `utm_content`. */
  numeroVersion?: (versionId: string) => Promise<number | undefined>;
  /**
   * V4-3 : le script validé d'un cas (gardé par les services, sinon celui du catalogue) ; `null` : aucun, l'écriture
   * a lieu. Absent : celui du catalogue.
   */
  scriptValide?: (casId: string) => Promise<ScriptValide | null>;
  /**
   * LOT F · la dernière version validée qui vient de CETTE vidéo (« Valider ce script » de son script écrit) ; `null` :
   * aucune. Lu seulement pour une vidéo « Nouveau script » ; absent : aucune.
   */
  scriptValideDeLaVideo?: (casId: string, videoId: string) => Promise<ScriptValide | null>;
  /**
   * 18/10 · mémoire anti-copie : le texte dit de tous les scripts déjà écrits ou validés du format (hors la vidéo qui
   * s'écrit), lu seulement quand Claude écrit. Absent ou illisible : aucune mémoire (comme avant), l'écriture n'échoue pas.
   */
  scriptsAnterieurs?: (casId: string, videoId: string) => Promise<readonly string[]>;
}

/**
 * Fabrique des outils réels d'une commande ; `null` : pas reliés (aucun lancement réel possible). `relance` : nombre de
 * « Réessayer » de ce travail (X10) ; les rendus relus sans état gardé (captures, voix) changent alors d'identifiant.
 */
export type FabriqueOutilsCasConcret = (commande: CommandeFabrication, travailId: string, options?: { relance: number }) => Promise<OutilsCasConcret | null>;

/** Raccords posés par les services, comme `brancherServicesTableau`. */
export interface ServicesCasConcret {
  outils?: FabriqueOutilsCasConcret;
  /** Dernière valeur connue du réglage `casConcret.retouches` (les services la relisent avant chaque chemin de retouche). */
  retouchesAllumees?: () => boolean;
}

const cleServices = Symbol.for("studio-axion-ia.cas-concret-services");
type AvecServices = typeof globalThis & { [cleServices]?: ServicesCasConcret };

export function brancherServicesCasConcret(s: ServicesCasConcret): void {
  (globalThis as AvecServices)[cleServices] = { ...((globalThis as AvecServices)[cleServices] ?? {}), ...s };
}

export function servicesCasConcret(): ServicesCasConcret {
  return (globalThis as AvecServices)[cleServices] ?? {};
}

export interface DependancesMoteurCasConcret {
  /** Outils injectés (tests) ; absents : ceux des services. */
  outils?: FabriqueOutilsCasConcret;
  /**
   * Réglage `casConcret.retouches` lu par l'appelant (synchrone). Absent ou faux : le moteur refuse toute retouche, comme
   * avant le portage. Rien dans le code ne le rend vrai ; Will allume le réglage lui-même.
   */
  retouchesAllumees?: () => boolean;
}

/* ------------------------------------------------------------------ */
/* État gardé dans le travail                                            */
/* ------------------------------------------------------------------ */

interface EtatCasConcret {
  journal: JournalCasConcret | null;
  /** Rang (dans `ETAPES_CAS_CONCRET`) de la dernière étape de la chaîne passée pendant CE travail ; -1 : aucune. */
  atteinte: number;
  /** Retouche par opérations : la fiche retouchée (l'écriture est sautée), les réglages des fins et les prises d'avant. */
  retouche?: RetoucheEnCours;
}

interface RetoucheEnCours {
  fiche: FicheEcrans;
  reglages: ReglagesFins;
  /** Prises de voix de la version d'avant (déjà payées), reprises quand leur empreinte est la même. */
  prisesAvant?: PrisesVoix;
  /** Ce que la retouche relit (payé) : sa réservation, donc le plafond de sa voix, d'un « Réessayer » à l'autre. */
  aRelire?: ARelire;
}

/** Prises de voix faites, gardées dans le projet de montage (`prisesVoix`) pour qu'une retouche les reprenne. */
type PrisesVoix = Pick<EtatVoixCasConcret, "corps" | "fins">;

function lireEtat(travail: Travail): EtatCasConcret {
  const e = travail.parametres?.casConcret as EtatCasConcret | undefined;
  return e && typeof e === "object" ? e : { journal: null, atteinte: -1 };
}

function avecEtat(travail: Travail, etat: EtatCasConcret): Travail {
  return { ...travail, parametres: { ...travail.parametres, casConcret: etat } };
}

/** Journal sans les états en cours (captures, voix, écrans, compositions) : seules les étapes faites passent à la version. */
function journalAGarder(j: JournalCasConcret | null): JournalCasConcret | null {
  return j ? { version: j.version, etapes: j.etapes } : null;
}

/* ------------------------------------------------------------------ */
/* Estimation (montants réels)                                           */
/* ------------------------------------------------------------------ */

function ligne(etape: string, fournisseur: string, unite: LigneCout["unite"], quantite: number, nature: LigneCout["nature"], total = ZERO, prixUnitaire = ZERO): LigneCout {
  return { etape, fournisseur, unite, quantite, prixUnitaire, total, nature };
}

function estimation(lignes: LigneCout[], dureeFabricationSec: number): Estimation {
  return { dureeFabricationSec, lignes, total: { centimes: lignes.reduce((s, l) => s + l.total.centimes, 0), devise: "EUR" } };
}

const FIXE_ESSAI = { videoId: "estimation", versionId: "estimation", habillage: "charte-duo/1", origine: "porte-a" as const };

/** Ce qu'il faut savoir pour estimer : le cas (s'il est connu), les fins, l'écriture, la voix. */
interface DemandeEstimation {
  cas?: CasConcret;
  reseaux: readonly ReseauCas[];
  avecMot: boolean;
  /** Réseaux où le mot est branché (X6). */
  motSur?: readonly ReseauCas[];
  mot?: string;
  motDit?: string;
  /** L'écriture est faite (une fiche est fournie : elle est sautée). */
  ecriture: boolean;
  /** LOT F · « Nouveau script » : le script validé du catalogue n'est pas rejoué, l'écriture et le texte du gabarit sont comptés. */
  nouveauScript?: boolean;
  /**
   * PRIX EXACT · le script validé relu, figé dans la vidéo : plus de ligne « Écriture », voix estimée sur SON texte. Ignoré s'il ne
   * convient plus au cas (autre cas, autre version) : le prix est alors celui d'avant (la fabrication s'arrêtera avant la voix).
   */
  scriptFige?: ScriptValide;
  /** Voix désignée (absente : aucune voix). */
  voix: { fournisseur?: string } | null;
  /** Texte du corps quand le cas ne le donne pas (fiche fournie, script de la vidéo). */
  texteCorps?: string;
  tauxUsdEur: number;
  /** 14/10 : lectures payées au plus par texte (contrôle de ressemblance à la voix de référence) ; absent : 1. */
  lecturesVoixMax?: number;
  /** Retouche sans opération connue : seul le corps est compté (aucune fin). */
  sansFins?: boolean;
  /** Socle de Will donné à l'écriture (compté dans son prix pire cas) ; absent : aucun. */
  socle?: EntreeRole["contexte"];
}

/** V4-3 : le script validé du catalogue pour ce cas (l'estimation n'a pas les outils des services). */
const scriptDuCas = (cas: CasConcret | undefined): ScriptValide | undefined => (cas ? scriptValideDuCatalogue(cas.id) : undefined);

/** Écriture au pire : `APPELS_ECRITURE_MAX` appels, chacun avec la réponse précédente en entrée et la sortie maximale. */
function coutEcritureCentimes(cas: CasConcret, fins: Parameters<typeof variableEcriture>[3], taux: number, socle?: EntreeRole["contexte"]): number {
  const variable = variableEcriture(cas, recettePour(cas), FIXE_ESSAI, fins);
  const usd = coutEstimeUsd(roleEcritureCasConcret, { contexte: contexteDuSocle(socle), variable: `${variable}\n${" ".repeat(MAX_TOKENS_ECRITURE * 3)}` });
  return Math.ceil(usdVersEur(usd * 100 * APPELS_ECRITURE_MAX, taux).centimes - 1e-9);
}

/** Commande minimale pour estimer UNE lecture par la brique « Voix » (tarif de la voix désignée, au taux figé). */
const pseudoVoix = (fournisseur: string | undefined, texteComplet: string, tauxUsdEur: number) => ({ distribution: [{ fournisseurVoix: fournisseur }], script: { texteComplet }, tauxUsdEur }) as unknown as CommandeFabrication;

/** Prix estimé d'UNE lecture de ce texte (centimes, arrondi supérieur) : la mesure du plafond avant chaque lecture. */
const prixLectureEstime = (fournisseur: string | undefined, texte: string, tauxUsdEur: number): number => briqueVoix.estimer(pseudoVoix(fournisseur, texte, tauxUsdEur))[0]?.total.centimes ?? 0;

/**
 * Voix au PIRE d'un corps et de fins à lire (mêmes lectures maximales que la vidéo) : une ligne, ou aucune si rien n'est à
 * lire ou si la voix n'a pas de tarif. Sert à la vidéo entière comme à une retouche (seuls les textes relus).
 */
function ligneVoixPireCas(fournisseur: string | undefined, corps: string | undefined, fins: readonly string[], tauxUsdEur: number, lecturesVoixMax?: number): LigneCout[] {
  const k = Math.max(1, Math.floor(lecturesVoixMax ?? 1));
  const lectures = [...(corps ? [{ texte: corps, fois: LECTURES_CORPS_MAX * k }] : []), ...fins.filter(Boolean).map((texte) => ({ texte, fois: LECTURES_FIN_MAX * k }))];
  const parTexte = lectures.map((x) => ({ ...x, ligne: briqueVoix.estimer(pseudoVoix(fournisseur, x.texte, tauxUsdEur))[0] })).filter((x) => x.ligne);
  if (!parTexte.length) return [];
  const modele = parTexte[0].ligne;
  return [{ ...modele, quantite: parTexte.reduce((n, x) => n + x.ligne.quantite * x.fois, 0), total: centimes(parTexte.reduce((n, x) => n + x.ligne.total.centimes * x.fois, 0)) }];
}

function lignesEstimees(d: DemandeEstimation): LigneCout[] {
  const l: LigneCout[] = [];
  const offre = d.cas?.offre;
  const mot = d.mot ?? d.cas?.mot ?? "";
  const motDit = d.motDit ?? d.cas?.motDit;
  const plan = offre ? regrouperFins(planDesFins({ reseaux: [...d.reseaux], offre, ...(d.cas?.nature ? { nature: d.cas.nature } : {}), mot, ...(motDit ? { motDit } : {}), avecMot: d.avecMot, ...(d.motSur ? { motSur: d.motSur } : {}), table: TABLE_FINS_DIAGNOSTIC })) : null;
  // V4-3 : un cas à script validé ne paie aucune écriture ; sa voix est estimée sur le texte du script.
  const figeUtilisable = d.scriptFige && d.cas && !problemesScriptValide(d.scriptFige, d.cas).length ? d.scriptFige : undefined;
  const script = d.ecriture && !d.nouveauScript ? (figeUtilisable ?? scriptDuCas(d.cas)) : undefined;
  if (d.ecriture && d.cas && !script) l.push(ligne("Écriture", "claude", "appel", APPELS_ECRITURE_MAX, "estime", centimes(coutEcritureCentimes(d.cas, plan?.fins ?? [], d.tauxUsdEur, d.socle))));
  if (d.voix) {
    const corps = script ? script.ecrans.map((e) => e.texteDit.trim()).join(" ") : d.cas && d.ecriture ? texteDuCorps(ficheParGabarit(d.cas, FIXE_ESSAI, dureesDesFins(plan?.fins ?? []))) : (d.texteCorps ?? "");
    const fins = d.sansFins ? [] : (plan?.fins ?? []).map((f) => f.ecrans.map((e) => e.texteDit.trim()).join(" "));
    // 17/10 (essai réel v-99d2f6353f41 : 0,56 € annoncés « au plus », 1,05 € payés) : le prix annoncé est le PIRE cas de
    // la chaîne. Le corps est lu jusqu'à `LECTURES_CORPS_MAX` fois et chaque fin `LECTURES_FIN_MAX` fois (contrôle des
    // mots et des blancs), et CHACUNE de ces lectures peut être relancée par la ressemblance (`lecturesVoixMax`) ;
    // chaque lecture est arrondie au centime supérieur, comme celle que le fournisseur facture.
    l.push(...ligneVoixPireCas(d.voix.fournisseur, corps, fins, d.tauxUsdEur, d.lecturesVoixMax));
  }
  l.push(ligne("Montage cas concret", "studio", "forfait", 1, "estime"));
  return l;
}

function dureeDe(entrees: Pick<EntreesCasConcret, "reseaux" | "ficheCle">): number {
  return etapesCasConcret({ entrees: { casConcret: entrees } }).reduce((t, e) => t + e.dureeEstimeeSec, 0);
}

/**
 * Le cas d'une vidéo, lu dans ses entrées : porte B (P2S), le cas construit depuis la description et gardé avec la vidéo
 * (jamais au catalogue) ; porte A, celui du catalogue désigné par `casId`. Illisible ou absent : `undefined`.
 */
export function casDesEntrees(e: Pick<EntreesCasConcret, "porte" | "casId" | "cas">): CasConcret | undefined {
  if (e.porte === "porte-b" && e.cas !== undefined) {
    const lu = verifierCas(e.cas);
    if (!lu.ok) return undefined;
    // L'écriture simulée retrouve un cas par son identifiant : celui-ci n'est pas au catalogue.
    retenirCasPourSimulation(lu.cas);
    return lu.cas;
  }
  return e.casId ? trouverCas(e.casId) : undefined;
}

/** Le cas d'une commande : celui des outils, sinon celui de ses entrées (porte B), sinon celui du catalogue. */
const casDe = (commande: Pick<CommandeFabrication, "entrees">, outils?: Pick<OutilsCasConcret, "cas"> | null): CasConcret | undefined => {
  if (outils?.cas) return outils.cas;
  return casDesEntrees(lireEntreesCasConcret(commande.entrees));
};

/**
 * Estimation d'un cas avant toute commande (écran du format) : même calcul que `estimer`. `voix` : le fournisseur de la
 * voix désignée (absent : tarif de la simulation) ; `null` : sans voix.
 */
export function estimerDepuisCas(cas: CasConcret, reseaux: readonly ReseauCas[], avecMot: boolean, options: { voix?: { fournisseur?: string } | null; tauxUsdEur?: number; motSur?: readonly ReseauCas[]; lecturesVoixMax?: number; socle?: EntreeRole["contexte"]; nouveauScript?: boolean; script?: ScriptValide | null } = {}): Estimation {
  const lignes = lignesEstimees({ cas, reseaux, avecMot, ...(options.nouveauScript ? { nouveauScript: true } : {}), ...(options.script && !options.nouveauScript ? { scriptFige: options.script } : {}),...(options.motSur ? { motSur: options.motSur } : {}), ecriture: true, voix: options.voix === undefined ? {} : options.voix, tauxUsdEur: options.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT, ...(options.lecturesVoixMax ? { lecturesVoixMax: options.lecturesVoixMax } : {}), ...(options.socle ? { socle: options.socle } : {}) });
  return estimation(lignes, dureeDe({ reseaux: [...reseaux] }));
}

function demandeDe(commande: CommandeFabrication): DemandeEstimation {
  const e = lireEntreesCasConcret(commande.entrees);
  const cas = casDe(commande);
  return {
    ...(cas ? { cas } : {}),
    reseaux: e.reseaux,
    avecMot: e.avecMot,
    motSur: e.motSur,
    ...(e.mot ? { mot: e.mot } : {}),
    ...(e.motDit ? { motDit: e.motDit } : {}),
    ecriture: !e.ficheCle,
    ...(e.nouveauScript !== undefined ? { nouveauScript: true } : {}),
    // Le script relu au lancement (jamais pour « Nouveau script » ni pour une fiche fournie) : prix et plafond de voix sur SON texte.
    ...(e.nouveauScript === undefined && !e.ficheCle && lireScriptValide(e.scriptFige) ? { scriptFige: lireScriptValide(e.scriptFige)! } : {}),
    voix: commande.distribution.length ? { ...(commande.distribution[0].fournisseurVoix ? { fournisseur: commande.distribution[0].fournisseurVoix } : {}) } : null,
    texteCorps: commande.script.texteComplet ?? "",
    tauxUsdEur: commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT,
    lecturesVoixMax: lecturesVoixMax(ressemblanceDeLaCommande(commande.entrees)),
  };
}

function estimerCommande(commande: CommandeFabrication): Estimation {
  return estimation(lignesEstimees(demandeDe(commande)), dureeDe(lireEntreesCasConcret(commande.entrees)));
}

/** Ce qu'une retouche relit (payé) : le corps (s'il change) et les fins qui changent. */
interface ARelire {
  corps?: string;
  fins: string[];
}

/**
 * Réservation d'une retouche dont on ne connaît pas les opérations (la retouche libre est refusée : rien ne sera payé) :
 * le corps relu au pire, jamais les fins ni l'écriture. C'est la retouche d'une phrase, la plus courante.
 */
function lignesRetoucheSansOperation(commande: CommandeFabrication): LigneCout[] {
  const d = demandeDe(commande);
  return lignesEstimees({ ...d, ecriture: !!d.cas, sansFins: true }).filter((l) => l.etape !== "Écriture");
}

/** Réservation d'une retouche (`estimerRetouche`) : la voix au pire des SEULS textes relus, plus le montage ; jamais l'écriture. */
function lignesRetouche(commande: CommandeFabrication, aRelire: ARelire): LigneCout[] {
  const voix = commande.distribution.length ? ligneVoixPireCas(commande.distribution[0].fournisseurVoix, aRelire.corps, aRelire.fins, commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT, lecturesVoixMax(ressemblanceDeLaCommande(commande.entrees))) : [];
  return [...voix, ligne("Montage cas concret", "studio", "forfait", 1, "estime")];
}

const aRelireDe = (a: ApercuRetoucheCasConcret): ARelire => (a.ok ? { ...(a.corpsRelu ? { corps: a.textesARelire[0] } : {}), fins: a.textesARelire.slice(a.corpsRelu ? 1 : 0) } : { fins: [] });

/* ------------------------------------------------------------------ */
/* Retouche par opérations (P2-02)                                       */
/* ------------------------------------------------------------------ */

export const RETOUCHE_REFUSEE = "CAS_CONCRET_RETOUCHE_REFUSEE";

/** Étapes d'une retouche : celles d'une fiche fournie (l'écriture est sautée). */
function etapesRetouche(commande: CommandeFabrication): DefinitionEtapeMoteur[] {
  const brut = (commande.entrees as Record<string, unknown> | undefined)?.casConcret;
  return etapesCasConcret({ entrees: { casConcret: { ...(brut && typeof brut === "object" ? brut : {}), ficheCle: "retouche" } } });
}

/** Une opération hors liste (ou mal formée) refuse la retouche avant tout. */
export function refusOperationsCasConcret(operations: readonly unknown[]): { code: string; message: string } | null {
  const fautive = operations.find((op) => !lireOperationRetoucheCasConcret(op));
  if (fautive === undefined) return null;
  const type = (fautive as { type?: unknown } | null)?.type;
  return { code: RETOUCHE_REFUSEE, message: estOperationRetoucheCasConcret(type) ? "Cette retouche est incomplète : choisissez de nouveau l'écran et la valeur à changer." : "Cette retouche ne fait pas partie de la liste proposée." };
}

/** Ce que la version d'avant garde dans son projet de montage (`projetMontage.casConcret`). */
function projetGarde(projetMontage: Record<string, unknown> | undefined): { fiche?: unknown; reglages?: Partial<ReglagesFins>; prisesVoix?: PrisesVoix } {
  const p = projetMontage?.casConcret as Record<string, unknown> | undefined;
  if (!p || typeof p !== "object") return {};
  const texte = (v: unknown) => (typeof v === "string" && v.trim() ? v : undefined);
  const mot = texte(p.mot);
  const motDit = texte(p.motDit);
  return {
    fiche: p.fiche,
    ...(typeof p.avecMot === "boolean" ? { reglages: { ...(mot ? { mot } : {}), ...(motDit ? { motDit } : {}), avecMot: p.avecMot } } : {}),
    ...(p.prisesVoix && typeof p.prisesVoix === "object" ? { prisesVoix: p.prisesVoix as PrisesVoix } : {}),
  };
}

/**
 * Ce que l'aperçu lit des outils : le cas, la table des fins, les interdits et, s'ils sont donnés, ceux de la voix (une
 * prise n'est tenue pour gardée que si son empreinte est celle de la voix d'aujourd'hui ; sans eux, elle l'est sur son texte).
 */
type OutilsApercu = Pick<OutilsCasConcret, "cas" | "contexte"> & Partial<Pick<OutilsCasConcret, "voix">>;

/** Une retouche préparée : l'aperçu (refusé ou non) et, acceptée, ce que le travail emporte. */
type RetouchePreparee = { refus: { code: string; message: string } } | { apercu: ApercuRetoucheCasConcret; retouche?: RetoucheEnCours };

/** Prépare une retouche : fiche gardée, réglages des fins, prises déjà lues, puis l'aperçu (pur). Ne lance rien. */
function preparerRetouche(commande: CommandeFabrication, operations: readonly unknown[], parent: Pick<ParentRetouche, "projetMontage"> | undefined, outils: OutilsApercu | null): RetouchePreparee {
  const refus = refusOperationsCasConcret(operations);
  if (refus) return { refus };
  const cas = casDe(commande, outils);
  if (!cas) return { refus: { code: "CAS_CONCRET_SANS_CAS", message: "Le cas de cette vidéo est introuvable : la retouche n'est pas possible." } };
  const garde = projetGarde(parent?.projetMontage);
  const forme = garde.fiche === undefined ? null : validerSchemaFiche(garde.fiche);
  if (!forme) return { refus: { code: RETOUCHE_REFUSEE, message: "La fiche d'écrans de cette vidéo est introuvable : la retouche n'est pas possible." } };
  if (!forme.ok || forme.fiche.casId !== cas.id) return { refus: { code: RETOUCHE_REFUSEE, message: "La fiche d'écrans de cette vidéo est illisible : la retouche n'est pas possible." } };
  const entrees = lireEntreesCasConcret(commande.entrees);
  // Réglages des fins de la version d'avant (ceux qu'elle a dits), sinon ceux de la commande ; puis, comme la chaîne,
  // ceux du cas.
  const r = garde.reglages ?? entrees;
  const mot = r.mot ?? cas.mot;
  const motDit = r.motDit ?? cas.motDit;
  const pr = commande.prononciations.map((p) => ({ mot: p.mot, prononciation: p.prononciation }));
  const p = garde.prisesVoix;
  const v = outils?.voix;
  const contexte: ContexteRetoucheCasConcret = {
    cas,
    reseaux: entrees.reseaux,
    motSur: entrees.motSur,
    mot,
    ...(motDit ? { motDit } : {}),
    avecMot: r.avecMot ?? entrees.avecMot,
    table: outils?.contexte.tableDesFins ?? TABLE_FINS_DIAGNOSTIC,
    motsInterdits: [...(outils?.contexte.interdits ?? [])],
    ...(pr.length ? { lire: (t: string) => substituerPrononciations(t, pr) } : {}),
    // Prises gardées : leurs textes (prononciations substituées) ; aucune : tout est relu.
    voixGardee: p ? { ...(p.corps.retenu && (!v || priseReprise(p.corps.texte, p.corps.prise, v)) ? { corps: p.corps.texte } : {}), fins: p.fins.filter((f) => (v ? priseReprise(f.texte, f.prise, v) : f.prise?.controle)).map((f) => f.texte) } : null,
  };
  const apercu = apercuRetoucheCasConcret(forme.fiche, [...operations], contexte);
  return apercu.ok ? { apercu, retouche: { fiche: apercu.fiche, reglages: apercu.reglages, aRelire: aRelireDe(apercu), ...(p ? { prisesAvant: p } : {}) } } : { apercu };
}

function estimationRetouche(commande: CommandeFabrication, apercu: ApercuRetoucheCasConcret): Estimation {
  return estimation(lignesRetouche(commande, aRelireDe(apercu)), etapesRetouche(commande).reduce((t, e) => t + e.dureeEstimeeSec, 0));
}

/**
 * Aperçu d'une retouche par opérations AVANT de la lancer (écran du format) : ce qui change, ce qui est relu et refait,
 * et le coût, au même calcul que la voix de la vidéo. Refusée : `apercu.ok` faux, ses raisons, coût nul. Ne lance rien.
 * `outils` : le cas fourni (porte B), la table des fins et les interdits ; absents : ceux du catalogue.
 */
export function estimerRetoucheCasConcret(commande: CommandeFabrication, operations: readonly unknown[], parent: Pick<ParentRetouche, "projetMontage"> | undefined, outils: OutilsApercu | null = null): { apercu: ApercuRetoucheCasConcret | null; refus: string | null; estimation: Estimation } {
  const p = preparerRetouche(commande, operations, parent, outils);
  if ("refus" in p) return { apercu: null, refus: p.refus.message, estimation: estimation([], 0) };
  return { apercu: p.apercu, refus: p.apercu.ok ? null : p.apercu.refus.join(" "), estimation: p.apercu.ok ? estimationRetouche(commande, p.apercu) : estimation([], 0) };
}

/* ------------------------------------------------------------------ */
/* Travaux                                                               */
/* ------------------------------------------------------------------ */

function nouveauTravail(defs: DefinitionEtapeMoteur[], ctx: ContexteLancement, commande: CommandeFabrication, etat: EtatCasConcret): Travail {
  const maintenant = ctx.maintenant ?? Date.now();
  const iso = new Date(maintenant).toISOString();
  const type = ctx.type ?? "fabrication";
  return {
    id: ctx.travailId,
    type,
    cibleId: commande.videoId,
    versionId: ctx.versionId,
    titre: ctx.titre,
    etapes: defs.map((d) => ({ cle: d.cle, nom: d.nom, icone: d.icone, dependDe: d.dependDe, statut: "en_attente" as const, progression: 0, sortieFichierIds: [] })),
    statut: "en_file",
    progression: 0,
    tentatives: 1,
    cleIdempotence: `${commande.videoId}:${ctx.versionId}:${type}`,
    fournisseurUtilise: ID_MOTEUR_CAS_CONCRET,
    creeLe: iso,
    modifieLe: iso,
    debuteLe: iso,
    finEstimee: new Date(maintenant + defs.reduce((s, d) => s + d.dureeEstimeeSec, 0) * 1000).toISOString(),
    parametres: { casConcret: etat },
  };
}

/** Travail refusé d'emblée (ce qui viendra en version 2) : message lisible, rien à refaire. */
function travailRefuse(ctx: ContexteLancement, commande: CommandeFabrication, code: string, message: string): Travail {
  const t = nouveauTravail(etapesCasConcret(commande), ctx, commande, { journal: null, atteinte: -1 });
  const erreur: ErreurTravail = { code, reessayable: false, messagePourWill: message };
  return { ...t, statut: "echec", erreur, termineLe: t.creeLe, etapes: t.etapes.map((e) => ({ ...e, statut: "ignoree" as const })) };
}

const etapeFaite = (cle: string, etat: EtatCasConcret) => {
  const i = ETAPES_CAS_CONCRET.indexOf(cle as EtapeCasConcret);
  return i >= 0 && i <= etat.atteinte;
};

/** Statuts des étapes d'après l'état ; `echec` : l'étape en échec et son erreur. */
function statuts(travail: Travail, etat: EtatCasConcret, echec?: { cle: string; erreur: ErreurTravail }): EtapeTravail[] {
  const etapes = travail.etapes.map((e): EtapeTravail => {
    if (e.statut === "ignoree") return { ...e };
    // X10 : l'échec d'abord. Une étape déjà passée pendant ce travail, puis refaite (entrées changées) et ratée, restait
    // « terminée » : aucune étape en échec, le travail « en cours » sans fin, la chaîne retombant à chaque tour sur le même
    // échec (incident du tableau animé du 12/10).
    if (echec && e.cle === echec.cle) return { ...e, statut: "echec", progression: 0, coutReel: undefined, erreur: echec.erreur };
    if (etapeFaite(e.cle, etat)) return { ...e, statut: "terminee", progression: 100, coutReel: e.cle === "voix" ? centimes(coutVoixDe(etat)) : ZERO, erreur: undefined };
    return { ...e, statut: "en_attente", progression: 0, coutReel: undefined, erreur: undefined };
  });
  if (!echec) {
    const prete = etapes.find((e) => e.statut === "en_attente" && e.dependDe.every((d) => etapes.find((x) => x.cle === d)?.statut === "terminee"));
    if (prete) Object.assign(prete, { statut: "en_cours", progression: 10 });
  }
  return etapes;
}

function suivant(travail: Travail, etat: EtatCasConcret, etapes: EtapeTravail[], maintenant: number): Travail {
  const enEchec = etapes.find((e) => e.statut === "echec");
  const fini = etapes.every((e) => e.statut === "terminee" || e.statut === "ignoree");
  const iso = new Date(maintenant).toISOString();
  return {
    ...avecEtat(travail, etat),
    etapes,
    progression: fini ? 100 : Math.round(etapes.reduce((t, e) => t + e.progression, 0) / Math.max(etapes.length, 1)),
    statut: enEchec ? "echec" : fini ? "termine" : "en_cours",
    erreur: enEchec?.erreur,
    modifieLe: iso,
    termineLe: fini || enEchec ? iso : undefined,
  };
}

/** Échec d'une étape (la première non faite si aucune n'est désignée). */
function enEchec(travail: Travail, etat: EtatCasConcret, cle: string | undefined, erreur: ErreurTravail, maintenant: number): Travail {
  const cible = cle && travail.etapes.some((e) => e.cle === cle) ? cle : (travail.etapes.find((e) => e.statut !== "ignoree" && !etapeFaite(e.cle, etat))?.cle ?? travail.etapes[0]?.cle);
  return suivant(travail, etat, statuts(travail, etat, cible ? { cle: cible, erreur } : undefined), maintenant);
}

/* ------------------------------------------------------------------ */
/* Un tour de la chaîne                                                  */
/* ------------------------------------------------------------------ */

/** Étapes dont l'échec ne se réessaie pas tel quel (la même entrée donnerait le même refus) : la main revient à Will, l'écran propose « Reprendre le cas ». */
export const NON_REESSAYABLES: ReadonlySet<EtapeCasConcret> = new Set(["fiche", "calage"]);
const MARQUE_PAUSE = "cas-concret:pause";

type Issue = { type: "pause" } | { type: "fini"; compteRendu: CompteRenduCasConcret } | { type: "echec"; cle: string; erreur: ErreurTravail };

const raisonDe = (err: unknown) => (err instanceof Error ? err.message : String(err));

/** En-tête de la réponse brute dans le détail technique d'une écriture refusée (X9). */
export const ENTETE_REPONSE_BRUTE = "Réponse brute du dernier essai :";
/** X10 : en-tête du message brut du serveur de rendu, quand un rendu a raté. */
export const ENTETE_MESSAGE_RENDU = "Message du serveur de rendu :";

/** Détail technique d'un échec : la raison, puis la réponse brute du dernier essai d'écriture quand elle existe (X9). */
function detailTechniqueDe(err: unknown): string {
  const detail = err instanceof ErreurFabricationCasConcret ? err.detail : undefined;
  // X10 : hors de l'écriture, le détail est le message brut du serveur de rendu (un rendu raté).
  const entete = err instanceof ErreurFabricationCasConcret && err.etape !== "ecriture" ? ENTETE_MESSAGE_RENDU : ENTETE_REPONSE_BRUTE;
  return detail ? `${raisonDe(err)}\n\n${entete}\n${detail}` : raisonDe(err);
}
const estEtape = (cle: string | undefined): cle is EtapeCasConcret => !!cle && (ETAPES_CAS_CONCRET as readonly string[]).includes(cle);

/** Entrées de la chaîne : celles de la commande ; une retouche y pose ses réglages des fins. */
function entreesDe(commande: Pick<CommandeFabrication, "entrees">, etat: Pick<EtatCasConcret, "retouche">): EntreesCasConcret {
  const e = lireEntreesCasConcret(commande.entrees);
  const r = etat.retouche?.reglages;
  if (!r) return e;
  const { motDit: _motDit, ...sansMotDit } = e;
  void _motDit;
  return { ...sansMotDit, mot: r.mot, ...(r.motDit ? { motDit: r.motDit } : {}), avecMot: r.avecMot };
}

/**
 * Une prise déjà payée est reprise quand son empreinte (texte, voix, réglages, essai) est celle d'aujourd'hui. Une prise
 * retenue à une relecture (`essai` ≥ 2) a l'empreinte de son essai : elle est payée, donc reprise aussi.
 */
function priseReprise(texte: string, p: EtatVoixCasConcret["corps"]["prise"], v: OutilsCasConcret["voix"]): boolean {
  return !!p?.controle && p.etat.phase === "faite" && p.empreinte === empreintePriseVoix({ texte, fournisseurVoix: v.fournisseurVoix, idVoix: v.idVoix, reglages: v.reglages, regles: v.regles, ...(p.essai ? { essai: p.essai } : {}) });
}

/**
 * Voix de départ d'une retouche : les prises d'avant dont l'empreinte (texte, voix, réglages) est la même sont reprises
 * telles quelles, les autres sont à lire. Même empreinte d'étape que la chaîne (`fabriquer.ts`, étape 4) : si elles
 * divergent un jour, la chaîne ignore ce départ et relit tout (plus cher, jamais faux).
 */
function voixDeRetouche(commande: CommandeFabrication, outils: OutilsCasConcret, cas: CasConcret, entrees: EntreesCasConcret, r: RetoucheEnCours): JournalCasConcret["voix"] | null {
  if (!r.prisesAvant) return null;
  const pr = commande.prononciations.map((p) => ({ mot: p.mot, prononciation: p.prononciation }));
  const lire = (t: string) => (pr.length ? substituerPrononciations(t, pr) : t);
  // Les réseaux tels que la chaîne les lit (`tourDeChaine` pose ceux des entrées dans son contexte).
  const reseaux = [...new Set(entrees.reseaux)];
  const motDit = entrees.motDit ?? cas.motDit;
  const plan = regrouperFins(planDesFins({ reseaux, offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: entrees.mot ?? cas.mot, ...(motDit ? { motDit } : {}), avecMot: entrees.avecMot, motSur: entrees.motSur, table: outils.contexte.tableDesFins }));
  const texteCorps = lire(texteDuCorps(r.fiche));
  const textesFins = plan.fins.map((f) => ({ id: f.id, texte: lire(texteDeFin(f)) }));
  const v = outils.voix;
  const meme = (texte: string, p: EtatVoixCasConcret["corps"]["prise"]) => priseReprise(texte, p, v);
  const avant = r.prisesAvant;
  const corps: EtatVoixCasConcret["corps"] = avant.corps.retenu && meme(texteCorps, avant.corps.prise) ? { texte: texteCorps, lectures: avant.corps.lectures, prise: avant.corps.prise, retenu: true } : { texte: texteCorps, lectures: 0 };
  const fins = textesFins.map((f) => {
    const prise = avant.fins.find((x) => x.texte === f.texte && meme(f.texte, x.prise))?.prise;
    return { ...f, ...(prise ? { prise } : {}) };
  });
  return { empreinte: empreinte("voix", texteCorps, textesFins, v.idVoix, v.reglages, v.fournisseurVoix, v.regles, TEMPO_VOIX, reglagesRecette()), etat: { corps, fins, payees: [], reformulations: [] } };
}

async function tourDeChaine(commande: CommandeFabrication, outils: OutilsCasConcret, depart: EtatCasConcret, versionId: string, maintenant: number): Promise<{ etat: EtatCasConcret; issue: Issue }> {
  const retouche = depart.retouche;
  // Retouche : la fiche retouchée est « fournie » (l'écriture est sautée).
  const entrees: EntreesCasConcret = retouche ? { ...entreesDe(commande, depart), ficheCle: `retouche:${versionId}` } : lireEntreesCasConcret(commande.entrees);
  let journal = depart.journal ? structuredClone(depart.journal) : null;
  let atteinte = depart.atteinte;
  let pause = false;
  /** La pause vient d'une étape tout juste faite (et non d'une attente au milieu d'une étape). */
  let pauseApresEtape = false;

  const cas = casDe(commande, outils);
  if (!cas) return { etat: depart, issue: { type: "echec", cle: "fiche", erreur: { code: "CAS_CONCRET_SANS_CAS", reessayable: false, messagePourWill: "Le cas de cette vidéo est introuvable : choisissez-en un autre." } } };

  const { env, contexte, lireFiche, cas: _cas, numeroVersion: lireNumero, scriptValide: lireScript, scriptValideDeLaVideo: lireDeLaVideo, scriptsAnterieurs: lireAnterieurs, ...reste } = outils;
  void _cas;
  // Retouche : la voix part des prises déjà payées (posée une fois, avant que la chaîne ne lise la voix).
  if (retouche && !journal?.voix) {
    const voix = voixDeRetouche(commande, outils, cas, entrees, retouche);
    if (voix) journal = { ...(journal ?? { version: VERSION_FABRICATION_CAS_CONCRET, etapes: {} }), voix };
  }
  const numeroVersion = await lireNumero?.(versionId);
  // V4-3 : le script validé du cas (services, sinon catalogue) ; une fiche fournie l'emporte (elle saute l'écriture).
  const scriptLu = entrees.ficheCle ? null : lireScript ? await lireScript(cas.id) : (scriptValideDuCatalogue(cas.id) ?? null);
  // Un script validé DEPUIS LE STUDIO qui ne convient plus au cas (autre cas, autre version) est périmé : traité comme ABSENT (Claude
  // écrit un nouveau script, la fabrication s'arrête à « Script à valider », Will valide, la voix n'est payée qu'après). Même règle
  // que la feuille « Votre vidéo » (`problemesScriptValide`). Sinon la fabrication le refusait (« faites revalider le script ») sans
  // aucun recours dans l'interface. Un script du CATALOGUE périmé reste un refus (défaut de code).
  const duCatalogue = scriptValideDuCatalogue(cas.id);
  const perime = (s: ScriptValide | null | undefined): boolean => !!s && s !== duCatalogue && problemesScriptValide(s, cas).length > 0;
  // Réglage du studio périmé alors que le script du catalogue convient à la version courante : on retombe sur le catalogue.
  const scriptCourant = perime(scriptLu) ? (duCatalogue && !problemesScriptValide(duCatalogue, cas).length ? duCatalogue : null) : scriptLu;
  // LOT F · « Nouveau script » : la vidéo ne rejoue JAMAIS le script du cas. Elle rejoue la dernière version validée qui vient
  // d'ELLE (Will a validé son script écrit : plus récente ou non), sinon elle écrit / reste à « Script à valider » (sa fiche
  // écrite est au journal, aucune réécriture). Ni le script d'une autre vidéo, ni une version modifiée à la relecture.
  const nouveau = entrees.nouveauScript !== undefined && !entrees.ficheCle;
  const ecarte = nouveau ? scriptCourant : null;
  const deLaVideo = nouveau ? ((lireDeLaVideo ? await lireDeLaVideo(cas.id, commande.videoId) : null) ?? null) : null;
  // Le script validé de la vidéo, d'une version périmée du cas (jamais celui du catalogue), est lui aussi traité comme absent.
  // PRIX EXACT : le script relu au lancement est figé dans la vidéo. Il est rejoué tel quel, JAMAIS remplacé par une réécriture non
  // réservée : même périmé, il va à l'étape « fiche » qui le refuse avant toute voix, sans aucun appel d'écriture.
  const fige = entrees.ficheCle || nouveau ? null : lireScriptValide(entrees.scriptFige);
  const scriptValide = fige ?? (nouveau ? (perime(deLaVideo) ? null : deLaVideo) : scriptCourant);
  // Essai : « simuler l'échec d'une étape » devient la panne d'essai de la chaîne (un échec, puis la réussite).
  const panneDEssai = contexte.panneDEssai ?? (estEtape(commande.simulerEchecEtape) ? commande.simulerEchecEtape : undefined);
  // 14/10 : contrôle de ressemblance à la voix de référence, figé dans la commande au lancement (absent : coupé).
  const ressemblance = reste.voix.ressemblance ?? ressemblanceDeLaCommande(commande.entrees);
  // 17/10 : la voix ne paie jamais plus que sa part du prix confirmé (même calcul que l'estimation de la commande).
  // Sans objet : voix simulée (rien n'est payé), fiche fournie sans texte connu de l'estimation. Retouche : sa fiche est
  // « fournie », mais son prix confirmé est sa réservation (`estimerRetouche`) : elle est plafonnée à celle-ci.
  const plafonnee = commande.distribution.length > 0 && (commande.distribution[0].fournisseurVoix ?? "simulation") !== "simulation" && (!entrees.ficheCle || !!retouche || !!commande.script.texteComplet?.trim());
  const voixEstimee = plafonnee ? (retouche?.aRelire ? lignesRetouche(commande, retouche.aRelire) : estimerCommande(commande).lignes).find((l) => l.etape === "Voix") : undefined;
  const taux = commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT;
  // Retouche sans ligne « Voix » réservée (rien à relire) : son plafond est zéro, jamais l'absence de plafond.
  const centimesVoix = voixEstimee ? voixEstimee.total.centimes : plafonnee && retouche?.aRelire ? 0 : undefined;
  const plafondVoix = centimesVoix !== undefined ? { centimes: centimesVoix, prixLecture: (texte: string) => prixLectureEstime(commande.distribution[0].fournisseurVoix, texte, taux) } : undefined;
  const o: OutilsFabricationCasConcret<JournalCasConcret> = {
    ...reste,
    voix: { ...reste.voix, ...(ressemblance ? { ressemblance } : {}) },
    budget: { ...reste.budget, ...(plafondVoix ? { plafondVoix } : {}) },
    contexte: { ...contexte, reseaux: entrees.reseaux, ...(panneDEssai ? { panneDEssai } : {}) },
    journal: {
      lire: async () => (journal ? structuredClone(journal) : null),
      ecrire: async (j) => {
        // L'étape qui vient d'être faite : celle dont l'empreinte est nouvelle.
        const faite = ETAPES_CAS_CONCRET.find((e) => j.etapes[e] && j.etapes[e]?.empreinte !== journal?.etapes[e]?.empreinte);
        journal = structuredClone(j);
        if (!faite) return;
        atteinte = Math.max(atteinte, ETAPES_CAS_CONCRET.indexOf(faite));
        pause = pauseApresEtape = true;
        throw new Error(MARQUE_PAUSE);
      },
    },
  };

  try {
    const compteRendu = await fabriquerCasConcret({
      videoId: commande.videoId,
      versionId,
      ...(numeroVersion !== undefined ? { numeroVersion } : {}),
      env,
      cas,
      entrees,
      outils: o,
      ...(retouche ? { lireFiche: async () => structuredClone(retouche.fiche) } : entrees.ficheCle && lireFiche ? { lireFiche: () => lireFiche(entrees.ficheCle!) } : {}),
      ...(scriptValide ? { scriptValide } : {}),
      ...(ecarte ? { structureEcartee: ecarte.structure ?? STRUCTURES[0] } : {}),
      ...(lireAnterieurs ? { lireScriptsAnterieurs: () => lireAnterieurs(cas.id, commande.videoId) } : {}),
      ...(commande.distribution[0]?.personnageId ? { personnageId: commande.distribution[0].personnageId } : {}),
      prononciations: commande.prononciations.map((p) => ({ mot: p.mot, prononciation: p.prononciation })),
      // X2 : l'âge d'un appel détaché se compte à l'heure du passage.
      horlogeAppels: () => maintenant,
      // Un fournisseur fait attendre : on rend la main, le prochain `avancer` reprend au même endroit.
      attendre: async () => {
        pause = true;
        throw new Error(MARQUE_PAUSE);
      },
    });
    return { etat: { ...depart, journal, atteinte: ETAPES_CAS_CONCRET.length - 1 }, issue: { type: "fini", compteRendu } };
  } catch (err) {
    const etape = err instanceof ErreurFabricationCasConcret ? err.etape : undefined;
    // Attente ou échec au milieu d'une étape : celles d'avant ont été passées (faites ou reprises).
    if (etape && !pauseApresEtape) atteinte = Math.max(atteinte, ETAPES_CAS_CONCRET.indexOf(etape) - 1);
    const apres: EtatCasConcret = { ...depart, journal, atteinte };
    if (pause) return { etat: apres, issue: { type: "pause" } };
    const raisons = err instanceof ErreurFabricationCasConcret ? err.raisons : [raisonDe(err)];
    const simule = etape !== undefined && etape === panneDEssai && !!journal?.pannesDEssai?.[etape] && depart.journal?.pannesDEssai?.[etape] === undefined;
    const nom = etapesCasConcret(commande).find((e) => e.cle === etape)?.nom;
    // V4-3 : un script à valider n'est pas un échec : Will le relit, le valide, puis « Réessayer » fabrique la vidéo.
    if (etape === "fiche" && raisons[0] === PHRASE_SCRIPT_A_VALIDER) {
      return { etat: apres, issue: { type: "echec", cle: "fiche", erreur: { code: CODE_SCRIPT_A_VALIDER, reessayable: true, messagePourWill: PHRASE_SCRIPT_A_VALIDER } } };
    }
    const reessayable = simule || !etape || !NON_REESSAYABLES.has(etape);
    const erreur: ErreurTravail = {
      code: simule ? "CAS_CONCRET_ECHEC_SIMULE" : etape === "fiche" ? "CAS_CONCRET_FICHE_REFUSEE" : "CAS_CONCRET_ECHEC",
      reessayable,
      messagePourWill: `${phraseEtapeEchouee(nom)} ${raisons.join(" ")}${reessayable ? ` Vous pouvez réessayer cette étape seule.${etape === "ecriture" && raisons[0]?.startsWith(DEBUT_REFUS_ECRITURE) ? annonceNouvelEssai(cas, commande) : ""}` : " Reprenez le cas ou la fiche, puis relancez."}`,
      detailTechnique: detailTechniqueDe(err),
    };
    return { etat: apres, issue: { type: "echec", cle: etape ?? "fiche", erreur } };
  }
}

/* ------------------------------------------------------------------ */
/* Résultat                                                              */
/* ------------------------------------------------------------------ */

/** Voix payée pendant ce travail (chaque prise lue, gardée au journal dès sa lecture). */
function coutVoixDe(etat: EtatCasConcret): number {
  return (etat.journal?.voix?.etat.payees ?? []).reduce((s, p) => s + p.coutCentimes, 0);
}

/** Ce qui a été payé pendant ce travail : la voix, dès qu'une prise est lue (même si son étape n'est pas finie). */
function lignesPayeesDe(etat: EtatCasConcret): LigneCout[] {
  const payees = etat.journal?.voix?.etat.payees ?? [];
  const total = coutVoixDe(etat);
  if (!total) return [];
  const caracteres = payees.reduce((s, p) => s + p.caracteres, 0);
  return [ligne("Voix", payees[0]?.fournisseur ?? "voix", "caractere", caracteres, "reel", centimes(total))];
}

/**
 * L0a (15/10) : les plans de la vidéo tirés de la fiche CALÉE, un par écran du corps (texte dit, début et fin posés par
 * le calage) ; le segment est celui du script de la vidéo (`idSegmentEcran`). Rien si un écran n'a pas ses horaires :
 * les plans de la version restent alors tels quels. PUR.
 */
export function plansDeLaFiche(videoId: string, fiche: Pick<FicheEcrans, "ecrans">): { plans?: PlanProduit[] } {
  if (!fiche.ecrans.length || fiche.ecrans.some((e) => e.debutMs === undefined || e.finMs === undefined)) return {};
  return {
    plans: fiche.ecrans.map((e, i) => ({
      ordre: i + 1,
      debutSec: e.debutMs! / 1000,
      finSec: e.finMs! / 1000,
      texte: e.texteDit.trim(),
      segmentId: idSegmentEcran(videoId, i),
      sourceImage: "motion" as const,
      motsEnValeur: [],
      cadrage: { pointInteret: { x: 0.5, y: 0.5 }, zoom: 1 },
      transition: "coupe" as const,
    })),
  };
}

function resultatDe(commande: CommandeFabrication, r: CompteRenduCasConcret, etat: EtatCasConcret, maintenant: number): ResultatFabrication {
  const signales = [...r.rapport.indicatifs, ...r.rapport.nonFaits];
  const alertes: AlerteQualite[] = [
    ...signales.map((l) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message: `${l.libelle} : ${l.raison}` })),
    // S1e : un bruitage illisible par le rendu est retiré ; la vidéo est fabriquée sans lui.
    ...r.bruitagesRetires.map((message) => ({ code: "bruitage" as const, gravite: "attention" as const, message })),
    // V4-3 : défauts visibles mesurés (texte sur texte, objet vide, phrase en double…), jamais bloquants.
    ...(r.defautsVisuels ?? []).map((d) => ({ code: "defaut-visuel" as const, gravite: "info" as const, message: `Écran ${d.ecranId} : ${d.detail}` })),
  ];
  const note = Math.max(60, 90 - 5 * signales.length);
  const entrees = entreesDe(commande, etat);
  const prisesVoix = etat.journal?.voix?.etat;
  // La première fin est la sortie de la vidéo ; chaque fin garde son fichier dans le projet de montage.
  const premiere = r.fins[0];
  const sorties = premiere
    ? [{ ratio: "9:16" as const, fichierCle: premiere.fichierCle, vignetteCle: premiere.vignetteCle, resolution: "1080x1920", dureeSec: premiere.dureeSec, taille: 0, rapportQualite: { note, verifie: { image: true, son: true, sousTitres: true, mentionIA: false, droits: true }, alertes, niveauSonoreLufs: -14 } }]
    : [];
  return {
    sorties,
    // X9 : les sous-titres du texte réellement dit (la première fin) remplacent ceux du brouillon.
    ...(r.sousTitres?.length ? { sousTitres: r.sousTitres } : {}),
    // L0a (15/10) : les vrais plans (un par écran, texte dit, horaires du calage) remplacent ceux du brouillon.
    ...plansDeLaFiche(commande.videoId, r.fiche),
    noteQualite: { globale: note, alertes },
    lignesReelles: [...lignesPayeesDe(etat), ligne("Montage cas concret", "studio", "forfait", 1, "reel")],
    projetMontage: {
      moteur: ID_MOTEUR_CAS_CONCRET,
      casConcret: {
        journal: journalAGarder(etat.journal),
        fiche: r.fiche,
        // Mesures du fichier de CHAQUE fin (dimensions, volume, crête…) : la fiche vidéo les montre réseau par réseau.
        // L0d : et ses sous-titres (export .srt / .vtt par réseau, `services/sous-titres-par-reseau.ts`).
        fins: r.fins.map((f) => ({ id: f.id, reseaux: f.reseaux, fichierCle: f.fichierCle, dureeSec: f.dureeSec, mesures: f.mesures, ...(f.sousTitres?.length ? { sousTitres: f.sousTitres } : {}) })),
        liens: r.liens,
        rapport: { verdict: r.rapport.verdict, resume: r.rapport.resume, phrases: r.rapport.phrases },
        // Traçabilité (demande de Will du 12/10).
        ...entrees,
        cas: { id: r.fiche.casId, empreinte: r.fiche.empreinteCas },
        charte: r.fiche.habillage,
        versionFiche: r.fiche.version,
        voix: r.voix,
        prises: r.prises,
        publication: r.publication,
        // P2-02 : prises faites (déjà payées), reprises par une retouche quand leur texte ne change pas.
        ...(prisesVoix ? { prisesVoix: { corps: prisesVoix.corps, fins: prisesVoix.fins } satisfies PrisesVoix } : {}),
        le: new Date(maintenant).toISOString(),
      },
    },
  };
}

/* ------------------------------------------------------------------ */
/* Le moteur                                                             */
/* ------------------------------------------------------------------ */

const NON_RELIE = "« Cas concret MD » n'est pas relié (voix, stockage des fichiers ou serveur de rendu). Vérifiez Réglages > Connexions, puis réessayez.";
const VERSION_2 = "viendra en version 2";

/** Refus avant toute réservation : ce qui manque à la commande elle-même. */
function refusDeCommande(commande: CommandeFabrication): { code: string; message: string } | null {
  const e = lireEntreesCasConcret(commande.entrees);
  if (!commande.distribution.length) return { code: "CAS_CONCRET_SANS_VOIX", message: "Désignez la voix de cette vidéo." };
  if (!e.casId && !e.ficheCle) return { code: "CAS_CONCRET_SANS_CAS", message: "Choisissez le cas de cette vidéo." };
  if (!e.reseaux.length) return { code: "CAS_CONCRET_SANS_RESEAU", message: "Cochez au moins un réseau." };
  // X7 : le même contrôle que la feuille « Votre vidéo » et le lancement, sur ce que la commande porte (la validation, la
  // voix et le mot pris ont été contrôlés par le service avant).
  if (e.casId) {
    const phrase = refusAvantPrix({ cas: casDesEntrees(e), ...(e.empreinteCas ? { empreinteVue: e.empreinteCas } : {}), reseaux: e.reseaux, mot: e.mot ?? "", avecMot: e.avecMot, motSur: e.motSur, essai: e.essai, ...(e.description !== undefined ? { description: e.description, faitsConfirmes: e.faitsConfirmes ?? [] } : {}) });
    if (phrase) return { code: "CAS_CONCRET_REFUS_AVANT_PRIX", message: phrase };
  }
  return null;
}

/** Prix d'UN appel d'écriture (au pire), en centimes d'euro : ce que coûte au plus un nouvel essai après « Réessayer » (X12). */
export function coutNouvelEssaiEcritureCentimes(cas: CasConcret, commande: CommandeFabrication): number {
  const e = lireEntreesCasConcret(commande.entrees);
  const plan = regrouperFins(planDesFins({ reseaux: [...e.reseaux], offre: cas.offre, ...(cas.nature ? { nature: cas.nature } : {}), mot: e.mot ?? cas.mot, ...((e.motDit ?? cas.motDit) ? { motDit: e.motDit ?? cas.motDit } : {}), avecMot: e.avecMot, motSur: e.motSur, table: TABLE_FINS_DIAGNOSTIC }));
  return Math.max(1, Math.ceil(coutEcritureCentimes(cas, plan.fins, commande.tauxUsdEur ?? TAUX_USD_EUR_PAR_DEFAUT) / APPELS_ECRITURE_MAX));
}

/** X12 : ce que fait « Réessayer » après une écriture refusée, et son prix (dit AVANT le clic). */
function annonceNouvelEssai(cas: CasConcret, commande: CommandeFabrication): string {
  const prix = formaterMontant({ centimes: coutNouvelEssaiEcritureCentimes(cas, commande), devise: "EUR" });
  return ` « Reprendre » relit d'abord les réponses déjà payées avec les règles du jour ; si elles restent refusées, un nouvel essai d'écriture coûte environ ${prix}.`;
}

/** Phrase d'une étape en échec : une seule tournure, accordée quel que soit le nom de l'étape (« Les écrans »…). */
export function phraseEtapeEchouee(nom: string | undefined): string {
  return nom ? `L'étape « ${nom} » n'a pas abouti.` : "La fabrication n'a pas abouti.";
}

export function creerMoteurMontageCasConcret(dependances: DependancesMoteurCasConcret = {}): MoteurVideo {
  const fabrique = (): FabriqueOutilsCasConcret | undefined => dependances.outils ?? servicesCasConcret().outils;
  const retouchesAllumees = (): boolean => (dependances.retouchesAllumees ?? servicesCasConcret().retouchesAllumees)?.() === true;

  return {
    id: ID_MOTEUR_CAS_CONCRET,
    nom: "Montage cas concret",
    capacites: {
      // 65 s : borne haute de la vidéo entière (R21) ; 9:16 seulement.
      dureeMaxSec: 65,
      ratios: ["9:16"],
      langues: ["fr-FR"],
      // Retouche par opérations (P2-02) ; refusée par `refusRetouche` tant que `casConcret.retouches` est éteint.
      retoucheParPlan: true,
      asynchrone: true,
      accordExige: false,
      maquette: false,
    },

    async estimer(commande) {
      return estimerCommande(commande);
    },
    async estimerRetouche(commande, _planIds, contexte) {
      // Réservation « au plus » : le coût exact de l'aperçu (seuls les textes relus, au pire des lectures), jamais l'écriture.
      // « Réessayer » : ce que le travail a déjà posé. Sans opération (la retouche libre est refusée) ou refusées : le corps au pire,
      // la retouche ne lira rien.
      const duree = etapesRetouche(commande).reduce((t, e) => t + e.dureeEstimeeSec, 0);
      const posee = (contexte?.travail?.parametres?.casConcret as EtatCasConcret | undefined)?.retouche?.aRelire;
      if (posee) return estimation(lignesRetouche(commande, posee), duree);
      if (!contexte?.operations?.length) return estimation(lignesRetoucheSansOperation(commande), duree);
      // Mêmes outils que `retoucher` (cas, table des fins, interdits, voix) : l'aperçu et la retouche relisent les mêmes textes.
      let outils: OutilsCasConcret | null = null;
      try {
        outils = (await fabrique()?.(commande, "estimation")) ?? null;
      } catch {
        outils = null;
      }
      const exacte = estimerRetoucheCasConcret(commande, contexte.operations, contexte.parent, outils);
      return exacte.apercu?.ok ? exacte.estimation : estimation(lignesRetoucheSansOperation(commande), duree);
    },
    async estimerReexport() {
      return estimation([ligne("Montage cas concret", "studio", "forfait", 1, "estime")], 10);
    },

    etapes: (commande) => etapesCasConcret(commande),

    refusAuLancement: refusDeCommande,
    // Réglage `casConcret.retouches` éteint (défaut) : refus comme avant, avant toute réservation.
    refusRetouche: (commande) => (retouchesAllumees() ? refusDeCommande(commande) : { code: "RETOUCHE_NON_PRISE_EN_CHARGE", message: `La retouche d'un cas concret ${VERSION_2}.` }),

    async lancer(commande, contexte) {
      return nouveauTravail(etapesCasConcret(commande), contexte, commande, { journal: null, atteinte: -1 });
    },

    async avancer(travail, commande, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule" || travail.statut === "echec") return { travail };
      let etat = lireEtat(travail);
      let outils: OutilsCasConcret | null = null;
      try {
        outils = (await fabrique()?.(commande, travail.id, { relance: Math.max(0, travail.tentatives - 1) })) ?? null;
      } catch (err) {
        // L1-05 : une voix refusée ne se règle pas en réessayant (il faut choisir la voix maître) : pas de « réessayer ».
        if (err instanceof VoixNonEpingleeError) return { travail: enEchec(travail, etat, undefined, { code: "CAS_CONCRET_NON_RELIE", reessayable: false, messagePourWill: err.messagePourWill, detailTechnique: raisonDe(err) }, maintenant) };
        return { travail: enEchec(travail, etat, undefined, { code: "CAS_CONCRET_NON_RELIE", reessayable: true, messagePourWill: `${raisonDe(err)} Vous pouvez réessayer.`, detailTechnique: raisonDe(err) }, maintenant) };
      }
      if (!outils) return { travail: enEchec(travail, etat, undefined, { code: "CAS_CONCRET_NON_RELIE", reessayable: true, messagePourWill: NON_RELIE }, maintenant) };

      // La chaîne, jusqu'à la prochaine étape faite ou la prochaine attente.
      const tour = await tourDeChaine(commande, outils, etat, travail.versionId ?? commande.videoId, maintenant);
      etat = tour.etat;
      if (tour.issue.type === "pause") return { travail: suivant(travail, etat, statuts(travail, etat), maintenant) };
      if (tour.issue.type === "echec") return { travail: enEchec(travail, etat, tour.issue.cle, tour.issue.erreur, maintenant) };
      const r = tour.issue.compteRendu;
      if (r.rapport.verdict === "bloque") {
        const etatControle = { ...etat, atteinte: ETAPES_CAS_CONCRET.indexOf("controle") - 1 };
        return { travail: enEchec(travail, etatControle, "controle", { code: "CAS_CONCRET_CONTROLES_BLOQUANTS", reessayable: false, messagePourWill: `La vérification bloque la livraison (${r.rapport.resume}). ${r.rapport.phrases.join(" ")}` }, maintenant) };
      }
      return { travail: suivant(travail, etat, statuts(travail, etat), maintenant), resultat: resultatDe(commande, r, etat, maintenant) };
    },

    async reessayer(travail, maintenant = Date.now()) {
      // L'étape en échec repart ; tout ce qui est fait reste fait (le journal garde chaque étape réussie et chaque prise).
      // X10 : les rendus restés en cours ou ratés repartent, sinon la chaîne relirait le même échec.
      // X12 : une écriture arrêtée relit ses réponses payées avec les règles du jour, puis fait au plus UN nouvel appel.
      const etat = lireEtat(travail);
      const ecritureArretee = travail.etapes.some((e) => e.cle === "ecriture" && e.statut === "echec");
      const journal = relancerRendusCasConcret(ecritureArretee ? marquerRepriseEcriture(etat.journal) : etat.journal, travail.tentatives);
      return {
        ...avecEtat(travail, { ...etat, journal }),
        etapes: travail.etapes.map((e) => (e.statut === "echec" ? { ...e, statut: "en_attente" as const, progression: 0, erreur: undefined } : e)),
        statut: "en_cours",
        erreur: undefined,
        termineLe: undefined,
        tentatives: travail.tentatives + 1,
        modifieLe: new Date(maintenant).toISOString(),
      };
    },

    async retoucher({ commande, contexte, operations, parent }) {
      const ctx = { ...contexte, type: "retouche" as const };
      // Réglage éteint : refus comme avant, rien n'est lu ni lancé.
      if (!retouchesAllumees()) return travailRefuse(ctx, commande, "RETOUCHE_NON_PRISE_EN_CHARGE", `La retouche d'un cas concret ${VERSION_2} : relancez une vidéo depuis le cas.`);
      // Les opérations arrivent par le contrat commun (typé pour les autres formats) : lues ici, hors liste = refus.
      const ops: readonly unknown[] = operations ?? [];
      if (!ops.length) return travailRefuse(ctx, commande, "RETOUCHE_NON_PRISE_EN_CHARGE", `La retouche libre d'un cas concret ${VERSION_2} : choisissez une retouche dans la liste.`);
      const refus = refusOperationsCasConcret(ops);
      if (refus) return travailRefuse(ctx, commande, refus.code, refus.message);
      let outils: OutilsCasConcret | null = null;
      try {
        outils = (await fabrique()?.(commande, contexte.travailId)) ?? null;
      } catch (err) {
        return travailRefuse(ctx, commande, "CAS_CONCRET_NON_RELIE", `${raisonDe(err)} Vous pouvez réessayer.`);
      }
      if (!outils) return travailRefuse(ctx, commande, "CAS_CONCRET_NON_RELIE", NON_RELIE);
      // Appliquée et revalidée ICI, avant de rien lancer : un refus ne modifie rien et dit pourquoi.
      const p = preparerRetouche(commande, ops, parent, outils);
      if ("refus" in p) return travailRefuse(ctx, commande, p.refus.code, p.refus.message);
      if (!p.retouche) return travailRefuse(ctx, commande, RETOUCHE_REFUSEE, p.apercu.refus.join(" "));
      return nouveauTravail(etapesRetouche(commande), ctx, commande, { journal: null, atteinte: -1, retouche: p.retouche });
    },

    async reexporter({ commande, contexte }) {
      return travailRefuse({ ...contexte, type: "reexport" }, commande, "REEXPORT_NON_PRIS_EN_CHARGE", `Un autre format d'image ou une autre fin ${VERSION_2} : la vidéo sort déjà une fin par réseau coché.`);
    },

    async recalquer({ commande, contexte }) {
      return travailRefuse({ ...contexte, type: "recalque-sous-titres" }, commande, "RECALQUE_NON_PRIS_EN_CHARGE", `La correction des sous-titres seuls ${VERSION_2} : ils suivent la voix.`);
    },

    async maquette(commande) {
      // Pas de maquette (capacites.maquette = false) : elle viendra en version 2 ; la fiche d'écrans tient lieu d'aperçu.
      return { dureeSec: commande.dureeCibleSec };
    },

    async annuler(travail, maintenant = Date.now()) {
      if (travail.statut === "termine" || travail.statut === "annule") return travail;
      const iso = new Date(maintenant).toISOString();
      return {
        ...travail,
        statut: "annule",
        etapes: travail.etapes.map((e) => (e.statut === "terminee" ? { ...e } : { ...e, statut: "ignoree" as const, coutReel: undefined, erreur: undefined })),
        erreur: undefined,
        modifieLe: iso,
        termineLe: iso,
      };
    },

    lignesPayees(travail) {
      return lignesPayeesDe(lireEtat(travail));
    },
  };
}

export const moteurMontageCasConcret = creerMoteurMontageCasConcret();
