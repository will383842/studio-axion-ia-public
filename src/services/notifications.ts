/**
 * NOTIFICATIONS (cloche de l'en-tête, AV2.4-8 ; Web Push et e-mail de secours, lot M1b B.9 ter ; reliées à l'écran au lot R3).
 * - `creerNotification` enregistre (aucun appel réseau : utilisable sous le verrou) et met en file d'envoi ;
 * - `diffuserNotifications` envoie la file HORS verrou (boucle de fond) : téléphone d'abord, e-mail en secours ;
 *   audit D, B10 : la file est EN BASE (champ `envoi` de la notification) ; rien n'est perdu au redémarrage, et un envoi
 *   raté est réessayé aux tours suivants (attente croissante), au plus `ESSAIS_MAX_NOTIFICATION` fois ;
 * - `envoyerEssai` (geste de Will, Réglages > Notifications) : UN message sur le canal demandé, jamais deux.
 * ÉCRIT ET ÉTEINT (règle commune n° 2 du plan R) : rien ne part tant que la carte « Notifications » de
 * Réglages > Connexions est en simulation, même si les clés sont posées sur le serveur. La cloche reçoit toujours tout.
 * Lire les notifications n'avance plus aucune fabrication : c'est la boucle de fond qui s'en charge.
 */
import "server-only";
import { EMAIL_PAS_PRET, TELEPHONE_PAS_PRET } from "@/domaine/notifications-textes";
import type { EnvoiNotification, Id, Notification } from "@/domaine/types";
import { etatConnexion, resoudreFournisseur, type EtatConnexion } from "@/fournisseurs";
import { envoyerEmail, type ConfigEmail } from "@/fournisseurs/notification/email";
import { canauxDe, variablesManquantes } from "@/fournisseurs/notification/inscription";
import { abonnementValide, envoyerPush, type AbonnementPush, type ConfigPush } from "@/fournisseurs/notification/push";
import { nouvelId } from "@/lib/ids";
import { pluriel } from "@/lib/textes";
import { depots, ecrireParametre, ErreurStudio, filtreExemples, horodatage, journaliser, lireParametre, maintenant, sousVerrou } from "./_commun";
import { exigerSession } from "./auth";
import type { PreferencesNotifications } from "./reglages";

/* --- La carte « Notifications » ------------------------------------- */

/**
 * Canaux réellement utilisables : ceux du fournisseur RÉSOLU (réglage « fournisseur.notification », sinon
 * FOURNISSEUR_NOTIFICATION, sinon simulation). Carte en simulation : aucun canal, rien ne part.
 */
export async function canauxActifs(): Promise<{ carte: EtatConnexion; push: ConfigPush | null; email: ConfigEmail | null }> {
  const enBase = await lireParametre<string | null>("fournisseur.notification", null);
  return { carte: etatConnexion("notification", enBase), ...canauxDe(resoudreFournisseur("notification", enBase)) };
}

/** Adresse ZeptoMail utilisable par les autres envois du studio (veille) : null tant que la carte est en simulation. */
export async function emailActif(): Promise<ConfigEmail | null> {
  return (await canauxActifs()).email;
}

export async function listerNotifications(limite = 30): Promise<Notification[]> {
  // « Afficher les exemples » désactivé : les notifications des exemples suivent l'interrupteur.
  const exemples = await filtreExemples<Notification>();
  const liste = await depots().notifications.lister(exemples);
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe)).slice(0, limite);
}

export async function compterNonLues(): Promise<number> {
  const exemples = await filtreExemples<Notification>();
  return depots().notifications.compter((n) => !n.lue && exemples(n));
}

export async function marquerLues(ids?: Id[]): Promise<void> {
  await exigerSession();
  const d = depots();
  const exemples = await filtreExemples<Notification>();
  // Sous le verrou (aucun réseau) : la diffusion modifie aussi les notifications (champ `envoi`), aucune écriture perdue.
  await sousVerrou(async () => {
    for (const n of await d.notifications.lister((x) => !x.lue && exemples(x) && (!ids || ids.includes(x.id)))) {
      await d.notifications.modifier(n.id, { lue: true });
    }
  });
}

