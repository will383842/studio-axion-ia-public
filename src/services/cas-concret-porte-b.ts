/**
 * PORTE B DU « CAS CONCRET MD » (tâche P2S, lot A, d'après P2-08 ; moteur de P2-01 : `montage-cas-concret/description.ts`).
 *
 * Will écrit librement dans la case de `/cas-concret` ; le studio en tire un cas, puis ouvre la même feuille « Votre
 * vidéo » qu'un cas du catalogue.
 *
 * - AUCUN appel payant pour une description trop courte ou hors sujet : `verifierDescription` refuse avant tout, avec une
 *   phrase d'aide, et rien n'est créé.
 * - Sinon un BROUILLON de vidéo du format porte la demande (`entrees.casConcret` : `porte: "porte-b"`, la description,
 *   l'identifiant du cas tiré du texte) : la dépense Claude lui est rattachée. Le même texte reprend le même brouillon.
 * - L'appel Claude est DÉTACHÉ (`ecritureDetachee`, `appels.ts`) : `demarrerPorteB` et `suivrePorteB` ne l'attendent
 *   jamais ; le premier passage le lance, les suivants relisent sa réponse (l'écran se met à jour seul). Un appel en
 *   cours n'est jamais doublé (journal gardé dans les entrées du brouillon, verrou du service).
 * - Le cas rendu est gardé AVEC la vidéo (`entrees.casConcret.cas`), jamais au catalogue ni dans les validations.
 * - Garde d'honnêteté : un fait que Will n'a pas donné tel quel et qui ne vient pas du site est « à confirmer »
 *   (`faitsAConfirmer`) ; `confirmerFaitPorteB` le confirme ou le retire. Tant qu'il en reste un, `refusAvantPrix`
 *   (appelé par la feuille, le lancement et le moteur) refuse avec la même phrase.
 * Ce fichier ne publie rien.
 */
import "server-only";
import { empreinteCas, type CasConcret } from "@/formats/cas-concret/cas";
import type { Id, Video } from "@/domaine/types";
import { casDesEntrees, ENTREE_CAS_CONCRET, lireEntreesCasConcret } from "@/moteurs/montage-cas-concret";
import { ecritureDetachee, type AppelSuivi } from "@/moteurs/montage-cas-concret/appels";
import { casDepuisDescription, ETAPE_DESCRIPTION, idDescription } from "@/moteurs/montage-cas-concret/description";
import { faitsAConfirmer, verifierDescription } from "@/moteurs/montage-cas-concret/honnetete";
import { creerVerrou, depots, ErreurStudio, journaliser } from "./_commun";
import { exigerSession } from "./auth";
import { REGLAGES_CAS_CONCRET, reglageAllume } from "./cas-concret-reglages";
import { ecritureClaudeCasConcret, type DependancesBranchementsCasConcret } from "./cas-concret-branchements";
import { nouveauBrouillonFormat } from "./creation-format";

const FORMAT_CAS_CONCRET_ID = "cas-concret";

/** Ce que l'écran montre pendant que le cas se prépare. */
export const PHRASE_PREPARATION = "Je prépare votre cas…";
/** Le cas n'a pas pu être construit : la main revient à Will. */
export const PHRASE_PORTE_B_ETEINTE = "Cette façon de demander un cas n'est pas ouverte.";
export const PHRASE_ECHEC_PORTE_B = "Je n'ai pas pu tirer un cas de ce texte. Reformulez-le en deux phrases : la tâche, et qui la fait.";

/** Un fait du cas à confirmer, tel que l'écran le montre. */
export interface FaitAConfirmer {
  id: string;
  enonce: string;
}

export type EtatPorteB =
  | { statut: "refusee"; phrase: string }
  | { statut: "en-cours"; videoId: Id; phrase: string }
  | { statut: "echec"; videoId: Id; phrase: string }
  | { statut: "pret"; videoId: Id; cas: CasConcret; empreinte: string; aConfirmer: FaitAConfirmer[] };

export type DependancesPorteB = Pick<DependancesBranchementsCasConcret, "claudeActif" | "executer" | "verifierBudget" | "appels"> & { maintenant?: () => number };

