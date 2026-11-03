/**
 * Personnes opposées (« stop », « arrêtez » écrit par la personne) : registre de mise à l'écart, par EMPREINTE de l'identifiant
 * opaque du contact (jamais l'identifiant lui-même, jamais d'adresse). Rien n'est jamais supprimé.
 */
import "server-only";
import { createHash } from "node:crypto";
import { ecrireParametre, lireParametre, maintenant, sousVerrou } from "./_commun";

export const PARAM_OPPOSITIONS_MOTS = "mots.oppositions";
export interface LigneOpposition {
  id: string;
  le: string;
  transmise: boolean;
}
export const empreinteContact = (id: string): string => createHash("sha256").update(id, "utf8").digest("hex").slice(0, 32);

/**
 * Cette personne s'est-elle déjà opposée ? Identifiant absent : non. Lecture impossible : l'ERREUR EST PROPAGÉE (jamais « opposée »
 * par défaut) : l'appelant réessaie plus tard, il ne met jamais une vraie demande de côté à cause d'une panne de base.
 */
export async function personneOpposee(idContact: string | null | undefined): Promise<boolean> {
  if (!idContact) return false;
  const id = empreinteContact(idContact);
  return (await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, [])).some((x) => x.id === id);
}

/** Met la personne à l'écart (une seule ligne par personne). */
export async function enregistrerOpposition(idContact: string): Promise<void> {
  await sousVerrou(async () => {
    const liste = await lireParametre<LigneOpposition[]>(PARAM_OPPOSITIONS_MOTS, []);
    const id = empreinteContact(idContact);
    if (!liste.some((x) => x.id === id)) await ecrireParametre(PARAM_OPPOSITIONS_MOTS, [...liste, { id, le: maintenant(), transmise: false }]);
  });
}
