/**
 * L4-08 : passerelle visuel -> créneau -> Publication. Les dépôts sont passés en paramètre (doublure en test).
 * Isolation : aucun appel réseau, diffuseur ou modèle d'IA. Une Publication « programmee » est une ligne du Studio,
 * rien ne part : l'envoi reste décidé ailleurs, par le fondateur.
 * Les transitions (visuel et créneau) sont portées par L1-04 et L1-08 ; ce module ne fait que les appeler.
 */
import "server-only";
import type { Depot } from "@/domaine/depots";
import type { Publication } from "@/domaine/types";
import type { ReseauDeclinaison } from "@/domaine/types";
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
  // Une Publication existe déjà pour ce visuel et ce réseau si elle porte l'id courant ou celui d'une version
  // antérieure (le créneau a été décalé depuis) : on la réutilise, on ne recrée jamais.
  const plan: { reseau: ReseauDeclinaison; id: string; existante: Publication | null }[] = [];
  for (const { reseau, cle } of lignes) {
    const id = `pub_${cle}`;
    const existante = (await d.publications.obtenir(id))
      ?? (await d.publications.trouver((p) => p.visuelId === v.id && p.reseau === reseau && p.statut === "programmee"));
    plan.push({ reseau, id, existante });
  }
  // Un rejeu n'est accepté que s'il ne change rien ; sinon la porte s'applique (créneau confié à renvoyer = refus).
  if (deja && plan.some((l) => !l.existante || l.existante.date !== c.heuresParReseau[l.reseau])) {
    if (c.aRenvoyer) throw new Error("À renvoyer à l'usine après un décalage : le rejeu est refusé.");
    if (plan.some((l) => !l.existante)) { const porte = peutProgrammer(c); if (!porte.ok) throw new Error(porte.raison); }
  }
  const publications: Publication[] = [];
  for (const { reseau, id, existante } of plan) {
    const date = c.heuresParReseau[reseau]!;
    if (!existante) {
      publications.push(await d.publications.enregistrer({
        id, visuelId: v.id, reseau, statut: "programmee", via: "manuel",
        date, texte: v.titre, creeLe: maintenant, modifieLe: maintenant,
      }));
    } else if (existante.date !== date) {
      publications.push(await d.publications.modifier(existante.id, { date, modifieLe: maintenant } as Partial<Publication>));
    } else publications.push(existante);
  }

  if (v.statut === "valide") {
    if (!transitionPermise("valide", "programme")) throw new Error("Transition valide -> programme refusée pour un visuel.");
    await d.visuels.modifier(v.id, { statut: "programme" } as Partial<Visuel>);
  }
  if (c.statut === "valide") await changerStatut(d, c.id, "programme", "studio", maintenant);
  return publications;
}
