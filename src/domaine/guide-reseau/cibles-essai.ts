// Cibles d'essai limitées à des comptes listés (phase 2 de l'essai, Facebook seulement). Module PUR : aucun import serveur, aucun accès réseau ni base.
// Une cible d'essai (catalogue : `test: true`) reste refusée partout, sauf pour un compte nommé dans PARCOURS_ESSAI_COMPTES ET sur Facebook.
// Variable absente, vide, mal formée, trop longue ou « * » : jamais permis (échec fermé). Aucun mot, aucun guide, aucun compte figé ici.

export const VARIABLE_ESSAI_COMPTES = "PARCOURS_ESSAI_COMPTES";
/** Au plus trois comptes d'essai. */
export const ESSAI_COMPTES_MAX = 3;
/** Forme d'un identifiant de compte (lettres, chiffres, tiret, tiret bas) ; ni espace, ni « * ». */
const RE_ID_COMPTE = /^[A-Za-z0-9_-]{6,64}$/;
/** Forme d'un identifiant d'auteur : la MÊME que celle acceptée par le webhook (`RE_ID` de crochet-zernio.ts). Ni espace, ni « * », ni virgule. */
const RE_ID_AUTEUR = /^[A-Za-z0-9._:-]{1,200}$/;

type Env = Record<string, string | undefined>;

/**
 * Liste des comptes d'essai. Vide si la variable est absente, vide ou si UNE entrée est mal formée (liste entière refusée),
 * si elle dépasse trois comptes. Seuls les blancs autour d'une entrée sont ignorés.
 */
export function comptesEssai(env: Env): readonly string[] {
  const brut = env[VARIABLE_ESSAI_COMPTES];
  if (typeof brut !== "string" || brut.trim() === "") return [];
  const entrees = brut.split(",").map((x) => x.trim());
  if (entrees.length > ESSAI_COMPTES_MAX) return [];
  if (!entrees.every((x) => RE_ID_COMPTE.test(x))) return [];
  return entrees;
}

/** Vrai si au moins un compte d'essai est valablement listé. */
export function essaiActif(env: Env): boolean {
  return comptesEssai(env).length > 0;
}

/** Vrai seulement si le compte est listé ET le réseau est Facebook. Instagram, autres réseaux, compte inconnu : faux. */
export function cibleEssaiPermise(
  env: Env,
  compte: string | undefined | null,
  reseau: string | null | undefined,
): boolean {
  if (reseau !== "facebook") return false;
  if (typeof compte !== "string" || compte === "") return false;
  return comptesEssai(env).includes(compte);
}

export const VARIABLE_ESSAI_AUTEURS = "PARCOURS_ESSAI_AUTEURS";
/** Au plus trois auteurs d'essai. */
export const ESSAI_AUTEURS_MAX = 3;

/**
 * Liste des auteurs de commentaire admis sur une cible d'essai (même forme que l'identifiant accepté par le webhook).
 * Vide si la variable est absente, vide, trop longue ou si UNE entrée est mal formée.
 */
export function auteursEssai(env: Env): readonly string[] {
  const brut = env[VARIABLE_ESSAI_AUTEURS];
  if (typeof brut !== "string" || brut.trim() === "") return [];
  const entrees = brut.split(",").map((x) => x.trim());
  if (entrees.length > ESSAI_AUTEURS_MAX) return [];
  if (!entrees.every((x) => RE_ID_AUTEUR.test(x))) return [];
  return entrees;
}

/** Vrai seulement si l'auteur du commentaire est listé. Liste absente, vide ou invalide : personne (échec fermé). */
export function auteurEssaiPermis(env: Env, auteur: string | undefined | null): boolean {
  if (typeof auteur !== "string" || auteur === "") return false;
  return auteursEssai(env).includes(auteur);
}
