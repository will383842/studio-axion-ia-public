/**
 * RACCORDS DU « CAS CONCRET MD » (tâche S1b, plan cas concret § 5) : ce que les services branchent sur le moteur
 * `montage-cas-concret` (pur, il n'importe jamais un service). Chargé pour son effet par la boucle de fond (raccord S1c),
 * qui fait avancer les travaux. Patrons : `tableau-branchements.ts` et `tableau-outils.ts`, jamais importés.
 *
 *  - VOIX : celle que désigne `commande.distribution[0].voixId` (posée par le service de lancement : la voix effective
 *    de l'avocat, `voixDeReference`), jamais une voix choisie ici. Absente, pas prête ou pas de HeyGen : refus « Votre
 *    voix n'est pas prête. » avant toute dépense.
 *  - BUDGET : la voix passe par `verifierEtReserverSelonOrigine` (chaîne unique du studio, avec l'origine de la commande, L3-01), au nom de la vidéo et du travail, juste
 *    avant chaque lecture payante. L'écriture et la reformulation passent par `executerRolePourVideo` (plafond propre
 *    de la vidéo, limite du mois, pré-vol, réservation de l'appel, coût réel) ; avant chaque appel, un pré-vol du budget
 *    du studio et des crédits refuse tôt ce qui ne passerait pas.
 *  - RENDU : `studio-rendu` réel, ou la simulation. En simulation, rien n'échoue : voix d'essai, rendu simulé, écriture
 *    simulée, captures remplacées par leur dessin. En PRODUCTION, une fabrication dont un fournisseur serait simulé est
 *    refusée avant toute dépense.
 *  - `assembler` (opération `assemblage`, tempo du format), `mesurerPauses` (opération `mesure-son`, une demande par
 *    blanc) et `capturer` (opération `capture-site`) passent par le service de rendu.
 *  - Sons : seulement les bruitages validés reçus dans la commande, avec leur fichier. Interdits : ceux du contexte de
 *    marque. Fins : `TABLE_FINS_DIAGNOSTIC`.
 *  - S1e : ces trois opérations sont « soumettre puis relire » : un passage relit l'état du rendu (la demande est soumise
 *    s'il ne la connaît pas) et, pas fini, lève `RenduEnCours` ; la chaîne rend la main, la boucle de fond n'attend
 *    jamais un rendu. Une clé qui commence par « / » (fichier public du studio : bruitages) passe par
 *    `cleLisibleParLeRendu` ; un bruitage illisible est retiré (la vidéo se fabrique sans lui, avec une alerte). Une
 *    entrée absente du stockage arrête les finitions après UNE série d'essais (`seriesFichierInaccessible`).
 *  - X2 : l'écriture et la reformulation sont des appels DÉTACHÉS : `executerRolePourVideo` est lancé sans être attendu
 *    (le passage rend la main), sa réponse est gardée dans les paramètres du studio (`casConcret.appel.<clé>`), relue
 *    aux passages suivants et jamais redemandée (`montage-cas-concret/appels.ts`). X3 : c'est le TEXTE de la réponse
 *    (et sa raison d'arrêt) qui est gardé et relu : un rôle sans schéma n'a pas de `donnees` (`reponseEcritureDepuis`).
 *  - X10 · FIN GARANTIE de chaque attente (incident du tableau animé du 12/10) : écrans et finitions posent le délai de
 *    garde commun (`garde`, `fournisseurs/rendu/garde.ts`) : un rendu en cours qui n'avance plus depuis 15 min, ou que le
 *    serveur ne connaît plus, devient un échec réessayable (un nouvel essai sous un autre identifiant, puis l'échec).
 *    Les rendus relus sans état gardé (captures, recette et raccord de la voix, mesure des blancs, analyse et nettoyage de
 *    la voix maître) passent par `serviceRenduCasConcret` : même délai de garde (la veille est gardée en mémoire du
 *    processus ; un redémarrage la remet à zéro, la borne reste), puis `-e1`, `-e2` et l'échec clair ; après
 *    « Réessayer » (`relance`), leurs identifiants changent (`-r<n>`) : le serveur ne rend plus l'échec gardé. Les appels
 *    Claude détachés ont déjà la leur (`DELAI_REPONSE_APPEL_MS`, `appels.ts`).
 *  - V4-3 · SCRIPT VALIDÉ : `scriptValide` rend celui du cas (réglage du studio, sinon catalogue) : aucun appel
 *    d'écriture. Sans lui, Claude écrit, et la chaîne s'arrête après la relecture (`exigerScriptValide`) jusqu'à ce que
 *    Will valide le script (`cas-concret-scripts.ts`).
 *  - PANNES D'ESSAI (simulation seulement, jamais si un fournisseur est réel) : un mot qui commence par `PANNE` fait
 *    échouer l'étape « Les écrans » à son premier essai ; un mot qui commence par `REFUS` fait refuser deux fois
 *    l'écriture.
 *
 * Rien n'est importé hors de `src/` (l'image du studio ne contient ni `scripts/` ni `studio-rendu/`) ; les modules
 * lourds (crédits, dépense Claude) sont chargés à la demande, quand un travail du format avance.
 */
