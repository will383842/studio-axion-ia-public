/**
 * INSCRIPTION DES NOTIFICATIONS RÉELLES (lot R3, PLAN-OUTILS-REELS-2026-10-03, constat C4).
 * Le registre (`fournisseurs/index.ts`) appelle `notificationsReelles()` une fois, sans être touché ailleurs.
 *
 * `{ "web-push-email": … }` si le téléphone (VAPID_PUBLIQUE, VAPID_PRIVEE, VAPID_SUJET) OU l'e-mail
 * (EMAIL_SECOURS_CLE, EMAIL_SECOURS_EXPEDITEUR, EMAIL_SECOURS_DESTINATAIRE) est configuré. Rien d'autre.
 * Écrit et éteint : il ne s'ACTIVE que par le choix de Will (Réglages > Connexions, réglage « fournisseur.notification »)
 * ou `FOURNISSEUR_NOTIFICATION=web-push-email`. Tant que la carte est en simulation, rien ne part (ni téléphone ni e-mail).
 *
 * Les abonnements des téléphones sont des données : ils vivent dans le service (`services/notifications.ts`), qui
 * lit ici les deux configurations (`canauxDe`). `envoyer` seul (sans abonnés) n'écrit que l'e-mail.
 */
import type { FournisseurNotification } from "../types";
import { configEmail, envoyerEmail, type ConfigEmail } from "./email";
import { configPush, type ConfigPush } from "./push";

export const ID_NOTIFICATIONS_REELLES = "web-push-email";

/** Variables serveur, par canal (NOMS seulement : affichés « il manque … », jamais les valeurs). */
export const VARIABLES_TELEPHONE = ["VAPID_PUBLIQUE", "VAPID_PRIVEE", "VAPID_SUJET"] as const;
export const VARIABLES_EMAIL = ["EMAIL_SECOURS_CLE", "EMAIL_SECOURS_EXPEDITEUR", "EMAIL_SECOURS_DESTINATAIRE"] as const;

export interface FournisseurNotificationReel extends FournisseurNotification {
  /** Configuration Web Push (null : téléphone pas configuré sur le serveur). */
  readonly push: ConfigPush | null;
  /** Configuration ZeptoMail (null : e-mail pas configuré sur le serveur). */
  readonly email: ConfigEmail | null;
}

export function creerNotificationsReelles(push: ConfigPush | null, email: ConfigEmail | null): FournisseurNotificationReel {
  return {
    id: ID_NOTIFICATIONS_REELLES,
    type: "notification",
    nom: "Notifications (téléphone, e-mail)",
    reelPrevu: "Notifications web + e-mail",
    mode: "reel",
    capacites: { asynchrone: false, accordExige: false },
    push,
    email,
    async envoyer(demande) {
      return { envoye: (await envoyerEmail(email, demande)).envoye };
    },
  };
}

export function notificationsReelles(env: Record<string, string | undefined> = process.env): Record<string, FournisseurNotification> {
  const push = configPush(env);
  const email = configEmail(env);
  if (!push && !email) return {};
  return { [ID_NOTIFICATIONS_REELLES]: creerNotificationsReelles(push, email) };
}

/** Canaux réellement utilisables par le fournisseur RÉSOLU : rien du tout pour une simulation. */
export function canauxDe(f: FournisseurNotification): { push: ConfigPush | null; email: ConfigEmail | null } {
  if (f.mode !== "reel" || !("push" in f) || !("email" in f)) return { push: null, email: null };
  const r = f as FournisseurNotificationReel;
  return { push: r.push, email: r.email };
}

/** NOMS des variables manquantes, par canal (pour l'écran). Aucune valeur n'est lue au-delà de « vide ou non ». */
export function variablesManquantes(env: Record<string, string | undefined> = process.env): { telephone: string[]; email: string[] } {
  const vides = (noms: readonly string[]) => noms.filter((n) => !env[n]?.trim());
  return { telephone: vides(VARIABLES_TELEPHONE), email: vides(VARIABLES_EMAIL) };
}
