"use server";
/** Réglages › Cadence : enregistre les heures, quotas et objectifs. Session exigée. N'appelle aucun fournisseur. */
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { enregistrerReglagesCadence, lireReglagesCadence } from "@/services/reglages-cadence";
import { lireHeure, RESEAUX_CADENCE } from "@/domaine/cadence/reglages";

export async function enregistrerReglagesCadenceAction(valeur: unknown): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await enregistrerReglagesCadence(valeur);
    revalidatePath("/reglages/cadence");
    return undefined;
  });
}

const nombre = (v: FormDataEntryValue | null): number | undefined => {
  const t = String(v ?? "").trim();
  return t === "" ? undefined : Number(t);
};

/**
 * Version formulaire de la page : heures séparées par des virgules, par réseau. Un champ vidé reprend la valeur de
 * départ, une heure illisible renvoie à l'écran avec un message (rien n'est enregistré), les objectifs sont conservés.
 */
export async function enregistrerCadenceFormulaire(donnees: FormData): Promise<void> {
  await exigerSession();
  const reseaux: Record<string, unknown> = {};
  const illisibles: string[] = [];
  for (const id of RESEAUX_CADENCE) {
    const saisies = String(donnees.get(`heures-${id}`) ?? "").split(/[,;\s]+/).filter(Boolean);
    illisibles.push(...saisies.filter((h) => lireHeure(h) === null));
    reseaux[id] = {
      heures: saisies.length > 0 ? saisies : undefined,
      quotaParJour: nombre(donnees.get(`quota-${id}`)),
      ecartMinMinutes: nombre(donnees.get(`ecart-${id}`)),
    };
  }
  if (illisibles.length > 0) {
    const message = `Heure illisible : ${illisibles.join(", ")}. Écrivez par exemple 8h, 8:30 ou 18:00.`;
    redirect(`/reglages/cadence?erreur=${encodeURIComponent(message)}`);
  }
  const actuels = await lireReglagesCadence();
  await enregistrerReglagesCadenceAction({ reseaux, objectifs: actuels.objectifs });
}