import "server-only";
import { createHash } from "node:crypto";
import { TABLE_FINS_DIAGNOSTIC } from "@/briques/fins/table-diagnostic";
import type { BruitageDisponible, CommandeFabrication, Id, LigneCout, MediaCommande } from "@/domaine/types";
import type { AccordPrix } from "@/domaine/accord";
import type { DemandeRendu, EtatRendu, ServiceRendu, StockageFichiers } from "@/fournisseurs/types";
import { delaiSansNouvelleMs, lireRenduGarde, type GardeRendu, type VeilleRendu } from "@/fournisseurs/rendu/garde";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import { brancherServicesCasConcret, estRenduEnCours, lireEntreesCasConcret, RenduEnCours, type OutilsCasConcret } from "@/moteurs/montage-cas-concret";
import { avecCasRetenus } from "@/moteurs/montage-cas-concret/cas-simules";
import { ETAPE_ECRITURE, ETAPE_REFORMULATION, roleEcritureCasConcret } from "@/moteurs/montage-cas-concret/ecriture";
import type { AppelsDetaches, BruitageValideCasConcret, EtapeCasConcret, OutilsEcriture, OutilsVariete, ReponseAppelEcriture, ResultatCapture } from "@/moteurs/montage-cas-concret/outils";
import { DEBIT_RECETTE } from "@/moteurs/montage-cas-concret/regles";
import { REGLES_BLANCS_CAS_CONCRET } from "@/moteurs/montage-cas-concret/voix";
import type { ScriptValide } from "@/moteurs/montage-cas-concret/script-valide";
import { exigerVoixMaitre } from "@/briques/voix-maitre/voix-epinglee";
import { TEMPO_VOIX } from "@/formats/cas-concret";
import { retouchesAllumeesConnues } from "./cas-concret-reglages";
import { CONSIGNE_VOIX_CAS_CONCRET } from "@/moteurs/montage-cas-concret/avant-prix";
import { RECETTE_VOIX_CAS_CONCRET } from "@/moteurs/montage-cas-concret/recette-voix";

/* ------------------------------------------------------------------ */
/* Phrases montrées à Will                                               */
/* ------------------------------------------------------------------ */

export const VOIX_PAS_PRETE = CONSIGNE_VOIX_CAS_CONCRET;
export const STUDIO_NON_RELIE = "Le studio n'est pas relié (voix, fichiers ou rendu).";
/**
 * Débit de la voix d'essai, avant le tempo : celui de la recette une fois le tempo appliqué (la vidéo de référence dit
 * 167 mots en 53 s). Sans lui, la voix d'essai lit à 4,4 mots par seconde et les vidéos simulées sont trop courtes.
 */
export const MOTS_PAR_SECONDE_VOIX_ESSAI = DEBIT_RECETTE * TEMPO_VOIX;
const VOIX_NON_RELIEE = "Votre voix n'est pas reliée chez son fournisseur.";

/** Préfixes des mots qui déclenchent une panne d'essai (simulation seulement). */
export const MOT_PANNE = "PANNE";
export const MOT_REFUS = "REFUS";
/** Étape qui échoue à son premier essai avec un mot `PANNE…`. */
export const ETAPE_PANNE_D_ESSAI: EtapeCasConcret = "ecrans";

/**
 * Plafond Claude propre au format, par vidéo : l'écriture (deux appels au pire) et les reformulations du corps. Ses
 * dépenses se reconnaissent à leur étape (« Cas concret · écriture », « Cas concret · reformulation »).
 */
export const PARAM_PLAFOND_ECRITURE_CAS_CONCRET = "casConcret.plafondEcritureUsd";
export const PLAFOND_ECRITURE_CAS_CONCRET_USD = 1;

/** Préfixe des réponses d'appels détachés gardées dans les paramètres du studio (X2). */
export const PREFIXE_APPEL_DETACHE = "casConcret.appel.";
/** Réponse gardée quand l'appel détaché lève au lieu de répondre (phrase fixe, jamais le message brut). */
const APPEL_EN_PANNE = "l'appel n'a pas abouti.";

/** Nouvelles soumissions au plus d'un rendu après une panne passagère (nouvel identifiant à chaque fois). */
export const ESSAIS_RENDU_CAS_CONCRET = 2;
/** Séries d'essais de la composition sur une entrée absente du stockage : une seule (elle ne revient pas en attendant). */
export const SERIES_FICHIER_INACCESSIBLE_CAS_CONCRET = 1;
/** Niveau rendu pour un blanc trop court pour être mesuré : silence. */
const NIVEAU_SILENCE_DB = -90;

/* ------------------------------------------------------------------ */
/* Ce que les tests peuvent remplacer                                    */
/* ------------------------------------------------------------------ */

/** Plafond propre (forme de `PlafondPropre` de `depense-claude-video.ts`). */
interface PlafondPropreCasConcret {
  id: string;
  parametre: string;
  defautUsd: number;
  prefixeEtape: string;
}

/** Forme de `ResultatVideo` (`depense-claude-video.ts`) : `texte` et `stopReason` rendus pour un plafond propre (X3). */
type ResultatAppelVideo = { ok: true; simule: boolean; donnees?: unknown; texte?: string; stopReason?: string | null; invalide?: string; coutUsd?: number } | { ok: false; arret: string; message: string };

export interface DependancesBranchementsCasConcret {
  /** Production (défaut : `NODE_ENV`). */
  production?: boolean;
  /** Service de rendu et son mode (défaut : `studio-rendu` de l'environnement, ou la simulation). */
  rendu?: { service: ServiceRendu; simule: boolean };
  /** Claude est-il choisi et relié pour les textes ? (défaut : `claudeTextesActif`). */
  claudeActif?: () => Promise<boolean>;
  /** Socle de Will donné à l'écriture (essais : injecté) ; absent : lu dans le studio quand Claude est relié. */
  socle?: () => Promise<EntreeRole["contexte"] | undefined>;
  /** UN appel d'un rôle pour la vidéo (défaut : `executerRolePourVideo`). */
  executer?: (videoId: Id, role: DefinitionRole, entree: EntreeRole, options: { etape: string; plafondPropre: PlafondPropreCasConcret }) => Promise<ResultatAppelVideo>;
  /** Numéro de la version fabriquée (défaut : lu dans les versions du studio) ; jamais deviné. */
  numeroVersion?: (versionId: string) => Promise<number | undefined>;
  /** Pré-vol du budget du studio et des crédits, sans réservation (défaut : `verifierBudgetEtCredits`). */
  verifierBudget?: (estimation: { lignes: LigneCout[]; total: LigneCout["total"] }, accord: AccordPrix, quoi: string) => Promise<void>;
  /** Contrôle et réservation (défaut : `verifierEtReserverSelonOrigine`, avec l'origine de la commande). */
  verifierEtReserver?: (estimation: { lignes: LigneCout[]; total: LigneCout["total"] }, accord: AccordPrix, quoi: string, demande: { videoId: Id; travailId: Id }) => Promise<void>;
  /** Stockage des fichiers (défaut : celui de l'environnement). */
  stockage?: StockageFichiers;
  /** Réponses des appels détachés (défaut : `appelsDetaches()`, paramètres du studio). */
  appels?: AppelsDetaches;
  /** Sans effet depuis S1e : un passage n'attend plus aucun rendu (gardé pour les essais existants). */
  attendre?: (ms: number) => Promise<void>;
  /** X10 : nombre de « Réessayer » du travail (posé par le moteur) ; les rendus relus changent alors d'identifiant. */
  relance?: number;
  /** X10 : horloge du délai de garde des rendus (tests ; défaut : `Date.now`). */
  horloge?: () => number;
  /** V4-3 : le script validé d'un cas (défaut : `scriptValideDuStudio`, réglage du studio puis catalogue). */
  scriptValide?: (casId: string) => Promise<ScriptValide | null>;
  /** LOT F : la dernière version validée qui vient d'une vidéo (défaut : `scriptValideDeLaVideo`). */
  scriptValideDeLaVideo?: (casId: string, videoId: string) => Promise<ScriptValide | null>;
  /** 18/10 : le texte dit des scripts déjà écrits ou validés (défaut : `scriptsDejaEcrits`, catalogue + studio + vidéos non supprimées). */
  scriptsAnterieurs?: (casId: string, videoId: string) => Promise<readonly string[]>;
  /** V4-3 : un script écrit par Claude attend la validation de Will avant toute voix (défaut : oui). */
  validationScript?: boolean;
  /** L2 : historique des tirages et mise héritée (défaut : réglages du studio) ; `null` : aucun tirage. */
  variete?: OutilsVariete | null;
}

