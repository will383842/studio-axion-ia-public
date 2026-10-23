"use server";

/** Actions de l'écran fourni : garder l'image masquée (avec l'attestation), la retirer. Rien n'est envoyé ailleurs. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { poserEcranFourni, retirerEcranFourni } from "./service";

export async function poserEcranFourniAction(d: { casId: string; etapeCas: number; fichierId: string; masques: unknown; attestation: boolean }): Promise<Resultat<{ etapeCas: number }>> {
  const r = await essayer(async () => ({ etapeCas: (await poserEcranFourni(d)).etapeCas }));
  if (r.ok) revalidatePath(`/cas-concret/ecran-fourni/${d.casId}`);
  return r;
}

export async function retirerEcranFourniAction(casId: string, etapeCas: number): Promise<Resultat<{ etapeCas: number }>> {
  const r = await essayer(async () => {
    await retirerEcranFourni(casId, etapeCas);
    return { etapeCas };
  });
  if (r.ok) revalidatePath(`/cas-concret/ecran-fourni/${casId}`);
  return r;
}