/* --- Création et diffusion ------------------------------------------ */

/** Audit D, B10 : essais d'envoi au plus, puis « echec » (la cloche l'a toujours). */
export const ESSAIS_MAX_NOTIFICATION = 6;
/** Attente avant le réessai n (1 min, 2, 4, 8, 16 min…), plafonnée à 30 min. */
export function attenteReessaiNotification(essais: number): number {
  return Math.min(30 * 60_000, 60_000 * 2 ** Math.max(0, essais - 1));
}

/** Une seule diffusion à la fois dans le processus (un même envoi ne part jamais deux fois). */
const cleDiffusion = Symbol.for("studio-axion-ia.notifications-diffusion");
type AvecDiffusion = typeof globalThis & { [cleDiffusion]?: Promise<{ push: number; emails: number }> };

export const PREFERENCES_PAR_DEFAUT: PreferencesNotifications = { videoPrete: true, echec: true, budget: true, canal: "console" };

/**
 * Enregistre une notification (cloche) et la met en file pour le téléphone / l'e-mail. Aucun appel réseau.
 * `options.email` (lot « crédits ») : l'e-mail part aussi, quel que soit le canal choisi (alertes graves de crédit).
 */
export async function creerNotification(n: Omit<Notification, "id" | "creeLe" | "modifieLe" | "lue" | "envoi">, options: { email?: boolean } = {}): Promise<Notification> {
  // `emailForce` (lot « crédits ») : alerte grave (crédit sous 10 %, plus qu'une vidéo, clé refusée) : l'e-mail part aussi.
  const envoi: EnvoiNotification | undefined = n.estDemo ? undefined : { statut: "a-envoyer", essais: 0, ...(options.email ? { emailForce: true } : {}) };
  return depots().notifications.enregistrer({ id: nouvelId("not"), lue: false, ...horodatage(), ...n, ...(envoi ? { envoi } : {}) });
}

/** Canaux d'envoi d'une notification selon les préférences de Will (PUR). La cloche reçoit toujours tout. */
export function canauxPour(n: Pick<Notification, "type" | "estDemo">, p: PreferencesNotifications, disponibles: { push: boolean }): { push: boolean; email: boolean; emailSiPushEchoue: boolean } {
  const aucun = { push: false, email: false, emailSiPushEchoue: false };
  if (n.estDemo || p.canal === "console") return aucun;
  // Veille des outils (lot B2) : la cloche seulement ; l'e-mail (intérêt fort, alerte rouge, résumé du lundi)
  // est envoyé par la veille elle-même, filtré par `veille/regles.ts`.
  if (n.type === "veille") return aucun;
  // Crédits (lot « crédits ») : la cloche seulement ; les alertes graves forcent l'e-mail (`creerNotification`, option `email`).
  if (n.type === "credit") return aucun;
  if (n.type === "video-prete" && !p.videoPrete) return aucun;
  if (n.type === "echec" && !p.echec) return aucun;
  if (n.type === "budget" && !p.budget) return aucun;
  if (p.canal === "email") return { push: false, email: true, emailSiPushEchoue: false };
  return { push: disponibles.push, email: false, emailSiPushEchoue: true };
}

/** Faux transports et configurations injectables (tests) ; en production, rien n'est passé. */
export interface DependancesNotifications {
  /** Fournies (même `null`), elles REMPLACENT la carte « Notifications » : réservé aux tests. */
  push?: ConfigPush | null;
  email?: ConfigEmail | null;
  envoyerPush?: typeof envoyerPush;
  envoyerEmail?: typeof envoyerEmail;
  /** Horloge (tests : réessais). */
  maintenant?: () => number;
}

async function canauxPourEnvoi(dependances: DependancesNotifications): Promise<{ push: ConfigPush | null; email: ConfigEmail | null }> {
  if ("push" in dependances || "email" in dependances) return { push: dependances.push ?? null, email: dependances.email ?? null };
  const { push, email } = await canauxActifs();
  return { push, email };
}

