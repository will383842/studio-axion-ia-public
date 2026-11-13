/**
 * SUI-A — suivi chiffré par mot, LECTURE SEULE (hors copie du site). Lit les événements `zernio.commentaire` et l'état
 * `parcours.conversations` (champs réduits seulement), puis les compteurs du site : POST /api/interne/compteurs-guide-reseau,
 * corps { v: 1 }, par le transport signé EXISTANT du parcours (comme `cibles-site.ts`), délai 3 s.
 * Copie dans le paramètre `suivi.miroir_site` : fraîche 10 min, gardée 24 h, pause de 60 s après un échec.
 * Site en panne, 404 ou forme fausse → `siteDisponible: false` et chiffres du site à null : jamais d'exception.
 * Cache mémoire de 60 s. La sortie ne contient ni clé, ni identifiant, ni texte ; aucun corps n'est journalisé.
 */
import "server-only";
import {
  CHEMIN_COMPTEURS_GUIDE_RESEAU,
  compteursVersCopie,
  lireCompteursSite,
  type CompteursSite,
} from "@/domaine/guide-reseau/compteurs-site-contrat";
import {
  assemblerSuivi,
  type ConversationSuivi,
  type EvenementSuivi,
  type TableauSuivi,
} from "@/domaine/guide-reseau/suivi-mots";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { ReponseSite } from "@/fournisseurs/site/types";
import { depots, ecrireParametre, journaliser, lireParametre } from "./_commun";
import { transportDuSite } from "./parcours-mot";

const PARAM_CONVERSATIONS = "parcours.conversations";
const TYPE_COMMENTAIRE = "zernio.commentaire";
export const PARAM_SUIVI_MIROIR = "suivi.miroir_site";
export const DELAI_SITE_SUIVI_MS = 3_000;
export const FRAICHEUR_SUIVI_MS = 10 * 60_000;
export const PEREMPTION_SUIVI_MS = 24 * 60 * 60_000;
export const PAUSE_SUIVI_APRES_ECHEC_MS = 60_000;
export const DUREE_CACHE_SUIVI_MS = 60_000;

type Env = Record<string, string | undefined>;

export interface LectureSuivi {
  evenements: () => Promise<EvenementSuivi[]>;
  conversations: () => Promise<ConversationSuivi[]>;
}

const texte = (v: unknown): string | null => (typeof v === "string" ? v : null);
const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

const lectureReelle: LectureSuivi = {
  evenements: async () =>
    (
      await depots().evenementsFournisseurs.lister(
        (e) => e.fournisseur === "zernio" && e.type === TYPE_COMMENTAIRE,
      )
    ).map((e) => ({
      idEvenement: texte(e.idEvenement),
      recuLe: e.recuLe,
      motSeul: texte(e.charge.motSeul),
      etat: texte(e.charge.etat),
      idPostPlateforme: texte(e.charge.idPostPlateforme),
      reseau: texte(e.charge.reseau),
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
      idPostPlateforme: texte(c.idPostPlateforme),
      reseau: texte(c.reseau),
      versionTexteM1: texte(c.versionTexteM1),
      formulations: estObjet(c.formulations)
        ? Object.fromEntries(
            Object.entries(c.formulations).filter(
              (e): e is [string, string] => typeof e[1] === "string",
            ),
          )
        : null,
      suiviIg: texte(c.suiviIg),
      lienIgLe: texte(c.lienIgLe),
      okRecus: typeof c.okRecus === "number" ? c.okRecus : null,
    }));
  },
};

class DelaiDepasse extends Error {}

async function appeler(
  env: Env,
  maintenantMs: number,
): Promise<ReponseSite | null> {
  const site = transportDuSite(env);
  if (!site) return null;
  const corps = JSON.stringify({ v: 1 });
  const entetes = signerAppel({
    secret: site.secret,
    methode: "POST",
    chemin: CHEMIN_COMPTEURS_GUIDE_RESEAU,
    corps,
    horodatageSec: Math.floor(maintenantMs / 1000),
  });
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new DelaiDepasse("delai")),
      DELAI_SITE_SUIVI_MS,
    );
  });
  try {
    return await Promise.race([
      site.transport({
        methode: "POST",
        chemin: CHEMIN_COMPTEURS_GUIDE_RESEAU,
        corps,
        entetes,
      }),
      delai,
    ]);
  } finally {
    clearTimeout(minuteur);
  }
}

