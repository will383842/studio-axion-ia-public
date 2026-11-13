/**
 * PLAFOND MENSUEL GLOBAL ET BUDGET DE L'USINE (L1-09 ; porte v2, § 3 quater, appel 5). Serveur seulement, aucun appel réseau.
 *  - Le PLAFOND du mois (`budget.mensuel`, centimes d'euro entiers) se règle UNIQUEMENT dans le studio, par Will
 *    connecté (`definirBudget`). Il borne la commande de Will et le budget de l'Usine, et reste gardé à la dépense
 *    (`controlerBudgetDuMois`) ; il ne borne PAS `plafond_cents`, borné par le plafond d'UN SUJET de la chaîne active (L3-0).
 *  - Le BUDGET DE L'USINE (`budget.usine.<AAAA-MM>`) est écrit par un seul endroit, `reglerBudgetUsine` (la porte du
 *    lot 3 l'appellera après sa garde par secret). Toujours ≤ plafond du studio : un secret volé ne suffit pas à tout
 *    dépenser. Sans budget reçu pour le mois de Paris en cours, aucune fabrication commandée par l'Usine ne part.
 *  - La garde dure est `controlerBudgetDuMois`, appelée par le passage commun (`verifierBudgetEtCredits`, sous le verrou
 *    des crédits) : dépensé du mois + engagé (pire cas des travaux en cours, hors ce travail s'il reprend) + ce
 *    lancement > plafond → refus avant toute réservation, et alerte à Will (cloche, une fois par jour et par motif).
 *  - Réglage illisible (absent de forme, négatif, non entier, texte) → refus : jamais « pas de plafond ».
 */
import "server-only";
import { centimes, formaterMontant } from "@/lib/montants";
import type { Id } from "@/domaine/types";
import { ecrireParametre, ErreurStudio, journaliser, lireParametre, maintenant } from "./_commun";
import { decalerMois, engagementDuTravail, jourParis, moisParis, resumeBudget } from "./couts";
import { creerNotification } from "./notifications";
import { budgetIndicatifPour, messageAuDelaDuBudgetIndicatifClaude } from "./mode-budget";
import { centimesDuPlafond } from "@/lib/montants";
import { avecOrigineFournisseur, CLE_QUOTAS_USINE, lireQuotasUsine, reserverQuota, type QuotaUsine } from "./plafond-fournisseur";

const CLE_PLAFOND = "budget.mensuel";
const cleBudgetUsine = (mois: string) => `budget.usine.${mois}`;
const MOIS_VALIDE = /^\d{4}-(0[1-9]|1[0-2])$/;

/** Erreur de champ (contrat : `400 champ_invalide` avec le nom du champ). */
export class ErreurChampInvalide extends ErreurStudio {
  constructor(
    public readonly champ: string,
    message: string,
  ) {
    super("CHAMP_INVALIDE", message);
  }
}

/** Un montant en centimes d'euro ENTIERS, positif ou nul (jamais de flottant, de texte ni de NaN). PUR. */
export function estCentimesEntiers(v: unknown): v is number {
  return typeof v === "number" && Number.isSafeInteger(v) && v >= 0;
}

/**
 * Plafond du mois réglé dans le studio, en centimes entiers ; `null` : aucun plafond réglé (plus de plafond par défaut :
 * une commande du Studio n'est jamais refusée pour un montant sans réglage du fondateur). Illisible → `BUDGET_ILLISIBLE`.
 */
export async function plafondStudioCentimes(): Promise<number | null> {
  const p = await lireParametre<unknown>(CLE_PLAFOND, null);
  if (p === null || p === undefined) return null;
  const c = typeof p === "object" ? (p as { centimes?: unknown }).centimes : undefined;
  if (!estCentimesEntiers(c)) throw new ErreurStudio("BUDGET_ILLISIBLE", "Le plafond du mois est illisible : réglez-le de nouveau dans Réglages > Budget. Rien ne part en attendant.");
  return c;
}

/* --- Budget envoyé par l'Usine ------------------------------------------ */

interface BudgetUsineEnBase {
  budget_mensuel_cents?: number;
  /** Budget réglé en quantités (quotas) : tient lieu de budget du mois ; les quotas eux-mêmes sont gardés par plafond-fournisseur. */
  en_quantites?: true;
  mois: string;
  le: string;
}