/**
 * Envoie la file (appelé par la boucle de fond, HORS verrou). Chaque envoi a son délai maximal ; un échec
 * n'empêche jamais la cloche (déjà enregistrée). Abonnements refusés par le navigateur : marqués expirés, gardés.
 * Carte « Notifications » en simulation (ou rien de configuré) : les notifications en attente passent « sans-canal »,
 * RIEN ne part. Audit D, B10 : la file est lue EN BASE ; un envoi raté reste « a-envoyer » et repart à un tour suivant.
 */
export async function diffuserNotifications(dependances: DependancesNotifications = {}): Promise<{ push: number; emails: number }> {
  const g = globalThis as AvecDiffusion;
  if (g[cleDiffusion]) return { push: 0, emails: 0 };
  const p = diffuser(dependances).finally(() => {
    g[cleDiffusion] = undefined;
  });
  g[cleDiffusion] = p;
  return p;
}

/** Écrit le nouvel état d'envoi (sous le verrou, aucun réseau ; relu pour ne rien écraser). */
async function ecrireEnvoi(id: Id, envoi: EnvoiNotification): Promise<void> {
  await sousVerrou(async () => {
    if (await depots().notifications.obtenir(id)) await depots().notifications.modifier(id, { envoi });
  });
}

async function diffuser(dependances: DependancesNotifications): Promise<{ push: number; emails: number }> {
  const instant = (dependances.maintenant ?? Date.now)();
  const dues = (await depots().notifications.lister((n) => n.envoi?.statut === "a-envoyer" && !n.estDemo && (!n.envoi.prochainEssaiLe || new Date(n.envoi.prochainEssaiLe).getTime() <= instant)))
    .sort((a, b) => a.creeLe.localeCompare(b.creeLe));
  if (!dues.length) return { push: 0, emails: 0 };
  const { push, email } = await canauxPourEnvoi(dependances);
  const pousser = dependances.envoyerPush ?? envoyerPush;
  const ecrire = dependances.envoyerEmail ?? envoyerEmail;
  // Écrit et éteint : sans canal réel, aucun envoi (pas même un e-mail « simulé »). La cloche a déjà tout.
  if (!push && !email) {
    for (const n of dues) await ecrireEnvoi(n.id, { ...n.envoi!, statut: "sans-canal" });
    return { push: 0, emails: 0 };
  }
  const preferences = await lireParametre<PreferencesNotifications>("notifications", PREFERENCES_PAR_DEFAUT);
  let nPush = 0;
  let nEmails = 0;
  for (const n of dues) {
    const envoi = n.envoi!;
    const actifs = (await lireParametre<AbonnementPush[]>("push.abonnements", [])).filter((a) => !a.expireLe);
    const canaux = envoi.emailForce ? { push: !!push && actifs.length > 0, email: true, emailSiPushEchoue: false } : canauxPour(n, preferences, { push: !!push && actifs.length > 0 });
    if (!canaux.push && !canaux.email && !canaux.emailSiPushEchoue) {
      await ecrireEnvoi(n.id, { ...envoi, statut: "ignoree" });
      continue;
    }
    let recuPush = !!envoi.pushFait;
    if (canaux.push && push && !envoi.pushFait) {
      const r = await pousser(push, actifs, { titre: n.titre, message: n.message, lien: n.lien });
      nPush += r.envoyes;
      recuPush = r.envoyes > 0;
      if (r.expires.length) await marquerExpires(r.expires);
    }
    const emailVoulu = canaux.email || (canaux.emailSiPushEchoue && !recuPush);
    let recuEmail = false;
    let emailTente = false;
    if (email && emailVoulu) {
      emailTente = true;
      const r = await ecrire(email, { titre: n.titre, message: n.message, lien: n.lien });
      recuEmail = r.envoye;
      if (r.envoye) nEmails++;
    }
    const pushTente = canaux.push && !!push;
    if (!pushTente && !emailTente && !envoi.pushFait) {
      // Rien de joignable (aucun téléphone abonné, aucun e-mail configuré) : rien ne part, rien à réessayer.
      await ecrireEnvoi(n.id, { ...envoi, statut: "sans-canal" });
      continue;
    }
    // Alerte grave : l'e-mail doit partir (s'il est configuré) ; sinon, un canal qui a reçu suffit.
    const reussi = envoi.emailForce && email ? recuEmail : recuPush || recuEmail;
    const le = new Date(instant).toISOString();
    if (reussi) {
      await ecrireEnvoi(n.id, { ...envoi, statut: "envoyee", essais: envoi.essais + 1, pushFait: recuPush || undefined, dernierEssaiLe: le, prochainEssaiLe: undefined });
      continue;
    }
    const essais = envoi.essais + 1;
    if (essais >= ESSAIS_MAX_NOTIFICATION) {
      console.error(`[studio] notification « ${n.titre} » non envoyée après ${essais} essais (gardée dans la cloche)`);
      await ecrireEnvoi(n.id, { ...envoi, statut: "echec", essais, pushFait: recuPush || undefined, dernierEssaiLe: le, prochainEssaiLe: undefined });
      continue;
    }
    await ecrireEnvoi(n.id, { ...envoi, essais, pushFait: recuPush || undefined, dernierEssaiLe: le, prochainEssaiLe: new Date(instant + attenteReessaiNotification(essais)).toISOString() });
  }
  return { push: nPush, emails: nEmails };
}

