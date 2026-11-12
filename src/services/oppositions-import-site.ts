/**
 * STOP-S5a — le Studio IMPORTE les oppositions connues du site, par conversation (`POST /api/interne/oppositions-par-conv`).
 * Éteint par défaut (`OPPOSITIONS_SITE_IMPORT_ENABLED`) : aucun appel, aucune écriture.
 *
 * Règles de sûreté :
 *  - seule une réponse 200 VALIDE (même longueur, même ordre, version 1, rien d'autre) est lue ; tout le reste (429, 503, 5xx, 401, 422,
 *    délai, réponse mal formée) est « INCONNU » : rien n'est écrit, le cycle n'est pas complet. Jamais « non opposée » par défaut ;
 *  - une opposition importée est écrite avec `transmise: true` (le site la connaît) et `source: "site"` ;
 *  - cycle : conversations triées par référence, lots de 100, 10 lots au plus par passage, reprise au curseur ; le cycle n'est « complet »
 *    qu'à la fin. Sans cycle complet récent (30 min), `personneOpposeePartout` écarte les personnes qui ont un lien (`site_perime`) ;
 *  - le paramètre `parcours.oppositions.site` ne contient que des références opaques et des dates ; l'alerte (cloche seulement, jamais
 *    de push) ne contient qu'un nombre, au plus une par heure ;
 *  - appel signé par le transport du site déjà permis (`transportDuSite`), comme `cibles-site.ts`.
 */
import "server-only";
import {
  CHEMIN_OPPOSITIONS_PAR_CONV,
  LOT_MAX_PAR_CONV,
  RE_REF_CONV,
  construireCorpsParConv,
  lireReponseParConv,
} from "@/domaine/guide-reseau/oppositions-par-conv-contrat";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { ReponseSite } from "@/fournisseurs/site/types";
import {
  cleIdempotenceOpaque,
  lireClesEmpreinte,
} from "@/domaine/guide-reseau/empreinte-personne";
import {
  ecrireParametre,
  journaliser,
  lireParametre,
  sousVerrou,
} from "./_commun";
import { creerNotification } from "./notifications";
import {
  PARAM_OPPOSITIONS_MOTS,
  PARAM_OPPOSITIONS_SITE,
  enregistrerOppositionsImportees,
  importSiteActif,
  type LigneOpposition,
} from "./oppositions-mots";
import {
  PARAM_OPPOSITIONS_FILE,
  PARAM_OPPOSITIONS_PAGE,
  type EntreeOpposition,
  type EntreeOppositionPage,
} from "./oppositions-transmission";
import { transportDuSite } from "./parcours-mot";

export {
  PARAM_OPPOSITIONS_SITE,
  VARIABLE_OPPOSITIONS_SITE_IMPORT,
  PEREMPTION_IMPORT_SITE_MS,
} from "./oppositions-mots";
export const INTERVALLE_IMPORT_MS = 10 * 60_000;
export const LOTS_MAX_PAR_PASSAGE = 10;
export const DELAI_IMPORT_SITE_MS = 5_000;
const INTERVALLE_ALERTE_MS = 3600_000;
/** Même nom que `PARAM_CONVERSATIONS` (parcours-conversation.ts) : pas d'import, pour éviter tout cycle. */
const PARAM_CONVERSATIONS_ETAT = "parcours.conversations";

type Env = Record<string, string | undefined>;
export interface EtatImportSite {
  curseur: string | null;
  cycleCommenceLe: number | null;
  dernierCycleCompletLe: number | null;
  alerteLe: number | null;
}
const VIDE: EtatImportSite = {
  curseur: null,
  cycleCommenceLe: null,
  dernierCycleCompletLe: null,
  alerteLe: null,
};

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);
const nombreOuNull = (v: unknown): number | null =>
  typeof v === "number" && Number.isFinite(v) ? v : null;

function lireEtat(brut: unknown): EtatImportSite {
  if (!estObjet(brut)) return { ...VIDE };
  return {
    curseur:
      typeof brut.curseur === "string" && RE_REF_CONV.test(brut.curseur)
        ? brut.curseur
        : null,
    cycleCommenceLe: nombreOuNull(brut.cycleCommenceLe),
    dernierCycleCompletLe: nombreOuNull(brut.dernierCycleCompletLe),
    alerteLe: nombreOuNull(brut.alerteLe),
  };
}

