/**
 * MG-2 — chiffres par mot, LECTURE SEULE. Lit les événements `zernio.commentaire` et l'état `parcours.conversations` avec les dépôts
 * existants, sans rien écrire. La sortie ne contient que des mots et des nombres : jamais d'identifiant, de clé d'empreinte ni de texte.
 * Cache mémoire de 60 s (une lecture en panne n'est jamais mise en cache).
 */
import "server-only";
import {
  agregerStatsMots,
  type ConversationStat,
  type EvenementStat,
  type StatsMotChiffrees,
} from "@/domaine/guide-reseau/stats-mots";
import { depots, lireParametre } from "./_commun";

/** Même nom que dans `parcours-conversation.ts` (non importé : ce module n'en tire pas le parcours). */
const PARAM_CONVERSATIONS = "parcours.conversations";
const TYPE_COMMENTAIRE = "zernio.commentaire";
export const DUREE_CACHE_STATS_MOTS_MS = 60_000;

export interface LectureStatsMots {
  evenements: () => Promise<EvenementStat[]>;
  conversations: () => Promise<ConversationStat[]>;
}

const texte = (v: unknown): string | null => (typeof v === "string" ? v : null);

const lectureReelle: LectureStatsMots = {
  evenements: async () =>
    (
      await depots().evenementsFournisseurs.lister(
        (e) => e.fournisseur === "zernio" && e.type === TYPE_COMMENTAIRE,
      )
    ).map((e) => ({
      recuLe: e.recuLe,
      motSeul: texte(e.charge.motSeul),
      etat: texte(e.charge.etat),
    })),
  conversations: async () => {
    const tout = await lireParametre<Record<string, Record<string, unknown>>>(
      PARAM_CONVERSATIONS,
      {},
    );
    return Object.entries(tout).map(([cle, c]) => ({
      cle,
      mot: texte(c.mot),
      nature: texte(c.nature),
      etat: texte(c.etat) ?? "",
      creeLe: texte(c.creeLe) ?? "",
      m1Le: texte(c.m1Le),
      suitLeCompte: c.suitLeCompte === true,
    }));
  },
};

let cache: { jusqua: number; valeur: StatsMotChiffrees[] } | null = null;
/** Tests : vide le cache. */
export function reinitialiserCacheStatsMots(): void {
  cache = null;
}

/** Chiffres par mot, en lecture seule. `lecture` et `maintenantMs` ne servent qu'aux tests. */
export async function lireStatsMots(
  o: { maintenantMs?: number; lecture?: LectureStatsMots } = {},
): Promise<StatsMotChiffrees[]> {
  const maintenant = o.maintenantMs ?? Date.now();
  if (cache && maintenant < cache.jusqua) return cache.valeur;
  const lecture = o.lecture ?? lectureReelle;
  const [evenements, conversations] = await Promise.all([
    lecture.evenements(),
    lecture.conversations(),
  ]);
  const valeur = agregerStatsMots(evenements, conversations, maintenant);
  cache = { jusqua: maintenant + DUREE_CACHE_STATS_MOTS_MS, valeur };
  return valeur;
}