async function marquerExpires(endpoints: string[]): Promise<void> {
  // Lecture-modification-écriture de la liste : sous le verrou (aucun appel réseau dedans).
  await sousVerrou(async () => {
    const liste = await lireParametre<AbonnementPush[]>("push.abonnements", []);
    await ecrireParametre(
      "push.abonnements",
      liste.map((a) => (endpoints.includes(a.endpoint) && !a.expireLe ? { ...a, expireLe: maintenant() } : a)),
    );
  });
}

/* --- Abonnement du téléphone ---------------------------------------- */

/**
 * Clé publique VAPID à donner au navigateur. null : téléphone pas configuré sur le serveur, OU carte « Notifications »
 * en simulation (le téléphone n'est alors pas proposé à l'abonnement : il ne recevrait rien).
 */
export async function clePubliquePush(): Promise<string | null> {
  return (await canauxActifs()).push?.publique ?? null;
}

/** Appareils actifs au plus (relecture R3) : au-delà, refusé ; rien n'est jamais effacé. */
export const MAX_APPAREILS = 20;

/**
 * Enregistre l'abonnement d'un appareil (déjà connu : rien ne change). Le canal passe à « téléphone »
 * si Will n'en avait choisi aucun. Une adresse déjà marquée expirée (refusée par le navigateur) n'est jamais
 * ranimée : le téléphone doit en demander une neuve (« Activer sur ce téléphone »).
 */
export async function enregistrerAbonnementPush(abonnement: unknown, appareil: string): Promise<void> {
  await exigerSession();
  if (!abonnementValide(abonnement)) throw new ErreurStudio("ABONNEMENT_INVALIDE", "Ce téléphone n'a pas pu être relié. Réessayez.");
  const ajoute = await sousVerrou(async () => {
    const liste = await lireParametre<AbonnementPush[]>("push.abonnements", []);
    if (liste.some((a) => a.endpoint === abonnement.endpoint)) return null;
    if (liste.filter((a) => !a.expireLe).length >= MAX_APPAREILS) throw new ErreurStudio("TROP_D_APPAREILS", `${MAX_APPAREILS} appareils sont déjà prévenus : c'est le maximum.`);
    const propre: AbonnementPush = { endpoint: abonnement.endpoint, keys: { p256dh: abonnement.keys.p256dh, auth: abonnement.keys.auth }, appareil: appareil.slice(0, 80), ajouteLe: maintenant() };
    await ecrireParametre("push.abonnements", [...liste, propre]);
    const p = await lireParametre<PreferencesNotifications>("notifications", PREFERENCES_PAR_DEFAUT);
    if (p.canal === "console") await ecrireParametre("notifications", { ...p, canal: "telephone" });
    return propre;
  });
  if (ajoute) await journaliser("notifications", `Notifications activées sur ${ajoute.appareil || "un appareil"}`);
}