export interface BudgetUsine {
  /** `null` : budget réglé en quantités seulement (jamais un refus pour un montant). */
  budget_mensuel_cents: number | null;
  mois: string;
}

/** Budget de l'Usine pour ce mois (Paris). Absent, illisible ou d'un autre mois → null (= aucune fabrication de l'Usine). */
export async function lireBudgetUsine(mois: string = moisParis()): Promise<BudgetUsine | null> {
  const b = await lireParametre<Partial<BudgetUsineEnBase> | null>(cleBudgetUsine(mois), null);
  if (!b || typeof b !== "object" || b.mois !== mois) return null;
  if (estCentimesEntiers(b.budget_mensuel_cents)) return { budget_mensuel_cents: b.budget_mensuel_cents, mois };
  if (b.en_quantites === true && b.budget_mensuel_cents === undefined) return { budget_mensuel_cents: null, mois };
  return null;
}

function quotasValides(v: unknown): QuotaUsine[] {
  const estQuota = (q: unknown): q is QuotaUsine => {
    if (!q || typeof q !== "object") return false;
    const { periode, reseau, type, limite } = q as Record<string, unknown>;
    return (periode === "jour" || periode === "semaine") && typeof reseau === "string" && reseau !== "" && typeof type === "string" && type !== "" && typeof limite === "number" && Number.isSafeInteger(limite) && limite > 0;
  };
  if (!Array.isArray(v) || v.length === 0 || v.length > 100 || !v.every(estQuota)) {
    throw new ErreurChampInvalide("quotas", "Les quotas doivent être une liste de { periode (jour ou semaine), reseau, type, limite (entier supérieur à zéro) }.");
  }
  return v.map((q) => ({ periode: q.periode, reseau: q.reseau, type: q.type, limite: q.limite }));
}

/**
 * SEUL endroit d'écriture du budget de l'Usine (appel 5). Pas de session : la porte (lot 3) garde l'appel par son secret ;
 * ce service ne doit être exposé par aucune action d'écran. Le budget est un QUOTA de contenus (par période, réseau et type) ;
 * `budget_mensuel_cents` reste toléré. Un corps vide est accepté (rien n'est écrit).
 *  - `quotas` (facultatif) : liste lisible en entier, sinon `CHAMP_INVALIDE` ; enregistrée comme quotas de l'usine ;
 *  - `budget_mensuel_cents` (facultatif) : centimes entiers ≥ 0, ≤ plafond du studio s'il y en a un, sinon `CHAMP_INVALIDE` ;
 *  - `mois` (facultatif, le mois de Paris en cours par défaut) : AAAA-MM, le mois en cours ou le suivant ;
 *  - rejeu de la même valeur pour le même mois → `deja: true`, rien n'est réécrit ni journalisé. Aucun montant dans le journal.
 */
export async function reglerBudgetUsine(corps: { budget_mensuel_cents?: unknown; mois?: unknown; quotas?: unknown }): Promise<BudgetUsine & { deja: boolean; quotas?: QuotaUsine[] }> {
  const { budget_mensuel_cents: cents, mois: moisRecu, quotas: quotasRecus } = corps;
  const courant = moisParis();
  const mois = moisRecu === undefined ? courant : moisRecu;
  if (typeof mois !== "string" || !MOIS_VALIDE.test(mois) || (mois !== courant && mois !== decalerMois(courant, 1))) {
    throw new ErreurChampInvalide("mois", "Le mois doit être le mois en cours ou le suivant (AAAA-MM).");
  }
  if (cents !== undefined && !estCentimesEntiers(cents)) throw new ErreurChampInvalide("budget_mensuel_cents", "Le budget doit être un nombre entier de centimes, positif ou nul.");
  const quotas = quotasRecus === undefined ? undefined : quotasValides(quotasRecus);
  if (cents !== undefined) {
    const plafond = await plafondStudioCentimes();
    if (plafond !== null && cents > plafond) throw new ErreurChampInvalide("budget_mensuel_cents", "Le budget dépasse le plafond du mois réglé dans le studio.");
  }
  const avant = await lireBudgetUsine(mois);
  if (cents === undefined && quotas === undefined) return { budget_mensuel_cents: avant?.budget_mensuel_cents ?? null, mois, deja: true };
  const quotasAvant = quotas ? JSON.stringify(await lireParametre<unknown>(CLE_QUOTAS_USINE, null)) : undefined;
  const memeQuotas = quotas === undefined || quotasAvant === JSON.stringify(quotas);
  if (avant && memeQuotas && (cents === undefined ? avant.budget_mensuel_cents === null || quotas !== undefined : avant.budget_mensuel_cents === cents)) {
    return { ...avant, deja: true, ...(quotas ? { quotas } : {}) };
  }
  if (quotas) await ecrireParametre(CLE_QUOTAS_USINE, quotas);
  const b: BudgetUsineEnBase = { mois, le: maintenant(), ...(cents !== undefined ? { budget_mensuel_cents: cents } : { en_quantites: true }) };
  await ecrireParametre(cleBudgetUsine(mois), b);
  await journaliser("budget", `Budget de l'Usine pour ${mois} réglé${quotas ? ` en quantités (${quotas.length} quota${quotas.length > 1 ? "s" : ""})` : ""}.`);
  return { budget_mensuel_cents: cents ?? null, mois, deja: false, ...(quotas ? { quotas } : {}) };
}

