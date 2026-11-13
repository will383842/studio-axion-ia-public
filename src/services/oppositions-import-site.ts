/**
 * STOP-S5a — VÉRIFICATION À LA DEMANDE, par personne, des oppositions connues du site (`POST /api/interne/oppositions-par-conv`).
 * Éteint par défaut (`OPPOSITIONS_SITE_IMPORT_ENABLED`) : aucun appel, aucune lecture, aucune écriture.
 *
 * Principe : `personneOpposeePartout` (oppositions-mots) exige, pour chaque lien reçu par la personne, une preuve « non opposée » du
 * site datée de moins de 10 min ; sinon elle demande la vérification de ces références et LÈVE (rien ne part, l'événement est réessayé).
 * Ce module traite les demandes : au plus 2 lots de 100 par passage, au plus un passage toutes les 15 s.
 *
 * Règles de sûreté :
 *  - seule une réponse 200 VALIDE (même longueur, même ordre, version 1, rien d'autre) est lue ; tout le reste (401, 422, 429, 503, 5xx,
 *    délai, exception, réponse mal formée, site non relié) est « INCONNU » : rien n'est écrit pour le lot, ses références sont remises
 *    en demande, pause de 60 s, alerte. Jamais « non opposée » par défaut ;
 *  - une opposition importée est écrite D'ABORD au registre (`transmise: true`, `source: "site"`), ENSUITE seulement les preuves
 *    « non opposée » sont écrites : si le registre échoue, aucune preuve pour le lot ;
 *  - AUCUNE écriture des files de transmission (`parcours.oppositions.file` / `.page`) : c'est `rattraperOppositions` qui s'en charge ;
 *  - l'appel réseau se fait HORS verrou ; le paramètre `parcours.oppositions.site` ne contient que des références opaques et des dates ;
 *  - alerte à la cloche seulement (jamais de push), un nombre seulement, au plus une par heure ; elle ne fait jamais échouer le passage ;
 *  - aucun journal ne contient de référence, d'adresse ni d'identifiant ;
 *  - la mémoire (demandes, pause, compteurs) est propre à chaque processus : rien n'est partagé entre processus, un redémarrage repart
 *    de zéro. Sans gravité : tout est refermé par défaut et une demande perdue est refaite au prochain essai de la personne.
 */
import "server-only";
import {
  CHEMIN_OPPOSITIONS_PAR_CONV,
  LOT_MAX_PAR_CONV,
  RE_REF_CONV,
  construireCorpsParConv,
  lireReponseParConv,
} from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import { LOT_MAX_PAR_PASSAGE_CONVERSATION } from "@/domaine/guide-reseau/plafonds-conversation";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { ReponseSite } from "@/fournisseurs/site/types";
import {
  depots,
  ecrireParametre,
  journaliser,
  lireParametre,
  sousVerrou,
} from "./_commun";
import { creerNotification } from "./notifications";
import {
  FRAICHEUR_SITE_MS,
  PARAM_OPPOSITIONS_SITE,
  acquitterDebordementsSite,
  acquitterRefsIllisiblesSite,
  debordementsSite,
  demanderVerificationSite,
  enregistrerOppositionsImportees,
  importSiteActif,
  lireVerifs,
  personneOpposeePartout,
  prendreDemandesSite,
  refsIllisiblesSite,
} from "./oppositions-mots";
import { transportDuSite } from "./parcours-mot";

export {
  PARAM_OPPOSITIONS_SITE,
  VARIABLE_OPPOSITIONS_SITE_IMPORT,
} from "./oppositions-mots";
export const MARGE_RENOUVELLEMENT_MS = 120_000;
export const MAX_VERIFS = 1000;
export const MAX_DEMANDES_PAR_PASSAGE = 200;
export const LOTS_MAX_PAR_PASSAGE = 2;
export const INTERVALLE_VERIFICATION_MS = 15_000;
export const PAUSE_APRES_ECHEC_MS = 60_000;
export const DELAI_APPEL_SITE_MS = 5_000;
export const INTERVALLE_ALERTE_MS = 3_600_000;
/** Mêmes noms que dans parcours-conversation.ts : pas d'import (évite tout cycle). */
const PARAM_CONVERSATIONS_ETAT = "parcours.conversations";
const FOURNISSEUR = "zernio";
const TYPES_EVENEMENTS: readonly string[] = [
  "zernio.commentaire",
  "zernio.message",
];

type Env = Record<string, string | undefined>;