/**
 * L'adresse d'abonnement de CET appareil (connue de son navigateur) est-elle active ? Réponse oui/non seulement :
 * aucune autre adresse n'est jamais renvoyée. Sous session.
 */
export async function abonnementActif(endpoint: unknown): Promise<boolean> {
  await exigerSession();
  if (typeof endpoint !== "string" || !endpoint) return false;
  return (await lireParametre<AbonnementPush[]>("push.abonnements", [])).some((a) => a.endpoint === endpoint && !a.expireLe);
}

/** Nombre d'appareils qui reçoivent les notifications. */
export async function compterAbonnementsPush(): Promise<number> {
  return (await lireParametre<AbonnementPush[]>("push.abonnements", [])).filter((a) => !a.expireLe).length;
}

/* --- Écran Réglages > Notifications (lot R3) ------------------------- */

/** Ce que l'écran doit savoir du serveur : des oui/non, un nombre, l'adresse de Will. Aucun nom technique. */
export interface VueNotificationsServeur {
  /** État de la carte « Notifications » (Réglages > Connexions). */
  carte: EtatConnexion;
  /** Carte reliée ET clés VAPID posées : le téléphone peut être activé. */
  telephonePret: boolean;
  /** Carte reliée ET ZeptoMail configuré : l'e-mail peut partir. */
  emailPret: boolean;
  /** Appareils qui reçoivent les notifications (abonnements non expirés). */
  appareils: number;
  /** Adresse qui reçoit les e-mails (celle de Will, affichée pour qu'il la vérifie). */
  destinataire: string | null;
}

const cleSignale = Symbol.for("studio-axion-ia.notifications-reglages-signales");

/**
 * Carte choisie mais un canal pas prêt : les NOMS des réglages à poser vont au journal du serveur (une fois par
 * processus), jamais à l'écran. Voir docs/OUTILS-REELS-R3.md.
 */
function signalerReglagesManquants(push: boolean, email: boolean): void {
  const g = globalThis as typeof globalThis & { [cleSignale]?: boolean };
  if (g[cleSignale] || (push && email)) return;
  g[cleSignale] = true;
  const vides = variablesManquantes();
  const noms = [...(push ? [] : vides.telephone), ...(email ? [] : vides.email.length ? vides.email : ["EMAIL_SECOURS_EXPEDITEUR ou EMAIL_SECOURS_DESTINATAIRE (adresse refusée)"])];
  console.warn(`[studio] notifications : réglage serveur à poser : ${noms.join(", ")}`);
}

export async function vueNotifications(): Promise<VueNotificationsServeur> {
  const { carte, push, email } = await canauxActifs();
  if (carte !== "simulation") signalerReglagesManquants(!!push, !!email);
  return { carte, telephonePret: !!push, emailPret: !!email, appareils: await compterAbonnementsPush(), destinataire: email?.destinataire ?? null };
}

/** Un essai par canal au plus toutes les 30 secondes : un double appui n'envoie jamais deux messages. */
export const INTERVALLE_ESSAI_MS = 30_000;

export interface ResultatEssai {
  canal: "telephone" | "email";
  /** Appareils qui ont reçu l'essai (téléphone), ou 1 si l'e-mail est parti. */
  recus: number;
  /** Appareils visés (téléphone), 1 pour l'e-mail. */
  vises: number;
  /** Phrase à afficher à Will. */
  message: string;
}

