import "server-only";
/**
 * Journal d'envoi DURABLE (D7-02) : même liste blanche que journal-envoi.ts, mais écrit dans un dépôt (la collection
 * des événements, type « envoi-journal ») au lieu de la sortie standard, perdue à chaque recréation du conteneur.
 *
 * - Écriture sans await : `ecrireJournalEnvoi` rend la main aussitôt et ne lève jamais (un journal ne change jamais un envoi).
 * - Conservé sans purge : ce module ne supprime ni ne modifie jamais une ligne.
 * - La lecture ne lit que le dépôt : aucun fournisseur, aucun réseau.
 * Jamais : texte, légende, e-mail, pseudo, clé ou jeton, détail technique, corps de réponse, identifiant de compte.
 */
import type { Depot } from "@/domaine/depots";
import type { DateIso, Evenement } from "@/domaine/types";
import type { EvenementEnvoi } from "./journal-envoi";

export const TYPE_JOURNAL_ENVOI = "envoi-journal";

export type EntreeJournalEnvoi = Record<string, string | number | boolean> & { ts: string; code: string; action: string };

const FORME_MOT = /^[A-Za-z0-9_-]{1,40}$/;
const FORME_CODE = /^[A-Z0-9_]{1,40}$/;
const FORME_ID = /^[A-Za-z0-9_.-]{1,80}$/;

/** Ne garde que les champs autorisés, de la bonne forme (ts posé ici). */
export function filtrerEntreeJournal(brut: unknown, maintenant: DateIso): Record<string, string | number | boolean> {
  const e = (brut && typeof brut === "object" ? brut : {}) as Record<string, unknown>;
  const sortie: Record<string, string | number | boolean> = { ts: maintenant };
  const texte = (cle: string, forme: RegExp) => {
    const v = e[cle];
    if (typeof v === "string" && forme.test(v)) sortie[cle] = v;
  };
  texte("action", FORME_MOT);
  if (e.outil === "zernio" || e.outil === "buffer") sortie.outil = e.outil;
  texte("reseau", FORME_MOT);
  texte("code", FORME_CODE);
  texte("contenuId", FORME_ID);
  if (typeof e.nbComptes === "number" && Number.isInteger(e.nbComptes) && e.nbComptes >= 0 && e.nbComptes <= 1000) sortie.nbComptes = e.nbComptes;
  if (typeof e.brouillon === "boolean") sortie.brouillon = e.brouillon;
  return sortie;
}

let compteur = 0;

function ecrire(d: Depot<Evenement>, evenement: EvenementEnvoi, maintenant: DateIso): Promise<void> {
  const champs = filtrerEntreeJournal(evenement, maintenant);
  compteur += 1;
  const id = `${TYPE_JOURNAL_ENVOI}:${maintenant}:${compteur}:${Math.random().toString(36).slice(2, 8)}`;
  return d
    .enregistrer({ id, type: TYPE_JOURNAL_ENVOI, message: JSON.stringify(champs), date: maintenant, creeLe: maintenant, modifieLe: maintenant })
    .then(() => undefined)
    .catch(() => undefined);
}

/** Écrit une ligne sans attendre : rend `undefined`, ne lève jamais. `attendre` (tests) rend la promesse de fin. */
export function ecrireJournalEnvoi(d: Depot<Evenement>, evenement: EvenementEnvoi, maintenant: DateIso): void;
export function ecrireJournalEnvoi(d: Depot<Evenement>, evenement: EvenementEnvoi, maintenant: DateIso, attendre: true): Promise<void>;
export function ecrireJournalEnvoi(d: Depot<Evenement>, evenement: EvenementEnvoi, maintenant: DateIso, attendre?: boolean): Promise<void> | void {
  let p: Promise<void>;
  try {
    p = ecrire(d, evenement, maintenant);
  } catch {
    p = Promise.resolve();
  }
  if (attendre) return p;
}

/** Lecture seule du dépôt, plus récentes d'abord. Ne rend que des champs de la liste blanche. */
export async function lireJournalEnvoi(d: Depot<Evenement>, limite = 500): Promise<EntreeJournalEnvoi[]> {
  const lignes = await d.lister((e) => e.type === TYPE_JOURNAL_ENVOI);
  const sortie: EntreeJournalEnvoi[] = [];
  for (const l of lignes) {
    try {
      const brut = JSON.parse(l.message) as unknown;
      const champs = filtrerEntreeJournal(brut, typeof (brut as { ts?: unknown })?.ts === "string" ? (brut as { ts: string }).ts : l.date);
      if (typeof champs.code === "string" && typeof champs.action === "string") sortie.push(champs as EntreeJournalEnvoi);
    } catch {
      /* ligne illisible : ignorée, jamais supprimée */
    }
  }
  return sortie.sort((a, b) => (a.ts < b.ts ? 1 : a.ts > b.ts ? -1 : 0)).slice(0, limite);
}

/** Branchement sur les vrais dépôts (la page n'importe jamais un dépôt) : lecture seule. */
export async function listerJournalEnvoi(limite = 500): Promise<EntreeJournalEnvoi[]> {
  const { depots } = await import("./_commun");
  return lireJournalEnvoi(depots().evenements, limite);
}

/** Branchement des envois : écrit sans attendre, ne lève jamais. */
export async function noterEnvoiDurable(evenement: EvenementEnvoi): Promise<void> {
  try {
    const { depots, maintenant } = await import("./_commun");
    ecrireJournalEnvoi(depots().evenements, evenement, maintenant());
  } catch {
    /* rien */
  }
}