/* ------------------------------------------------------------------ */
/* Pièces pures                                                          */
/* ------------------------------------------------------------------ */

const majuscules = (mot: string | undefined) => (mot ?? "").trim().toUpperCase();

/** Panne d'essai demandée par le mot (`PANNE…` → « Les écrans » ; `REFUS…` → écriture refusée deux fois). PUR. */
export function panneDuMot(mot: string | undefined): { panneDEssai?: EtapeCasConcret; refusEcriture: boolean } {
  const m = majuscules(mot);
  return { ...(m.startsWith(MOT_PANNE) ? { panneDEssai: ETAPE_PANNE_D_ESSAI } : {}), refusEcriture: m.startsWith(MOT_REFUS) };
}

/** Bruitages validés reçus dans la commande, avec leur fichier ; un son sans fichier n'est pas posé. PUR. */
export function bruitagesValides(disponibles: readonly BruitageDisponible[] | undefined, medias: Readonly<Record<Id, MediaCommande>> | undefined): BruitageValideCasConcret[] {
  return (disponibles ?? []).flatMap((b) => {
    const m = medias?.[b.elementId];
    return m?.cle ? [{ ...b, cle: m.cle, mime: m.mime }] : [];
  });
}

/** Morceau d'identifiant de rendu sûr et court, tiré d'une empreinte. PUR. */
export function idRenduCasConcret(prefixe: string, ...parts: unknown[]): string {
  return `${prefixe}-${createHash("sha256").update(JSON.stringify(parts)).digest("hex").slice(0, 24)}`;
}

/**
 * Appels détachés (X2) : l'appel part sans être attendu ; sa réponse (ou une panne en phrase fixe) est gardée dans les
 * paramètres du studio, qui survivent à un redémarrage. Toute erreur est écrite au journal du serveur (jamais la
 * demande ni une clé).
 */
export function appelsDetaches(): AppelsDetaches {
  const cle = (c: string) => `${PREFIXE_APPEL_DETACHE}${c}`;
  return {
    lancer: (c, appel) => {
      void (async () => {
        let r: ReponseAppelEcriture;
        try {
          r = await appel();
        } catch (err) {
          console.error(`[cas-concret] appel détaché ${c} en panne (${err instanceof Error ? err.name : "erreur"})`);
          r = { ok: false, arret: "panne", message: APPEL_EN_PANNE };
        }
        try {
          const { ecrireParametre, videoSupprimee } = await import("./_commun");
          // Vidéo supprimée définitivement pendant l'appel (`cc…-<vidéo>-<version>-…`) : la réponse n'est pas gardée.
          const videoId = /^cc[a-z]+-(v-[a-z0-9]+)-/.exec(c)?.[1];
          if (videoId && (await videoSupprimee(videoId))) return;
          await ecrireParametre(cle(c), { ...r, le: new Date().toISOString() });
        } catch (err) {
          console.error(`[cas-concret] réponse de l'appel ${c} non gardée (${err instanceof Error ? err.name : "erreur"})`);
        }
      })();
    },
    lire: async (c) => {
      const { lireParametre } = await import("./_commun");
      const v = await lireParametre<unknown>(cle(c), null);
      return v && typeof v === "object" && typeof (v as { ok?: unknown }).ok === "boolean" ? (v as ReponseAppelEcriture) : null;
    },
  };
}

/**
 * Réponse d'un appel du chemin de dépense, pour l'écriture et la reformulation (PUR). X3 : nos rôles n'ont PAS de schéma ;
 * en production leur réponse n'est que dans `texte` (`lireSortie` ne remplit `donnees` que pour un schéma) : le texte et
 * la raison d'arrêt sont gardés, c'est cette réponse qui est gardée puis relue par les appels détachés (X2).
 */
export function reponseEcritureDepuis(r: ResultatAppelVideo): ReponseAppelEcriture {
  if (!r.ok) return { ok: false, arret: r.arret, message: r.message };
  return {
    ok: true,
    simule: r.simule,
    ...(r.donnees !== undefined ? { donnees: r.donnees } : {}),
    ...(typeof r.texte === "string" ? { texte: r.texte } : {}),
    ...(r.stopReason !== undefined ? { stopReason: r.stopReason } : {}),
    ...(r.invalide ? { invalide: r.invalide } : {}),
    ...(typeof r.coutUsd === "number" ? { coutUsd: r.coutUsd } : {}),
  };
}

