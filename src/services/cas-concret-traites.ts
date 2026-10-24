/**
 * CAS CONCRETS TRAITÉS : lecture, inscription durable et remise en stock. SERVEUR UNIQUEMENT.
 * Les règles sont dans `domaine/cas-traites.ts` (pur). Un cas dont la vidéo est allée au bout n'est plus disponible
 * (voir l'en-tête de ce fichier pour les détails). Ce service ne fabrique rien, ne dépense rien, n'appelle aucun
 * fournisseur ; il n'écrit que deux réglages du studio (`casConcret.casTraites`, `casConcret.casRemis`), jamais une vidéo.
 *
 * Inscription durable : à la fin d'une fabrication de cas concret (`travaux.ts`), le cas est inscrit ; il reste donc traité
 * même si Will supprime la vidéo pour de bon. Remise en stock : décision explicite de Will (session exigée, journalisée).
 */
import "server-only";
import {
  casIdDeLaVideo,
  casTraites,
  PHRASE_RELANCE_CAS_TRAITE,
  FORMAT_CAS_CONCRET,
  videoFinie,
  type CasTraite,
  type InscriptionCasTraite,
  type RemiseEnStock,
  type VideoCasTraite,
} from "@/domaine/cas-traites";
import { CATALOGUE } from "@/formats/cas-concret/catalogue";
import { lireCasAjoutes } from "./cas-concret-ajoutes-lecture";
import type { Video } from "@/domaine/types";
import { statutEffectif } from "@/domaine/sujets-traites";
import { creerVerrou, depots, ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { exigerSession } from "./auth";

export { PHRASE_CAS_TRAITE } from "@/domaine/cas-traites";

export const CLE_CAS_TRAITES = "casConcret.casTraites";
export const CLE_CAS_REMIS = "casConcret.casRemis";

type Inscrits = Record<string, InscriptionCasTraite>;
type Remis = Record<string, RemiseEnStock>;

/** Lectures du service : remplaçables dans les tests par de faux dépôts. */
export interface SourcesCasTraites {
  videos(): Promise<VideoCasTraite[]>;
  inscrits(): Promise<Inscrits>;
  remis(): Promise<Remis>;
  ecrireInscrits(v: Inscrits): Promise<void>;
  ecrireRemis(v: Remis): Promise<void>;
  maintenant(): string;
}

const objet = (v: unknown): Record<string, unknown> => (v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {});
const texte = (v: unknown): string | undefined => (typeof v === "string" && v ? v : undefined);

async function lireVideos(): Promise<VideoCasTraite[]> {
  const d = depots();
  const lues = await d.videos.lister(
    (v) => v.formatId === FORMAT_CAS_CONCRET,
    // Projection légère : seuls le cas et les champs de la règle sont copiés (pas de gros brouillons).
    (v) => ({ ...v, entrees: { casConcret: objet((v.entrees as Record<string, unknown> | undefined)?.casConcret) } }),
  );
  const { commandeEnEssai } = await import("@/moteurs");
  const sortie: VideoCasTraite[] = [];
  for (const v of lues) {
    const base: VideoCasTraite = {
      id: v.id,
      titre: v.titre ?? "",
      formatId: v.formatId,
      statut: v.statut,
      ...(v.statutAvantArchive ? { statutAvantArchive: v.statutAvantArchive } : {}),
      ...(v.estDemo === true ? { estDemo: true } : {}),
      ...(texte(v.sourceVideoId) ? { sourceVideoId: texte(v.sourceVideoId)! } : {}),
      ...(texte(v.typeDerive) ? { typeDerive: texte(v.typeDerive)! } : {}),
      entrees: v.entrees as Record<string, unknown>,
      ...(texte(v.terminee) ? { terminee: texte(v.terminee)! } : {}),
      ...(texte(v.modifieLe) ? { modifieLe: texte(v.modifieLe)! } : {}),
    };
    // Un essai simulé (version choisie fabriquée par le moteur de simulation) ne retire pas le cas.
    if (videoFinie(base) && v.versionChoisieId) {
      const version = await d.versions.obtenir(v.versionChoisieId);
      if (version && commandeEnEssai(version.commande)) base.essaiSimule = true;
    }
    sortie.push(base);
  }
  return sortie;
}

export const SOURCES_CAS_TRAITES: SourcesCasTraites = {
  videos: lireVideos,
  inscrits: async () => objet(await lireParametre<unknown>(CLE_CAS_TRAITES, {})) as Inscrits,
  remis: async () => objet(await lireParametre<unknown>(CLE_CAS_REMIS, {})) as Remis,
  ecrireInscrits: (v) => ecrireParametre(CLE_CAS_TRAITES, v),
  ecrireRemis: (v) => ecrireParametre(CLE_CAS_REMIS, v),
  maintenant,
};

/** Les cas traités maintenant (clé = identifiant du cas). Recalculé à chaque appel, lu frais dans les dépôts. */
export async function lireCasTraites(src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<Map<string, CasTraite>> {
  const [videos, inscrits, remis] = await Promise.all([src.videos(), src.inscrits(), src.remis()]);
  return casTraites({ videos, inscrits, remis });
}

/**
 * Ce cas est-il traité ? `saufVideoId` : la vidéo relancée elle-même ne compte pas (elle n'est jamais « finie » quand on la
 * relance, mais le garde-fou reste exact si une autre lecture la montrait prête).
 */
export async function estCasTraite(casId: string, options: { saufVideoId?: string } = {}, src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<boolean> {
  const sauf = options.saufVideoId;
  if (!sauf) return (await lireCasTraites(src)).has(casId);
  // « Traité par une AUTRE vidéo » : on recalcule sans la vidéo relancée ni son inscription.
  const [videos, inscrits, remis] = await Promise.all([src.videos(), src.inscrits(), src.remis()]);
  const autres = Object.fromEntries(Object.entries(inscrits).filter(([, i]) => i?.videoId !== sauf));
  return casTraites({ videos: videos.filter((v) => v.id !== sauf), inscrits: autres, remis }).has(casId);
}

const verrou = creerVerrou();

/**
 * Inscrit durablement le cas de cette vidéo qui vient d'aller au bout. IDEMPOTENT : n'écrit que si la clé manque. Ne
 * touche jamais une vidéo. Le moteur appelant ne doit jamais échouer à cause de cette inscription (il rattrape l'erreur).
 */
export async function noterCasTraite(video: { id: string; titre: string; formatId: string; estDemo?: boolean; sourceVideoId?: string; typeDerive?: string; entrees?: unknown; terminee?: string }, src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<boolean> {
  if (video.formatId !== FORMAT_CAS_CONCRET || video.estDemo || video.sourceVideoId || video.typeDerive) return false;
  const casId = casIdDeLaVideo({ entrees: objet(video.entrees) });
  if (!casId) return false;
  return verrou(async () => {
    const [inscrits, remis] = await Promise.all([src.inscrits(), src.remis()]);
    if (inscrits[casId]) return false;
    // Une vidéo déjà comptée au moment d'une remise en stock ne rend jamais le cas traité.
    if (remis[casId]?.videoIds?.includes(video.id)) return false;
    await src.ecrireInscrits({ ...inscrits, [casId]: { videoId: video.id, titre: video.titre, le: video.terminee ?? src.maintenant() } });
    return true;
  });
}

/**
 * Will remet un cas traité en stock : il redevient disponible, et seule une NOUVELLE vidéo finie après ce moment le
 * retire de nouveau. Session exigée, journalisée. Rien n'est supprimé (les vidéos restent).
 */
export async function remettreEnStock(casId: string, src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<{ remisLe: string }> {
  await exigerSession();
  // Garde-fous : seul un cas du catalogue, et traité, se remet en stock ; la chaîne reçue n'est jamais recopiée telle quelle.
  if (typeof casId !== "string" || casId.length > 120 || !(CATALOGUE.some((c) => c.id === casId) || (await lireCasAjoutes()).some((c) => c.id === casId))) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'existe plus.");
  return verrou(async () => {
    const [videos, inscrits, remis] = await Promise.all([src.videos(), src.inscrits(), src.remis()]);
    if (!casTraites({ videos, inscrits, remis }).has(casId)) throw new ErreurStudio("CAS_INCONNU", "Ce cas n'est pas dans les cas traités.");
    const comptees = videos.filter((v) => videoFinie(v) && casIdDeLaVideo(v) === casId).map((v) => v.id);
    const anciens = remis[casId]?.videoIds ?? [];
    const remisLe = src.maintenant();
    const ids = [...new Set([...anciens, ...comptees, ...(inscrits[casId]?.videoId ? [inscrits[casId]!.videoId!] : [])])];
    await src.ecrireRemis({ ...remis, [casId]: { remisLe, videoIds: ids } });
    if (inscrits[casId]) {
      const { [casId]: _retire, ...reste } = inscrits;
      void _retire;
      await src.ecrireInscrits(reste);
    }
    await journaliser("cas-concret", `Cas remis en stock : ${casId}`, { type: "cas-concret", id: casId });
    return { remisLe };
  });
}

/**
 * Garde de relance : la vidéo en panne `videoId` appartient à un cas déjà traité par une AUTRE vidéo ? Renvoie la phrase de
 * refus (sinon `null`). `entrees` : les entrées de la commande de la vidéo (`casConcret.casId`).
 */
export async function refusCasDejaTraite(entrees: unknown, videoId: string, phrase: string = PHRASE_RELANCE_CAS_TRAITE, src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<string | null> {
  const casId = casIdDeLaVideo({ entrees: objet(entrees) });
  if (!casId) return null;
  return (await estCasTraite(casId, { saufVideoId: videoId }, src)) ? phrase : null;
}

/**
 * Avant d'effacer une vidéo (suppression de Will OU purge automatique de la corbeille) : si elle est un cas concret fini
 * (donc un cas traité), le cas est inscrit d'abord. Ne bloque JAMAIS la suppression : une erreur est seulement journalisée.
 */
export async function noterAvantSuppression(video: Video, src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<void> {
  try {
    if (video.formatId !== FORMAT_CAS_CONCRET || video.estDemo || video.sourceVideoId || video.typeDerive) return;
    if (statutEffectif(video) !== "prete") return;
    if (video.versionChoisieId) {
      const version = await depots().versions.obtenir(video.versionChoisieId);
      const { commandeEnEssai } = await import("@/moteurs");
      if (version && commandeEnEssai(version.commande)) return;
    }
    await noterCasTraite({ ...video, terminee: video.terminee ?? video.modifieLe }, src);
  } catch (e) {
    await journaliser("cas-concret", `Cas concret : inscription avant suppression impossible (${e instanceof Error ? e.name : "erreur"})`, { type: "video", id: video.id }).catch(() => undefined);
  }
}

let passeFaite = false;

/**
 * Passe d'inscription UNIQUE (au démarrage du travailleur) : les vidéos de cas concret déjà prêtes avant la mise en place de
 * l'inscription sont inscrites, pour que leur suppression ne libère jamais leur cas. AJOUTS SEULEMENT, idempotente : une clé
 * déjà présente n'est pas touchée, une remise en stock est respectée. Rend le nombre de cas ajoutés.
 */
export async function inscrireLesCasDejaTraites(src: SourcesCasTraites = SOURCES_CAS_TRAITES): Promise<number> {
  if (src === SOURCES_CAS_TRAITES) {
    if (passeFaite) return 0;
    passeFaite = true;
  }
  try {
    return await verrou(async () => {
      const [videos, inscrits, remis] = await Promise.all([src.videos(), src.inscrits(), src.remis()]);
      const ajouts: Inscrits = {};
      for (const [casId, t] of casTraites({ videos, inscrits: {}, remis })) {
        if (!inscrits[casId]) ajouts[casId] = { ...(t.videoId ? { videoId: t.videoId } : {}), titre: t.titre, le: t.le };
      }
      if (!Object.keys(ajouts).length) return 0;
      // Ajouts seulement : une clé déjà présente (relue juste avant d'écrire) l'emporte toujours.
      await src.ecrireInscrits({ ...ajouts, ...(await src.inscrits()) });
      return Object.keys(ajouts).length;
    });
  } catch (e) {
    if (src === SOURCES_CAS_TRAITES) passeFaite = false;
    throw e;
  }
}
