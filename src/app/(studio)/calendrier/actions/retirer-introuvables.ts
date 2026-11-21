"use server";

/**
 * Action serveur du calendrier (RAP-3 finitions) : retirer du calendrier les publications reprises du diffuseur qu'il ne retrouve plus
 * (« à vérifier »). Geste LOCAL : il pose `retireeLe`, n'efface rien, n'écrit rien chez le diffuseur. Session exigée, sous verrou.
 */
import { revalidatePath } from "next/cache";
import { depots, essayer, ErreurStudio, maintenant, sousVerrou, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { mesureVerifieeRecente } from "@/services/constantes-introuvable";
import { MESSAGE_LISTE_CHANGEE, MESSAGE_RELECTURE_INCERTAINE, appliquerRetraitRelu, retraitGroupeSur, selectionnerRetrait, type VerdictRelecture } from "@/services/retirer-rapatriee";
import { estErreurZernio } from "@/fournisseurs/publication/zernio-erreurs";
import { clientZernio, PARAM_ECART_CALENDRIER, type EcartCalendrier } from "@/services/zernio";

/** Lecture SEULE d'un post chez le diffuseur : il répond (« present »), n'existe plus (404 : « introuvable »), ou la réponse n'est pas claire (« incertain »). Ne lève jamais. */
async function relire(idExterne: string | undefined): Promise<VerdictRelecture> {
  if (!idExterne) return "incertain";
  try {
    await clientZernio().lirePost(idExterne);
    return "present";
  } catch (e) {
    return estErreurZernio(e) && e.code === "introuvable" ? "introuvable" : "incertain";
  }
}

export async function retirerIntrouvablesAction(ids: string[]): Promise<Resultat<{ retirees: number; message: string }>> {
  await exigerSession();
  return essayer(async () => {
    if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) throw new ErreurStudio("LISTE_CHANGEE", MESSAGE_LISTE_CHANGEE);
    const d = depots();
    const lister = () => d.publications.lister(() => true);
    // Temps 1 (sous verrou, sans réseau) : contrôles et sélection. Le serveur ne se fie pas à l'écran.
    const debut = await sousVerrou(async () => {
      // La mesure doit être VÉRIFIÉE, de moins d'une heure (jamais « non vérifié » ni « jamais mesuré »).
      const mesure = (await d.parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as EcartCalendrier | undefined;
      if (!mesureVerifieeRecente(mesure, Date.now())) throw new ErreurStudio("MESURE_NON_VERIFIEE", "L'écart avec le diffuseur n'est pas vérifié à l'instant : relisez le diffuseur, puis réessayez.");
      // Et sûre : la liste vérifiée doit retrouver au moins un de NOS posts (sinon : clé d'un autre espace), et le retrait ne doit pas être un retrait de masse.
      const toutes = await lister();
      const sur = retraitGroupeSur(mesure, toutes);
      if (!sur.sur) throw new ErreurStudio("RETRAIT_NON_SUR", sur.message);
      const selection = selectionnerRetrait(toutes, ids, maintenant(), mesure?.espaceRetrouveLe);
      if (!selection) throw new ErreurStudio("LISTE_CHANGEE", MESSAGE_LISTE_CHANGEE);
      return { selection, mesure };
    });
    // Temps 2 (HORS verrou) : chaque publication à retirer est relue SEULE chez le diffuseur (lecture seule, 10 au plus).
    const verdicts = new Map<string, VerdictRelecture>();
    for (const p of debut.selection.verifiees) verdicts.set(p.id, await relire(p.idExterne));
    // Temps 3 (sous verrou, écriture locale seule) : l'état est relu ; s'il a changé entre-temps, rien n'est retiré.
    return sousVerrou(async () => {
      const mesure = (await d.parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as EcartCalendrier | undefined;
      const toutes = await lister();
      if (!mesureVerifieeRecente(mesure, Date.now()) || !retraitGroupeSur(mesure, toutes).sur || mesure?.espaceSuspectLe !== debut.mesure?.espaceSuspectLe || mesure?.espaceRetrouveLe !== debut.mesure?.espaceRetrouveLe) throw new ErreurStudio("LISTE_CHANGEE", MESSAGE_LISTE_CHANGEE);
      const r = await appliquerRetraitRelu({ lister: async () => toutes, ecrire: async (id, modif) => void (await d.publications.modifier(id, modif)), maintenant }, ids, debut.selection, verdicts, mesure?.espaceRetrouveLe);
      if (!r.ok) throw new ErreurStudio(r.message === MESSAGE_RELECTURE_INCERTAINE ? "RELECTURE_INCERTAINE" : "LISTE_CHANGEE", r.message);
      revalidatePath("/calendrier");
      return { retirees: r.retirees, message: r.message };
    });
  });
}
