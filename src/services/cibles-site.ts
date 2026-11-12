/**
 * MG-1 — client signé vers le catalogue du site (écran /mots). SANS EFFET : rien ne l'appelle encore.
 *
 * Lecture : catalogue (GET /api/interne/catalogue-reseau) et liaisons (GET /api/interne/mots-cibles), par le transport signé
 * EXISTANT du parcours (`transportDuSite` : SITE_GUIDES_RESEAU_SECRET et SITE_VIDEOS_URL, aucune nouvelle variable).
 * Copie dans le paramètre `cibles.miroir` : relue au site après 10 min ; si le site échoue, gardée jusqu'à 24 h, puis `null`
 * (échec fermé). La copie ne contient jamais d'adresse ni de chemin de PDF : tout passe par `lireCatalogue` / `lireLiaisons`.
 * Écriture : création d'une cible, liaison et déliaison d'un mot ; les refus du site deviennent des phrases françaises.
 * Ni le secret ni une signature ne sont journalisés.
 */
import "server-only";
import { randomBytes } from "node:crypto";
import {
  CHEMIN_CATALOGUE_RESEAU,
  CODE_GUIDE_DEPART,
  CHEMIN_CIBLES_RESEAU,
  CHEMIN_MOTS_CIBLES,
  PHRASES_REFUS_SITE,
  RE_CODE_CIBLE,
  lireCatalogue,
  lireLiaisons,
  motVersSite,
  type ElementCatalogue,
  type LiaisonMot,
  type ReseauSite,
  type TypeElement,
} from "@/domaine/guide-reseau/cibles-contrat";
import { signerAppel } from "@/fournisseurs/site/signature";
import type { ReponseSite } from "@/fournisseurs/site/types";
import { ecrireParametre, journaliser, lireParametre } from "./_commun";
import { transportDuSite } from "./parcours-mot";

export const PARAM_CIBLES_MIROIR = "cibles.miroir";
export const DELAI_SITE_CIBLES_MS = 3_000;
export const FRAICHEUR_MIROIR_MS = 10 * 60_000;
export const PEREMPTION_MIROIR_MS = 24 * 60 * 60_000;
/** Après un échec du site, on ne le rappelle pas avant ce délai (la copie sert entre-temps). */
export const PAUSE_APRES_ECHEC_MS = 60_000;

type Env = Record<string, string | undefined>;

export interface CiblesSite {
  catalogue: ElementCatalogue[];
  liaisons: LiaisonMot[];
  /** Instant (ms) où le site a été lu pour la dernière fois. */
  luLe: number;
  /** Lignes du site que le Studio n'a pas pu lire. */
  ignores: number;
  /** Vrai quand le site n'a pas répondu et que la copie sert à sa place. */
  depuisCopie: boolean;
}

interface Miroir extends Omit<CiblesSite, "depuisCopie"> {
  /** Une écriture a réussi depuis : relire au prochain passage, tout en gardant cette copie en secours. */
  aRelire?: boolean;
}

const estObjet = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

class DelaiDepasse extends Error {}