/** Pas encore de réponse : le passage rend la main. */
class AttenteCas extends Error {}
/** Délai dépassé : l'appel est tenu pour perdu. */
class CasExpire extends Error {}

const brut = (v: Pick<Video, "entrees">): Record<string, unknown> => ((v.entrees as Record<string, unknown> | undefined)?.[ENTREE_CAS_CONCRET] as Record<string, unknown> | undefined) ?? {};

/** Un brouillon de la porte B (sinon `null`). */
function estPorteB(v: Video | null | undefined): v is Video {
  return !!v && v.formatId === FORMAT_CAS_CONCRET_ID && lireEntreesCasConcret(v.entrees).porte === "porte-b";
}

async function garderEntrees(video: Video, champs: Record<string, unknown>): Promise<Video> {
  const entrees = { ...(video.entrees ?? {}), [ENTREE_CAS_CONCRET]: { ...brut(video), ...champs } };
  await depots().videos.modifier(video.id, { entrees });
  return { ...video, entrees };
}

/** L'état prêt d'une vidéo dont le cas est construit (faits à confirmer : ceux qui ne sont ni confirmés ni retirés). */
function etatPret(video: Video, cas: CasConcret): EtatPorteB {
  const e = lireEntreesCasConcret(video.entrees);
  const confirmes = new Set(e.faitsConfirmes ?? []);
  const aConfirmer = faitsAConfirmer(cas, e.description ?? "")
    .filter((f) => !confirmes.has(f.id))
    .map((f) => ({ id: f.id, enonce: f.enonce }));
  return { statut: "pret", videoId: video.id, cas, empreinte: empreinteCas(cas), aConfirmer };
}

const verrou = creerVerrou();

/**
 * Will a écrit un texte libre. Trop court ou hors sujet : la phrase d'aide, rien n'est créé, aucun appel. Sinon : le
 * brouillon (repris si le même texte en a déjà un), puis un premier passage qui LANCE l'appel sans l'attendre.
 */
export async function demarrerPorteB(texte: string, dep: DependancesPorteB = {}): Promise<EtatPorteB> {
  await exigerSession();
  // Réglage `casConcret.porteB` éteint : aucun appel, aucun brouillon.
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.porteB))) return { statut: "refusee", phrase: PHRASE_PORTE_B_ETEINTE };
  const description = texte.trim();
  const refus = verifierDescription(description);
  if (refus.length) return { statut: "refusee", phrase: refus[0] };
  const casId = idDescription(description);
  return verrou(async () => {
    const deja = (await depots().videos.lister((v) => v.formatId === FORMAT_CAS_CONCRET_ID && v.statut === "brouillon")).find((v) => estPorteB(v) && lireEntreesCasConcret(v.entrees).casId === casId);
    let video: Video;
    if (deja) {
      // Le même texte après un échec : un nouvel essai. Le journal est gardé, ses appels clos : un appel en échec repart
      // sous une nouvelle tentative (jamais relu sous l'ancienne clé), une réponse arrivée est relue sans être repayée.
      const appels = Object.fromEntries(Object.entries((brut(deja).appels as Record<string, AppelSuivi> | undefined) ?? {}).map(([id, s]) => [id, { ...s, clos: true }]));
      video = brut(deja).echec ? await garderEntrees(deja, { echec: undefined, appels }) : deja;
    } else {
      video = await nouveauBrouillonFormat({ formatId: FORMAT_CAS_CONCRET_ID, titre: "Exemple", sujet: description, distribution: [], entrees: { [ENTREE_CAS_CONCRET]: { porte: "porte-b", casId, description } } });
      await journaliser("cas-concret", "Cas demandé par une description (porte B)");
    }
    return avancer(video, dep);
  });
}

