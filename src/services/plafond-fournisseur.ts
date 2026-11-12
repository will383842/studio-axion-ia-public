/**
 * L2-13 — GARDE-FOU PAR FOURNISSEUR EN QUANTITÉS, JAMAIS EN MONTANT. Serveur seulement, aucun appel réseau.
 *  - Origine « usine » (fabrication automatique) : un quota de quantité (par jour ou par semaine, réseau, type) est atteint =
 *    appel refusé avant tout envoi, et un message apparaît dans le cockpit (réglage + cloche, sans montant).
 *  - Origine « studio » (le fondateur, et toute origine non précisée) : JAMAIS bloquée.
 *  - V1 : valeur locale par défaut, au format de l'usine (période, réseau, type, limite) pour un branchement sans migration en V2.
 *  - `FAL_PLAFOND_USD` reste une constante technique serveur : au-delà, l'appel de l'usine est refusé, celui du fondateur passe avec une alerte.
 *  - Aucun montant dans les messages. Un rejeu (même clé d'idempotence) ne consomme pas une seconde unité.
 */
import "server-only";
import { AsyncLocalStorage } from "node:async_hooks";
import { lundiDeLaSemaine } from "@/lib/calendrier-plages";
import { creerVerrou, ecrireParametre, journaliser, lireParametre, maintenant } from "./_commun";
import { jourParis } from "./couts";
import { creerNotification } from "./notifications";

export type OrigineFournisseur = "studio" | "usine";
export type PeriodeQuota = "jour" | "semaine";
export interface QuotaUsine {
  periode: PeriodeQuota;
  reseau: string;
  type: string;
  limite: number;
}

export const CLE_QUOTAS_USINE = "plafond.quotas-usine";
export const CLE_MESSAGE_COCKPIT = "plafond.message-cockpit";
/** Valeur locale V1 (limite technique invisible, en nombre d'appels), au format de l'usine. */
export const QUOTAS_PAR_DEFAUT: readonly QuotaUsine[] = [
  { periode: "jour", reseau: "fal", type: "image", limite: 40 },
  { periode: "jour", reseau: "fal", type: "clip", limite: 10 },
];

/* --- Origine de l'appel --------------------------------------------------- */

const contexte = new AsyncLocalStorage<OrigineFournisseur>();

/** Exécute `f` avec l'origine donnée. Tout point d'entrée de la fabrication automatique l'appelle avec « usine ». */
export function avecOrigineFournisseur<T>(origine: OrigineFournisseur, f: () => Promise<T>): Promise<T> {
  return contexte.run(origine, f);
}

/** Origine courante : « studio » quand rien n'est précisé (le fondateur n'est jamais bloqué). */
export function origineFournisseurCourante(): OrigineFournisseur {
  return contexte.getStore() ?? "studio";
}

/* --- Quotas --------------------------------------------------------------- */

function estQuota(q: unknown): q is QuotaUsine {
  if (!q || typeof q !== "object") return false;
  const { periode, reseau, type, limite } = q as Record<string, unknown>;
  return (periode === "jour" || periode === "semaine") && typeof reseau === "string" && reseau !== "" && typeof type === "string" && type !== "" && typeof limite === "number" && Number.isSafeInteger(limite) && limite > 0;
}

/** Quotas en vigueur : la valeur enregistrée si elle est lisible en entier, sinon le défaut (jamais « pas de quota » par accident). */
export async function lireQuotasUsine(): Promise<QuotaUsine[]> {
  const v = await lireParametre<unknown>(CLE_QUOTAS_USINE, null);
  if (Array.isArray(v) && v.length > 0 && v.every(estQuota)) return v.map((q) => ({ periode: q.periode, reseau: q.reseau, type: q.type, limite: q.limite }));
  return QUOTAS_PAR_DEFAUT.map((q) => ({ ...q }));
}

interface Compteur {
  cles: string[];
}