/** Un appel signé, borné à 3 s. Lève si le site ne répond pas à temps ou est injoignable. `null` = transport absent : aucun appel n'est parti. */
async function appeler(
  env: Env,
  maintenantMs: number,
  methode: "GET" | "POST",
  chemin: string,
  corps: string,
): Promise<ReponseSite | null> {
  const site = transportDuSite(env);
  if (!site) return null;
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
      DELAI_SITE_CIBLES_MS,
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

/** Lit le site. `message` = échec (injoignable, refus, forme illisible) ; le journal ne reçoit que le chemin et le code. */
async function lireLeSite(
  env: Env,
  maintenantMs: number,
): Promise<{ cibles: Omit<CiblesSite, "depuisCopie"> } | { message: string }> {
  try {
    const [c, l] = await Promise.all([
      appeler(env, maintenantMs, "GET", CHEMIN_CATALOGUE_RESEAU, ""),
      appeler(env, maintenantMs, "GET", CHEMIN_MOTS_CIBLES, ""),
    ]);
    if (!c || !l) return { message: "" };
    const cat = c.statut === 200 ? lireCatalogue(c.corps) : null;
    const lia = l.statut === 200 ? lireLiaisons(l.corps) : null;
    if (!cat || !lia)
      return {
        message: `Lecture du catalogue du site refusée ou illisible (catalogue ${c.statut}, mots ${l.statut}).`,
      };
    return {
      cibles: {
        catalogue: cat.elements,
        liaisons: lia.liaisons,
        luLe: maintenantMs,
        ignores: cat.ignores + lia.ignores,
      },
    };
  } catch {
    return {
      message:
        "Lecture du catalogue du site impossible : le site n'a pas répondu.",
    };
  }
}

// État en mémoire (un redémarrage repart de zéro) : instant du dernier échec et série en cours.
let dernierEchecMs: number | null = null;
let serieJournalisee = false;

/** Remet à zéro l'état en mémoire (essais). */
export function reinitialiserEtatCiblesSite(): void {
  dernierEchecMs = null;
  serieJournalisee = false;
}

/** Relit la copie en repassant par le contrat : une copie abîmée, ou qui aurait gardé une adresse, est écartée. */
function lireMiroir(brut: unknown): Miroir | null {
  if (
    !estObjet(brut) ||
    typeof brut.luLe !== "number" ||
    !Number.isFinite(brut.luLe)
  )
    return null;
  const cat = lireCatalogue(brut.catalogue);
  const lia = lireLiaisons(brut.liaisons);
  if (!cat || !lia) return null;
  return {
    catalogue: cat.elements,
    liaisons: lia.liaisons,
    luLe: brut.luLe,
    ignores: typeof brut.ignores === "number" ? brut.ignores : 0,
    aRelire: brut.aRelire === true,
  };
}

export async function lireCiblesSite(
  o: { env?: Env; maintenantMs?: number } = {},
): Promise<CiblesSite | null> {
  const env = o.env ?? process.env;
  const now = o.maintenantMs ?? Date.now();
  const copie = lireMiroir(
    await lireParametre<unknown>(PARAM_CIBLES_MIROIR, null),
  );
  const age = copie ? now - copie.luLe : Infinity;
  if (copie && !copie.aRelire && age >= 0 && age < FRAICHEUR_MIROIR_MS)
    return depuis(copie, false);
  // Le site a échoué il y a moins d'une minute : on ne le rappelle pas, la copie (si elle est assez jeune) sert.
  const depuisEchec = dernierEchecMs === null ? Infinity : now - dernierEchecMs;
  const enPause = depuisEchec >= 0 && depuisEchec < PAUSE_APRES_ECHEC_MS;
  if (!enPause) {
    const lu = await lireLeSite(env, now);
    if ("cibles" in lu) {
      dernierEchecMs = null;
      serieJournalisee = false;
      const { catalogue, liaisons, luLe, ignores } = lu.cibles;
      await ecrireParametre(PARAM_CIBLES_MIROIR, {
        catalogue,
        liaisons,
        luLe,
        ignores,
      });
      return { ...lu.cibles, depuisCopie: false };
    }
    // Pas de message = site non relié (aucun appel parti) : ce n'est pas un échec du site.
    if (lu.message) {
      dernierEchecMs = now;
      // Un seul message par série d'échecs.
      if (!serieJournalisee) {
        serieJournalisee = true;
        await journaliser("cibles_site", lu.message);
      }
    }
  }
  // Site en échec : la copie sert jusqu'à 24 h, ensuite échec fermé.
  if (copie && age >= 0 && age < PEREMPTION_MIROIR_MS)
    return depuis(copie, true);
  return null;
}

const depuis = (m: Miroir, depuisCopie: boolean): CiblesSite => ({
  catalogue: m.catalogue,
  liaisons: m.liaisons,
  luLe: m.luLe,
  ignores: m.ignores,
  depuisCopie,
});

// ---------------------------------------------------------------- écriture

// Défaut connu : `horodatage_hors_fenetre` (dérive d'horloge) n'est jamais atteint ici : l'horodatage vient de `maintenantMs` signé tel quel.
export type ResultatEcriture<T = object> =
  | ({ ok: true } & T)
  | { ok: false; phrase: string };

/** Résultat d'une création : en cas d'échec le `code` est TOUJOURS rendu, pour rejouer sans doublon. */
export type ResultatCreation =
  | { ok: true; code: string }
  | { ok: false; phrase: string; code: string };

// Un appel est parti mais sa réponse n'est pas arrivée (délai, coupure) : le site a pu enregistrer la demande.
const PHRASE_INCERTAIN =
  "Le site n'a pas répondu à temps : la demande a peut-être été enregistrée. Réessayez, elle ne sera pas créée deux fois.";
const PHRASE_NON_RELIE =
  "Le site n'est pas relié au Studio : rien n'a été enregistré.";
const PHRASE_INCONNUE =
  "Le site a refusé la demande : rien n'a été enregistré.";

function phraseDuRefus(r: ReponseSite): string {
  const code =
    estObjet(r.corps) && typeof r.corps.erreur === "string"
      ? r.corps.erreur
      : "";
  if (Object.hasOwn(PHRASES_REFUS_SITE, code)) return PHRASES_REFUS_SITE[code];
  // Réponse sans code lisible : on se rabat sur le statut (404 = site éteint, 429 = trop de demandes, 401 = signature).
  if (r.statut === 404) return PHRASES_REFUS_SITE.introuvable;
  if (r.statut === 429) return PHRASES_REFUS_SITE.trop_de_requetes;
  if (r.statut === 401) return PHRASES_REFUS_SITE.signature_invalide;
  // Erreur du site (5xx) sans code lisible : l'appel est parti, la demande a pu être enregistrée.
  if (r.statut >= 500) return PHRASE_INCERTAIN;
  return PHRASE_INCONNUE;
}

async function ecrire(
  env: Env,
  maintenantMs: number,
  chemin: string,
  corps: Record<string, unknown>,
): Promise<ResultatEcriture<{ reponse: unknown }>> {
  let r: ReponseSite | null;
  try {
    r = await appeler(env, maintenantMs, "POST", chemin, JSON.stringify(corps));
  } catch (e) {
    await journaliser(
      "cibles_site",
      `Écriture vers ${chemin} impossible : ${e instanceof DelaiDepasse ? "délai dépassé" : "le site n'a pas répondu"}.`,
    );
    return { ok: false, phrase: PHRASE_INCERTAIN };
  }
  if (!r) return { ok: false, phrase: PHRASE_NON_RELIE };
  if (r.statut === 200 && estObjet(r.corps) && r.corps.ok === true) {
    await marquerARelire();
    return { ok: true, reponse: r.corps };
  }
  const phrase = phraseDuRefus(r);
  await journaliser(
    "cibles_site",
    `Écriture vers ${chemin} refusée par le site (${r.statut}).`,
  );
  return { ok: false, phrase };
}

async function marquerARelire(): Promise<void> {
  const copie = lireMiroir(
    await lireParametre<unknown>(PARAM_CIBLES_MIROIR, null),
  );
  if (copie)
    await ecrireParametre(PARAM_CIBLES_MIROIR, { ...copie, aRelire: true });
}

const codeNouveau = (type: TypeElement): string =>
  `${type === "guide" ? "gde" : "adr"}-${randomBytes(6).toString("hex")}`;

/**
 * Crée (ou met à jour) une cible. Le Studio fournit lui-même le code : `adr-` + 12 hex pour une adresse (`gde-` pour un guide).
 * Pour rejouer sans doublon, repasser le même `code` (rendu par le premier appel).
 */
export async function creerElementCatalogue(o: {
  env?: Env;
  maintenantMs?: number;
  type: TypeElement;
  titre: string;
  url?: string;
  cheminPdf?: string;
  code?: string;
  test?: boolean;
}): Promise<ResultatCreation> {
  const code = o.code ?? codeNouveau(o.type);
  if (
    !RE_CODE_CIBLE.test(code) ||
    !code.startsWith(o.type === "guide" ? "gde-" : "adr-")
  ) {
    // Le code de départ du site (`guide-ia`) n'est accepté que pour un guide.
    if (!(code === CODE_GUIDE_DEPART && o.type === "guide"))
      return { ok: false, phrase: PHRASES_REFUS_SITE.code_invalide, code };
  }
  const corps: Record<string, unknown> = {
    code,
    type: o.type,
    titre: o.titre,
    ...(o.type === "guide"
      ? { cheminPdf: o.cheminPdf ?? null }
      : { url: o.url ?? null }),
    ...(o.test !== undefined ? { test: o.test } : {}),
  };
  const r = await ecrire(
    o.env ?? process.env,
    o.maintenantMs ?? Date.now(),
    CHEMIN_CIBLES_RESEAU,
    corps,
  );
  return r.ok ? { ok: true, code } : { ok: false, phrase: r.phrase, code };
}

async function lier(
  o: {
    env?: Env;
    maintenantMs?: number;
    mot: string;
    reseau: ReseauSite;
    codeCible: string;
  },
  actif: boolean,
): Promise<ResultatEcriture> {
  const mot = motVersSite(o.mot);
  if (mot === null)
    return { ok: false, phrase: PHRASES_REFUS_SITE.mot_invalide };
  const r = await ecrire(
    o.env ?? process.env,
    o.maintenantMs ?? Date.now(),
    CHEMIN_MOTS_CIBLES,
    { mot, reseau: o.reseau, codeCible: o.codeCible, actif },
  );
  return r.ok ? { ok: true } : r;
}

/** Relie un mot à une cible pour un réseau (« tous » = tous les réseaux sans ligne propre). */
export const lierMot = (o: {
  env?: Env;
  maintenantMs?: number;
  mot: string;
  reseau: ReseauSite;
  codeCible: string;
}): Promise<ResultatEcriture> => lier(o, true);

/**
 * Délie un mot : la ligne est désactivée (actif=false), jamais supprimée.
 * Il faut envoyer la cible actuelle de la ligne : le site la remplace par celle reçue.
 * Si la cible a été désactivée, le site refuse (cible_inactive) : relier d'abord le mot à une cible active, ou réactiver la cible, puis délier.
 */
export const delierMot = (o: {
  env?: Env;
  maintenantMs?: number;
  mot: string;
  reseau: ReseauSite;
  codeCible: string;
}): Promise<ResultatEcriture> => lier(o, false);
