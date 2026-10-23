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

/** Plafond du mois par défaut (150 €, garde-fou du plan maître C2), tant que Will n'en a pas réglé d'autre. */
export const PLAFOND_MENSUEL_PAR_DEFAUT_CENTIMES = 15000;
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

/** Plafond du mois réglé dans le studio, en centimes entiers. Illisible → `BUDGET_ILLISIBLE` (refus, rien ne part). */
export async function plafondStudioCentimes(): Promise<number> {
  const p = await lireParametre<unknown>(CLE_PLAFOND, centimes(PLAFOND_MENSUEL_PAR_DEFAUT_CENTIMES));
  const c = p && typeof p === "object" ? (p as { centimes?: unknown }).centimes : undefined;
  if (!estCentimesEntiers(c)) throw new ErreurStudio("BUDGET_ILLISIBLE", "Le plafond du mois est illisible : réglez-le de nouveau dans Réglages > Budget. Rien ne part en attendant.");
  return c;
}

/* --- Budget envoyé par l'Usine ------------------------------------------ */

interface BudgetUsineEnBase {
  budget_mensuel_cents: number;
  mois: string;
  le: string;
}

export interface BudgetUsine {
  budget_mensuel_cents: number;
  mois: string;
}

/** Budget de l'Usine pour ce mois (Paris). Absent, illisible ou d'un autre mois → null (= aucune fabrication de l'Usine). */
export async function lireBudgetUsine(mois: string = moisParis()): Promise<BudgetUsine | null> {
  const b = await lireParametre<Partial<BudgetUsineEnBase> | null>(cleBudgetUsine(mois), null);
  if (!b || typeof b !== "object" || b.mois !== mois || !estCentimesEntiers(b.budget_mensuel_cents)) return null;
  return { budget_mensuel_cents: b.budget_mensuel_cents, mois };
}

/**
 * SEUL endroit d'écriture du budget de l'Usine (appel 5 : `{ budget_mensuel_cents, mois }`). Pas de session : la porte
 * (lot 3) garde l'appel par son secret ; ce service ne doit être exposé par aucune action d'écran.
 *  - `budget_mensuel_cents` : centimes entiers ≥ 0, ≤ plafond du studio, sinon `CHAMP_INVALIDE` (rien n'est écrit) ;
 *  - `mois` : AAAA-MM, le mois de Paris en cours ou le suivant (jamais un mois passé) ;
 *  - rejeu de la même valeur pour le même mois → `deja: true`, rien n'est réécrit ni journalisé.
 */
