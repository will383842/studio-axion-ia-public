"use server";

/**
 * Action serveur du calendrier : « Retirer du calendrier » pour un carrousel programmé.
 * Rien ne part d'ici ; aucun outil de publication n'est appelé : on efface seulement les lignes prévues du Studio.
 * Session exigée ; confirmation écrite exigée ; tout refus est une phrase claire, sans aucune écriture.
 */
import { revalidatePath } from "next/cache";
import { lireCleFiche } from "@/components/calendrier/FicheEntree";
import { appliquerLot } from "@/donnees/memoire";
import { depots, essayer, ErreurStudio, maintenant, sousVerrou, type Resultat } from "@/services/_commun";
import { exigerSession } from "@/services/auth";
import { PHRASES_RETRAIT, RefusRetrait, retirerVisuel, type DepotsPasserelle } from "@/services/plan-vers-publication";

const SEULEMENT_CARROUSELS = "Seules les publications d'un carrousel se retirent d'ici pour le moment.";

export async function retirerDuCalendrier(cle: string, confirmation: string): Promise<Resultat<{ creneauId: string }>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      if (confirmation !== "retirer") throw new ErreurStudio("RETRAIT_A_CONFIRMER", "Confirmez d'abord le retrait.");
      const k = lireCleFiche(cle);
      if (k?.origine !== "publication") throw new ErreurStudio("RETRAIT_REFUSE", SEULEMENT_CARROUSELS);
      const d = depots();
      const p = await d.publications.obtenir(k.id);
      if (!p) throw new ErreurStudio("RETRAIT_REFUSE", PHRASES_RETRAIT.introuvable);
      if (!p.visuelId) throw new ErreurStudio("RETRAIT_REFUSE", SEULEMENT_CARROUSELS);
      const passerelle: DepotsPasserelle = {
        creneaux: d.creneauxEditoriaux as unknown as DepotsPasserelle["creneaux"],
        journal: d.journalDecalages,
        publications: d.publications,
        visuels: d.visuels,
        evenements: d.evenements,
      };
      let creneauId: string;
      try {
        ({ creneauId } = await retirerVisuel(passerelle, p.visuelId, maintenant(), appliquerLot));
      } catch (e) {
        if (e instanceof RefusRetrait) throw new ErreurStudio("RETRAIT_REFUSE", e.message);
        throw e;
      }
      revalidatePath("/calendrier");
      revalidatePath("/carrousels/" + p.visuelId);
      return { creneauId };
    }),
  );
}
