"use server";

/** Actions de la fiche script (B.8 #12). Chaque action commence par exigerSession(). */
import { revalidatePath } from "next/cache";
import type { BlocScript } from "@/domaine/types";
import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { basculerFavori, basculerReference, enregistrerScript, modifierScript, obtenirScript, validerScript } from "@/services/scripts";

/**
 * Enregistre les retouches comme NOUVELLE VERSION (rattachée à la racine, pour la comparaison).
 * Renvoie l'id de la nouvelle version.
 */
export async function enregistrerVersionAction(id: string, blocs: BlocScript[]): Promise<Resultat<string>> {
  await exigerSession();
  return essayer(async () => {
    const s = await obtenirScript(id);
    if (!s) throw new Error("Script introuvable");
    const nouveau = await enregistrerScript({ formatId: s.formatId, sujet: s.sujet, blocs, dureeCibleSec: s.dureeCibleSec, cible: s.cible, ton: s.ton, ideeId: s.ideeId, parentId: s.parentId ?? s.id });
    // Les notes sont recalculées par modifierScript.
    await modifierScript(nouveau, { blocs });
    revalidatePath("/ecrire");
    return nouveau;
  });
}

export async function renommerScriptAction(id: string, sujet: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await modifierScript(id, { sujet });
    revalidatePath(`/scripts/${id}`);
    return undefined;
  });
}

export async function basculerFavoriAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await basculerFavori(id);
    revalidatePath(`/scripts/${id}`);
    return undefined;
  });
}

export async function basculerReferenceAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await basculerReference(id);
    revalidatePath(`/scripts/${id}`);
    return undefined;
  });
}

export async function validerScriptAction(id: string): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await validerScript(id);
    revalidatePath(`/scripts/${id}`);
    return undefined;
  });
}
