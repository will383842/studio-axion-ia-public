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
import { baseSiteValide, construireAdresseRecherche, faitSansMontant, nettoyerRecherche, validerReponseRecherche, type FaitSite } from "@/domaine/kb-site";
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