/**
 * Plafond d'UN SUJET en centimes d'euro entiers (§ 3 quater : « plafond d'un sujet » du studio) de la chaîne ACTIVE
 * (`generateur.plafondGrandeChaineUsd` pour la grande, `generateur.plafondSujetUsd` pour la courte), converti au taux du studio et arrondi VERS LE BAS (jamais un centime au-dessus). Réglage illisible : défaut du studio.
 */
export async function plafondSujetCentimes(): Promise<number> {
  const { chaineDeLEcriture, plafondChaineUsd, taux } = await import("./generation-claude");
  // Chaîne RÉELLEMENT active (réglage `generateur.chaine`) : « grande » lit son propre plafond, « courte » et « equipe » celui du sujet.
  const [usd, t] = await Promise.all([chaineDeLEcriture().then(plafondChaineUsd), taux()]);
  return Math.floor(usd * 100 * t + 1e-9);
}

/**
 * `plafond_cents` d'une commande de l'Usine : entier > 0, ≤ plafond d'UN SUJET du studio (§ 3 quater), et non le plafond
 * du mois (le mois reste gardé à la dépense, par `controlerBudgetDuMois`). Le chiffre de l'Usine n'est jamais cru.
 */
export async function verifierPlafondCommande(plafondCents: unknown): Promise<number | null> {
  if (plafondCents === undefined) return null; // absent : accepté (NEW-ARG-03), l'usine n'envoie plus de plafond en euros
  if (!estCentimesEntiers(plafondCents) || plafondCents === 0) throw new ErreurChampInvalide("plafond_cents", "Le plafond de la commande doit être un nombre entier de centimes, supérieur à zéro.");
  if (plafondCents > (await plafondSujetCentimes())) throw new ErreurChampInvalide("plafond_cents", "Le plafond de la commande dépasse le plafond d'un sujet réglé dans le studio.");
  return plafondCents;
}

/* --- Garde dure du passage commun ---------------------------------------- */

/** D'où vient le lancement : Will dans le studio (par défaut, inchangé) ou une commande de l'Usine. */
export type OrigineLancement = "studio" | "usine";

type MotifRefus = "plafond" | "usine-atteint" | "usine-absent" | "usine-sans-borne" | "usine-quota";
const ALERTES: Record<MotifRefus, { titre: string; message: string }> = {
  plafond: { titre: "Fabrication refusée : plafond du mois atteint", message: "Rien n'est parti. Réglages > Budget pour relever le plafond." },
  "usine-atteint": { titre: "Commande de l'Usine refusée : budget du mois atteint", message: "Rien n'est parti. Le budget se règle dans l'Usine, sous le plafond du studio." },
  "usine-sans-borne": { titre: "Commande de l'Usine refusée : aucune limite ne s'applique", message: "Rien n'est parti. Réglez une limite dans l'Usine, ou un plafond du mois dans Réglages > Budget." },
  "usine-quota": { titre: "Commande de l'Usine refusée : limite de quantité atteinte", message: "Rien n'est parti. La limite se règle dans l'Usine ; vos essais à la main ne sont pas concernés." },
  "usine-absent": { titre: "Commande de l'Usine refusée : aucun budget reçu pour ce mois", message: "Rien n'est parti. Réglez le budget du mois dans l'Usine." },
};

