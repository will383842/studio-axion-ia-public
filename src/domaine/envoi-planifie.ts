/**
 * Envoi planifié (D7-01) : une entrée du calendrier d'envoi, une par vidéo, réseau et version de créneau.
 * Rien ne part sans la validation du fondateur : `programme` ne mène jamais directement à `a-envoyer`,
 * il faut passer par `confirme` (geste explicite). Aucun envoi réel ici : ce module ne fait que décrire l'état.
 */
import type { EntiteBase, DateIso, Id, ReseauDeclinaison } from "./types";

export type StatutEnvoi = "brouillon" | "valide" | "programme" | "confirme" | "a-envoyer" | "envoye" | "echec" | "annule";

export const TRANSITIONS_ENVOI: Record<StatutEnvoi, readonly StatutEnvoi[]> = {
  brouillon: ["valide", "annule"],
  valide: ["programme", "annule"],
  programme: ["confirme", "valide", "annule"],
  confirme: ["a-envoyer", "programme", "annule"],
  "a-envoyer": ["envoye", "echec"],
  echec: ["programme", "annule"],
  envoye: [],
  annule: [],
};

export interface EnvoiPlanifie extends EntiteBase {
  /** Clé stable : identique tant que la version du créneau ne change pas. Sert aussi d'identifiant. */
  cle: string;
  videoId: Id;
  reseau: ReseauDeclinaison;
  versionCreneau: number;
  /** AAAA-MM-JJ, heure de Paris. */
  jour: string;
  /** « 09:30 » (HH:MM, heure de Paris) ; jamais une « meilleure heure » inventée. */
  heure?: string;
  statut: StatutEnvoi;
  valideeLe?: DateIso;
  valideePar?: string;
  consentementTiktok?: boolean;
  niveauConfidentialiteTiktok?: string;
  envoyeLe?: DateIso;
}

export function cleEnvoi(videoId: Id, reseau: ReseauDeclinaison, versionCreneau: number): string {
  return `envoi:${videoId}:${reseau}:v${versionCreneau}`;
}

export function peutTransiter(de: StatutEnvoi, vers: StatutEnvoi): boolean {
  return TRANSITIONS_ENVOI[de].includes(vers);
}
