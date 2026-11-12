"use server";
/** Réglages › Cadence : enregistre les heures, quotas et objectifs. Session exigée. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { enregistrerReglagesCadence } from "@/services/reglages-cadence";
import { RESEAUX_CADENCE } from "@/domaine/cadence/reglages";

export async function enregistrerReglagesCadenceAction(valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await enregistrerReglagesCadence(valeur);
    revalidatePath("/reglages/cadence");
    return undefined;
  });
}

/** Version formulaire de la page : heures séparées par des virgules, par réseau. */
export async function enregistrerCadenceFormulaire(donnees: FormData): Promise<void> {
  const reseaux: Record<string, unknown> = {};
  for (const id of RESEAUX_CADENCE) {
    reseaux[id] = {
      heures: String(donnees.get(`heures-${id}`) ?? "").split(/[,;\s]+/).filter(Boolean),
      quotaParJour: Number(donnees.get(`quota-${id}`)),
      ecartMinMinutes: Number(donnees.get(`ecart-${id}`)),
    };
  }
  await enregistrerReglagesCadenceAction({ reseaux });
}
