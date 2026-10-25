/**
 * MODE DU BUDGET : un seul interrupteur, `budget.mode` = "indicatif" | "bloquant" (décision de Will, 23/10).
 *  - « indicatif » : les montants (plafond du mois, seuil de confirmation, plafonds par vidéo, solde deviné de fal.ai) sont
 *    des REPÈRES. Au-delà, le studio journalise et prévient Will (cloche, une fois par jour et par motif), puis continue.
 *    Sur les chemins Claude et le lot d'images, plus aucun arrêt de sécurité ; ailleurs, un arrêt à 5 × le prix annoncé subsiste encore.
 *  - « bloquant » : comportement d'avant, tous les seuils refusent. Retour en arrière : réglage `budget.mode` = "bloquant".
 * Ce qui reste dur dans les DEUX modes : les gardes de l'Usine, le solde réel HeyGen / ElevenLabs, les
 * plafonds anti-boucle (retouches, lectures de voix) et l'idempotence des réservations.
 * (Le double réel et le montage réel, eux, suivent le mode : en indicatif, le prix du jour vaut accord pour une commande de l'utilisateur.)
 * HONNÊTETÉ (25/10/2026) : côté écran, `confirmerPrix` accepte désormais tout montant, quel que soit le mode : plus aucun clic de
 * confirmation. En mode « bloquant », seuls les plafonds durs et le budget du mois tiennent encore côté serveur.
 * Le défaut vient du code (`STUDIO_BUDGET_MODE_DEFAUT`, « indicatif » sans variable) ; le réglage en base l'emporte.
 * Un réglage illisible retombe sur le défaut du code. Lu à l'exécution : pas de redémarrage, pas de migration.
 */
import "server-only";
import { type AccordPrix } from "@/domaine/accord";
import { depots, ecrireParametre, journaliser, lireParametre } from "./_commun";

export type ModeBudget = "indicatif" | "bloquant";
export const CLE_MODE_BUDGET = "budget.mode";

/** Multiple du prix annoncé au-delà duquel une vidéo (ou un sujet) s'arrête, même en mode indicatif. */
export const FACTEUR_SECURITE_BUDGET = 5;

function defautDuCode(): ModeBudget {
  return process.env.STUDIO_BUDGET_MODE_DEFAUT === "bloquant" ? "bloquant" : "indicatif";
}

export async function modeBudget(): Promise<ModeBudget> {
  const v = await lireParametre<unknown>(CLE_MODE_BUDGET, null);
  return v === "indicatif" || v === "bloquant" ? v : defautDuCode();
}

/** Indicatif pour CETTE commande : jamais pour une commande de l'Usine (elle reste bloquante). */
export async function budgetIndicatifPour(origine?: string | null): Promise<boolean> {
  return origine !== "usine" && (await budgetIndicatif());
}

/**
 * Origine d'une vidéo, lue sur sa version la plus récente (`commande.origine`, figée au lancement). Sert aux chemins qui
 * n'ont pas l'origine en main (monteur, face caméra animée, textes) : une vidéo commandée par l'Usine le reste. Illisible : studio.
 */
export async function origineDeLaVideo(videoId: string): Promise<"studio" | "usine"> {
  try {
    const versions = await depots().versions.lister((v) => v.videoId === videoId);
    const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
    return derniere?.commande?.origine === "usine" ? "usine" : "studio";
  } catch {
    // Échec fermé : une origine illisible est traitée comme l'Usine (bloquante), jamais comme une commande de Will.
    return "usine";
  }
}

/**
 * Sujet de la cloche de dépassement : l'identifiant du LOT si la vidéo en fait partie (une cloche par lot), sinon celui de la
 * vidéo. Le même sujet sert aux dépassements Claude et à ceux de la caisse Image -> vidéo : une vidéo ne sonne jamais deux fois.
 */
export async function sujetDeCloche(videoId: string): Promise<string> {
  try {
    const versions = await depots().versions.lister((v) => v.videoId === videoId);
    const derniere = versions.sort((a, b) => b.numero - a.numero)[0];
    const lot = (derniere?.commande?.entrees as { lot?: { id?: unknown; rang?: unknown } } | undefined)?.lot;
    return typeof lot?.id === "string" && lot.id && typeof lot.rang === "number" ? lot.id : videoId;
  } catch {
    return videoId;
  }
}

/** Indicatif pour CETTE vidéo : l'origine donnée l'emporte, sinon celle de sa dernière version ; l'Usine reste bloquante. */
export async function budgetIndicatifPourVideo(videoId: string, origine?: string | null): Promise<boolean> {
  return budgetIndicatifPour(origine ?? (await origineDeLaVideo(videoId)));
}

export async function budgetIndicatif(): Promise<boolean> {
  return (await modeBudget()) === "indicatif";
}

