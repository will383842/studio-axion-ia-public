/**
 * TÂCHES DE FOND DU TABLEAU ANIMÉ (constat du 12/10 en production : l'écriture du script tenait plus de 3 minutes dans
 * UNE action serveur ; Cloudflare coupe toute requête au-delà de 100 s : l'écran tombait sur l'erreur générique, les
 * appels étaient payés et rien n'était gardé).
 *
 * Désormais, « Écrire le script pour moi » et « Découper en scènes » ENREGISTRENT une tâche dans le brouillon
 * (`video.entrees.tableauCreation.tache`) et rendent la main tout de suite. Le travail est fait par la BOUCLE DE FOND
 * du studio (`services/boucle.ts`, tâche annexe « tâches du tableau animé », hors du tour, une seule à la fois, dans
 * l'instance qui tient le verrou de la boucle). L'écran interroge l'état toutes les 3 s (`suiviTacheTableau`).
 *
 * - Après CHAQUE appel payé, sa réponse est gardée dans la tâche (`journal`) : une reprise (page fermée, redémarrage,
 *   erreur) REJOUE ces réponses au lieu de rappeler Claude. Un appel déjà payé n'est jamais repayé.
 * - Un appel en vol au moment d'un redémarrage (`enVol`) n'a pas laissé de réponse : la tâche passe « interrompue » ;
 *   « Reprendre » refait seulement la suite, après confirmation du prix (enveloppe neuve du plafond propre).
 * - Toute erreur : `console.error` (vidéo, étape, nature ; jamais de clé ni de texte de la demande), message en
 *   français dans la tâche, bouton « Réessayer » à l'écran. Jamais l'écran d'erreur générique.
 * - La trace du script (`tracesScriptsTableau`) est ouverte à l'enregistrement de la demande et complétée à chaque
 *   étape, y compris en cas d'erreur ou d'interruption.
 */
import "server-only";
import type { AngleScript, AppelTrace, DemandeScriptTableau } from "@/domaine/scripts-tableau";
import type { Id, Video } from "@/domaine/types";
import type { ReponseClaude } from "@/fournisseurs/claude/client";
import { masquerSecrets } from "@/fournisseurs/claude/secret";
import type { DefinitionRole, EntreeRole } from "@/generateur/roles/types";
import type { OutilsDecoupage, ReponseAppelDecoupage } from "@/moteurs/montage-tableau/decoupage";
import { nouvelId } from "@/lib/ids";
import type { ClientScripts } from "./tableau-scripts";
import type { MethodeTableau } from "./tableau-scripts/consignes";
import { depots, journaliser, maintenant, sousVerrou } from "./_commun";

/* ------------------------------------------------------------------ */
/* La tâche, gardée dans le brouillon                                    */
/* ------------------------------------------------------------------ */

export type TypeTacheTableau = "ecriture" | "decoupage";
export type EtapeTacheTableau = "accroches" | "ecriture" | "relance" | "relecture" | "decoupage";
export type StatutTacheTableau = "en-attente" | "en-cours" | "terminee" | "refusee" | "erreur" | "interrompue";

/** Un appel payé, gardé avec sa réponse : rejoué tel quel à la reprise (jamais repayé). */
export interface AppelJournalTableau {
  /** Passe du générateur (`angle`, `ecriture`, `relance`, `relecture`) ou rôle du découpage. */
  passe: string;
  reponse: unknown;
  /** Coût RÉEL de l'appel (dépense enregistrée), en dollars. */
  coutUsd: number;
  dureeMs: number;
  le: string;
  /** Découpage : raison d'arrêt du modèle (« max_tokens » : réponse coupée) et jetons de l'appel. */
  stopReason?: string | null;
  jetons?: { entree: number; cacheLu: number; cacheEcrit: number; sortie: number };
}

/** Longueur gardée de la réponse brute d'un appel du découpage, dans le journal de la tâche. */
export const BRUT_MAX_JOURNAL = 20_000;

/** La réponse du découpage telle que gardée au journal : le texte brut tronqué à `BRUT_MAX_JOURNAL` caractères (PUR). */
export function reponsePourJournal(r: ReponseAppelDecoupage): ReponseAppelDecoupage {
  if (!r.ok || typeof r.donnees !== "string" || r.donnees.length <= BRUT_MAX_JOURNAL) return r;
  return { ...r, donnees: r.donnees.slice(0, BRUT_MAX_JOURNAL) };
}

