"use server";
/**
 * Réglages › Dosage de l'animation (X3-10b-b). Session exigée.
 * Enveloppe le service des défauts (éteint tant que `dosageMotion.actif` n'est pas exactement `true`).
 * Aucun appel payant. Rien n'importe ce fichier pour l'instant.
 */
import { revalidatePath } from "next/cache";
import { CRANS_PERMIS } from "@/briques/dosage-motion/crans";
import { DOSAGES, type DosageMotion, type IdGenerateurDosage } from "@/briques/dosage-motion/types";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { definirDefautDosage, lireDefautsDosage } from "@/services/dosage-motion-defauts";

const REFUS = "Ce choix n'existe pas pour ce générateur.";

const estGenerateur = (v: unknown): v is IdGenerateurDosage =>
  typeof v === "string" && Object.prototype.hasOwnProperty.call(CRANS_PERMIS, v);
const estCran = (v: unknown): v is DosageMotion => typeof v === "string" && (DOSAGES as readonly string[]).includes(v);

export type ResultatActionDosage = { ok: true } | { ok: false; message: string };

export async function definirDefautDosageAction(generateur: unknown, cran: unknown): Promise<ResultatActionDosage> {
  await exigerSession();
  if (!estGenerateur(generateur) || !estCran(cran)) return { ok: false, message: REFUS };
  const r = await definirDefautDosage(generateur, cran);
  if (r.ok) revalidatePath("/reglages");
  return r;
}

export async function lireDefautsDosageAction(): Promise<Resultat<Record<IdGenerateurDosage, DosageMotion>>> {
  await exigerSession();
  return essayer(() => lireDefautsDosage());
}
