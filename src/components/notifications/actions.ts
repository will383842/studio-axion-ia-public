"use server";

import { exigerSession } from "@/services/auth";
import { essayer, type Resultat } from "@/services/_commun";
import { marquerLues } from "@/services/notifications";

/** Marque comme lues les notifications données (toutes si `ids` est absent). */
export async function marquerLuesAction(ids?: string[]): Promise<Resultat> {
  await exigerSession();
  return essayer(async () => {
    await marquerLues(ids);
    return undefined;
  });
}