/** Durée d'un assemblage simulé : morceaux mis bout à bout, puis le tempo. PUR. */
export function dureeAssemblee(morceaux: readonly { deSec: number; aSec: number }[], tempo = 1): number {
  return +(morceaux.reduce((s, m) => s + (m.aSec - m.deSec), 0) / tempo).toFixed(3);
}

/* ------------------------------------------------------------------ */
/* Rendu « soumettre puis relire » et fichiers publics (S1e)             */
/* ------------------------------------------------------------------ */

/**
 * Un passage sur un rendu : relit son état ; inconnu, la demande est soumise (`suivreRendu`). Une panne passagère est
 * soumise à nouveau sous `-e1`, `-e2` (relus dans l'ordre à chaque passage : rien à garder entre deux). Fini : l'état
 * terminé ; pas fini : `RenduEnCours` ; échec définitif : `ErreurRendu`.
 */
export async function relireRendu(service: ServiceRendu, premiere: DemandeRendu, quoi: string): Promise<Extract<EtatRendu, { statut: "termine" }>> {
  const { ErreurRendu, suivreRendu } = await import("@/fournisseurs/rendu/client");
  for (let essai = 0; ; essai++) {
    const e = await suivreRendu(service, essai ? { ...premiere, idRendu: `${premiere.idRendu}-e${essai}` } : premiere);
    if (e.statut === "termine") return e;
    if (e.statut !== "echec") throw new RenduEnCours(quoi);
    if (!e.erreur.reessayable || essai >= ESSAIS_RENDU_CAS_CONCRET) throw new ErreurRendu(e.erreur);
  }
}

/** Veilles des rendus relus sans état gardé (délai de garde), par identifiant, en mémoire du processus. */
const VEILLES = new Map<string, VeilleRendu>();
/** Au-delà, les plus anciennes veilles sont oubliées (une veille oubliée recommence son délai : la borne reste). */
const VEILLES_MAX = 2_000;

/**
 * X10 · Service de rendu des demandes relues SANS état gardé par la chaîne (captures, recette et raccord de la voix,
 * mesure des blancs, voix maître) :
 *  - délai de garde commun (`lireRenduGarde`) à la lecture : un rendu `en_cours` figé depuis `garde.delaiMs` est lu comme
 *    un échec réessayable (la demande suivante, `-e1`, part ; jamais une attente sans fin). « Inconnu » est rendu tel
 *    quel : `suivreRendu` soumet de nouveau la demande (reprise après un redémarrage du serveur de rendu) ;
 *  - `relance` (nombre de « Réessayer ») : identifiants suffixés `-r<n>`, pour que la reprise ne relise pas l'échec
 *    gardé 24 h par le serveur.
 * Une veille déclarée figée est gardée telle quelle : les passages suivants relisent le même échec et passent à l'essai
 * suivant (rien à garder dans la chaîne).
 */
export function serviceRenduCasConcret(service: ServiceRendu, o: { garde: GardeRendu; relance?: number; veilles?: Map<string, VeilleRendu> }): ServiceRendu {
  const veilles = o.veilles ?? VEILLES;
  const id = (x: string) => (o.relance ? `${x}-r${o.relance}` : x);
  return {
    soumettre: async (d) => {
      const r = await service.soumettre({ ...d, idRendu: id(d.idRendu) });
      return { ...r, idRendu: d.idRendu };
    },
    etat: async (idRendu) => {
      const cle = id(idRendu);
      const e = await service.etat(cle);
      if (e.statut === "inconnu") {
        veilles.delete(cle);
        return e;
      }
      const lu = await lireRenduGarde({ soumettre: service.soumettre, etat: async () => e }, { idRendu: cle } as DemandeRendu, veilles.get(cle), o.garde);
      if (e.statut === "termine" || (e.statut === "echec" && !lu.sansNouvelle)) veilles.delete(cle);
      else if (lu.veille) {
        if (veilles.size >= VEILLES_MAX) veilles.delete(veilles.keys().next().value!);
        veilles.set(cle, lu.veille);
      }
      return lu.etat;
    },
  };
}

/** Clés publiques déjà copiées dans le stockage, par processus : jamais recopiées ni revérifiées à chaque passage. */
const clesLisibles = new Map<string, string>();

/** Stockage qui ne vérifie que le préfixe d'une clé publique (simulation : rien n'est déposé ni lu). */
const PREFIXE_SEUL = { confirmerDepot: async () => ({ ok: true }) } as unknown as StockageFichiers;

/** Taille la plus grande d'un son lu en entier pour ses mesures (WAV de la voix : quelques Mo). */
export const SON_MAX_OCTETS = 16 * 1024 * 1024;

/**
 * Lit un son EN ENTIER par son adresse signée (`null` : illisible, trop gros ou vide). Essai réel du 14/10
 * (v-e99a49ee86cb) : la lecture passait par `lireDebut`, bornée à 4 096 octets ; le contrôle de fin de voix ne voyait que
 * 0,04 s de son et refusait une voix dite en entier (et les blancs mesurés pour placer les coupes étaient vides).
 */
export async function lireSonEntier(adresse: string, appeler: typeof fetch = fetch, max = SON_MAX_OCTETS): Promise<Uint8Array | null> {
  try {
    const r = await appeler(adresse, { signal: AbortSignal.timeout(60_000) });
    if (!r.ok) return null;
    const annonce = Number(r.headers.get("content-length"));
    if (Number.isFinite(annonce) && annonce > max) return null;
    const octets = new Uint8Array(await r.arrayBuffer());
    return octets.byteLength && octets.byteLength <= max ? octets : null;
  } catch {
    return null;
  }
}

/** Le socle de Will pour le cas concret (modèles de ton du format), lu une fois, jamais bloquant. */
export function socleUneFois(charger: () => Promise<EntreeRole["contexte"]> = socleWillCasConcret): () => Promise<EntreeRole["contexte"] | undefined> {
  let lu: Promise<EntreeRole["contexte"] | undefined> | undefined;
  return () =>
    (lu ??= charger().catch((e: unknown) => {
      console.error(`[cas-concret] socle de Will illisible, écriture avec la seule consigne du format : ${e instanceof Error ? `${e.name} : ${e.message.slice(0, 200)}` : "erreur"}`);
      return undefined;
    }));
}