let dernierEchecMs: number | null = null;
let serieJournalisee = false;
let cache: { jusqua: number; valeur: TableauSuivi } | null = null;

/** Tests : vide seulement le cache du tableau (la pause après échec reste). */
export function viderCacheTableauSuivi(): void {
  cache = null;
}

/** Tests : remet à zéro la mémoire du service (cache, pause après échec). */
export function reinitialiserCacheSuivi(): void {
  cache = null;
  dernierEchecMs = null;
  serieJournalisee = false;
}

function lireMiroir(brut: unknown): { luLe: number; compteurs: CompteursSite } | null {
  if (!estObjet(brut) || typeof brut.luLe !== "number" || !Number.isFinite(brut.luLe))
    return null;
  const compteurs = lireCompteursSite(brut.compteurs);
  if (!compteurs) return null;
  const ignorees =
    typeof brut.lignesIgnorees === "number" && Number.isSafeInteger(brut.lignesIgnorees) && brut.lignesIgnorees >= 0
      ? brut.lignesIgnorees
      : 0;
  return { luLe: brut.luLe, compteurs: { ...compteurs, lignesIgnorees: ignorees } };
}

/** Compteurs du site : copie fraîche, sinon site, sinon copie (≤ 24 h), sinon null. Ne lève jamais. */
async function compteursDuSite(env: Env, now: number): Promise<CompteursSite | null> {
  try {
    const copie = lireMiroir(await lireParametre<unknown>(PARAM_SUIVI_MIROIR, null));
    const age = copie ? now - copie.luLe : Infinity;
    if (copie && age >= 0 && age < FRAICHEUR_SUIVI_MS) return copie.compteurs;
    const depuisEchec = dernierEchecMs === null ? Infinity : now - dernierEchecMs;
    if (!(depuisEchec >= 0 && depuisEchec < PAUSE_SUIVI_APRES_ECHEC_MS)) {
      let echec: string | null = null;
      try {
        const r = await appeler(env, now);
        if (r) {
          const c = r.statut === 200 ? lireCompteursSite(r.corps) : null;
          if (c) {
            dernierEchecMs = null;
            serieJournalisee = false;
            try {
              await ecrireParametre(PARAM_SUIVI_MIROIR, {
                luLe: now,
                ...compteursVersCopie(c),
              });
            } catch {
              // Écriture de la copie impossible : même pause d'une minute avant de rappeler le site.
              dernierEchecMs = now;
            }
            return c;
          }
          echec = `Lecture des compteurs du site refusée ou illisible (statut ${r.statut}).`;
        }
      } catch {
        echec = "Lecture des compteurs du site impossible : le site n'a pas répondu.";
      }
      if (echec !== null) {
        dernierEchecMs = now;
        if (!serieJournalisee) {
          serieJournalisee = true;
          await journaliser("suivi_site", echec);
        }
      }
    }
    return copie && age >= 0 && age < PEREMPTION_SUIVI_MS ? copie.compteurs : null;
  } catch {
    return null;
  }
}

/** Tableau de suivi par mot. `env`, `lecture` et `maintenantMs` ne servent qu'aux tests. */
export async function lireTableauSuivi(
  o: { env?: Env; maintenantMs?: number; lecture?: LectureSuivi } = {},
): Promise<TableauSuivi> {
  const now = o.maintenantMs ?? Date.now();
  if (cache && now < cache.jusqua) return cache.valeur;
  const lecture = o.lecture ?? lectureReelle;
  const [evenements, conversations] = await Promise.all([
    lecture.evenements(),
    lecture.conversations(),
  ]);
  const site = await compteursDuSite(o.env ?? process.env, now);
  const valeur = assemblerSuivi(evenements, conversations, site, now);
  cache = { jusqua: now + DUREE_CACHE_SUIVI_MS, valeur };
  return valeur;
}