/** Phrase de l'arrêt de sécurité (5 × le prix annoncé) ; `prixAnnonce` : le prix annoncé déjà écrit en euros, s'il est connu. */
export function messageArretSecurite(prixAnnonce?: string): string {
  return `Arrêt de sécurité : cette fabrication dépasserait 5 fois le prix annoncé${prixAnnonce ? ` (${prixAnnonce})` : ""}, rien de plus n'est payé.`;
}
/** Phrase d'un dépassement du budget indicatif : la fabrication continue. */
export function messageAuDelaDuBudgetIndicatif(prixAnnonce?: string): string {
  return `Au-delà du budget indicatif${prixAnnonce ? ` (${prixAnnonce})` : ""} : la fabrication continue, arrêt de sécurité à ${FACTEUR_SECURITE_BUDGET} fois le prix annoncé.`;
}
/** Chemins Claude (textes, face caméra, écriture) : le prix ne bloque jamais, plus aucun arrêt de sécurité n'existe. */
export function messageAuDelaDuBudgetIndicatifClaude(prixAnnonce?: string): string {
  return `Au-delà du budget indicatif${prixAnnonce ? ` (${prixAnnonce})` : ""} : la fabrication continue.`;
}
export const MESSAGE_ARRET_SECURITE = messageArretSecurite();

/**
 * Dépassement du budget indicatif : journal TOUJOURS ; cloche au plus une fois par jour et par `sujet` (une vidéo). Jamais de
 * push ni d'e-mail : une notification de type « credit » reste à la cloche (`canauxPour`), et aucun envoi forcé n'est demandé.
 * Une panne de l'alerte ne change jamais la suite : la fabrication continue.
 */
export async function signalerDepassementIndicatif(sujet: string, titre: string, message: string): Promise<void> {
  try {
    await journaliser("budget", message);
  } catch {
    /* le journal ne bloque jamais */
  }
  try {
    const { jourParis } = await import("./couts");
    const cle = `budget.prixaccepte.${jourParis()}.${sujet}`;
    if (await lireParametre<boolean>(cle, false)) return;
    const { creerNotification } = await import("./notifications");
    await creerNotification({ type: "credit", titre, message, lien: "/reglages#budget" });
    await ecrireParametre(cle, true);
  } catch {
    /* la cloche ne bloque jamais */
  }
}

/**
 * Règle « le prix ne bloque jamais » : en mode indicatif, pour une commande de l'utilisateur (jamais de l'Usine), le prix du jour
 * VAUT accord. Rend alors le plus haut de `montantCentimes` et de l'accord reçu (s'il est un montant) ; sinon l'accord inchangé.
 * `o.signaler` : l'APPELANT dit si l'ancienne règle aurait refusé ce prix (accord absent ou trop bas pour ce chemin). Seulement
 * alors, et jamais pour 0 €, le journal dit « Prix X € accepté sans confirmation » et la cloche prévient (une par jour et par
 * vidéo, ou « global » sans `videoId`). Sans `signaler`, rien n'est écrit : un appel sous le seuil ne fait aucun bruit.
 */
export async function accordAutomatique(accord: AccordPrix, montantCentimes: number, o: { origine?: string | null; videoId?: string; signaler?: boolean } = {}): Promise<AccordPrix> {
  const indicatif = o.videoId ? await budgetIndicatifPourVideo(o.videoId, o.origine) : await budgetIndicatifPour(o.origine);
  if (!indicatif || !Number.isFinite(montantCentimes)) return accord;
  const montant = Math.max(0, Math.ceil(montantCentimes));
  const rendu = Math.max(montant, typeof accord === "number" && Number.isFinite(accord) ? accord : 0);
  if (o.signaler === true && montant > 0) {
    try {
      const { formaterMontant } = await import("@/lib/montants");
      const prix = formaterMontant({ centimes: montant, devise: "EUR" });
      const sujet = o.videoId ? await sujetDeCloche(o.videoId) : "global";
      await signalerDepassementIndicatif(sujet, "Prix accepté sans confirmation", `Prix ${prix} accepté sans confirmation`);
    } catch {
      /* le journal ne bloque jamais */
    }
  }
  return rendu;
}

/**
 * Appelle `appel` avec l'accord reçu ; si l'issue demande un accord (`accord-requis` + centimes), UNE SEULE relance avec
 * l'accord automatique. Mode bloquant ou Usine : `accordAutomatique` rend l'accord inchangé, aucune relance. Jamais de boucle.
 */
export async function avecAccordAutomatique<I extends { statut: string }>(appel: (accord?: number) => Promise<I>, accordInitial?: number, o: { origine?: string | null; videoId?: string } = {}): Promise<I> {
  const issue = await appel(accordInitial);
  const centimes = (issue as { centimes?: unknown }).centimes;
  if (issue.statut !== "accord-requis" || typeof centimes !== "number") return issue;
  const accord = await accordAutomatique(false, centimes, { ...o, signaler: true });
  return typeof accord === "number" ? appel(accord) : issue;
}
