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
import { depots, ecrireParametre, lireParametre, maintenant as maintenantIso } from "./_commun";
import { dansEssai, essaiEnCours } from "./essai-contexte";
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

/* --- Contexte d'exécution : l'identifiant seulement (module feuille `essai-contexte.ts`) ------------------------------------ */

export { dansEssai, essaiEnCours };

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

/** Seconde condition de la porte du client du fournisseur (la condition générale y reste écrite) : l'essai en cours couvre le créneau du contexte. */
export async function porteClientEssai(): Promise<boolean> {
  return essaiOuvertPour(essaiEnCours());
}

/* --- Pose et lecture pour l'écran Réglages (aucune saisie du compte ni du réseau : tout est lu du créneau) ------------------ */

/** Un créneau peut-il porter l'essai ? Phrase de refus, ou `null` s'il est éligible. Lecture seule. */
export function refusEligibilite(c: { statut?: string; valideeLe?: string; refuseLe?: string; retireLe?: string; visuelId?: string; videoId?: string; compteCible?: string; heuresParReseau?: Record<string, string | undefined> } | null | undefined, maintenant: number): string | null {
  if (!c) return "Ce créneau est introuvable.";
  if (c.statut !== "valide" || !c.valideeLe || !Number.isFinite(Date.parse(c.valideeLe)) || c.refuseLe || c.retireLe) return "Seul un créneau validé peut porter l'essai.";
  if (!c.visuelId || c.videoId) return "L'essai ne porte que sur un visuel (carrousel) : une vidéo est exclue.";
  if (!c.compteCible?.trim()) return "Ce créneau n'a pas de compte de destination.";
  const reseaux = Object.keys(c.heuresParReseau ?? {});
  if (reseaux.length !== 1 || !["linkedin", "instagram", "facebook"].includes(reseaux[0])) return "L'essai exige un seul réseau (LinkedIn, Instagram ou Facebook) sur ce créneau.";
  const t = Date.parse(c.heuresParReseau?.[reseaux[0]] ?? "");
  if (!Number.isFinite(t)) return "La date de ce créneau est illisible.";
  if (t < maintenant + 24 * 60 * 60 * 1000) return "Ce créneau est trop proche : choisissez-en un daté d'au moins un jour.";
  if (t > maintenant + 6 * 24 * 60 * 60 * 1000) return "Ce créneau est trop lointain : le brouillon n'est créé qu'à six jours au plus de la date.";
  return null;
}

export interface CreneauEligible {
  id: string;
  reseau: string;
  jour: string;
}

export interface EtatEssaiVu {
  /** L'essai posé (même expiré, pendant la fenêtre de nettoyage), ou `null`. */
  essai: EssaiLu | null;
  /** L'essai couvre-t-il encore la création d'un brouillon ? */
  actif: boolean;
  eligibles: CreneauEligible[];
}

/** Ce que l'écran affiche : l'essai lu et les créneaux éligibles. Lecture seule. */
export async function lireEtatEssai(maintenant: number = Date.parse(maintenantIso())): Promise<EtatEssaiVu> {
  const lu = await lireEssai(maintenant);
  const actif = !!lu && (await essaiCouvre(lu.creneauId, "brouillon", maintenant));
  const eligibles: CreneauEligible[] = [];
  try {
    for (const c of await depots().creneauxEditoriaux.lister()) {
      if (refusEligibilite(c as never, maintenant) !== null) continue;
      const reseau = Object.keys(c.heuresParReseau)[0];
      eligibles.push({ id: c.id, reseau, jour: (c.heuresParReseau as Record<string, string>)[reseau].slice(0, 10) });
    }
  } catch {
    // Lecture impossible : aucune proposition.
  }
  return { essai: lu, actif, eligibles: eligibles.sort((a, b) => a.jour.localeCompare(b.jour) || a.id.localeCompare(b.id)) };
}

export type ResultatPoseEssai = { ok: true; essai: EssaiLu } | { ok: false; message: string };

/**
 * Pose l'essai : le compte et le réseau sont LUS du créneau (jamais saisis). Refus si « Tout arrêter » est actif, si la clé du diffuseur
 * est absente, si un autre essai existe encore (actif ou en nettoyage), si la durée n'est pas un entier de 1 à 24 h ou si le créneau n'est pas éligible.
 * À appeler sous `sousVerrou`. Écrit le réglage seul.
 */
export async function poserEssai(demande: { creneauId: string; dureeHeures: number }, maintenant: number = Date.parse(maintenantIso())): Promise<ResultatPoseEssai> {
  const refus = (message: string): ResultatPoseEssai => ({ ok: false, message });
  const h = demande?.dureeHeures;
  if (typeof h !== "number" || !Number.isInteger(h) || h < 1 || h > 24) return refus("La durée de l'essai est de 1 à 24 heures, en heures entières.");
  if (typeof demande.creneauId !== "string" || !demande.creneauId) return refus("Choisissez le créneau de l'essai.");
  if ((await envoiZernioAutorise()) !== true) return refus("« Tout arrêter » est actif : reprenez les envois avant de poser un essai.");
  if (!cleZernioPresente()) return refus("L'outil de publication n'est pas relié (clé absente) : aucun essai possible.");
  if (await lireEssai(maintenant)) return refus("Un essai existe déjà : retirez-le avant d'en poser un autre.");
  const c = await depots().creneauxEditoriaux.obtenir(demande.creneauId);
  const motif = refusEligibilite(c as never, maintenant);
  if (motif) return refus(motif);
  const reseau = Object.keys(c!.heuresParReseau)[0];
  const pose = Math.floor(maintenant / 1000) * 1000;
  const valeur: EssaiLu = { creneauId: c!.id, compte: c!.compteCible, reseau, poseLe: new Date(pose).toISOString().replace(/\.\d{3}Z$/, "Z"), expireLe: new Date(pose + h * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, "Z") };
  await ecrireParametre(PARAM_ESSAI_BROUILLON, { version: 1, ...valeur });
  return { ok: true, essai: valeur };
}

/** Retire l'essai (écrit `null`). Rien d'autre n'est touché ; un brouillon resté chez le diffuseur se retire depuis le calendrier ou à la main. */
export async function retirerEssai(): Promise<void> {
  await ecrireParametre(PARAM_ESSAI_BROUILLON, null);
}