// État en mémoire (un redémarrage repart de zéro) : dernier passage et passage en cours.
let dernierPassageMs: number | null = null;
let enCours = false;
/** Remet à zéro l'état en mémoire (essais). */
export function reinitialiserImportOppositionsSite(): void {
  dernierPassageMs = null;
  enCours = false;
}

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
  let minuteur: ReturnType<typeof setTimeout> | undefined;
  const delai = new Promise<never>((_, rejeter) => {
    minuteur = setTimeout(
      () => rejeter(new DelaiDepasse("delai")),
      DELAI_IMPORT_SITE_MS,
    );
  });
  try {
    return await Promise.race([
      site.transport({ methode, chemin, corps, entetes }),
      delai,
    ]);
  } finally {
    clearTimeout(minuteur);
  }
}

/** Un lot : un booléen par référence demandée, ou `null` (INCONNU) pour tout ce qui n'est pas une réponse 200 valide. */
async function interroger(
  env: Env,
  maintenantMs: number,
  refs: readonly string[],
): Promise<boolean[] | null> {
  const corps = construireCorpsParConv(refs);
  if (corps === null) return null;
  try {
    const r = await appeler(env, maintenantMs, corps);
    if (!r || r.statut !== 200) return null;
    return lireReponseParConv(r.corps, refs);
  } catch {
    return null;
  }
}

/** Alerte à la cloche : un nombre seulement, au plus une par heure. Jamais de push. Ne fait jamais échouer le passage. */
async function alerter(
  etat: EtatImportSite,
  nombre: number,
  now: number,
): Promise<void> {
  if (
    etat.alerteLe !== null &&
    now - etat.alerteLe >= 0 &&
    now - etat.alerteLe < INTERVALLE_ALERTE_MS
  )
    return;
  etat.alerteLe = now;
  const message = `L'import des oppositions du site est incomplet : ${nombre} conversation(s) n'ont pas pu être vérifiées. Les personnes qui ont reçu un lien sont écartées tant que la vérification échoue (rien ne leur est envoyé).`;
  try {
    await journaliser("parcours_conversation", `ALERTE : ${message}`);
    await creerNotification(
      {
        type: "echec",
        titre: "Oppositions du site non importées",
        message,
        lien: "/mots",
      },
      { cloche: true },
    );
  } catch {
    /* l'alerte ne doit jamais faire échouer le passage */
  }
}

/**
 * Le site connaît déjà ces oppositions : on pose AUSSI les entrées des files de transmission à l'état « transmise » (voie page, et voie
 * adresse si l'adresse avait été transmise). Sans cela, la réconciliation (`rattraperOppositions`) renverrait au site ce qu'il vient de
 * nous dire : boucle. Une entrée déjà présente n'est jamais touchée. Ni adresse, ni identifiant brut.
 */
async function marquerConnuesDuSite(
  cles: readonly string[],
  conv: Record<string, unknown>,
  env: Env,
  now: number,
): Promise<void> {
  if (cles.length === 0) return;
  const k = lireClesEmpreinte(env);
  if (!k.ok) throw new Error("cles_absentes");
  const iso = new Date(now).toISOString();
  await sousVerrou(async () => {
    const page = await lireParametre<Record<string, EntreeOppositionPage>>(
      PARAM_OPPOSITIONS_PAGE,
      {},
    );
    const file = await lireParametre<Record<string, EntreeOpposition>>(
      PARAM_OPPOSITIONS_FILE,
      {},
    );
    const page2 = { ...page };
    const file2 = { ...file };
    for (const cle of cles) {
      const e = conv[cle];
      if (!estObjet(e) || (e.reseau !== "instagram" && e.reseau !== "facebook"))
        continue;
      if (
        !page2[cle] &&
        typeof e.refLienConv === "string" &&
        e.refLienConv !== ""
      )
        page2[cle] = {
          cleIdempotence: cleIdempotenceOpaque(
            k.courante,
            "opposition",
            `page:${cle}`,
          ),
          refLienConv: e.refLienConv,
          reseau: e.reseau,
          creeLe: iso,
          etat: "transmise",
          essais: 0,
          prochainEssaiLe: null,
          dernierCode: "connue_du_site",
        };
      if (!file2[cle] && typeof e.occurredAt === "string")
        file2[cle] = {
          cleIdempotence: cleIdempotenceOpaque(k.courante, "opposition", cle),
          reseau: e.reseau,
          creeLe: iso,
          essais: 0,
          prochainEssaiLe: null,
          etat: "transmise",
          dernierCode: "connue_du_site",
          depuis: iso,
          lectures: 0,
        };
    }
    if (Object.keys(page2).length !== Object.keys(page).length)
      await ecrireParametre(PARAM_OPPOSITIONS_PAGE, page2);
    if (Object.keys(file2).length !== Object.keys(file).length)
      await ecrireParametre(PARAM_OPPOSITIONS_FILE, file2);
  });
}

