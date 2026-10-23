"use server";

/** Écriture en série (B7) : plan (prix maximum, combien partiront), lancement, suivi. Chacune commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { lancerSerie, planSerie, suiviSerie, type PlanSerie, type ReglagesSerie, type SuiviSerie } from "@/services/serie-ecriture";

export async function planSerieAction(demandees: number): Promise<Resultat<PlanSerie>> {
  await exigerSession();
  return essayer(() => planSerie(demandees));
}

export async function lancerSerieAction(idees: { texte: string; ideeId?: string }[], reglages: ReglagesSerie, cle: string, totalConfirme?: number, partirontConfirme?: number): Promise<Resultat<{ partis: number; restes: number; essai: boolean }>> {
  await exigerSession();
  return essayer(async () => {
    const { serie, plan } = await lancerSerie(idees, reglages, cle, typeof totalConfirme === "number" && Number.isFinite(totalConfirme) ? totalConfirme : undefined, typeof partirontConfirme === "number" && Number.isInteger(partirontConfirme) ? partirontConfirme : undefined);
    revalidatePath("/ecrire");
    revalidatePath("/");
    return { partis: serie.elements.filter((e) => e.sort === "parti").length, restes: serie.elements.filter((e) => e.sort !== "parti").length, essai: plan.essai };
  });
}

export async function suiviSerieAction(id?: string): Promise<Resultat<SuiviSerie | null>> {
  await exigerSession();
  return essayer(() => suiviSerie(id));
}
