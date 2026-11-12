"use server";

/** RC-31 : stock de messages à faire passer. Chaque action commence par exigerSession(). Rien n'est supprimé : on archive. */
import { revalidatePath } from "next/cache";
import { creerEntreeStock, archiverMessage, planifierEntree, type MessageStock, type PrioriteStock } from "@/domaine/stock-messages";
import type { IdReseau } from "@/domaine/types";
import { nouvelId } from "@/lib/ids";
import { depots, essayer, maintenant, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";

export async function creerEntreeStockAction(e: {
  texte: string;
  reseaux: IdReseau[];
  format?: string;
  priorite: PrioriteStock;
  echeance?: string;
}): Promise<Resultat<MessageStock>> {
  await exigerSession();
  return essayer(async () => {
    const texte = e.texte.trim();
    if (!texte) throw new Error("Écrivez le message à mettre en stock.");
    const entree = await depots().stockMessages.enregistrer(creerEntreeStock({ ...e, texte, id: nouvelId("stk") }, maintenant()));
    revalidatePath("/ecrire/stock");
    return entree;
  });
}

export async function planifierEntreeStockAction(id: string, creneauId: string): Promise<Resultat<MessageStock>> {
  await exigerSession();
  return essayer(async () => {
    const m = await depots().stockMessages.obtenir(id);
    if (!m) throw new Error("Ce message n'est plus dans le stock.");
    const r = await depots().stockMessages.enregistrer(planifierEntree(m, creneauId));
    revalidatePath("/ecrire/stock");
    return r;
  });
}

export async function archiverEntreeStockAction(id: string): Promise<Resultat<MessageStock>> {
  await exigerSession();
  return essayer(async () => {
    const m = await depots().stockMessages.obtenir(id);
    if (!m) throw new Error("Ce message n'est plus dans le stock.");
    const r = await depots().stockMessages.enregistrer(archiverMessage(m, maintenant()));
    revalidatePath("/ecrire/stock");
    return r;
  });
}
