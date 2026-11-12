/**
 * Service des envois planifiés (D7-01). Le dépôt est passé en paramètre (doublure en test) ; aucun envoi réel :
 * ce service ne fait que tenir l'état du calendrier. Rien ne part sans la validation du fondateur.
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import { cleEnvoi, peutTransiter, type EnvoiPlanifie, type StatutEnvoi } from "@/domaine/envoi-planifie";
import type { Id, ReseauDeclinaison } from "@/domaine/types";

export interface DemandeEnvoi {
  videoId: Id;
  reseau: ReseauDeclinaison;
  versionCreneau: number;
  jour: string;
  heure?: string;
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

/** Idempotent : la même clé rend l'entrée existante, sans rien changer. */
export async function creerEnvoi(d: Depot<EnvoiPlanifie>, demande: DemandeEnvoi, maintenant: string): Promise<EnvoiPlanifie> {
  const cle = cleEnvoi(demande.videoId, demande.reseau, demande.versionCreneau);
  verifierCreneau(demande);
  const existant = await d.obtenir(cle);
  if (existant) return existant;
  return d.enregistrer({ id: cle, cle, ...demande, statut: "brouillon", creeLe: maintenant, modifieLe: maintenant });
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
