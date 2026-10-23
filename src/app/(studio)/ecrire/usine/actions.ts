"use server";

/** Idées de l'usine : appels faits ici, côté serveur (le secret n'atteint jamais le navigateur). */
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { exigerSession } from "@/services/auth";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { listerMetiersUsine, proposerIdeesUsine, usineActive } from "@/services/usine-porte";
import { ecrireSujetDeLUsine } from "@/services/usine-sujet";
import { ideesDuComitePourAffichage } from "@/services/comite-affichage";
import type { IdeesDuComite, IdeeUsine, MetierUsine } from "@/domaine/usine";

const filtres = z.object({
  type: z.enum(["video", "carrousel", "image", "texte", "story"]),
  reseaux: z.array(z.string()).max(10),
  metiers: z.array(z.string()).max(50),
  tailles: z.array(z.string()).max(10),
});
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

function exigerUsine() {
  if (!usineActive()) throw new ErreurStudio("USINE_ETEINTE", "L'usine n'est pas reliée.");
}

export async function listerMetiersUsineAction(): Promise<Resultat<MetierUsine[]>> {
  await exigerSession();
  return essayer(async () => {
    exigerUsine();
    return listerMetiersUsine();
  });
}

/** Idées déjà jugées par le comité (lecture seule : rien ne part, rien n'est payé). Éteint : vide. */
export async function ideesDuComiteAction(): Promise<Resultat<IdeesDuComite>> {
  await exigerSession();
  return essayer(() => ideesDuComitePourAffichage());
}

export async function proposerIdeesUsineAction(entree: unknown): Promise<Resultat<IdeeUsine[]>> {
  await exigerSession();
  return essayer(async () => {
    exigerUsine();
    const f = filtres.parse(entree);
    if (f.type !== "video") throw new ErreurStudio("USINE_BIENTOT", "Ce type arrive bientôt.");
    return proposerIdeesUsine(f);
  });
}

export async function ecrireSujetUsineAction(entree: unknown, reseaux: string[]): Promise<Resultat<{ id: string; rappelUsine: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    exigerUsine();
    const r = await ecrireSujetDeLUsine(idee.parse(entree), { reseaux: z.array(z.string()).parse(reseaux), typeContenu: "video" });
    revalidatePath("/ecrire");
    return r;
  });
}
