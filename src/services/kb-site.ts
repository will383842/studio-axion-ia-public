/**
 * PORTE UNIQUE DE LECTURE DES FAITS DU SITE (fiche KB-02). Serveur seulement, LECTURE SEULE.
 *
 * `chercherFaitsSite(q)` interroge la recherche de la base de connaissances du site, et rien d'autre :
 *  - réglage « kb_site.lecture.actif » (ÉTEINT par défaut, relu à chaque recherche) et adresse `SITE_KB_URL`
 *    (absente = éteint) : l'un manque, aucun appel ne part ;
 *  - un seul appel GET par recherche, sans corps ni signature ; jamais d'écriture vers le site ;
 *  - délai court, `cache: "no-store"`, aucune redirection suivie ;
 *  - réponse validée (forme exacte) ; erreur, 400, 429, délai ou réponse mal formée : liste vide et message simple, sans exception ;
 *  - cadence plafonnée sous la limite du site (30 appels par minute et par adresse) ;
 *  - titres et extraits sortent SANS montant.
 * Un fait trouvé n'est qu'une preuve PROPOSÉE (voir `proposerPreuveDepuisSite`) : rien n'est utilisé sans validation.
 * `fetch` est injectable pour les tests : aucun test n'appelle le vrai site.
 */
import "server-only";
import { baseMethodeValide, baseSiteValide, CHEMIN_METHODE_SITE, consigneSansMontant, construireAdresseRecherche, faitSansMontant, nettoyerRecherche, nettoyerSujet, validerReponseMethode, validerReponseRecherche, type ConsigneMethode, type FaitSite } from "@/domaine/kb-site";
import { lireParametre } from "./_commun";

/** Réglage « Lire la base du site » : faux tant que le fondateur ne l'a pas allumé. */
export const REGLAGE_LECTURE_SITE = "kb_site.lecture.actif";
/** Variable d'environnement : adresse du site (origine). Absente = porte éteinte. */
export const VARIABLE_SITE_KB = "SITE_KB_URL";

const DELAI_MS = 4000;
/** Le site accepte 30 appels par minute et par adresse : on s'arrête avant. */
const MAX_APPELS_PAR_MINUTE = 20;
const FENETRE_MS = 60_000;

export type EtatLecture = "ok" | "vide" | "eteinte" | "trop-rapide" | "erreur";
export interface ResultatLectureSite {
  etat: EtatLecture;
  faits: FaitSite[];
  /** Phrase simple à afficher. */
  message: string;
}

export interface OptionsLectureSite {
  env?: Record<string, string | undefined>;
  fetchImpl?: typeof fetch;
  delaiMs?: number;
}

let appelsRecents: number[] = [];
/** Pour les tests. */
export function reinitialiserCadenceSite(): void {
  appelsRecents = [];
}

const rien = (etat: EtatLecture, message: string): ResultatLectureSite => ({ etat, faits: [], message });

async function lectureAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(REGLAGE_LECTURE_SITE, false)) === true;
  } catch {
    return false; // lecture du réglage impossible : on reste éteint
  }
}

/** Le site est-il relié ? (réglage allumé ET adresse valide) — sert à l'écran, n'appelle jamais le site. */
export async function lectureSiteDisponible(env: Record<string, string | undefined> = process.env): Promise<{ allumee: boolean; adresse: boolean }> {
  return { allumee: await lectureAllumee(), adresse: baseSiteValide(env.SITE_KB_URL) !== null };
}

export async function chercherFaitsSite(q: string, options: OptionsLectureSite = {}): Promise<ResultatLectureSite> {
  const env = options.env ?? process.env;
  const base = baseSiteValide(env.SITE_KB_URL);
  if (!(await lectureAllumee()) || !base) return rien("eteinte", "Lecture du site éteinte.");

  const texte = nettoyerRecherche(q);
  const adresse = construireAdresseRecherche(base, texte);
  if (!texte || !adresse) return rien("vide", "Écrivez ce que vous cherchez.");

  const maintenant = Date.now();
  appelsRecents = appelsRecents.filter((t) => maintenant - t < FENETRE_MS);
  if (appelsRecents.length >= MAX_APPELS_PAR_MINUTE) return rien("trop-rapide", "Trop de recherches à la suite : réessayez dans une minute.");
  appelsRecents.push(maintenant);

  const f = options.fetchImpl ?? fetch;
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), options.delaiMs ?? DELAI_MS);
  try {
    const reponse = await f(adresse, { method: "GET", headers: { accept: "application/json" }, cache: "no-store", redirect: "error", signal: controle.signal });
    if (reponse.status === 429) return rien("trop-rapide", "Le site demande d'attendre : réessayez dans une minute.");
    if (!reponse.ok) return rien("erreur", "Le site n'a pas pu répondre à cette recherche. Réessayez dans un instant.");
    const faits = validerReponseRecherche(await reponse.json()).map(faitSansMontant);
    return faits.length ? { etat: "ok", faits, message: "" } : rien("vide", "Aucun fait trouvé pour cette recherche.");
  } catch (e) {
    const delai = e instanceof Error && e.name === "AbortError";
    return rien("erreur", delai ? "Le site met trop de temps à répondre. Réessayez dans un instant." : "Le site n'a pas pu répondre à cette recherche. Réessayez dans un instant.");
  } finally {
    clearTimeout(minuteur);
  }
}