export interface TacheTableau {
  id: string;
  type: TypeTacheTableau;
  statut: StatutTacheTableau;
  /** Étape en cours (ou la dernière atteinte). */
  etape: EtapeTacheTableau;
  creeLe: string;
  majLe: string;
  /** Début de l'enveloppe de dépense (dernière confirmation à l'écran) : le plafond propre compte depuis. */
  depuis: string;
  /** Un appel payant est parti et n'est pas encore revenu. */
  enVol?: { etape: EtapeTacheTableau; le: string };
  journal: AppelJournalTableau[];
  /** Écriture : la demande, l'angle repris (autre accroche), le pire cas en dollars, la trace. */
  demande?: DemandeScriptTableau;
  angle?: AngleScript;
  pireUsd?: number;
  traceId?: string;
  /** Écriture : la méthode dont le prix a été confirmé (réglage `tableau.methode`) ; absente : tâche d'avant le lot A5, donc « complete » (les nouvelles tâches l'écrivent toujours). */
  methode?: MethodeTableau;
  /** Découpage : le jour des règles et la version visée. */
  aujourdhui?: string;
  versionId?: string;
  /** Fin : une phrase (erreur, refus), et le détail d'un refus. */
  message?: string;
  motifs?: string[];
}

export const LIBELLES_ETAPES_TABLEAU: Readonly<Record<EtapeTacheTableau, string>> = {
  accroches: "Je cherche cinq accroches…",
  ecriture: "J'écris le script…",
  relance: "Je corrige les défauts relevés…",
  relecture: "Je le relis…",
  decoupage: "Je découpe en scènes…",
};

export const tacheActive = (t: Pick<TacheTableau, "statut"> | null | undefined): boolean => !!t && (t.statut === "en-attente" || t.statut === "en-cours");

/** Tâche neuve, en attente de la boucle de fond. */
export function nouvelleTache(type: TypeTacheTableau, etape: EtapeTacheTableau, extra: Partial<TacheTableau> = {}): TacheTableau {
  const t = maintenant();
  return { id: nouvelId("tq"), type, statut: "en-attente", etape, creeLe: t, majLe: t, depuis: t, journal: [], ...extra };
}

const CLE = "tableauCreation";

export function tacheDe(video: Pick<Video, "entrees"> | null | undefined): TacheTableau | null {
  const b = (video?.entrees as Record<string, unknown> | undefined)?.[CLE] as { tache?: TacheTableau } | undefined;
  const t = b?.tache;
  return t && typeof t === "object" && typeof t.id === "string" && Array.isArray(t.journal) ? t : null;
}

/** La tâche d'un brouillon (lecture tolérante). */
export async function lireTache(videoId: Id): Promise<TacheTableau | null> {
  return tacheDe(await depots().videos.obtenir(videoId));
}

/**
 * Modifie la tâche d'un brouillon, sous le verrou du studio, sur une copie FRAÎCHE de la vidéo (aucune écriture de
 * l'écran n'est écrasée). `seulement` : l'identifiant de la tâche visée (une tâche remplacée entre-temps n'est pas touchée).
 */
export async function modifierTache(videoId: Id, seulement: string | null, f: (t: TacheTableau | null) => TacheTableau | null): Promise<TacheTableau | null> {
  return sousVerrou(async () => {
    const video = await depots().videos.obtenir(videoId);
    const b = (video?.entrees as Record<string, unknown> | undefined)?.[CLE] as Record<string, unknown> | undefined;
    if (!video || !b) return null;
    const avant = tacheDe(video);
    if (seulement && avant?.id !== seulement) return avant;
    const apres = f(avant);
    const tache = apres ? { ...apres, majLe: maintenant() } : undefined;
    await depots().videos.modifier(videoId, { entrees: { ...video.entrees, [CLE]: { ...b, tache } } });
    return tache ?? null;
  });
}

/* ------------------------------------------------------------------ */
/* Ce que l'écran lit                                                    */
/* ------------------------------------------------------------------ */

export interface VueTacheTableau {
  id: string;
  type: TypeTacheTableau;
  statut: StatutTacheTableau;
  etape: EtapeTacheTableau;
  /** La phrase à afficher, en clair. */
  phrase: string;
  /** Appels déjà faits (gardés). */
  appels: number;
  coutUsd: number;
  depuis: string;
  majLe: string;
  motifs: string[];
  /** La boucle de fond ne tourne pas dans ce processus (la tâche attendra). */
  boucleArretee: boolean;
}

