/**
 * ESSAI BORNÉ D'UN BROUILLON chez le diffuseur : UN créneau, UN compte, un brouillon seulement, 24 h au plus.
 *
 * Réglage `zernio.essai_brouillon` (collection `parametres`) : { version: 1, creneauId, compte, reseau, poseLe, expireLe }.
 * Fermé par défaut : toute anomalie (absent, illisible, expiré, trop long, créneau inconnu ou vidéo, compte différent, deux réseaux,
 * « Tout arrêter » actif, clé du diffuseur absente, lecture qui lève) rend `null`, sans lever.
 *
 * Aucun des trois réglages généraux n'est ouvert ni simulé : chaque porte reçoit une seconde condition « essai », qui ne vaut que
 * pour l'identifiant du créneau d'essai (égalité stricte) et pour trois gestes (brouillon, déplacement, retrait). Le contexte
 * d'exécution ne porte que l'identifiant : CHAQUE lecture revérifie le réglage et l'heure.
 */
import { estReseauVisuelEnvoi } from "@/domaine/reseaux-visuel-envoi";
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { creneauEnvoyable } from "@/domaine/plan-editorial/envoyable";
import { analyserCible } from "@/fournisseurs/publication/zernio-corps";
import { ErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { depots, lireParametre, maintenant as maintenantIso } from "./_commun";
import { cleZernioPresente, envoiZernioAutorise, publicationEditorialeAutorisee } from "./zernio";
import { estCompteParDefaut } from "@/domaine/plan-editorial/compte-par-defaut";

export const PARAM_ESSAI_BROUILLON = "zernio.essai_brouillon";
export const DUREE_MAX_ESSAI_MS = 24 * 60 * 60 * 1000;
export const FENETRE_NETTOYAGE_MS = 24 * 60 * 60 * 1000;
const JOUR_MS = 24 * 60 * 60 * 1000;

export type GesteEssai = "brouillon" | "deplacement" | "retrait";

export interface EssaiLu {
  creneauId: string;
  compte: string;
  reseau: string;
  poseLe: string;
  expireLe: string;
}

const chaine = (v: unknown): v is string => typeof v === "string" && v.trim() !== "";
const maintenantMs = (): number => Date.parse(maintenantIso());

/** Le créneau peut-il être désigné pour l'essai ? (pur) Rend la raison du refus, ou `null` s'il est éligible. */
export function raisonNonEligible(
  c: { statut?: string; valideeLe?: string; refuseLe?: string; retireLe?: string; aRenvoyer?: boolean; videoId?: string; visuelId?: string; heuresParReseau?: Record<string, string | undefined> } | null | undefined,
  maintenant: number,
): string | null {
  if (!c) return "Ce créneau est introuvable.";
  if (!creneauEnvoyable(c)) return "Ce créneau n'est ni validé ni programmé (ou il est refusé, retiré ou à renvoyer) : seul un créneau validé ou programmé peut servir à l'essai.";
  if (c.videoId || !c.visuelId) return "Seul un créneau portant un visuel (carrousel) peut servir à l'essai : les vidéos sont exclues.";
  const reseaux = Object.keys(c.heuresParReseau ?? {});
  if (reseaux.length !== 1 || !estReseauVisuelEnvoi(reseaux[0])) return "L'essai exige un créneau sur UN seul réseau (LinkedIn, Instagram, Facebook ou Pinterest).";
  const t = Date.parse(c.heuresParReseau?.[reseaux[0]] ?? "");
  if (!Number.isFinite(t) || t < maintenant + JOUR_MS || t > maintenant + 6 * JOUR_MS) return "La date du créneau doit tomber entre demain et dans 6 jours.";
  return null;
}

/** Lit l'essai ; `null` à la moindre anomalie (fermé). Ne lève jamais. */
export async function lireEssai(maintenant: number = maintenantMs()): Promise<EssaiLu | null> {
  try {
    const v = await lireParametre<unknown>(PARAM_ESSAI_BROUILLON, null);
    if (!v || typeof v !== "object" || Array.isArray(v)) return null;
    const o = v as Record<string, unknown>;
    if (o.version !== 1 || !chaine(o.creneauId) || !chaine(o.compte) || !chaine(o.reseau) || !chaine(o.poseLe) || !chaine(o.expireLe)) return null;
    const pose = Date.parse(o.poseLe);
    const expire = Date.parse(o.expireLe);
    if (!Number.isFinite(pose) || !Number.isFinite(expire) || expire <= pose || expire - pose > DUREE_MAX_ESSAI_MS || pose > maintenant) return null;
    // Au-delà de la fenêtre de nettoyage, plus rien n'est lu (aucun geste ne passe).
    if (maintenant >= expire + FENETRE_NETTOYAGE_MS) return null;
    const c = await depots().creneauxEditoriaux.obtenir(o.creneauId);
    // Créneau « rien de choisi » (un clic) : l'essai porte la cible réelle résolue à la pose (jamais le marqueur lui-même) ; sinon égalité stricte.
    if (!c || c.videoId || !c.visuelId) return null;
    if (estCompteParDefaut(c.compteCible) ? estCompteParDefaut(o.compte) : c.compteCible !== o.compte) return null;
    const reseaux = Object.keys(c.heuresParReseau ?? {});
    if (reseaux.length !== 1 || reseaux[0] !== o.reseau) return null;
    if ((await envoiZernioAutorise()) === false) return null;
    if (!cleZernioPresente()) return null;
    return { creneauId: o.creneauId, compte: o.compte, reseau: o.reseau, poseLe: o.poseLe, expireLe: o.expireLe };
  } catch {
    return null;
  }
}

/** L'essai couvre-t-il ce créneau pour ce geste ? Égalité STRICTE de l'identifiant ; le retrait vit 24 h de plus que la création. */
export async function essaiCouvre(creneauId: string | undefined, geste: GesteEssai, maintenant: number = maintenantMs()): Promise<boolean> {
  try {
    if (!creneauId) return false;
    const e = await lireEssai(maintenant);
    if (!e || creneauId !== e.creneauId) return false;
    const expire = Date.parse(e.expireLe);
    return geste === "retrait" ? maintenant < expire + FENETRE_NETTOYAGE_MS : maintenant < expire;
  } catch {
    return false;
  }
}

const contexte = new AsyncLocalStorage<string>();

/** Exécute `f` dans le contexte d'essai du créneau `creneauId` (seul l'identifiant est porté ; chaque porte relit tout). */
export function dansEssai<T>(creneauId: string, f: () => T): T {
  return contexte.run(creneauId, f);
}

export const essaiEnCours = (): string | undefined => contexte.getStore();

/** Porte du calendrier pour UN créneau : la porte générale, OU l'essai en cours de CE créneau. Erreur = fermé. */
export async function porteCalendrierPour(creneauId?: string): Promise<boolean> {
  try {
    if (await publicationEditorialeAutorisee()) return true;
  } catch {
    /* fermé */
  }
  const id = essaiEnCours();
  return !!creneauId && id === creneauId && (await essaiCouvre(creneauId, "brouillon"));
}

/** Porte du client du fournisseur : la porte générale, OU un essai en cours qui couvre encore le brouillon. */
export async function porteClientEssai(): Promise<boolean> {
  try {
    if (await publicationEditorialeAutorisee()) return true;
  } catch {
    /* fermé */
  }
  const id = essaiEnCours();
  return !!id && (await essaiCouvre(id, "brouillon"));
}

/**
 * Garde du fournisseur, AVANT la création d'un post : sous essai, `isDraft` doit valoir `true` et le compte du corps doit être celui de l'essai.
 * Hors essai : ne fait rien (les chemins généraux sont inchangés).
 */
export async function verifierCorpsSousEssai(corps: { isDraft?: unknown; platforms?: { accountId?: unknown; platformSpecificData?: unknown }[] }): Promise<void> {
  const id = essaiEnCours();
  if (!id) return;
  const refus = (m: string) => new ErreurZernio("envoi-coupe", `Essai borné : ${m} Rien n'a été envoyé.`);
  const e = await lireEssai();
  if (!e || !(await essaiCouvre(id, "brouillon"))) throw refus("l'essai n'est plus valable.");
  if (corps.isDraft !== true) throw refus("seul un brouillon est permis.");
  let attendue: ReturnType<typeof analyserCible>;
  try {
    attendue = analyserCible(e.compte);
  } catch {
    throw refus("le compte de l'essai est illisible.");
  }
  const cibles = corps.platforms ?? [];
  if (cibles.length !== 1 || cibles[0]?.accountId !== attendue.accountId) throw refus("le compte n'est pas celui de l'essai.");
  // Cible COMPLÈTE : la page (Facebook) ou l'organisation (LinkedIn) doivent aussi être celles de l'essai.
  const sp = cibles[0]?.platformSpecificData;
  const spec = sp && typeof sp === "object" ? (sp as Record<string, unknown>) : {};
  if (spec.pageId !== attendue.pageId || spec.organizationUrn !== attendue.organizationUrn) throw refus("la page ou l'organisation n'est pas celle de l'essai.");
}
