/**
 * ESSAI BORNÉ D'UN BROUILLON CHEZ LE DIFFUSEUR : UN créneau, UN compte, brouillon seulement, 24 h au plus.
 *
 * Réglage `zernio.essai_brouillon` (collection `parametres`) ; absent, illisible ou incohérent = FERMÉ, sans jamais lever.
 * Aucun réglage n'est simulé ouvert : chaque porte du calendrier vaut « condition générale OU essai couvrant CE créneau ».
 *  - `lireEssai` : l'essai tel que posé, seulement si tout est cohérent avec le créneau relu en base (jamais saisi) ;
 *  - `essaiCouvre(creneauId, geste)` : égalité STRICTE de l'identifiant du créneau (le créneau « …-reprise » n'est pas couvert),
 *    `brouillon` et `deplacement` jusqu'à l'expiration, `retrait` 24 h de plus (nettoyage) ;
 *  - `dansEssai` / `essaiEnCours` : contexte d'exécution qui ne porte QUE l'identifiant ; chaque lecture revérifie `essaiCouvre`.
 * « Tout arrêter » (`zernio.envoi_autorise` à faux) l'emporte toujours. Ni promotion, ni PUT, ni chemin vidéo.
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { depots, lireParametre, maintenant as maintenantIso } from "./_commun";
import { cleZernioPresente, envoiZernioAutorise, publicationEditorialeAutorisee } from "./zernio";

export const PARAM_ESSAI_BROUILLON = "zernio.essai_brouillon";
export const DUREE_MAX_ESSAI_MS = 24 * 60 * 60 * 1000;
export const FENETRE_NETTOYAGE_MS = 24 * 60 * 60 * 1000;

export type GesteEssai = "brouillon" | "deplacement" | "retrait";

export interface EssaiLu {
  creneauId: string;
  compte: string;
  reseau: string;
  poseLe: string;
  expireLe: string;
}

const texte = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const instant = (v: string): number => (/Z$/.test(v) ? Date.parse(v) : NaN);

/**
 * L'essai posé, ou `null` (fermé) pour toute anomalie. Rendu tant que la fenêtre de nettoyage n'est pas passée : c'est
 * `essaiCouvre` qui décide, geste par geste. Lecture seule.
 */
export async function lireEssai(maintenant: number = Date.parse(maintenantIso())): Promise<EssaiLu | null> {
  try {
    const brut = await lireParametre<unknown>(PARAM_ESSAI_BROUILLON, null);
    if (!brut || typeof brut !== "object" || Array.isArray(brut)) return null;
    const o = brut as Record<string, unknown>;
    if (o.version !== 1 || !texte(o.creneauId) || !texte(o.compte) || !texte(o.reseau) || !texte(o.poseLe) || !texte(o.expireLe)) return null;
    const pose = instant(o.poseLe);
    const expire = instant(o.expireLe);
    if (!Number.isFinite(pose) || !Number.isFinite(expire) || !Number.isFinite(maintenant)) return null;
    if (expire <= pose || expire - pose > DUREE_MAX_ESSAI_MS || pose > maintenant) return null;
    if (maintenant >= expire + FENETRE_NETTOYAGE_MS) return null;
    // « Tout arrêter » l'emporte ; sans clé du diffuseur, rien à essayer.
    if ((await envoiZernioAutorise()) !== true || !cleZernioPresente()) return null;
    const c = await depots().creneauxEditoriaux.obtenir(o.creneauId);
    if (!c || !c.visuelId || c.videoId) return null;
    if (c.compteCible !== o.compte) return null;
    const reseaux = Object.keys(c.heuresParReseau ?? {});
    if (reseaux.length !== 1 || reseaux[0] !== o.reseau) return null;
    return { creneauId: o.creneauId, compte: o.compte, reseau: o.reseau, poseLe: o.poseLe, expireLe: o.expireLe };
  } catch {
    return null;
  }
}

/** Vrai seulement si un essai valide désigne EXACTEMENT ce créneau pour ce geste, à cet instant. */
export async function essaiCouvre(creneauId: string, geste: GesteEssai, maintenant: number = Date.parse(maintenantIso())): Promise<boolean> {
  if (typeof creneauId !== "string" || !creneauId) return false;
  const essai = await lireEssai(maintenant);
  if (!essai || creneauId !== essai.creneauId) return false;
  const expire = Date.parse(essai.expireLe);
  return geste === "retrait" ? maintenant < expire + FENETRE_NETTOYAGE_MS : maintenant < expire;
}

/* --- Contexte d'exécution : l'identifiant seulement ----------------------------------------------------------------------- */

const contexte = new AsyncLocalStorage<string>();

/** Exécute `f` avec le créneau d'essai en contexte. N'ouvre rien à lui seul : chaque porte relit `essaiCouvre`. */
export function dansEssai<T>(creneauId: string, f: () => Promise<T>): Promise<T> {
  return contexte.run(creneauId, f);
}

export const essaiEnCours = (): string | undefined => contexte.getStore();

/**
 * Porte de création d'un brouillon pour CE créneau : la condition générale (trois réglages) OU l'essai couvrant ce créneau.
 * Sans identifiant (appelants hors calendrier) : condition générale seule.
 */
export async function porteCalendrierPour(creneauId?: string): Promise<boolean> {
  if (await publicationEditorialeAutorisee()) return true;
  return essaiOuvertPour(creneauId);
}

/** Essai en cours dans ce contexte, pour CE créneau, et couvrant la création d'un brouillon. */
export async function essaiOuvertPour(creneauId?: string): Promise<boolean> {
  if (!creneauId || essaiEnCours() !== creneauId) return false;
  return essaiCouvre(creneauId, "brouillon");
}

/** Porte du client du fournisseur : générale, ou un essai en cours qui couvre le créneau du contexte. */
export async function porteClientEssai(): Promise<boolean> {
  if (await publicationEditorialeAutorisee()) return true;
  return essaiOuvertPour(essaiEnCours());
}