/** Alerte à Will (cloche + file d'envoi), une fois par jour et par motif. Une panne de l'alerte ne change jamais le refus. */
async function alerterRefus(motif: MotifRefus): Promise<void> {
  await alerterUneFoisParJour(motif, ALERTES[motif]);
}

/**
 * MODE INDICATIF : un seuil dépassé ne refuse plus, il PRÉVIENT. Journal à chaque dépassement ; cloche une seule fois par
 * jour et par motif, ou par vidéo/sujet si `sujet` est donné (clé `budget.refus.<jour>.<motif>[-<sujet>]`). Une panne de l'alerte ne change jamais la suite : la fabrication continue.
 */
export async function signalerDepassementIndicatif(motif: string, titre: string, message: string, sujet?: string): Promise<void> {
  try {
    await journaliser("budget", `Budget indicatif dépassé (${motif}) : ${message}`);
  } catch {
    /* le journal ne bloque jamais */
  }
  // Une cloche par vidéo (ou sujet) et par jour : la clé porte l'identifiant ; sans identifiant, une par jour et par motif.
  await alerterUneFoisParJour(sujet ? `indicatif-${motif}-${sujet}` : `indicatif-${motif}`, { titre, message }, "credit");
}

/**
 * Jugement d'un plafond PAR VIDÉO ou par sujet (centimes du pire cas : déjà engagé + cet appel). PUR côté décision :
 *  - sous le plafond : "ok" ;
 *  - mode bloquant, plafond dépassé : "bloque" (refus comme avant) ;
 *  - mode indicatif, quel que soit le dépassement : "ok" après avoir prévenu le fondateur (journal + une cloche par jour et par motif),
 *    SANS arrêt : le prix ne bloque jamais.
 */
export async function jugerPlafond(totalCentimes: number, plafondUsd: number, indicatif: boolean, quoi: string, sujet?: string, affichage: { tauxUsdEur?: number; sansPrix?: boolean } = {}): Promise<"ok" | "bloque"> {
  const plafond = centimesDuPlafond(plafondUsd);
  if (totalCentimes <= plafond) return "ok";
  if (!indicatif) return "bloque";
  await signalerDepassementIndicatif("video", "Prix annoncé dépassé (la vidéo continue)", `${quoi} : ${messageAuDelaDuBudgetIndicatifClaude(affichage.sansPrix || affichage.tauxUsdEur === undefined ? undefined : formaterMontant(centimes(centimesDuPlafond(plafondUsd * affichage.tauxUsdEur))))}`, sujet);
  // NEW-ARG-04 : plus d'arrêt pour un prix, quel que soit le multiple ; le dépassement prévient, la fabrication continue.
  return "ok";
}

/** `type` : "budget" (refus, canaux de Will) ; "credit" = cloche seule (jamais de push ni d'e-mail : cloches indicatives). */
async function alerterUneFoisParJour(motif: string, texte: { titre: string; message: string }, type: "budget" | "credit" = "budget"): Promise<void> {
  try {
    const cle = `budget.refus.${jourParis()}.${motif}`;
    if (await lireParametre<boolean>(cle, false)) return;
    await creerNotification({ type, ...texte, lien: "/reglages" });
    // L3-0 : la marque « déjà alerté » n'est posée qu'APRÈS l'envoi réussi ; une panne d'envoi laisse l'alerte repartir au refus suivant.
    await ecrireParametre(cle, true);
  } catch {
    /* le refus part quand même */
  }
}