interface EtatProcessus {
  enCours: boolean;
  dernierPassageMs: number | null;
  pauseJusquaMs: number;
  reponsesIllisibles: number;
}
/** Mémoire de processus, propre à chaque processus (un redémarrage repart de zéro). */
const processus = (): EtatProcessus => {
  const g = globalThis as { __studioVerifSite?: EtatProcessus };
  return (g.__studioVerifSite ??= {
    enCours: false,
    dernierPassageMs: null,
    pauseJusquaMs: 0,
    reponsesIllisibles: 0,
  });
};
/** Remet à zéro l'état en mémoire (essais). */
export function reinitialiserImportOppositionsSite(): void {
  const g = globalThis as { __studioVerifSite?: EtatProcessus };
  delete g.__studioVerifSite;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const lireAlerteLe = (brut: unknown): number | null =>
  estObjet(brut) &&
  typeof brut.alerteLe === "number" &&
  Number.isFinite(brut.alerteLe)
    ? brut.alerteLe
    : null;

/** Réponses 200 du site refusées par la lecture stricte, depuis le démarrage du processus (un nombre seulement). */
export const reponsesIllisiblesSite = (): number => processus().reponsesIllisibles;

class DelaiDepasse extends Error {}

/** Un appel signé, borné. `null` = site non relié (aucun appel parti). */
async function appeler(
  env: Env,
  maintenantMs: number,
  corps: string,
): Promise<ReponseSite | null> {
  const site = transportDuSite(env);
  if (!site) return null;
  const methode = "POST" as const;
  const chemin = CHEMIN_OPPOSITIONS_PAR_CONV;
  const entetes = signerAppel({
    secret: site.secret,
    methode,
    chemin,
    corps,
    horodatageSec: Math.floor(maintenantMs / 1000),
  });
  // Le signal est annulé à l'échéance : un transport qui le lit abandonne l'appel (le client réel a aussi son propre délai de 10 s).
  const arret = new AbortController();
  const requete = { methode, chemin, corps, entetes, signal: arret.signal };
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(() => {
      arret.abort();
      rejeter(new DelaiDepasse("delai"));
    }, DELAI_APPEL_SITE_MS);
  });
  try {
    return await Promise.race([site.transport(requete), delai]);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Résultat d'un lot : `{ reponse }` (valide), `{ nonRelie }` ou `{}` (INCONNU). */
async function interroger(
  env: Env,
  now: number,
  refs: readonly string[],
): Promise<{ reponse?: boolean[]; nonRelie?: true }> {
  const corps = construireCorpsParConv(refs);
  if (corps === null) return {};
  try {
    const r = await appeler(env, now, corps);
    if (r === null) return { nonRelie: true };
    if (r.statut !== 200) return {};
    const reponse = lireReponseParConv(r.corps, refs);
    if (reponse === null) processus().reponsesIllisibles++;
    return reponse === null ? {} : { reponse };
  } catch {
    return {};
  }
}

/** Alerte à la cloche : un nombre seulement, au plus une par heure. Jamais de push. Ne fait jamais échouer le passage. Rend vrai si envoyée. */
async function alerter(
  message: string,
  titre: string,
  now: number,
): Promise<boolean> {
  try {
    const marquee = await sousVerrou(async () => {
      const brut = await lireParametre<unknown>(PARAM_OPPOSITIONS_SITE, null);
      const dernier = lireAlerteLe(brut);
      if (
        dernier !== null &&
        now - dernier >= 0 &&
        now - dernier < INTERVALLE_ALERTE_MS
      )
        return false;
      await ecrireParametre(PARAM_OPPOSITIONS_SITE, {
        v: 1,
        verifs: lireVerifs(brut),
        alerteLe: now,
      });
      return true;
    });
    if (!marquee) return false;
    await journaliser("parcours_conversation", `ALERTE : ${message}`);
    await creerNotification(
      { type: "echec", titre, message, lien: "/mots" },
      { cloche: true },
    );
    return true;
  } catch {
    return false; // l'alerte ne doit jamais faire échouer le passage
  }
}
const alerteEchec = (nombre: number, now: number): Promise<boolean> =>
  alerter(
    `La vérification des oppositions du site a échoué : ${nombre} référence(s) n'ont pas pu être vérifiées. Les personnes qui ont reçu un lien attendent (rien ne leur est envoyé).`,
    "Oppositions du site non vérifiées",
    now,
  );
const alerteNonRelie = (now: number): Promise<boolean> =>
  alerter(
    "Le site n'est pas relié : les oppositions du site ne peuvent pas être vérifiées. Les personnes qui ont reçu un lien attendent (rien ne leur est envoyé).",
    "Site non relié (oppositions)",
    now,
  );
const alerteDebordement = (nombre: number, now: number): Promise<boolean> =>
  alerter(
    `Trop de vérifications d'oppositions du site en attente : ${nombre} demande(s) ont été abandonnées. Les personnes concernées attendent (rien ne leur est envoyé) et seront revérifiées à leur prochain essai.`,
    "Demandes de vérification du site en débordement",
    now,
  );
const alerteSansConversation = (nombre: number, now: number): Promise<boolean> =>
  alerter(
    `Le site signale ${nombre} référence(s) opposée(s) qui ne correspondent à aucune conversation connue. Elles restent à vérifier (rien n'est envoyé).`,
    "Oppositions du site sans conversation",
    now,
  );
const alerteIllisibles = (nombre: number, now: number): Promise<boolean> =>
  alerter(
    `Des références de lien illisibles bloquent des personnes : ${nombre} cas depuis la dernière alerte. Rien ne leur est envoyé.`,
    "Références de lien illisibles",
    now,
  );

/**
 * Un passage de vérification. Éteint : retour immédiat. Allumé : au plus un passage toutes les 15 s, aucun pendant la pause après échec.
 * Les erreurs de lecture/écriture sont propagées (l'étape du passage les absorbe) ; les références prises sont alors remises en demande.
 */
export async function verifierOppositionsSite(
  o: { env?: Env; maintenantMs?: number } = {},
): Promise<void> {
  const env = o.env ?? process.env;
  if (!importSiteActif(env)) return;
  const now = o.maintenantMs ?? Date.now();
  const p = processus();
  if (p.enCours) return;
  if (now < p.pauseJusquaMs) return;
  if (
    p.dernierPassageMs !== null &&
    now - p.dernierPassageMs >= 0 &&
    now - p.dernierPassageMs < INTERVALLE_VERIFICATION_MS
  )
    return;
  p.enCours = true;
  try {
    p.dernierPassageMs = now;
    await passage(env, now, p);
  } finally {
    p.enCours = false;
  }
}

/** Une preuve tient 10 min ; on la renouvelle dès 8 min (marge de 2 min). */
const encoreAssezFraiche = (t: number | undefined, now: number): boolean =>
  typeof t === "number" &&
  Number.isFinite(t) &&
  now - t >= 0 &&
  now - t < FRAICHEUR_SITE_MS - MARGE_RENOUVELLEMENT_MS;

async function passage(env: Env, now: number, p: EtatProcessus): Promise<void> {
  // 1. PROACTIF : les événements dus (mêmes critères que `traiterConversations`) demandent leur vérification. Le jeton rendu est jeté.
  const dus = await depots().evenementsFournisseurs.lister(
    (e) =>
      e.fournisseur === FOURNISSEUR &&
      TYPES_EVENEMENTS.includes(e.type) &&
      !e.traite &&
      (typeof e.charge.prochainEssaiLe !== "number" ||
        e.charge.prochainEssaiLe <= now),
  );
  dus.sort((a, b) => String(a.recuLe).localeCompare(String(b.recuLe)));
  for (const ev of dus.slice(0, LOT_MAX_PAR_PASSAGE_CONVERSATION)) {
    const c = ev.charge;
    await personneOpposeePartout(
      {
        idsBruts: [c.idAuteur, c.idExpediteur, c.idConversation].filter(
          (x): x is string => typeof x === "string",
        ),
      },
      { env, maintenantMs: now },
    ).catch(() => undefined);
  }

  // 2. Les demandes : jusqu'à 200, sans celles vérifiées depuis moins de 8 min, sans doublon, en lots de 100 (2 lots au plus).
  const prises = prendreDemandesSite(MAX_DEMANDES_PAR_PASSAGE);
  const restantes = new Set<string>();
  try {
    const verifs = lireVerifs(
      await lireParametre<unknown>(PARAM_OPPOSITIONS_SITE, null),
    );
    for (const r of new Set(prises))
      if (RE_REF_CONV.test(r) && !encoreAssezFraiche(verifs[r], now))
        restantes.add(r);
    const aFaire = [...restantes];
    let echec = false;
    let nonRelie = false;
    let sansCle = 0;
    for (
      let i = 0;
      i < LOTS_MAX_PAR_PASSAGE && i * LOT_MAX_PAR_CONV < aFaire.length;
      i++
    ) {
      const lot = aFaire.slice(
        i * LOT_MAX_PAR_CONV,
        (i + 1) * LOT_MAX_PAR_CONV,
      );
      // 3. Appel HORS verrou.
      const r = await interroger(env, now, lot);
      if (!r.reponse) {
        echec = true;
        nonRelie = r.nonRelie === true;
        break;
      }
      const bilan = await enregistrerLot(env, now, lot, r.reponse, restantes);
      if (bilan === null) {
        echec = true;
        break;
      }
      sansCle += bilan.sansCle;
    }
    if (echec) {
      p.pauseJusquaMs = now + PAUSE_APRES_ECHEC_MS;
      if (nonRelie) await alerteNonRelie(now);
      else await alerteEchec(restantes.size, now);
    } else if (sansCle > 0) await alerteSansConversation(sansCle, now); // en cas d'échec, `restantes` les compte déjà
  } catch (e) {
    demanderVerificationSite(restantes);
    throw e;
  }
  demanderVerificationSite(restantes); // tout ce qui n'a pas reçu de preuve reste demandé
  const illisibles = refsIllisiblesSite();
  if (illisibles > 0 && (await alerteIllisibles(illisibles, now)))
    acquitterRefsIllisiblesSite();
  const abandonnees = debordementsSite();
  if (abandonnees > 0 && (await alerteDebordement(abandonnees, now)))
    acquitterDebordementsSite();
}

/**
 * 4. Réponse valide : d'ABORD le registre (références « opposées »), ENSUITE seulement les preuves « non opposée ». Rend faux si rien
 * n'a été prouvé pour ce lot (`null`), sinon le nombre de références « opposées » sans aucune clé de conversation (restées INCONNUES).
 * Les références prouvées sont retirées de `restantes`.
 */
async function enregistrerLot(
  env: Env,
  now: number,
  lot: readonly string[],
  reponse: readonly boolean[],
  restantes: Set<string>,
): Promise<{ sansCle: number } | null> {
  const opposees = new Set(lot.filter((_, i) => reponse[i]));
  const conv = await lireParametre<unknown>(PARAM_CONVERSATIONS_ETAT, {});
  const cles: string[] = [];
  const avecCle = new Set<string>();
  if (estObjet(conv))
    for (const [cle, e] of Object.entries(conv)) {
      const r = estObjet(e) ? e.refLienConv : undefined;
      if (typeof r === "string" && opposees.has(r)) {
        cles.push(cle);
        avecCle.add(r);
      }
    }
  try {
    await enregistrerOppositionsImportees(cles, { env });
  } catch {
    return null; // aucune preuve pour le lot
  }
  // Une référence « opposée » sans aucune clé reste INCONNUE : pas de preuve, remise en demande.
  for (const r of avecCle) restantes.delete(r);
  const sansCle = [...opposees].filter((r) => !avecCle.has(r)).length;
  const nonOpposees = lot.filter((_, i) => !reponse[i]);
  if (nonOpposees.length > 0) {
    // Écriture des preuves sous verrou, SANS appel réseau. Heure d'ENVOI de la demande (`now`) : la plus prudente.
    await sousVerrou(async () => {
      const brut = await lireParametre<unknown>(PARAM_OPPOSITIONS_SITE, null);
      const verifs = lireVerifs(brut);
      for (const r of nonOpposees)
        verifs[r] = Math.max(verifs[r] ?? -Infinity, now);
      // « Futur » = au-delà de l'horloge réelle : un passage plus lent ne doit pas effacer la preuve, plus récente, d'un passage concurrent.
      const horloge = Math.max(now, Date.now());
      const gardees = Object.entries(verifs)
        .filter(
          ([k, t]) =>
            RE_REF_CONV.test(k) &&
            Number.isFinite(t) &&
            t <= horloge &&
            now - t <= FRAICHEUR_SITE_MS + MARGE_RENOUVELLEMENT_MS,
        )
        .sort((a, b) => b[1] - a[1])
        .slice(0, MAX_VERIFS);
      await ecrireParametre(PARAM_OPPOSITIONS_SITE, {
        v: 1,
        verifs: Object.fromEntries(gardees),
        alerteLe: lireAlerteLe(brut),
      });
    });
    for (const r of nonOpposees) restantes.delete(r);
  }
  return { sansCle };
}
