"use server";

/**
 * Actions serveur du calendrier (CAL-10) : refuser une proposition, renvoyer une entrée en échec après correction.
 * Chaque action commence par exigerSession(). Aucun appel au diffuseur : rien ne part d'ici, rien n'est supprimé
 * (un refus archive). Le verrou du passé (jour de Paris) et du publié est vérifié ici, côté serveur.
 */
import { exigerSession } from "@/services/auth";
import { depots, ErreurStudio, essayer, maintenant, type Resultat } from "@/services/_commun";
import { changerStatut } from "@/services/plan-editorial";
import { estPasse, refuserProposition, transitionner, validerProposition } from "@/domaine/plan-editorial/statuts";
import type { CreneauPlan, DepotsPlan } from "@/services/plan-editorial";

const MOTIF_MAX = 500;

function depotsPlan(): DepotsPlan {
  const d = depots();
  return { creneaux: d.creneauxEditoriaux as DepotsPlan["creneaux"], journal: d.journalDecalages as unknown as DepotsPlan["journal"] };
}

async function lireModifiable(id: string): Promise<CreneauPlan> {
  const c = typeof id === "string" && id ? await depotsPlan().creneaux.obtenir(id) : null;
  if (!c) throw new Error("Cette entrée est introuvable.");
  if (c.statut === "publie") throw new Error("Déjà publiée. Elle n'est plus modifiable.");
  if (estPasse(c.jourVise, new Date())) throw new Error("Ce jour est passé : cette publication n'est plus modifiable.");
  return c;
}

export const PHRASE_HEURE_PASSEE = "L'heure est passée : déplacez la publication avant de la valider";

/**
 * « Accepter l'idée » et « Valider et programmer » : une entrée à venir passe à « valide » (validation tracée : date et auteur).
 * Une entrée dont l'heure est passée (Manquée) est refusée, sans écriture : il faut d'abord la déplacer. Rien ne part d'ici.
 */
export async function accepterEntree(id: string): Promise<Resultat<CreneauPlan>> {
  const session = await exigerSession();
  return essayer(async () => {
    const d = depotsPlan();
    const lu = typeof id === "string" && id ? await d.creneaux.obtenir(id) : null;
    if (lu && lu.statut !== "publie" && estPasse(lu.jourVise, new Date())) throw new ErreurStudio("HEURE_PASSEE", PHRASE_HEURE_PASSEE);
    const c = await lireModifiable(id);
    if (c.statut !== "propose" && c.statut !== "a_valider") throw new Error("Seule une idée ou une entrée à valider peut être acceptée.");
    if (c.statut === "propose") await changerStatut(d, id, "a_valider", "studio", maintenant());
    const a = (await d.creneaux.obtenir(id))!;
    const r = validerProposition(a, "studio", maintenant(), session.id);
    if (!r.ok) throw new Error(r.raison);
    return d.creneaux.enregistrer(r.creneau);
  });
}

/** Geste du fondateur : refuser une proposition à venir. Elle est archivée avec la date du refus et un motif facultatif. */
export async function refuserEntree(id: string, motif?: string): Promise<Resultat<CreneauPlan>> {
  await exigerSession();
  return essayer(async () => {
    const c = await lireModifiable(id);
    const r = refuserProposition(c, "studio", typeof motif === "string" ? motif.slice(0, MOTIF_MAX) : undefined, maintenant());
    if (!r.ok) throw new Error(r.raison);
    return depotsPlan().creneaux.enregistrer(r.creneau);
  });
}

/** « Corriger et renvoyer » : une entrée en échec à venir repasse « valide ». La reprogrammation relève du diffuseur, pas d'ici. */
export async function renvoyerEntreeCorrigee(id: string): Promise<Resultat<CreneauPlan>> {
  await exigerSession();
  return essayer(async () => {
    const c = await lireModifiable(id);
    if (c.statut !== "echec") throw new Error("Seule une publication à corriger peut être renvoyée.");
    const r = transitionner(c, "valide", "studio");
    if (!r.ok) throw new Error(r.raison);
    return depotsPlan().creneaux.enregistrer(r.creneau);
  });
}