/**
 * Contrôle du mois, appelé SOUS le verrou des crédits avant toute réservation. `besoinCentimes` est arrondi au centime
 * supérieur (pire cas). `travailId` : un travail qui reprend ne compte pas deux fois son propre engagement.
 * Codes : `BUDGET_ILLISIBLE`, `BUDGET_DEPASSE` (plafond du studio), `BUDGET_USINE_ABSENT`, `BUDGET_MENSUEL_ATTEINT`,
 * `BUDGET_USINE_SANS_BORNE` et `QUOTA_USINE_ATTEINT` (sans montant).
 * Commande de l'Usine : REFUSÉE dès qu'il manque une borne (jamais « passe ») : un montant reçu de l'Usine, un plafond du
 * studio, ou un quota réellement appliqué (couple réseau/type gardé sur le chemin de fabrication) la borne. `reseau` et `type`
 * (facultatifs) désignent le couple de la commande : un quota qui le couvre est appliqué ici (une unité par travail).
 */
export async function controlerBudgetDuMois(besoinCentimes: number, options: { origine?: OrigineLancement; travailId?: Id; reseau?: string; type?: string } = {}): Promise<void> {
  // Mode indicatif (commande de Will seulement) : le plafond du mois est un repère, jamais un refus. L'Usine reste bloquante.
  const indicatif = await budgetIndicatifPour(options.origine);
  let plafond: number | null;
  try {
    plafond = await plafondStudioCentimes();
  } catch (e) {
    if (!indicatif) throw e;
    await signalerDepassementIndicatif("plafond-illisible", "Budget du mois illisible (la fabrication continue)", "Le plafond du mois est illisible : rien n'est bloqué, mais réglez-le dans Réglages > Budget.");
    return;
  }
  // Estimation illisible : refus dans les DEUX modes (jamais un total NaN engagé).
  if (!Number.isFinite(besoinCentimes)) throw new ErreurStudio("BUDGET_ILLISIBLE", "Le prix de cette fabrication est illisible : rien ne part.");
  const besoin = Math.max(0, Math.ceil(besoinCentimes));
  const vue = await resumeBudget();
  const propre = options.travailId ? await engagementDuTravail(options.travailId) : 0;
  const utilise = vue.depense.centimes + vue.engage.centimes - propre;
  if (plafond !== null && utilise + besoin > plafond) {
    if (indicatif) {
      await signalerDepassementIndicatif("mois", "Budget indicatif du mois dépassé", "Rien n'est arrêté : la fabrication continue. Réglages > Budget pour ajuster le repère du mois.");
      return;
    }
    await alerterRefus("plafond");
    throw new ErreurStudio("BUDGET_DEPASSE", "Le budget du mois serait dépassé. Augmentez-le dans Réglages.");
  }
  if (options.origine !== "usine") return;
  const usine = await lireBudgetUsine();
  if (!usine) {
    await alerterRefus("usine-absent");
    throw new ErreurStudio("BUDGET_USINE_ABSENT", "Aucun budget du mois reçu de l'Usine : rien ne part.");
  }
  if (usine.budget_mensuel_cents !== null && utilise + besoin > usine.budget_mensuel_cents) {
    await alerterRefus("usine-atteint");
    throw new ErreurStudio("BUDGET_MENSUEL_ATTEINT", "Le budget du mois réglé dans l'Usine serait dépassé : rien ne part.");
  }
  const { reseau, type } = options;
  const couple = reseau !== undefined && type !== undefined;
  const quotas = await lireQuotasUsine();
  const couvert = (r: string, t: string) => quotas.some((q) => q.reseau === r && q.type === t);
  // Un quota ne borne que s'il est réellement appliqué : couple de la commande CONNU et couvert. Couple inconnu ou quota absent :
  // aucune borne (jamais « passe » par défaut pour l'origine usine) ; les quotas par défaut ne valent pas borne.
  const borne = usine.budget_mensuel_cents !== null || plafond !== null || (couple && couvert(reseau, type));
  if (!borne) {
    await alerterRefus("usine-sans-borne");
    throw new ErreurStudio("BUDGET_USINE_SANS_BORNE", "Aucune limite ne s'applique à cette commande de l'Usine : rien ne part.");
  }
  if (couple && options.travailId !== undefined && couvert(reseau, type)) {
    const r = await avecOrigineFournisseur("usine", () => reserverQuota(reseau, type, `budget:${options.travailId}`));
    if (r === null) {
      await alerterRefus("usine-quota");
      throw new ErreurStudio("QUOTA_USINE_ATTEINT", "La limite de quantité réglée dans l'Usine est atteinte : rien ne part.");
    }
  }
}