export function vueTache(t: TacheTableau, boucleActive: boolean): VueTacheTableau {
  const appels = t.journal.length;
  const quoi = t.type === "ecriture" ? "L'écriture" : "Le découpage";
  const phrase =
    t.statut === "en-attente"
      ? boucleActive
        ? "Je commence…"
        : `${quoi} attend : le travail de fond du studio est arrêté, il reprendra à son redémarrage.`
      : t.statut === "en-cours"
        ? LIBELLES_ETAPES_TABLEAU[t.etape]
        : t.statut === "interrompue"
          ? `${t.type === "ecriture" ? "Écriture interrompue" : "Découpage interrompu"} (redémarrage du studio pendant un appel). ${appels ? `Les ${appels} appel${appels > 1 ? "s" : ""} déjà fait${appels > 1 ? "s sont gardés" : " est gardé"} : « Reprendre » fait seulement la suite.` : "« Reprendre » relance le travail."}`
          : t.statut === "erreur"
            ? (t.message ?? `${quoi} s'est arrêté${t.type === "ecriture" ? "e" : ""}. Réessayez.`)
            : t.statut === "refusee"
              ? (t.message ?? `${quoi} est refusé${t.type === "ecriture" ? "e" : ""}.`)
              : t.type === "ecriture"
                ? "Script écrit."
                : "Scènes prêtes.";
  return { id: t.id, type: t.type, statut: t.statut, etape: t.etape, phrase, appels, coutUsd: t.journal.reduce((s, a) => s + a.coutUsd, 0), depuis: t.depuis, majLe: t.majLe, motifs: t.motifs ?? [], boucleArretee: !boucleActive };
}

/* ------------------------------------------------------------------ */
/* Rejouer les appels déjà payés                                         */
/* ------------------------------------------------------------------ */

/** Note l'appel neuf « en vol » ; vidéo supprimée entre-temps : l'appel (payé) ne part pas. */
async function marquerEnVol(videoId: Id, tacheId: string, etape: EtapeTacheTableau): Promise<void> {
  const notee = await modifierTache(videoId, tacheId, (t) => t && { ...t, statut: "en-cours", etape, enVol: { etape, le: maintenant() } });
  if (!notee && !(await depots().videos.obtenir(videoId))) throw new Error(`Vidéo ${videoId} supprimée : appel non lancé.`);
}

/**
 * Enveloppe un client du générateur : les appels déjà gardés dans la tâche sont REJOUÉS (même ordre, même passe) ; un
 * appel neuf est noté « en vol » avant de partir, puis sa réponse est gardée dès son retour.
 */
export function clientRejoue(videoId: Id, tacheId: string, client: ClientScripts, journalInitial: readonly AppelJournalTableau[]): ClientScripts {
  let journal = [...journalInitial];
  let rang = 0;
  return {
    simule: client.simule,
    async appeler(r, passe: AppelTrace["passe"]) {
      const i = rang++;
      const deja = journal[i];
      if (deja && deja.passe === passe) return { ...(deja.reponse as ReponseClaude), coutUsd: deja.coutUsd, dureeMs: deja.dureeMs };
      journal = journal.slice(0, i);
      const etape: EtapeTacheTableau = passe === "angle" ? "accroches" : passe;
      await marquerEnVol(videoId, tacheId, etape);
      const debut = Date.now();
      try {
        const reponse = await client.appeler(r, passe);
        const dureeMs = Date.now() - debut;
        const { coutUsd: cout, dureeMs: _d, ...brute } = reponse;
        void _d;
        journal = [...journal, { passe, reponse: brute, coutUsd: cout ?? 0, dureeMs, le: maintenant() }];
        await modifierTache(videoId, tacheId, (t) => t && { ...t, journal, enVol: undefined });
        return { ...reponse, dureeMs };
      } catch (e) {
        await modifierTache(videoId, tacheId, (t) => t && { ...t, enVol: undefined });
        throw e;
      }
    },
  };
}

/** Même chose pour le découpage : les réponses valides déjà payées sont rejouées par rang et par rôle. */
export function appelerRejoue(videoId: Id, tacheId: string, appeler: OutilsDecoupage["appeler"], journalInitial: readonly AppelJournalTableau[]): OutilsDecoupage["appeler"] {
  let journal = [...journalInitial];
  let rang = 0;
  return async (role: DefinitionRole, entree: EntreeRole): Promise<ReponseAppelDecoupage> => {
    const i = rang++;
    const deja = journal[i];
    if (deja && deja.passe === role.id) return deja.reponse as ReponseAppelDecoupage;
    journal = journal.slice(0, i);
    await marquerEnVol(videoId, tacheId, "decoupage");
    const debut = Date.now();
    try {
      const reponse = await appeler(role, entree);
      // Seule une réponse reçue (payée) est gardée, avec sa réponse brute, sa raison d'arrêt, ses jetons et son coût
      // RÉEL : un arrêt avant l'appel n'a rien coûté.
      if (reponse.ok && !reponse.simule) {
        journal = [
          ...journal,
          { passe: role.id, reponse: reponsePourJournal(reponse), coutUsd: reponse.coutUsd ?? 0, dureeMs: Date.now() - debut, le: maintenant(), stopReason: reponse.stopReason ?? null, ...(reponse.jetons ? { jetons: reponse.jetons } : {}) },
        ];
      }
      await modifierTache(videoId, tacheId, (t) => t && { ...t, journal, enVol: undefined });
      return reponse;
    } catch (e) {
      await modifierTache(videoId, tacheId, (t) => t && { ...t, enVol: undefined });
      throw e;
    }
  };
}

