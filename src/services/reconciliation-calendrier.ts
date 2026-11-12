/**
 * Réconciliation du statut rendu par le diffuseur vers le plan (L5-05). Fonction PURE : aucun appel, aucun dépôt.
 * Le point d'appel (hors zone) applique le résultat ; ici on dit seulement quoi changer.
 * Une transition non permise est ignorée, jamais forcée ; une réconciliation déjà faite ne change rien.
 */
import { transitionPermise as visuelPermis, type StatutVisuel } from "@/domaine/visuels/statuts";
import { transitionAutorisee as creneauPermis } from "@/domaine/plan-editorial/statuts";
import type { StatutPlan } from "@/domaine/plan-editorial/types";
import type { StatutPublication } from "@/domaine/types";

export type StatutDiffuseur = { diffuseur: "publie" | "echec" | "en_attente"; raison?: string };

export interface EntreeReconciliation {
  creneau: { id: string; statut: StatutPlan };
  publication: { id: string; statut: StatutPublication };
  visuel?: { id: string; statut: StatutVisuel };
}

export interface ResultatReconciliation {
  creneau?: { statut: StatutPlan };
  publication?: { statut: StatutPublication; erreur?: string };
  visuel?: { statut: StatutVisuel };
  /** Présent en cas d'échec : le créneau est à reprendre, avec la raison. */
  aReprendre?: { raison: string };
}

/** Transitions de la Publication que le diffuseur peut provoquer ; « publiee » est final, « brouillon » n'est jamais écrit. */
const PUBLICATION_PERMISE: Record<StatutPublication, readonly StatutPublication[]> = {
  brouillon: [],
  programmee: ["publiee", "echec"],
  echec: ["publiee"],
  publiee: [],
};

const RAISON_INCONNUE = "Raison inconnue (le diffuseur n'en a donné aucune).";

export function reconcilier(statut: StatutDiffuseur, e: EntreeReconciliation): ResultatReconciliation {
  if (statut.diffuseur === "en_attente") return {};
  const ok = statut.diffuseur === "publie";
  const vers: StatutPlan = ok ? "publie" : "echec";
  const r: ResultatReconciliation = {};
  if (e.creneau.statut !== vers && creneauPermis(e.creneau.statut, vers)) r.creneau = { statut: vers };
  const vp: StatutPublication = ok ? "publiee" : "echec";
  const raison = statut.raison?.trim() || RAISON_INCONNUE;
  if (e.publication.statut !== vp && PUBLICATION_PERMISE[e.publication.statut].includes(vp)) r.publication = ok ? { statut: vp } : { statut: vp, erreur: raison };
  if (e.visuel) {
    const vv: StatutVisuel = ok ? "publie" : "echec_envoi";
    if (e.visuel.statut !== vv && visuelPermis(e.visuel.statut, vv)) r.visuel = { statut: vv };
  }
  if (!ok && (r.creneau || r.publication)) r.aReprendre = { raison };
  return r;
}
