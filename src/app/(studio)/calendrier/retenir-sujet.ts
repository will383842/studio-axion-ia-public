"use server";

/**
 * « Retenir ce sujet » (carte d'une proposition de la semaine). Côté serveur : le secret de l'usine ne quitte jamais le serveur.
 * Aucun appel de modèle, aucune dépense, rien chez le diffuseur, aucun créneau créé, aucune fabrication lancée :
 * on écrit le sujet au Studio (`ecrireSujetDeLUsine`) et l'usine note le jour et le réseau visés (porte `retenir`).
 */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerSession } from "@/services/auth";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { avecViseeUsine, usineActive } from "@/services/usine-porte";
import { ecrireSujetDeLUsine } from "@/services/usine-sujet";
import { RESEAUX_DECLINAISON } from "@/reseaux/codes";

const idee = z.object({
  signature: z.string().min(1),
  parts: z.record(z.string(), z.string().nullable()),
  metier: z.string(),
  taille: z.string(),
  service: z.string().optional(),
  douleur: z.string().min(1),
  casUsage: z.string(),
  sujet: z.string().optional(),
  format: z.string().optional(),
  famille: z.string().optional(),
  fin: z.string().optional(),
});
const visee = z.object({
  jour: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  reseau: z.enum(RESEAUX_DECLINAISON as [string, ...string[]]),
});

export async function retenirSujetSemaineAction(entree: unknown, jour: string, reseau: string): Promise<Resultat<{ id: string; rappelUsine: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    if (!usineActive()) throw new ErreurStudio("USINE_ETEINTE", "L'usine n'est pas reliée.");
    const v = visee.safeParse({ jour, reseau });
    if (!v.success) throw new ErreurStudio("RETENIR_VISEE", "Ce jour ou ce réseau n'est pas reconnu : le sujet n'a pas été retenu.");
    const r = await avecViseeUsine(v.data, () => ecrireSujetDeLUsine(idee.parse(entree), { reseaux: [v.data.reseau], typeContenu: "video", dateVisee: v.data.jour }));
    revalidatePath("/calendrier");
    return r;
  });
}
