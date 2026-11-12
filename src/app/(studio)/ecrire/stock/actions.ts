"use server";

/** RC-31 : stock de messages à faire passer. Chaque action commence par exigerSession(). Rien n'est supprimé : on archive. */
import { revalidatePath } from "next/cache";
import { verifierSaisieStock, creerEntreeStock, archiverMessage, planifierEntree, type MessageStock, type PrioriteStock } from "@/domaine/stock-messages";
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
  /** Clé de rejeu du formulaire : un double clic ne crée qu'une entrée. */
  cle?: string;
}): Promise<Resultat<MessageStock>> {
  await exigerSession();
  return essayer(async () => {
    const erreur = verifierSaisieStock(e);
    if (erreur) throw new Error(erreur);
    const texte = e.texte.trim();
    const cle = e.cle?.trim();
    const id = cle ? `stk-${cle}` : nouvelId("stk");
    if (cle) {
      const existante = await depots().stockMessages.obtenir(id);
      if (existante) return existante;
    }
    const entree = await depots().stockMessages.enregistrer(creerEntreeStock({ ...e, texte, id }, maintenant()));
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
