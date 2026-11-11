/**
 * L4-08 : passerelle visuel -> créneau -> Publication. Les dépôts sont passés en paramètre (doublure en test).
 * Isolation : aucun appel réseau, diffuseur ou modèle d'IA. Une Publication « programmee » est une ligne du Studio,
 * rien ne part : l'envoi reste décidé ailleurs, par le fondateur.
 * Les transitions (visuel et créneau) sont portées par L1-04 et L1-08 ; ce module ne fait que les appeler.
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import type { Visuel } from "@/domaine/visuels/visuel";
import { transitionPermise } from "@/domaine/visuels/statuts";
import { changerStatut, identifiantsProgrammation, peutProgrammer, type CreneauPlan, type DepotsPlan } from "@/services/plan-editorial";

export interface DepotsPasserelle extends DepotsPlan {
  publications: Depot<Publication>;
  visuels: Depot<Visuel>;
}

/**
 * Programme un visuel depuis un créneau prêt : une Publication par réseau (source = le visuel), puis le visuel et le
 * créneau passent à « programme ». Idempotent : un rejeu rend les mêmes Publications et ne recrée rien.
 */
export async function programmerVisuel(d: DepotsPasserelle, creneauId: string, maintenant: string): Promise<Publication[]> {
  const c = await d.creneaux.obtenir(creneauId);
  if (!c) throw new Error(`Créneau introuvable : ${creneauId}`);
  if (!c.visuelId || c.videoId) throw new Error(`Le créneau ${creneauId} n'a pas de visuel unique.`);
  const v = await d.visuels.obtenir(c.visuelId);
  if (!v) throw new Error(`Visuel introuvable : ${c.visuelId}`);

  const deja = c.statut === "programme" && v.statut === "programme";
  if (!deja) {
    const porte = peutProgrammer(c);
    // Reprise après coupure : le créneau est resté « valide » alors que le visuel est déjà « programme ».
    if (!porte.ok) throw new Error(porte.raison);
    if (v.statut !== "valide" && v.statut !== "programme") throw new Error(`Visuel non validé (statut « ${v.statut} ») : il ne peut pas être programmé.`);
  }

  const lignes = identifiantsProgrammation(c);
  const publications: Publication[] = [];
  for (const { reseau, cle } of lignes) {
    // Identifiant stable : même créneau, même réseau, même version de décalage = même ligne.
    const id = `pub_${cle}`;
    const existante = await d.publications.obtenir(id);
    if (existante) { publications.push(existante); continue; }
    publications.push(await d.publications.enregistrer({
      id, visuelId: v.id, reseau, statut: "programmee", via: "manuel",
      date: c.heuresParReseau[reseau]!, texte: v.titre, creeLe: maintenant, modifieLe: maintenant,
    }));
  }

  if (v.statut === "valide") {
    if (!transitionPermise("valide", "programme")) throw new Error("Transition valide -> programme refusée pour un visuel.");
    await d.visuels.modifier(v.id, { statut: "programme" } as Partial<Visuel>);
  }
  if (c.statut === "valide") await changerStatut(d, c.id, "programme", "studio", maintenant);
  return publications;
}