// Le verrou vit dans la mémoire du processus : avec deux instances du serveur, le quota peut être dépassé d'une unité (acceptable en V1, une seule instance).
const verrou = creerVerrou();
const cleCompteur = (q: QuotaUsine, jour: string) => `plafond.compteur.${q.periode}.${q.periode === "semaine" ? lundiDeLaSemaine(jour) : jour}.${q.reseau}.${q.type}`;

async function alerterUneFoisParJour(motif: string, titre: string, message: string): Promise<void> {
  try {
    const cle = `plafond.alerte.${jourParis()}.${motif}`;
    if (await lireParametre<boolean>(cle, false)) return;
    await creerNotification({ type: "credit", titre, message, lien: "/reglages" }, { cloche: true });
    await ecrireParametre(cle, true);
  } catch {
    /* l'alerte ne change jamais la décision */
  }
}

export interface ReservationQuota {
  /** Rend l'unité si l'envoi n'est finalement pas parti. */
  liberer(): Promise<void>;
}

/**
 * Réserve UNE unité du quota (origine « usine » seulement). Quota atteint : `null` après avoir posé le message du cockpit.
 * Origine « studio » ou aucun quota pour ce réseau/type : une réservation vide. Même clé déjà comptée : aucune unité de plus.
 */
export async function reserverQuota(reseau: string, type: string, cleIdempotence: string): Promise<ReservationQuota | null> {
  const vide: ReservationQuota = { liberer: async () => undefined };
  if (origineFournisseurCourante() !== "usine") return vide;
  return verrou(async () => {
    const jour = jourParis();
    const q = (await lireQuotasUsine()).find((x) => x.reseau === reseau && x.type === type);
    if (!q) return vide;
    const cle = cleCompteur(q, jour);
    const c = await lireParametre<Compteur>(cle, { cles: [] });
    const cles = Array.isArray(c?.cles) ? c.cles : [];
    if (cles.includes(cleIdempotence)) return vide;
    if (cles.length >= q.limite) {
      const message = "La limite de fabrication automatique est atteinte pour cette période : la fabrication automatique s'arrête, vos essais à la main ne sont pas concernés.";
      await ecrireParametre(CLE_MESSAGE_COCKPIT, { message, le: maintenant(), reseau, type });
      await journaliser("budget", `Quota de quantité atteint (${reseau}, ${type}, par ${q.periode}) : fabrication automatique arrêtée.`);
      await alerterUneFoisParJour(`quota-${reseau}-${type}`, "Fabrication automatique arrêtée : limite atteinte", message);
      return null;
    }
    await ecrireParametre(cle, { cles: [...cles, cleIdempotence] });
    return {
      liberer: () =>
        verrou(async () => {
          const actuel = await lireParametre<Compteur>(cle, { cles: [] });
          await ecrireParametre(cle, { cles: (Array.isArray(actuel?.cles) ? actuel.cles : []).filter((k) => k !== cleIdempotence) });
        }),
    };
  });
}

/* --- Plafond technique (constante serveur) -------------------------------- */

/**
 * Le plafond technique est dépassé : l'usine est refusée, le fondateur passe avec une alerte (cloche, une fois par jour, sans montant).
 * Rend « refuser » ou « laisser ».
 */
export async function decisionAuDepassementTechnique(reseau: string): Promise<"refuser" | "laisser"> {
  if (origineFournisseurCourante() === "usine") {
    await alerterUneFoisParJour(`plafond-technique-${reseau}-usine`, "Fabrication automatique arrêtée : limite technique atteinte", "La limite technique du fournisseur est atteinte : la fabrication automatique s'arrête. Vos essais à la main ne sont pas bloqués.");
    return "refuser";
  }
  await alerterUneFoisParJour(`plafond-technique-${reseau}-studio`, "Limite technique du fournisseur dépassée (votre essai continue)", "Rien n'est bloqué pour vous, mais la fabrication automatique est arrêtée tant que la limite n'est pas relevée.");
  return "laisser";
}