/**
 * Un passage de l'import. Éteint : aucun appel, aucune écriture. Allumé : au plus un passage toutes les 10 min.
 * Les erreurs de lecture/écriture sont propagées (l'étape du passage les absorbe) : jamais d'état « complet » sur une erreur.
 */
export async function importerOppositionsDuSite(
  o: { env?: Env; maintenantMs?: number } = {},
): Promise<void> {
  const env = o.env ?? process.env;
  if (!importSiteActif(env)) return;
  const now = o.maintenantMs ?? Date.now();
  if (enCours) return;
  if (
    dernierPassageMs !== null &&
    now - dernierPassageMs >= 0 &&
    now - dernierPassageMs < INTERVALLE_IMPORT_MS
  )
    return;
  enCours = true;
  try {
    dernierPassageMs = now;
    await passage(env, now);
  } finally {
    enCours = false;
  }
}

async function passage(env: Env, now: number): Promise<void> {
  const etat = lireEtat(
    await lireParametre<unknown>(PARAM_OPPOSITIONS_SITE, null),
  );
  const conv = await lireParametre<unknown>(PARAM_CONVERSATIONS_ETAT, {});
  const registre = await lireParametre<unknown>(PARAM_OPPOSITIONS_MOTS, []);
  const dejaImportees = new Set<string>(
    Array.isArray(registre)
      ? (registre as LigneOpposition[])
          .filter((x) => x?.source === "site" && typeof x.id === "string")
          .map((x) => x.id)
      : [],
  );

  // Conversations à vérifier : un lien, état différent de « oppose », pas déjà importée. Référence -> clés de conversation.
  const parRef = new Map<string, string[]>();
  let illisibles = 0;
  if (estObjet(conv)) {
    for (const [cle, e] of Object.entries(conv)) {
      if (
        !estObjet(e) ||
        typeof e.refLienConv !== "string" ||
        e.refLienConv === ""
      )
        continue;
      if (e.etat === "oppose" || dejaImportees.has(cle)) continue;
      if (!RE_REF_CONV.test(e.refLienConv)) {
        illisibles++;
        continue;
      }
      parRef.set(e.refLienConv, [...(parRef.get(e.refLienConv) ?? []), cle]);
    }
  } else illisibles++;
  const refs = [...parRef.keys()].sort();

  const debut =
    etat.curseur === null
      ? 0
      : refs.findIndex((r) => r > (etat.curseur as string));
  let reste = debut === -1 ? refs.length : debut;
  if (etat.curseur === null) etat.cycleCommenceLe = now;
  let echec = illisibles > 0;
  let lots = 0;
  while (!echec && reste < refs.length && lots < LOTS_MAX_PAR_PASSAGE) {
    const lot = refs.slice(reste, reste + LOT_MAX_PAR_CONV);
    const reponse = await interroger(env, now, lot);
    if (reponse === null) {
      echec = true;
      break;
    }
    const opposees = lot
      .filter((_, i) => reponse[i])
      .flatMap((r) => parRef.get(r) ?? []);
    try {
      if (estObjet(conv)) await marquerConnuesDuSite(opposees, conv, env, now);
      await enregistrerOppositionsImportees(opposees, { env });
    } catch {
      echec = true;
      break;
    }
    reste += lot.length;
    etat.curseur = lot[lot.length - 1];
    lots++;
  }

  if (echec) {
    await alerter(etat, Math.max(refs.length - reste, 0) + illisibles, now);
  } else if (reste >= refs.length) {
    // Fin du cycle : tout a été vérifié depuis le début (le curseur n'avance que sur une réponse valide). La date retenue est celle du
    // DÉBUT du cycle : c'est la plus ancienne vérification, donc la seule qu'on puisse garantir pour toutes les conversations.
    etat.dernierCycleCompletLe = Math.min(etat.cycleCommenceLe ?? now, now);
    etat.curseur = null;
    etat.cycleCommenceLe = null;
  }
  await ecrireParametre(PARAM_OPPOSITIONS_SITE, etat);
}
