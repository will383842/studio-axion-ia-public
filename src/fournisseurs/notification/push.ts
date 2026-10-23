/**
 * NOTIFICATIONS SUR LE TÉLÉPHONE — Web Push VAPID (lot M1b, B.9 ter ; B.0 §13).
 * Activé seulement si `VAPID_PUBLIQUE`, `VAPID_PRIVEE` et `VAPID_SUJET` existent (aucun compte : des clés
 * générées une fois, par exemple `npx web-push generate-vapid-keys`). Sans elles : aucune notification poussée,
 * la cloche du studio et l'e-mail de secours restent.
 * Les abonnements sont tenus par le service des notifications (réglage `push.abonnements`) : ce module ne lit aucune donnée.
 */
import webpush from "web-push";

export interface ConfigPush {
  publique: string;
  privee: string;
  sujet: string;
}

/** Abonnement d'un navigateur (forme standard `PushSubscription.toJSON()`). */
export interface AbonnementPush {
  endpoint: string;
  keys: { p256dh: string; auth: string };
  /** Appareil (lisible), date d'ajout ; un abonnement refusé par le service est marqué expiré, jamais effacé. */
  appareil?: string;
  ajouteLe?: string;
  expireLe?: string;
}

export interface ChargePush {
  titre: string;
  message?: string;
  lien?: string;
}

export const DELAI_PUSH_MS = 10_000;

export function configPush(env: Record<string, string | undefined> = process.env): ConfigPush | null {
  const publique = env.VAPID_PUBLIQUE?.trim();
  const privee = env.VAPID_PRIVEE?.trim();
  const sujet = env.VAPID_SUJET?.trim();
  if (!publique || !privee || !sujet) return null;
  return { publique, privee, sujet: sujet.includes(":") ? sujet : `mailto:${sujet}` };
}

/**
 * Services de notification des navigateurs (relecture R3) : Chrome et Android (Google), Safari et iPhone (Apple),
 * Firefox (Mozilla), Edge (Microsoft). Une autre adresse est refusée : le studio n'enverra jamais de requête signée
 * vers un serveur quelconque.
 */
const SERVICES_CONNUS: ((hote: string) => boolean)[] = [
  (h) => h === "fcm.googleapis.com",
  (h) => h === "web.push.apple.com",
  (h) => h.endsWith(".push.services.mozilla.com"),
  (h) => h.endsWith(".notify.windows.com"),
];

/** Un abonnement valable : forme standard, adresse https d'un service de notification connu. */
export function abonnementValide(a: unknown): a is AbonnementPush {
  if (!a || typeof a !== "object") return false;
  const x = a as AbonnementPush;
  if (typeof x.endpoint !== "string" || !x.keys || typeof x.keys.p256dh !== "string" || typeof x.keys.auth !== "string") return false;
  try {
    const u = new URL(x.endpoint);
    return u.protocol === "https:" && !u.username && !u.password && !u.port && SERVICES_CONNUS.some((connu) => connu(u.hostname));
  } catch {
    return false;
  }
}

type Envoyeur = (abonnement: AbonnementPush, charge: string, options: webpush.RequestOptions) => Promise<unknown>;

/**
 * Envoie la notification à chaque abonnement actif. Renvoie le nombre d'envois réussis et les adresses
 * refusées définitivement (404/410 : abonnement révoqué par le navigateur) pour qu'elles soient marquées expirées.
 */
export async function envoyerPush(config: ConfigPush, abonnements: AbonnementPush[], charge: ChargePush, envoyeur: Envoyeur = (a, c, o) => webpush.sendNotification(a, c, o)): Promise<{ envoyes: number; expires: string[] }> {
  const actifs = abonnements.filter((a) => !a.expireLe);
  const corps = JSON.stringify({ titre: charge.titre, message: charge.message ?? "", lien: charge.lien ?? "/" });
  const options: webpush.RequestOptions = { vapidDetails: { subject: config.sujet, publicKey: config.publique, privateKey: config.privee }, TTL: 24 * 3600, timeout: DELAI_PUSH_MS };
  let envoyes = 0;
  const expires: string[] = [];
  await Promise.all(
    actifs.map(async (a) => {
      try {
        await envoyeur(a, corps, options);
        envoyes++;
      } catch (e) {
        const statut = (e as { statusCode?: number }).statusCode;
        if (statut === 404 || statut === 410) expires.push(a.endpoint);
      }
    }),
  );
  return { envoyes, expires };
}