/* ------------------------------------------------------------------ */
/* La boucle de fond                                                     */
/* ------------------------------------------------------------------ */

const cleEnCours = Symbol.for("studio-axion-ia.taches-tableau-en-cours");
/** Tâches traitées EN CE MOMENT par ce processus (une tâche « en cours » absente d'ici a été coupée par un redémarrage). */
export function tachesEnCours(): Set<string> {
  const g = globalThis as typeof globalThis & { [cleEnCours]?: Set<string> };
  return (g[cleEnCours] ??= new Set());
}

/** Nom de la tâche annexe de la boucle de fond. */
export const NOM_ANNEXE_TABLEAU = "tâches du tableau animé";

/** Ce que fait une tâche (fourni par `tableau-creation.ts`, injecté par les tests). */
export type ExecuterTache = (videoId: Id, tache: TacheTableau) => Promise<void>;

/** Phrase sûre d'une erreur (masquée, courte) pour le journal du serveur et l'écran. */
export function phraseErreur(e: unknown): string {
  const brut = e instanceof Error ? e.message : String(e);
  return masquerSecrets(brut, []).replace(/\s+/g, " ").slice(0, 200);
}

/**
 * Un passage de la boucle : marque « interrompues » les tâches coupées pendant un appel payé (redémarrage), puis traite
 * les tâches à faire, la plus ancienne d'abord, jusqu'à ce qu'il n'y en ait plus. Rend le nombre de tâches traitées.
 */
export async function travaillerTaches(executer: ExecuterTache): Promise<number> {
  const enCours = tachesEnCours();
  let faites = 0;
  for (let garde = 0; garde < 50; garde++) {
    const videos = await depots().videos.lister((v) => v.statut === "brouillon" && tacheActive(tacheDe(v)));
    const candidates: { videoId: Id; tache: TacheTableau }[] = [];
    for (const v of videos) {
      const t = tacheDe(v)!;
      if (enCours.has(t.id)) continue;
      if (t.statut === "en-cours" && t.enVol) {
        await marquerInterrompue(v.id, t);
        continue;
      }
      candidates.push({ videoId: v.id, tache: t });
    }
    const suivante = candidates.sort((a, b) => a.tache.creeLe.localeCompare(b.tache.creeLe))[0];
    if (!suivante) return faites;
    enCours.add(suivante.tache.id);
    try {
      await executer(suivante.videoId, suivante.tache);
    } catch (e) {
      // Filet : `executer` range lui-même ses erreurs ; une exception ici ne doit jamais laisser la tâche « en cours ».
      console.error(`[tableau] tâche ${suivante.tache.type} de la vidéo ${suivante.videoId} en échec à l'étape « ${suivante.tache.etape} » : ${e instanceof Error ? e.name : "erreur"} — ${phraseErreur(e)}`);
      await modifierTache(suivante.videoId, suivante.tache.id, (t) => t && { ...t, statut: "erreur", enVol: undefined, message: "Le travail s'est arrêté sur une erreur. Les appels déjà faits sont gardés : réessayez." }).catch(() => undefined);
    } finally {
      enCours.delete(suivante.tache.id);
    }
    faites++;
  }
  return faites;
}

async function marquerInterrompue(videoId: Id, t: TacheTableau): Promise<void> {
  console.error(`[tableau] tâche ${t.type} de la vidéo ${videoId} interrompue pendant l'étape « ${t.enVol?.etape ?? t.etape} » (redémarrage du studio pendant un appel)`);
  await modifierTache(videoId, t.id, (x) => x && { ...x, statut: "interrompue", message: undefined });
  if (t.traceId) {
    const { fermerTraceScript } = await import("./tableau-scripts");
    await fermerTraceScript(t.traceId, "interrompu", `Interrompue pendant l'étape « ${t.enVol?.etape ?? t.etape} » (redémarrage du studio pendant un appel).`);
  }
  await journaliser("video", `Tableau animé : ${t.type === "ecriture" ? "écriture" : "découpage"} interrompu par un redémarrage, à reprendre`, { type: "video", id: videoId });
}