export async function reglerBudgetUsine(corps: { budget_mensuel_cents: unknown; mois: unknown }): Promise<BudgetUsine & { deja: boolean }> {
  const { budget_mensuel_cents: cents, mois } = corps;
  const courant = moisParis();
  if (typeof mois !== "string" || !MOIS_VALIDE.test(mois) || (mois !== courant && mois !== decalerMois(courant, 1))) {
    throw new ErreurChampInvalide("mois", "Le mois doit être le mois en cours ou le suivant (AAAA-MM).");
  }
  if (!estCentimesEntiers(cents)) throw new ErreurChampInvalide("budget_mensuel_cents", "Le budget doit être un nombre entier de centimes, positif ou nul.");
  const plafond = await plafondStudioCentimes();
  if (cents > plafond) throw new ErreurChampInvalide("budget_mensuel_cents", "Le budget dépasse le plafond du mois réglé dans le studio.");
  const avant = await lireBudgetUsine(mois);
  if (avant && avant.budget_mensuel_cents === cents) return { ...avant, deja: true };
  const b: BudgetUsineEnBase = { budget_mensuel_cents: cents, mois, le: maintenant() };
  await ecrireParametre(cleBudgetUsine(mois), b);
  await journaliser("budget", `Budget de l'Usine pour ${mois} : ${formaterMontant(centimes(cents))} (plafond du studio : ${formaterMontant(centimes(plafond))})`);
  return { budget_mensuel_cents: cents, mois, deja: false };
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
export async function verifierPlafondCommande(plafondCents: unknown): Promise<number> {
  if (!estCentimesEntiers(plafondCents) || plafondCents === 0) throw new ErreurChampInvalide("plafond_cents", "Le plafond de la commande doit être un nombre entier de centimes, supérieur à zéro.");
  if (plafondCents > (await plafondSujetCentimes())) throw new ErreurChampInvalide("plafond_cents", "Le plafond de la commande dépasse le plafond d'un sujet réglé dans le studio.");
  return plafondCents;
}

/* --- Garde dure du passage commun ---------------------------------------- */

/** D'où vient le lancement : Will dans le studio (par défaut, inchangé) ou une commande de l'Usine. */
export type OrigineLancement = "studio" | "usine";

type MotifRefus = "plafond" | "usine-atteint" | "usine-absent";
const ALERTES: Record<MotifRefus, { titre: string; message: string }> = {
  plafond: { titre: "Fabrication refusée : plafond du mois atteint", message: "Rien n'est parti. Réglages > Budget pour relever le plafond." },
  "usine-atteint": { titre: "Commande de l'Usine refusée : budget du mois atteint", message: "Rien n'est parti. Le budget se règle dans l'Usine, sous le plafond du studio." },
  "usine-absent": { titre: "Commande de l'Usine refusée : aucun budget reçu pour ce mois", message: "Rien n'est parti. Réglez le budget du mois dans l'Usine." },
};

/** Alerte à Will (cloche + file d'envoi), une fois par jour et par motif. Une panne de l'alerte ne change jamais le refus. */
async function alerterRefus(motif: MotifRefus): Promise<void> {
  try {
    const cle = `budget.refus.${jourParis()}.${motif}`;
    if (await lireParametre<boolean>(cle, false)) return;
    await creerNotification({ type: "budget", ...ALERTES[motif], lien: "/reglages#budget" });
    // L3-0 : la marque « déjà alerté » n'est posée qu'APRÈS l'envoi réussi ; une panne d'envoi laisse l'alerte repartir au refus suivant.
    await ecrireParametre(cle, true);
  } catch {
    /* le refus part quand même */
  }
}

/**
 * Contrôle du mois, appelé SOUS le verrou des crédits avant toute réservation. `besoinCentimes` est arrondi au centime
 * supérieur (pire cas). `travailId` : un travail qui reprend ne compte pas deux fois son propre engagement.
 * Codes : `BUDGET_ILLISIBLE`, `BUDGET_DEPASSE` (plafond du studio), `BUDGET_USINE_ABSENT`, `BUDGET_MENSUEL_ATTEINT`.
 */
export async function controlerBudgetDuMois(besoinCentimes: number, options: { origine?: OrigineLancement; travailId?: Id } = {}): Promise<void> {
  const plafond = await plafondStudioCentimes();
  const besoin = Number.isFinite(besoinCentimes) ? Math.max(0, Math.ceil(besoinCentimes)) : Number.POSITIVE_INFINITY;
  const vue = await resumeBudget();
  const propre = options.travailId ? await engagementDuTravail(options.travailId) : 0;
  const utilise = vue.depense.centimes + vue.engage.centimes - propre;
  if (utilise + besoin > plafond) {
    await alerterRefus("plafond");
    throw new ErreurStudio("BUDGET_DEPASSE", "Le budget du mois serait dépassé. Augmentez-le dans Réglages.");
  }
  if (options.origine !== "usine") return;
  const usine = await lireBudgetUsine();
  if (!usine) {
    await alerterRefus("usine-absent");
    throw new ErreurStudio("BUDGET_USINE_ABSENT", "Aucun budget du mois reçu de l'Usine : rien ne part.");
  }
  if (utilise + besoin > usine.budget_mensuel_cents) {
    await alerterRefus("usine-atteint");
    throw new ErreurStudio("BUDGET_MENSUEL_ATTEINT", "Le budget du mois réglé dans l'Usine serait dépassé : rien ne part.");
  }
}
