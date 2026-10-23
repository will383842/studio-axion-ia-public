"use server";

/** Actions du lot G7a : saisie des mesures J+3 / J+7 et « Programmer les N ». Chacune commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import type { SaisieMesures } from "@/domaine/mesures";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { enregistrerMesures, programmerSujet, type ResultatProgrammation } from "@/services/mesures";
import { cocherAvantDePublier, verificationsAvantProgrammer, type VerificationsVersion } from "@/services/publications";

export async function enregistrerMesuresAction(publicationId: string, saisie: SaisieMesures): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await enregistrerMesures(publicationId, saisie);
    revalidatePath("/mesures");
    revalidatePath("/");
    return undefined;
  });
}

/** E2E-1 n° 11 : avant « Programmer les N », ce qui manque version par version (lecture seule). */
export async function verificationsAvantProgrammerAction(sujetId: string): Promise<Resultat<VerificationsVersion[]>> {
  await exigerSession();
  return essayer(() => verificationsAvantProgrammer(sujetId));
}

/** E2E-1 n° 11 : cocher une vérification d'une version depuis la feuille « Programmer les N » (une case, un toucher). */
export async function cocherVerificationAction(sujetId: string, videoId: string, cle: VerificationsVersion["manquantes"][number]["cle"], valeur: boolean): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await cocherAvantDePublier(videoId, cle, valeur);
    revalidatePath(`/videos/${videoId}`);
    revalidatePath(`/ecrire/sujets/${sujetId}`);
    return undefined;
  });
}

export async function programmerSujetAction(sujetId: string, formatId?: string): Promise<Resultat<ResultatProgrammation>> {
  await exigerSession();
  return essayer(async () => {
    const r = await programmerSujet(sujetId, { formatId });
    revalidatePath(`/ecrire/sujets/${sujetId}`);
    revalidatePath("/ecrire");
    revalidatePath("/calendrier");
    revalidatePath("/");
    return r;
  });
}
