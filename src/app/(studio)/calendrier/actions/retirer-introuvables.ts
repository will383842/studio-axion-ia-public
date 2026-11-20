"use server";

/**
 * Action serveur du calendrier (RAP-3 finitions) : retirer du calendrier les publications reprises du diffuseur qu'il ne retrouve plus
 * (« à vérifier »). Geste LOCAL : il pose `retireeLe`, n'efface rien, n'écrit rien chez le diffuseur. Session exigée, sous verrou.
 */
import { revalidatePath } from "next/cache";
import { depots, essayer, ErreurStudio, maintenant, sousVerrou, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { mesureVerifieeRecente } from "@/services/constantes-introuvable";
import { MESSAGE_LISTE_CHANGEE, retirerLesRapatrieesApresRelecture, retraitGroupeSur, type VerdictRelecture } from "@/services/retirer-rapatriee";
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
  return essayer(() =>
    sousVerrou(async () => {
      if (!Array.isArray(ids) || ids.some((x) => typeof x !== "string")) throw new ErreurStudio("LISTE_CHANGEE", MESSAGE_LISTE_CHANGEE);
      const d = depots();
      // Le serveur ne se fie pas à l'écran : la mesure doit être VÉRIFIÉE, de moins d'une heure (jamais « non vérifié » ni « jamais mesuré »).
      const mesure = (await d.parametres.obtenir(PARAM_ECART_CALENDRIER))?.valeur as EcartCalendrier | undefined;
      if (!mesureVerifieeRecente(mesure, Date.now())) throw new ErreurStudio("MESURE_NON_VERIFIEE", "L'écart avec le diffuseur n'est pas vérifié à l'instant : relisez le diffuseur, puis réessayez.");
      // Et sûre : la liste vérifiée doit retrouver au moins un de NOS posts (sinon : clé d'un autre espace), et le retrait ne doit pas être un retrait de masse.
      const toutes = await d.publications.lister(() => true);
      const sur = retraitGroupeSur(mesure, toutes);
      if (!sur.sur) throw new ErreurStudio("RETRAIT_NON_SUR", sur.message);
      // Au clic, chaque publication à retirer est relue SEULE chez le diffuseur (lecture seule, 10 au plus) : celle qui répond n'est pas retirée.
      const r = await retirerLesRapatrieesApresRelecture({ lister: async () => toutes, ecrire: async (id, modif) => void (await d.publications.modifier(id, modif)), maintenant, relire: (p) => relire(p.idExterne) }, ids, mesure?.espaceRetrouveLe);
      if (!r.ok) throw new ErreurStudio("LISTE_CHANGEE", r.message);
      revalidatePath("/calendrier");
      return { retirees: r.retirees, message: r.message };
    }),
  );
}