/* ------------------------------------------------------------------ */
/* Méthode du site (fiche KB-05c) : consignes internes, JAMAIS des preuves */
/* ------------------------------------------------------------------ */

/** Réglage « Lire la Méthode du site » : faux tant que le fondateur ne l'a pas allumé (distinct de la lecture des faits). */
export const REGLAGE_METHODE_SITE = "kb_site.methode.actif";
/** Variable d'environnement du serveur : secret partagé avec le site. Jamais en base, jamais à l'écran. */
export const VARIABLE_SECRET_METHODE = "METHODE_STUDIO_SECRET";
const SECRET_MIN = 32;

export type EtatMethode = "ok" | "vide" | "eteinte" | "non-branchee" | "fermee" | "trop-rapide" | "erreur";
export interface ResultatMethodeSite {
  etat: EtatMethode;
  consignes: ConsigneMethode[];
  /** Phrase simple à afficher. */
  message: string;
}

let appelsMethodeRecents: number[] = [];
/** Pour les tests. */
export function reinitialiserCadenceMethode(): void {
  appelsMethodeRecents = [];
}

const aucune = (etat: EtatMethode, message: string): ResultatMethodeSite => ({ etat, consignes: [], message });

async function methodeAllumee(): Promise<boolean> {
  try {
    return (await lireParametre<unknown>(REGLAGE_METHODE_SITE, false)) === true;
  } catch {
    return false; // lecture du réglage impossible : on reste éteint
  }
}

const secretValide = (v: string | undefined): v is string => typeof v === "string" && v.length >= SECRET_MIN;

/** Réglage, adresse https et secret : trois booléens pour l'écran. N'appelle jamais le site et ne rend jamais le secret. */
export async function lectureMethodeDisponible(env: Record<string, string | undefined> = process.env): Promise<{ allumee: boolean; adresse: boolean; secret: boolean }> {
  return { allumee: await methodeAllumee(), adresse: baseMethodeValide(env.SITE_KB_URL) !== null, secret: secretValide(env[VARIABLE_SECRET_METHODE]) };
}

/** Lit les consignes de la Méthode pour un sujet : un seul POST, lecture seule, jamais d'exception, aucun journal. */
export async function lireMethodeSite(sujet: string, options: OptionsLectureSite = {}): Promise<ResultatMethodeSite> {
  const env = options.env ?? process.env;
  if (!(await methodeAllumee())) return aucune("eteinte", "Méthode éteinte.");
  const base = baseMethodeValide(env.SITE_KB_URL);
  const secret = env[VARIABLE_SECRET_METHODE];
  if (!base || !secretValide(secret)) return aucune("non-branchee", "La Méthode n'est pas branchée : il manque l'adresse du site ou le secret sur le serveur.");

  const texte = nettoyerSujet(sujet);
  if (!texte) return aucune("vide", "Écrivez un sujet de 2 à 300 caractères.");

  const maintenant = Date.now();
  appelsMethodeRecents = appelsMethodeRecents.filter((t) => maintenant - t < FENETRE_MS);
  if (appelsMethodeRecents.length >= MAX_APPELS_PAR_MINUTE) return aucune("trop-rapide", "Trop de lectures à la suite : réessayez dans une minute.");
  appelsMethodeRecents.push(maintenant);

  const f = options.fetchImpl ?? fetch;
  const controle = new AbortController();
  const minuteur = setTimeout(() => controle.abort(), options.delaiMs ?? DELAI_MS);
  try {
    const reponse = await f(new URL(CHEMIN_METHODE_SITE, base).toString(), {
      method: "POST",
      headers: { "content-type": "application/json", accept: "application/json", "x-methode-secret": secret },
      body: JSON.stringify({ sujet: texte }),
      cache: "no-store",
      redirect: "error",
      signal: controle.signal,
    });
    if (reponse.status === 404) return aucune("fermee", "La Méthode n'est pas ouverte sur le site.");
    if (reponse.status === 401 || reponse.status === 503) return aucune("non-branchee", "La Méthode n'est pas branchée : le site n'a pas reconnu le secret ou n'est pas prêt.");
    if (reponse.status === 429) return aucune("trop-rapide", "Le site demande d'attendre : réessayez dans une minute.");
    if (!reponse.ok) return aucune("erreur", "Le site n'a pas pu répondre. Réessayez dans un instant.");
    const corps: unknown = await reponse.json();
    if (!corps || typeof corps !== "object" || !Array.isArray((corps as { items?: unknown }).items)) return aucune("erreur", "Le site n'a pas pu répondre. Réessayez dans un instant.");
    const consignes = validerReponseMethode(corps).map(consigneSansMontant);
    return consignes.length ? { etat: "ok", consignes, message: "" } : aucune("vide", "Aucun passage trouvé pour ce sujet.");
  } catch (e) {
    const delai = e instanceof Error && e.name === "AbortError";
    return aucune("erreur", delai ? "Le site met trop de temps à répondre. Réessayez dans un instant." : "Le site n'a pas pu répondre. Réessayez dans un instant.");
  } finally {
    clearTimeout(minuteur);
  }
}