/** L'écran relit l'état : le cas, l'attente ou l'échec. Un passage ne fait jamais qu'un pas, et n'attend aucun appel. */
export async function suivrePorteB(videoId: Id, dep: DependancesPorteB = {}): Promise<EtatPorteB> {
  await exigerSession();
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.porteB))) return { statut: "refusee", phrase: PHRASE_PORTE_B_ETEINTE };
  return verrou(async () => {
    const video = await depots().videos.obtenir(videoId);
    if (!estPorteB(video)) throw new ErreurStudio("INTROUVABLE", "Cette demande n'existe plus.");
    return avancer(video, dep);
  });
}

async function avancer(depart: Video, dep: DependancesPorteB): Promise<EtatPorteB> {
  let video = depart;
  const e = lireEntreesCasConcret(video.entrees);
  const pret = casDesEntrees(e);
  if (pret) return etatPret(video, pret);
  if (typeof brut(video).echec === "string") return { statut: "echec", videoId: video.id, phrase: brut(video).echec as string };
  const description = e.description ?? "";

  const journal: { appels?: Record<string, AppelSuivi> } = { appels: { ...((brut(video).appels as Record<string, AppelSuivi> | undefined) ?? {}) } };
  const outils = ecritureDetachee(await ecritureClaudeCasConcret(video.id, () => ETAPE_DESCRIPTION, dep), {
    journal,
    garder: async () => {
      video = await garderEntrees(video, { appels: journal.appels ?? {} });
    },
    horloge: dep.maintenant ?? Date.now,
    libelle: "Le cas",
    attente: () => new AttenteCas(),
    expire: (phrase) => new CasExpire(phrase),
  });

  try {
    const r = await casDepuisDescription({ texte: description, videoId: video.id }, outils);
    if (!r.ok) {
      // Échec motivé (refus du cas deux fois, budget, appel) : la phrase, sans le détail technique.
      const phrase = r.motif === "budget" ? r.message : PHRASE_ECHEC_PORTE_B;
      await garderEntrees(video, { echec: phrase });
      return { statut: "echec", videoId: video.id, phrase };
    }
    video = await garderEntrees(video, { cas: r.cas, empreinteCas: empreinteCas(r.cas), faitsConfirmes: [] });
    return etatPret(video, r.cas);
  } catch (err) {
    if (err instanceof AttenteCas) return { statut: "en-cours", videoId: video.id, phrase: PHRASE_PREPARATION };
    if (err instanceof CasExpire) {
      await garderEntrees(video, { echec: PHRASE_ECHEC_PORTE_B });
      return { statut: "echec", videoId: video.id, phrase: PHRASE_ECHEC_PORTE_B };
    }
    throw err;
  }
}

/**
 * Will confirme un fait « à confirmer », ou le retire du cas. Retiré : le cas change (nouvelle empreinte), la feuille
 * se recharge. Rien d'autre n'est modifié.
 */
export async function confirmerFaitPorteB(videoId: Id, faitId: string, decision: "confirmer" | "retirer"): Promise<EtatPorteB> {
  await exigerSession();
  if (!(await reglageAllume(REGLAGES_CAS_CONCRET.porteB))) throw new ErreurStudio("INTROUVABLE", PHRASE_PORTE_B_ETEINTE);
  return verrou(async () => {
    const video = await depots().videos.obtenir(videoId);
    if (!estPorteB(video) || video.statut !== "brouillon") throw new ErreurStudio("INTROUVABLE", "Cette demande n'existe plus.");
    const e = lireEntreesCasConcret(video.entrees);
    const cas = casDesEntrees(e);
    if (!cas || !cas.faits.some((f) => f.id === faitId)) throw new ErreurStudio("INTROUVABLE", "Ce chiffre n'est plus dans le cas.");
    if (decision === "confirmer") {
      const suivant = await garderEntrees(video, { faitsConfirmes: [...new Set([...(e.faitsConfirmes ?? []), faitId])] });
      return etatPret(suivant, cas);
    }
    const sans: CasConcret = { ...cas, faits: cas.faits.filter((f) => f.id !== faitId) };
    const suivant = await garderEntrees(video, { cas: sans, empreinteCas: empreinteCas(sans), faitsConfirmes: (e.faitsConfirmes ?? []).filter((id) => id !== faitId) });
    return etatPret(suivant, sans);
  });
}
