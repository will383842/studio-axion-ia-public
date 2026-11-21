/**
 * AUD-7 · GESTE « ACCEPTER LE DEVIS » du tutoriel d'outil, seul. Avant, l'accord ne s'écrivait que par `validerTutoriel` (pause
 * du script) : un devis en pause TO_DEVIS_A_ACCEPTER ne pouvait jamais être accepté (impasse).
 *
 * Le moteur range le devis montré (phrases + empreinte) dans la pause. Ce geste :
 * - n'agit que dans une pause TO_DEVIS_* (liste fermée) d'une fabrication en attente ;
 * - exige l'empreinte du devis que Williams a VU : un devis changé entre-temps = refus, rien n'est écrit ;
 * - écrit l'accord `{ empreinte, le }` (même forme que `validerTutoriel`) dans la vidéo ET dans la commande figée de la version,
 *   retire la pause et relance ; rien d'autre ;
 * - n'est pas rejouable : la pause est retirée, et un accord déjà égal à l'empreinte est refusé.
 * Aucun plafond n'est touché, aucun réglage n'est allumé, aucun appel payant, aucun montant. 0 €.
 */
import "server-only";
import type { Id, Travail } from "@/domaine/types";
import { ENTREE_DEVIS_TUTORIEL, lireAccordDevis } from "@/moteurs/montage-tutoriel-outil/devis-tutoriel";
import { CODE_DEVIS_A_ACCEPTER, CODE_DEVIS_ATTEINT } from "@/moteurs/montage-tutoriel-outil/index";
import { depots, maintenant } from "./_commun";
import { exigerSession } from "./auth";

export type IssueDevis = { statut: "ok"; phrase: string } | { statut: "refusee"; phrase: string };
export interface DevisAAccepter {
  phrases: string[];
  empreinte: string;
}

export const PHRASE_DEVIS_RIEN = "Aucun devis n'attend votre accord pour l'instant.";
export const PHRASE_DEVIS_CHANGE = "Le devis a changé depuis que vous l'avez lu : rouvrez-le avant de l'accepter.";
export const PHRASE_DEVIS_DEJA = "Ce devis est déjà accepté.";
const PHRASE_DEVIS_INVALIDE = "L'accord du devis n'est pas valable : rouvrez le devis.";
const CODES_PAUSE_DEVIS: readonly string[] = [CODE_DEVIS_A_ACCEPTER, CODE_DEVIS_ATTEINT];

const objet = (v: unknown): v is Record<string, unknown> => !!v && typeof v === "object" && !Array.isArray(v);
const refus = (phrase: string): IssueDevis => ({ statut: "refusee", phrase });

async function derniereFabrication(videoId: Id): Promise<Travail | null> {
  const liste = await depots().travaux.lister((t) => t.cibleId === videoId && t.type === "fabrication");
  return liste.sort((a, b) => b.creeLe.localeCompare(a.creeLe))[0] ?? null;
}

/** Le devis de la pause TO_DEVIS_* en cours (`null` : autre pause, pas de pause, ou devis absent). */
function devisDeLaPause(travail: Travail | null): DevisAAccepter | null {
  if (!travail || travail.statut !== "en_file") return null;
  const pause = travail.parametres?.pause;
  if (!objet(pause) || typeof pause.code !== "string" || !CODES_PAUSE_DEVIS.includes(pause.code) || !objet(pause.devis)) return null;
  const { phrases, empreinte } = pause.devis;
  if (typeof empreinte !== "string" || !empreinte.trim() || !Array.isArray(phrases)) return null;
  return { phrases: phrases.filter((p): p is string => typeof p === "string"), empreinte: empreinte.trim() };
}

/** Le devis à montrer à Williams ; `null` quand aucun devis n'attend son accord. Lecture seule. */
export async function lireDevisAAccepter(videoId: Id): Promise<DevisAAccepter | null> {
  await exigerSession();
  if (typeof videoId !== "string" || !videoId) return null;
  return devisDeLaPause(await derniereFabrication(videoId));
}

/** « Accepter le devis » : l'empreinte donnée doit être celle du devis encore en attente. */
export async function accepterDevis(videoId: Id, empreinteVue: string): Promise<IssueDevis> {
  await exigerSession();
  if (typeof videoId !== "string" || !videoId) return refus(PHRASE_DEVIS_RIEN);
  if (typeof empreinteVue !== "string" || !empreinteVue.trim() || empreinteVue.length > 200) return refus(PHRASE_DEVIS_INVALIDE);
  const travail = await derniereFabrication(videoId);
  const devis = devisDeLaPause(travail);
  if (!travail || !devis) return refus(PHRASE_DEVIS_RIEN);
  if (empreinteVue.trim() !== devis.empreinte) return refus(PHRASE_DEVIS_CHANGE);
  const d = depots();
  const video = await d.videos.obtenir(videoId);
  if (!video) return refus(PHRASE_DEVIS_RIEN);
  if (lireAccordDevis(video.entrees)?.empreinte === devis.empreinte) return refus(PHRASE_DEVIS_DEJA);
  const accord = { empreinte: devis.empreinte, le: maintenant() };
  await d.videos.modifier(videoId, { entrees: { ...(video.entrees ?? {}), [ENTREE_DEVIS_TUTORIEL]: accord } });
  const version = travail.versionId ? await d.versions.obtenir(travail.versionId) : null;
  if (version) await d.versions.modifier(version.id, { commande: { ...version.commande, entrees: { ...(version.commande.entrees ?? {}), [ENTREE_DEVIS_TUTORIEL]: accord } } });
  const { pause: _p, ...sansPause } = travail.parametres ?? {};
  void _p;
  await d.travaux.modifier(travail.id, { statut: "en_cours", parametres: sansPause });
  return { statut: "ok", phrase: "Le devis est accepté : la vidéo reprend." };
}
