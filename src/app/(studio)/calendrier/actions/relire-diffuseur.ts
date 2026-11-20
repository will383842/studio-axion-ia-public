"use server";

/**
 * Action serveur du calendrier (RAP-2) : relire le diffuseur. Chaque action commence par exigerSession().
 * Fichier propre à ce geste : actions.ts ne garde que les deux actions de la fiche d'entrée.
 */
import { revalidatePath } from "next/cache";
import { exigerSession } from "@/services/auth";
import { ErreurStudio, essayer, type Resultat } from "@/services/_commun";
import { synchroniserEtatsZernio } from "@/services/zernio";

/**
 * RAP-2 · « Relire le diffuseur » : un passage de synchronisation forcé et complet, DANS le processus du serveur (les dépôts y vivent en
 * mémoire : un script à part les désynchroniserait). Lecture seule chez le diffuseur ; la seule écriture est locale (publications rapatriées
 * et mesure de l'écart). Réglages d'envoi non concernés.
 */
const DELAI_MIN_ENTRE_PASSAGES_MS = 60_000;
const cleAntiRebond = Symbol.for("studio-axion-ia.relire-diffuseur");
type AvecAntiRebond = typeof globalThis & { [cleAntiRebond]?: number };

export async function relireDiffuseurAction(): Promise<Resultat<{ lues: number; changees: number }>> {
  await exigerSession();
  // Anti-rebond : `force` contourne l'intervalle de 15 min ; sans délai minimal, chaque clic coûterait jusqu'à 51 requêtes.
  const g = globalThis as AvecAntiRebond;
  const maintenant = Date.now();
  const r = await essayer(async () => {
    if (g[cleAntiRebond] !== undefined && maintenant - g[cleAntiRebond]! < DELAI_MIN_ENTRE_PASSAGES_MS) {
      throw new ErreurStudio("TROP_TOT", "Le diffuseur vient d'être relu : réessayez dans une minute.");
    }
    g[cleAntiRebond] = maintenant;
    return synchroniserEtatsZernio({ force: true, complet: true });
  });
  if (r.ok) revalidatePath("/calendrier");
  return r;
}