/** Le socle réel de Will pour le cas concret. */
async function socleWillCasConcret(): Promise<EntreeRole["contexte"]> {
  return (await import("./cas-concret-socle")).socleCasConcretSansV4();
}

/** Clé que le rendu peut lire : une clé publique (« / ») passe par `cleLisibleParLeRendu`, jamais signée telle quelle. */
async function cleLisible(cle: string, stockage: StockageFichiers, simule: boolean): Promise<string> {
  if (!cle.startsWith("/")) return cle;
  const deja = clesLisibles.get(cle);
  if (deja) return deja;
  const { cleLisibleParLeRendu } = await import("./etalonnage");
  const lisible = await cleLisibleParLeRendu(cle, simule ? PREFIXE_SEUL : stockage);
  if (!simule) clesLisibles.set(cle, lisible);
  return lisible;
}

/**
 * Bruitages dont le rendu peut lire le fichier (clé publique copiée dans le stockage). Un bruitage illisible (dossier
 * public non permis, copie impossible) est RETIRÉ avec une phrase : jamais une vidéo bloquée pour un bruitage.
 */
export async function bruitagesLisibles(sons: readonly BruitageValideCasConcret[], stockage: StockageFichiers, simule: boolean): Promise<{ sons: BruitageValideCasConcret[]; retires: string[] }> {
  const gardes: BruitageValideCasConcret[] = [];
  const retires: string[] = [];
  for (const son of sons) {
    try {
      gardes.push({ ...son, cle: await cleLisible(son.cle, stockage, simule) });
    } catch (err) {
      console.warn(`[cas-concret] bruitage retiré (${son.elementId}) : ${err instanceof Error ? err.message : "erreur"}`);
      retires.push(`Le bruitage « ${son.declencheur} » ne peut pas être lu par le serveur du studio : la vidéo est fabriquée sans lui.`);
    }
  }
  return { sons: gardes, retires };
}

/* ------------------------------------------------------------------ */
/* Les outils d'une commande                                             */
/* ------------------------------------------------------------------ */

/**
 * Le chemin de dépense Claude du format pour UNE vidéo (écriture, reformulation, et plus tard porte B et retouche par
 * discussion) : `executerRolePourVideo` sur le plafond propre du format, le socle de Will lu une fois, un pré-vol du
 * budget du studio et des crédits avant chaque appel (rien en simulation), et les appels DÉTACHÉS. Les outils rendus
 * sont ceux que le moteur enveloppe par `ecritureDetachee` : un appel n'est jamais attendu par une action ni par un passage.
 */
export async function ecritureClaudeCasConcret(
  videoId: Id,
  etapeDe: (role: DefinitionRole) => string,
  dep: Pick<DependancesBranchementsCasConcret, "claudeActif" | "socle" | "executer" | "verifierBudget" | "appels"> = {},
  /** L3-01 : origine de la commande ; elle suit le pré-vol et la réservation de chaque appel (`executerRolePourVideo`). */
  origine?: CommandeFabrication["origine"],
): Promise<OutilsEcriture> {
  const { lireParametre } = await import("./_commun");
  const { centimes, TAUX_USD_EUR_PAR_DEFAUT } = await import("@/lib/montants");
  const claudeActif = await (dep.claudeActif ?? (async () => (await import("./depense-claude-video")).claudeTextesActif()))();
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  const plafond: PlafondPropreCasConcret = { id: "ccecr", parametre: PARAM_PLAFOND_ECRITURE_CAS_CONCRET, defautUsd: PLAFOND_ECRITURE_CAS_CONCRET_USD, prefixeEtape: "Cas concret ·" };
  const executer =
    dep.executer ??
    (async (id: Id, role: DefinitionRole, entree: EntreeRole, options: { etape: string; plafondPropre: PlafondPropreCasConcret }): Promise<ResultatAppelVideo> => {
      const { executerRolePourVideo } = await import("./depense-claude-video");
      // Le plafond propre du format a la même forme que ceux du tableau ; son identifiant n'est pas dans leur liste.
      return executerRolePourVideo(id, role, entree, { ...options, ...(origine ? { origine } : {}) } as unknown as Parameters<typeof executerRolePourVideo>[3]);
    });
  const verifierBudget = dep.verifierBudget ?? (async (e, a, q) => (await import("./credits")).verifierBudgetEtCredits(e, a, q, { origine }));
  return {
    appeler: async (role, entree): Promise<ReponseAppelEcriture> => reponseEcritureDepuis(await executer(videoId, avecCasRetenus(role), entree, { etape: etapeDe(role), plafondPropre: plafond })),
    detache: dep.appels ?? appelsDetaches(),
    // Lot C4 : mémoire anti-copie commune (réglage `ecriture.memoireCasConcret`, coupé par défaut : alors rien ne change).
    memoireCommune: (await import("./memoire-cas-concret")).memoireCommuneDuStudio(),
    // Socle de Will (charte, style, preuves, ton de la v4 : le générateur du studio), lu UNE fois par lancement et
    // seulement quand Claude écrit vraiment ; illisible : journalisé, l'écriture se fait comme avant.
    ...(dep.socle ? { socle: dep.socle } : claudeActif ? { socle: socleUneFois() } : {}),
    budget: {
      reserver: async (demande) => {
        // Rien ne part en simulation (0 $). Sinon : pré-vol du budget du studio ; la réservation de l'appel est faite
        // par `executerRolePourVideo`, sous le verrou du mois, juste avant l'appel.
        if (!claudeActif) return { ok: true };
        const usd = centimes(Math.ceil(demande.coutEstimeUsd * 100 * Math.max(1, taux) - 1e-9));
        const ligne: LigneCout = { etape: demande.etape, fournisseur: "anthropic", unite: "appel", quantite: 1, prixUnitaire: usd, total: usd, nature: "estime" };
        try {
          await verifierBudget({ lignes: [ligne], total: usd }, false, "Cette écriture");
          return { ok: true };
        } catch (err) {
          // Phrase fixe par cause (jamais le message brut d'une erreur sous les yeux de Will).
          const code = err && typeof err === "object" && "code" in err ? (err as { code: unknown }).code : undefined;
          if (code === "CREDIT_INSUFFISANT") return { ok: false, message: "Crédit Claude insuffisant." };
          if (code === "BUDGET_DEPASSE") return { ok: false, message: "Budget du mois atteint." };
          throw err;
        }
      },
    },
  };
}

