/**
 * STOP-01 — VISIBILITÉ de la consultation des refus du site (aucune décision d'envoi ici).
 * - `santeOppositions` : ligne « oppositions » de /api/sante, un état court, PUR, jamais un nombre, jamais d'effet sur `ok` ;
 * - `surveillerOppositions` : une cloche au plus par heure quand l'import des refus du site est ÉTEINT alors que le parcours des
 *   messages privés est ALLUMÉ (les refus du site et du CRM ne sont alors pas consultés avant l'envoi). Tout éteint : retour immédiat.
 * Aucun appel au site, aucun envoi, aucun identifiant ni adresse dans la cloche, le journal ou la page de santé.
 */
import "server-only";
import { journaliser, lireParametre, ecrireParametre, sousVerrou } from "./_commun";
import { creerNotification } from "./notifications";
import { importSiteActif, type EtatVerificationSite } from "./oppositions-mots";

type Env = Record<string, string | undefined>;

export type EtatOppositionsSante = "eteint" | "jamais-verifie" | "ok" | "en-echec" | "inconnu";

/** Créneau durable de la cloche : `{ v: 1, alerteEteintLe }` (une date, rien d'autre). */
type CreneauBrut = { v?: unknown; alerteEteintLe?: unknown };
export const PARAM_SANTE_OPPOSITIONS = "oppositions.sante";
export const INTERVALLE_SURVEILLANCE_MS = 60_000;
export const INTERVALLE_ALERTE_SANTE_OPPOSITIONS_MS = 3_600_000;

/** PUR. Ne lit PAS l'interrupteur du parcours : l'état de la ligne ne dépend que de l'import. */
export function santeOppositions(env: Env, e: EtatVerificationSite): EtatOppositionsSante {
  if (!importSiteActif(env)) return "eteint";
  if (e.derniereIssue === null) return "jamais-verifie";
  return e.derniereIssue === "ok" ? "ok" : "en-echec";
}

interface MemoireSurveillance {
  dernierPassageMs: number | null;
}
const memoire = (): MemoireSurveillance => {
  const g = globalThis as { __studioSanteOppositions?: MemoireSurveillance };
  return (g.__studioSanteOppositions ??= { dernierPassageMs: null });
};
/** Remet à zéro la mémoire de processus (essais, redémarrage simulé). Le créneau durable en base n'est pas touché. */
export function reinitialiserSanteOppositions(): void {
  memoire().dernierPassageMs = null;
}

const parcoursAllume = (env: Env): boolean => /^(1|true|oui)$/i.test(env.PARCOURS_CONVERSATION_ENABLED?.trim() ?? "");
const MESSAGE =
  "Le parcours des messages privés envoie, mais les refus connus du site et du CRM ne sont pas consultés avant l'envoi (interrupteur des oppositions du site éteint).";

/** Au plus une fois par minute ; la cloche : au plus une par heure (créneau durable). Toute erreur est avalée. */
export async function surveillerOppositions(o: { env?: Env; maintenantMs?: number } = {}): Promise<void> {
  try {
    const env = o.env ?? process.env;
    if (importSiteActif(env) || !parcoursAllume(env)) return;
    const now = o.maintenantMs ?? Date.now();
    const m = memoire();
    if (m.dernierPassageMs !== null && now - m.dernierPassageMs >= 0 && now - m.dernierPassageMs < INTERVALLE_SURVEILLANCE_MS) return;
    m.dernierPassageMs = now;
    // Le verrou ne couvre que la lecture et l'écriture du créneau : `creerNotification` prend lui-même le verrou, il passe HORS verrou.
    const marquee = await sousVerrou(async () => {
      const brut = await lireParametre<CreneauBrut | null>(PARAM_SANTE_OPPOSITIONS, null);
      const dernier = brut !== null && typeof brut === "object" && brut.v === 1 && typeof brut.alerteEteintLe === "number" ? brut.alerteEteintLe : null;
      if (dernier !== null && now - dernier >= 0 && now - dernier < INTERVALLE_ALERTE_SANTE_OPPOSITIONS_MS) return false;
      await ecrireParametre(PARAM_SANTE_OPPOSITIONS, { v: 1, alerteEteintLe: now });
      return true;
    });
    if (!marquee) return;
    await journaliser("parcours_conversation", `ALERTE : ${MESSAGE}`);
    await creerNotification({ type: "echec", titre: "Refus du site non consultés", message: MESSAGE, lien: "/mots" }, { cloche: true });
  } catch {
    /* la surveillance ne casse jamais le tour */
  }
}