/**
 * « Envoyer un essai » : UN message, sur le canal demandé seulement (pas d'e-mail de secours pour un essai téléphone).
 * Refusé si la carte est en simulation, si le canal n'est pas configuré, ou si un essai vient de partir.
 * La date de l'essai est réservée SOUS VERROU (deux appuis simultanés : un seul message) ; l'envoi lui-même se fait
 * hors verrou (règle commune n° 5).
 */
export async function envoyerEssai(canal: "telephone" | "email", dependances: Pick<DependancesNotifications, "envoyerPush" | "envoyerEmail"> = {}): Promise<ResultatEssai> {
  await exigerSession();
  if (canal !== "telephone" && canal !== "email") throw new ErreurStudio("CANAL_INCONNU", "Ce canal n'existe pas.");
  const { carte, push, email } = await canauxActifs();
  if (carte === "simulation") throw new ErreurStudio("NOTIFICATIONS_SIMULATION", "Les notifications sont en mode essai : rien ne part. Reliez-les d'abord dans Connexions.");
  if (canal === "telephone" && !push) throw new ErreurStudio("CANAL_INDISPONIBLE", TELEPHONE_PAS_PRET);
  if (canal === "email" && !email) throw new ErreurStudio("CANAL_INDISPONIBLE", EMAIL_PAS_PRET);
  const actifs = (await lireParametre<AbonnementPush[]>("push.abonnements", [])).filter((a) => !a.expireLe);
  if (canal === "telephone" && !actifs.length) throw new ErreurStudio("AUCUN_APPAREIL", "Aucun téléphone n'est activé. Touchez d'abord « Activer sur ce téléphone ».");

  // Réservé AVANT l'envoi et SOUS VERROU : un second appui (même simultané) est refusé, rien ne repart.
  const cle = `notifications.dernierEssai.${canal}`;
  await sousVerrou(async () => {
    const dernier = await lireParametre<string | null>(cle, null);
    if (dernier && Date.now() - new Date(dernier).getTime() < INTERVALLE_ESSAI_MS) throw new ErreurStudio("ESSAI_TROP_TOT", "Un essai vient de partir. Attendez quelques secondes.");
    await ecrireParametre(cle, maintenant());
  });

  const charge = { titre: "Essai : les notifications du studio marchent", message: "C'est ici que vous recevrez « Votre vidéo est prête » et les alertes.", lien: "/reglages#notifications" };
  if (canal === "telephone" && push) {
    const r = await (dependances.envoyerPush ?? envoyerPush)(push, actifs, charge);
    if (r.expires.length) await marquerExpires(r.expires);
    await journaliser("notifications", `Essai de notification : reçu par ${pluriel(r.envoyes, "appareil")} sur ${actifs.length}`);
    return {
      canal,
      recus: r.envoyes,
      vises: actifs.length,
      message: r.envoyes
        ? `Essai envoyé à ${pluriel(r.envoyes, "appareil")}. Il arrive en quelques secondes.`
        : "Aucun appareil n'a reçu l'essai. Touchez à nouveau « Activer sur ce téléphone ».",
    };
  }
  const r = await (dependances.envoyerEmail ?? envoyerEmail)(email, charge);
  // Le journal du studio est affiché dans Réglages : une phrase simple. Le code du refus va au journal du serveur.
  await journaliser("notifications", r.envoye ? "Essai de notification par e-mail envoyé" : "Essai de notification par e-mail : pas parti");
  if (!r.envoye) {
    if (r.statut) console.warn(`[studio] essai e-mail refusé par ZeptoMail (statut HTTP ${r.statut}${r.statut === 401 || r.statut === 403 ? " : jeton EMAIL_SECOURS_CLE refusé" : ""})`);
    throw new ErreurStudio("ESSAI_REFUSE", r.statut === 401 || r.statut === 403 ? "L'e-mail n'a pas pu partir : son réglage est à faire vérifier." : "L'e-mail n'a pas pu partir. Réessayez dans un instant.");
  }
  return { canal, recus: 1, vises: 1, message: `Essai envoyé à ${email?.destinataire}. Regardez vos e-mails, et les indésirables.` };
}