/**
 * Outils de la chaîne pour une commande (voir l'en-tête). Lève une phrase claire quand la fabrication ne peut pas
 * partir (voix pas prête, studio pas relié en production) : rien n'a été dépensé.
 */
export async function outilsCasConcret(c: CommandeFabrication, travailId: Id, dep: DependancesBranchementsCasConcret = {}): Promise<OutilsCasConcret> {
  const commun = await import("./_commun");
  const { depots, fournisseur, lireParametre, ressourceActive } = commun;
  const { resoudreFournisseur } = await import("@/fournisseurs");
  const { centimes, TAUX_USD_EUR_PAR_DEFAUT } = await import("@/lib/montants");
  const { CENTIMES_USD_PAR_CARACTERE_HEYGEN } = await import("@/fournisseurs/heygen/voix");
  const d = depots();

  // 1. La voix désignée, et elle seule.
  const voixId = c.distribution[0]?.voixId;
  const voix = voixId ? await d.voix.obtenir(voixId) : null;
  if (!voix || voix.statut !== "pret") throw new Error(VOIX_PAS_PRETE);
  // Toujours la voix HeyGen maître (la voix simulée seulement en essai, refusée en production plus bas) : contrôle juste après la ressource.
  const fournisseurVoix = resoudreFournisseur("voix", voix.fournisseur);
  const voixSimulee = fournisseurVoix.mode === "simulation";
  const voixLue: typeof fournisseurVoix = voixSimulee ? { ...fournisseurVoix, lire: (demande) => fournisseurVoix.lire({ ...demande, motsParSeconde: MOTS_PAR_SECONDE_VOIX_ESSAI }) } : fournisseurVoix;
  const ressource = await ressourceActive(voix.id);
  // L1-05 : seule la voix maître HeyGen parle (autre fournisseur ou autre identifiant : refus, rien n'a été dépensé). La voix d'essai ne dépense rien.
  if (voix.fournisseur !== "simulation") exigerVoixMaitre(voix.fournisseur, ressource?.idExterne);
  if (!voixSimulee && !ressource?.idExterne) throw new Error(VOIX_NON_RELIEE);

  // 2. Stockage, alignement, rendu, Claude.
  const stockage: StockageFichiers = dep.stockage ?? (await fournisseur("stockage"));
  const aligneur = await fournisseur("alignement");
  const { obtenirServiceRendu, renduSimule } = await import("@/fournisseurs/rendu/client");
  const rendu = dep.rendu ?? { service: obtenirServiceRendu(), simule: renduSimule() };
  const claudeActif = await (dep.claudeActif ?? (async () => (await import("./depense-claude-video")).claudeTextesActif()))();
  const stockageSimule = stockage.mode === "simulation";
  const production = dep.production ?? process.env.NODE_ENV === "production";
  if (production && (voixSimulee || stockageSimule || rendu.simule)) throw new Error(STUDIO_NON_RELIE);
  /** Tout est simulé : seules les simulations reçoivent les pannes d'essai. */
  const simulation = voixSimulee && stockageSimule && rendu.simule && !claudeActif;

  const env = production ? "prod" : "dev";
  const entrees = lireEntreesCasConcret(c.entrees);
  const pannes: ReturnType<typeof panneDuMot> = simulation ? panneDuMot(entrees.mot) : { refusEcriture: false };
  const taux = await lireParametre<number>("taux.usdEur", TAUX_USD_EUR_PAR_DEFAUT);
  // X10 : délai de garde commun (écrans, finitions) ; les rendus relus sans état passent par le service gardé.
  const garde: GardeRendu = { delaiMs: delaiSansNouvelleMs(), ...(dep.horloge ? { maintenant: dep.horloge } : {}) };
  const renduGarde = serviceRenduCasConcret(rendu.service, { garde, relance: dep.relance ?? 0 });
  const relire = (demande: DemandeRendu, quoi: string) => relireRendu(renduGarde, demande, quoi);

  const signerLecture = async (cle: string) => {
    const lisible = await cleLisible(cle, stockage, stockageSimule);
    return stockage.urlLectureDuree ? stockage.urlLectureDuree(lisible, 3600) : stockage.urlLecture(lisible);
  };
  const signerDepot = async (cle: string, mime: string) => {
    if (stockage.urlDepotDuree) return stockage.urlDepotDuree(cle, 3600, mime);
    if (stockageSimule) return "";
    throw new Error(STUDIO_NON_RELIE);
  };
  /** Un fichier est-il déjà déposé sous cette clé ? (jamais en simulation : rien n'y est déposé.) */
  const existe = async (cle: string) => !stockageSimule && (await stockage.confirmerDepot(cle).catch(() => ({ ok: false }))).ok;

  // 3. Budget : la voix au caractère (tarif du fournisseur de la voix désignée, au taux prudent 1 $ = 1 €).
  const tarifUsd = fournisseurVoix.capacites.tarifUsd?.unite === "caractere" ? fournisseurVoix.capacites.tarifUsd.centimesUsd : CENTIMES_USD_PAR_CARACTERE_HEYGEN;
  const tarifCentimesParCaractere = tarifUsd * Math.max(1, taux);
  // L3-01 : contrôle, réservation et engagement sous le verrou des crédits, avec l'origine de la commande.
  const reserverVoix = dep.verifierEtReserver ?? (async (e, a, q, demande) => (await import("./credits")).verifierEtReserverSelonOrigine(c.origine, e, a, q, demande));

  // 4. Écriture et reformulation : le chemin de dépense Claude du studio, sur un plafond propre au format.
  const ecriture = await ecritureClaudeCasConcret(c.videoId, (role) => (role.id === roleEcritureCasConcret.id ? ETAPE_ECRITURE : ETAPE_REFORMULATION), { ...dep, claudeActif: async () => claudeActif }, c.origine);

  // P2C : images déposées par Will pour les écrans derrière une connexion (aucune capture pour ces étapes) ; réglage
  // `casConcret.ecranFourni` éteint : la lecture rend une liste vide.
  const { ecransFournisPourFabrication } = await import("@/components/formats/cas-concret/ecran-fourni/service");
  const ecransFournis = entrees.casId ? await ecransFournisPourFabrication(entrees.casId).catch(() => []) : [];

  const sons = await bruitagesLisibles(bruitagesValides(c.bruitagesDisponibles, c.medias), stockage, stockageSimule);
  const contexteMarque = (await d.contexteAxion.lister()).sort((a, b) => b.version - a.version)[0];
  const interdits = [...(contexteMarque?.jargonInterdit ?? []), ...(contexteMarque?.promessesInterdites ?? [])].filter((x) => typeof x === "string" && x.trim());

  // L2 : la variété (historique des tirages `casConcret.historiqueTirages`, mise d'une version précédente).
  const variete = dep.variete === undefined ? (await import("./cas-concret-variete")).outilsVarieteDuStudio() : dep.variete;

  return {
    env,
    ...(variete ? { variete } : {}),
    numeroVersion: dep.numeroVersion ?? (async (versionId) => {
      const v = await d.versions.obtenir(versionId).catch(() => null);
      return v?.numeroSuivi ?? v?.numero;
    }),
    // V4-3 : le script validé du cas (aucun appel d'écriture) ; sans lui, Claude écrit et Will valide avant la voix.
    scriptValide: dep.scriptValide ?? (async (casId) => (await import("./cas-concret-scripts")).scriptValideDuStudio(casId)),
    scriptValideDeLaVideo: dep.scriptValideDeLaVideo ?? (async (casId, videoId) => (await import("./cas-concret-scripts")).scriptValideDeLaVideo(casId, videoId)),
    scriptsAnterieurs: dep.scriptsAnterieurs ?? (async (_casId, videoId) => (await import("./cas-concret-scripts")).scriptsDejaEcrits(videoId)),
    voix: {
      voix: () => voixLue,
      stockage: () => stockage,
      aligneur: () => aligneur,
      // Analyse et nettoyage de la voix maître : sous délai de garde (X10).
      rendu: () => renduGarde,
      renduEstSimule: () => rendu.simule,
      idVoix: ressource?.idExterne ?? voix.id,
      // Vitesse de la recette de la voix (1,1), comme le tableau animé ; le fournisseur pose moteur et langue.
      reglages: { ...(voix.reglages ?? { vitesse: 1, stabilite: 45, emotion: 30 }), vitesse: RECETTE_VOIX_CAS_CONCRET.synthese.vitesse },
      tauxUsdEur: taux,
      fournisseurVoix: voix.fournisseur,
      // La voix de synthèse garde son horodatage, sauf si elle n'en donne pas. Essais réels du 14/10 : recalés par
      // l'aligneur, les mots ABSORBAIENT les hésitations (« euh ») de HeyGen, que le contrôle ne voyait plus ; Will les
      // entend. L'horodatage de HeyGen, lui, les laisse dans un blanc, où la mesure du son les trouve.
      caler: (motsEstimes) => motsEstimes && aligneur.mode !== "simulation",
      regles: REGLES_BLANCS_CAS_CONCRET,
      cle: (nom) => `studio/${env}/audio-maitre/${c.videoId}/${nom}`,
      assembler: async (a) => {
        if (rendu.simule) return { cle: a.sortieCle, dureeSec: a.recette?.dureeSec ?? dureeAssemblee(a.morceaux, a.tempo), mesures: { ...(a.tempo ? { tempo: a.tempo } : {}) } };
        if (a.recette) {
          // Recette de la voix (X4) : le corps (`audio`) et la fin (`audio2`) bruts, un seul traitement final.
          const demande: DemandeRendu = {
            idRendu: idRenduCasConcret("cc-recette", a.id, a.sortieCle),
            operation: "nettoyage-audio",
            file: "courte",
            entrees: { audio: await signerLecture(a.recette.corps), audio2: await signerLecture(a.recette.fin) },
            sortie: { urlDepot: await signerDepot(a.sortieCle, "audio/wav"), cle: a.sortieCle },
            parametres: a.recette.parametres,
          };
          const e = await relire(demande, "La recette de la voix");
          const mesures = e.mesures ?? {};
          return { cle: e.sortieCle, dureeSec: mesures.dureeSec ?? a.recette.dureeSec, mesures };
        }
        const cles = [...new Set(a.morceaux.map((m) => m.entree))];
        const nom = (cle: string) => `son${cles.indexOf(cle)}`;
        const demande: DemandeRendu = {
          idRendu: idRenduCasConcret("cc-asm", a.id, a.sortieCle),
          operation: "assemblage",
          file: "courte",
          entrees: Object.fromEntries(await Promise.all(cles.map(async (cle) => [nom(cle), await signerLecture(cle)] as const))),
          sortie: { urlDepot: await signerDepot(a.sortieCle, "audio/wav"), cle: a.sortieCle },
          parametres: { sortie: "wav", morceaux: a.morceaux.map((m) => ({ entree: nom(m.entree), deSec: m.deSec, aSec: m.aSec })), ...(a.fonduMs ? { fonduMs: a.fonduMs } : {}), ...(a.tempo ? { tempo: a.tempo } : {}) },
        };
        const e = await relire(demande, "L'assemblage de la voix");
        const mesures = e.mesures ?? {};
        return { cle: e.sortieCle, dureeSec: mesures.dureeSec ?? dureeAssemblee(a.morceaux, a.tempo), mesures };
      },
      // V4-1 : le son (WAV, 16 Mo au plus) pour mesurer ses blancs et contrôler la fin de la voix ; rien en simulation.
      lireSon: async (cle) => {
        // Un stockage qui sait lire ses fichiers (R2 : `lireDebut`) est lu EN ENTIER par une adresse signée ; sinon rien.
        if (rendu.simule || stockageSimule || !stockage.lireDebut || !stockage.urlLectureDuree) return null;
        const adresse = await stockage.urlLectureDuree(await cleLisible(cle, stockage, stockageSimule), 600).catch(() => null);
        return adresse ? lireSonEntier(adresse) : null;
      },
      mesurerPauses: async (cle, pauses) => {
        if (rendu.simule) return pauses.map(() => NIVEAU_SILENCE_DB);
        const media = await signerLecture(cle);
        // `mesure-son` rend le plus fort des blancs demandés : une demande par blanc donne le niveau de chacun. Toutes
        // sont soumises (ou relues) à chaque passage ; une seule pas finie : `RenduEnCours`.
        const lus = await Promise.allSettled(
          pauses.map(async (p) => {
            const id = idRenduCasConcret("cc-pause", cle, p.deSec, p.aSec);
            const sortieCle = `studio/${env}/audio-maitre/${c.videoId}/${id}.json`;
            const e = await relire({ idRendu: id, operation: "mesure-son", file: "courte", entrees: { media }, sortie: { urlDepot: await signerDepot(sortieCle, "application/json"), cle: sortieCle }, parametres: { pauses: [[p.deSec, p.aSec]] } }, "La mesure des blancs");
            const n = e.mesures?.pauseMaxDb;
            return typeof n === "number" && Number.isFinite(n) ? n : NIVEAU_SILENCE_DB;
          }),
        );
        const panne = lus.find((x): x is PromiseRejectedResult => x.status === "rejected" && !estRenduEnCours(x.reason));
        if (panne) throw panne.reason;
        const enCours = lus.find((x): x is PromiseRejectedResult => x.status === "rejected");
        if (enCours) throw enCours.reason;
        return lus.map((x) => (x as PromiseFulfilledResult<number>).value);
      },
    },
    scenes: {
      rendu: () => rendu.service,
      depot: (cle) => signerDepot(cle, "video/mp4"),
      existe,
      garde,
    },
    montage: {
      rendu: () => rendu.service,
      signer: async (lectures, depotsDemandes) => ({
        lectures: Object.fromEntries(await Promise.all(Object.entries(lectures).map(async ([n, cle]) => [n, await signerLecture(cle)] as const))),
        depots: Object.fromEntries(await Promise.all(depotsDemandes.map(async (x) => [x.cle, await signerDepot(x.cle, x.mime)] as const))),
      }),
      cle: (cmd, nom) => `studio/${env}/videos/${cmd.videoId}/${nom}`,
      seriesFichierInaccessible: SERIES_FICHIER_INACCESSIBLE_CAS_CONCRET,
      garde,
    },
    captures: {
      capturer: async (demande): Promise<ResultatCapture> => {
        // Simulation : aucune fausse image ; l'écran prend son dessin de repli.
        if (rendu.simule || stockageSimule) return { ok: false, raison: "capture impossible sans le serveur de rendu", reessayable: false };
        const mime = demande.parametres.type === "video" ? "video/mp4" : "image/jpeg";
        try {
          const e = await relire(
            { idRendu: idRenduCasConcret("cc-capture", demande.cle), operation: "capture-site", file: "longue", entrees: { page: demande.page }, sortie: { urlDepot: await signerDepot(demande.cle, mime), cle: demande.cle }, parametres: { ...demande.parametres } },
            "La capture du site",
          );
          return { ok: true, cle: e.sortieCle, mime, mesures: e.mesures ?? {} };
        } catch (err) {
          if (estRenduEnCours(err)) throw err;
          const reessayable = !!err && typeof err === "object" && "reessayable" in err ? Boolean((err as { reessayable: unknown }).reessayable) : true;
          return { ok: false, raison: "la capture a échoué", reessayable };
        }
      },
      existe,
    },
    ecriture: {
      ...ecriture,
      appeler: async (role, entree): Promise<ReponseAppelEcriture> => {
        // Panne d'essai `REFUS` : l'écriture rend une réponse vide, refusée à chaque essai.
        if (pannes.refusEcriture && role.id === roleEcritureCasConcret.id) return { ok: true, simule: true, texte: "" };
        return ecriture.appeler(role, entree);
      },
    },
    budget: {
      tarifCentimesParCaractere,
      verifierEtReserver: async (e) => {
        const total = centimes(e.centimes);
        const lignes: LigneCout[] = [{ etape: "voix", fournisseur: voix.fournisseur, unite: "caractere", quantite: e.caracteres, prixUnitaire: centimes(tarifCentimesParCaractere), total, nature: "estime" }];
        await reserverVoix({ lignes, total }, e.centimes, "Cette vidéo", { videoId: c.videoId, travailId });
      },
      // Mode indicatif : le contrôle par montant de la part voix est remplacé par un compteur de lectures (3 par texte).
      ...((await (await import("./mode-budget")).budgetIndicatifPour(c.origine)) ? { indicatif: { lecturesVoixMax: (await import("@/moteurs/montage-cas-concret/fabriquer")).LECTURES_VOIX_MAX_INDICATIF, facteurSecurite: (await import("./mode-budget")).FACTEUR_SECURITE_BUDGET } } : {}),
    },
    contexte: {
      aujourdhui: new Date().toISOString().slice(0, 10),
      interdits,
      tableDesFins: TABLE_FINS_DIAGNOSTIC,
      bruitagesValides: sons.sons,
      ...(sons.retires.length ? { bruitagesRetires: sons.retires } : {}),
      ...(pannes.panneDEssai ? { panneDEssai: pannes.panneDEssai } : {}),
      exigerScriptValide: dep.validationScript ?? true,
      ...(ecransFournis.length ? { ecransFournis } : {}),
    },
  };
}

brancherServicesCasConcret({ outils: (c, travailId, o) => outilsCasConcret(c, travailId, { relance: o?.relance ?? 0 }), retouchesAllumees: retouchesAllumeesConnues });
