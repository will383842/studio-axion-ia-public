/**
 * Service des envois planifiés (D7-01). Le dépôt est passé en paramètre (doublure en test) ; aucun envoi réel :
 * ce service ne fait que tenir l'état du calendrier. Rien ne part sans la validation du fondateur.
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import { CLE_DIFFUSEUR, cleEnvoi, cleEnvoiCreneau, peutTransiter, type EnvoiPlanifie, type StatutEnvoi } from "@/domaine/envoi-planifie";
import type { Id } from "@/domaine/types";
import type { ReseauEnvoiCreneau } from "@/domaine/reseaux-visuel-envoi";

export interface DemandeEnvoi {
  videoId: Id;
  reseau: ReseauEnvoiCreneau;
  versionCreneau: number;
  jour: string;
  heure?: string;
  /** Absent = vidéo. */
  nature?: "video" | "visuel";
  creneauId?: string;
}

/** Heure de Paris : jour AAAA-MM-JJ, heure HH:MM. */
function verifierCreneau(c: { jour: string; heure?: string }): void {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(c.jour)) throw new Error(`Jour invalide (AAAA-MM-JJ attendu) : ${c.jour}`);
  if (c.heure !== undefined && !/^([01]\d|2[0-3]):[0-5]\d$/.test(c.heure)) throw new Error(`Heure invalide (HH:MM attendu) : ${c.heure}`);
}

async function lire(d: Depot<EnvoiPlanifie>, id: Id): Promise<EnvoiPlanifie> {
  const e = await d.obtenir(id);
  if (!e) throw new Error(`Envoi planifié introuvable : ${id}`);
  return e;
}

/**
 * Clé d'envoi d'un créneau : la clé ancienne (sans id de créneau) tant qu'elle est libre ou qu'elle est déjà la sienne
 * (ou celle d'une entrée sans créneau : prudence) ; sinon la clé propre au créneau. Aucune entrée n'est lue pour être modifiée.
 */
export async function resoudreCleEnvoi(
  depot: { obtenir(id: Id): Promise<EnvoiPlanifie | null | undefined> },
  d: { videoId: Id; reseau: ReseauEnvoiCreneau; versionCreneau: number; creneauId?: string },
): Promise<string> {
  const ancienne = cleEnvoi(d.videoId, d.reseau, d.versionCreneau);
  if (!d.creneauId) return ancienne;
  // Stabilité : une entrée déjà posée sous la clé propre au créneau reste la sienne, même si l'entrée ancienne disparaît.
  const propre = cleEnvoiCreneau(d.videoId, d.reseau, d.versionCreneau, d.creneauId);
  if (await depot.obtenir(propre)) return propre;
  const existant = await depot.obtenir(ancienne);
  if (!existant || existant.creneauId === undefined || existant.creneauId === d.creneauId) return ancienne;
  return propre;
}

/** Idempotent : la même clé rend l'entrée existante, sans rien changer. */
export async function creerEnvoi(d: Depot<EnvoiPlanifie>, demande: DemandeEnvoi, maintenant: string): Promise<EnvoiPlanifie> {
  const cle = await resoudreCleEnvoi(d, demande);
  verifierCreneau(demande);
  const existant = await d.obtenir(cle);
  if (existant) return existant;
  const { nature, creneauId, ...base } = demande;
  return d.enregistrer({
    id: cle,
    cle,
    ...base,
    ...(nature !== undefined ? { nature } : {}),
    ...(creneauId !== undefined ? { creneauId } : {}),
    statut: "brouillon",
    creeLe: maintenant,
    modifieLe: maintenant,
  });
}

/**
 * Note la clé de 64 signes réellement envoyée au diffuseur (celle que rend l'envoi, jamais recalculée).
 * Clé invalide = erreur ; absente = écrite ; même valeur = rien ; valeur DIFFÉRENTE déjà posée = erreur (jamais écrasée).
 */
export async function noterCleDiffuseur(d: Depot<EnvoiPlanifie>, id: Id, cle: string, maintenant: string): Promise<EnvoiPlanifie> {
  if (typeof cle !== "string" || !CLE_DIFFUSEUR.test(cle)) throw new Error("Clé du diffuseur invalide (64 signes hexadécimaux attendus).");
  const e = await lire(d, id);
  if (e.cleDiffuseur === undefined) return d.modifier(id, { cleDiffuseur: cle, modifieLe: maintenant });
  if (e.cleDiffuseur === cle) return e;
  throw new Error("Clé du diffuseur déjà posée avec une autre valeur : elle n'est jamais écrasée.");
}

export async function validerEnvoi(d: Depot<EnvoiPlanifie>, id: Id, par: string, maintenant: string): Promise<EnvoiPlanifie> {
  const e = await lire(d, id);
  if (!peutTransiter(e.statut, "valide")) throw new Error(`Transition refusée : ${e.statut} → valide`);
  return d.modifier(id, { statut: "valide", valideeLe: maintenant, valideePar: par, modifieLe: maintenant });
}

export async function transiterEnvoi(d: Depot<EnvoiPlanifie>, id: Id, vers: StatutEnvoi, maintenant: string): Promise<EnvoiPlanifie> {
  const e = await lire(d, id);
  if (!peutTransiter(e.statut, vers)) throw new Error(`Transition refusée : ${e.statut} → ${vers}`);
  if (vers === "valide") throw new Error("Transition refusée : la validation passe par validerEnvoi (valideeLe, valideePar).");
  if (vers === "a-envoyer" && e.reseau === "tiktok" && (e.consentementTiktok !== true || !e.niveauConfidentialiteTiktok)) {
    throw new Error("TikTok : consentement et niveau de confidentialité requis avant l'envoi.");
  }
  return d.modifier(id, { statut: vers, modifieLe: maintenant, ...(vers === "envoye" ? { envoyeLe: maintenant } : {}) });
}

export async function annulerEnvoi(d: Depot<EnvoiPlanifie>, id: Id, maintenant: string): Promise<EnvoiPlanifie> {
  return transiterEnvoi(d, id, "annule", maintenant);
}

/** Déplace le jour ou l'heure : la clé ne bouge pas (seule une nouvelle version de créneau en change). */
export async function deplacerCreneau(d: Depot<EnvoiPlanifie>, id: Id, creneau: { jour: string; heure?: string }, maintenant: string): Promise<EnvoiPlanifie> {
  const e = await lire(d, id);
  if (e.statut === "envoye" || e.statut === "annule" || e.statut === "a-envoyer") throw new Error(`Créneau figé : ${e.statut}`);
  verifierCreneau(creneau);
  // Un envoi confirmé déplacé doit être reconfirmé : la confirmation portait sur l'ancien créneau.
  return d.modifier(id, { jour: creneau.jour, heure: creneau.heure, ...(e.statut === "confirme" ? { statut: "programme" as const } : {}), modifieLe: maintenant });
}
