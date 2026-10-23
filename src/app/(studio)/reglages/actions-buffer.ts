"use server";

/**
 * Actions serveur du bloc Buffer de Réglages (lot R1). Chacune commence par exigerSession().
 * « Tester » est le SEUL geste de cet écran qui appelle Buffer (lecture du compte et des comptes reliés, gratuite).
 */
import { revalidatePath } from "next/cache";
import type { IdReseau } from "@/domaine/types";
import type { ModeEnvoiPublication } from "@/domaine/types";
import { essayer, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { choisirCanalBuffer, definirModeBuffer, testerBuffer } from "@/services/buffer";

function rafraichir() {
  revalidatePath("/reglages");
}

export async function testerBufferAction(): Promise<Resultat<{ message: string; comptes: number }>> {
  await exigerSession();
  return essayer(async () => {
    const r = await testerBuffer();
    rafraichir();
    return r;
  });
}

/** Lot R1b : compte(s) proposé(s) par défaut à l'envoi ; liste vide : Will choisit à chaque envoi. */
export async function choisirCanalBufferAction(reseau: IdReseau, canalId: string | string[] | null): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await choisirCanalBuffer(reseau, canalId);
    rafraichir();
    return undefined;
  });
}

export async function definirModeBufferAction(mode: ModeEnvoiPublication): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await definirModeBuffer(mode);
    rafraichir();
    return undefined;
  });
}
