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
import { annulerRetraitServeur, CODES_RETRAIT, retirerProgrammationServeur } from "@/services/retirer-programmation";

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

/* --- CAL-22 (écrite EN AVANCE, attend RC-08a) : retirer une publication PROGRAMMÉE chez le diffuseur, puis « À placer ». --- */

const NON_RETIRABLE = "Seule une publication programmée d'un créneau se retire d'ici.";

/**
 * « Retirer » une publication programmée : retrait chez le diffuseur confirmé par une relecture, puis retour dans « À placer ».
 * Session exigée ; confirmation écrite exigée. Refus ou silence du diffuseur : la publication reste « Programmé », phrase claire.
 * Le câblage (dépendances réelles) est dans le service : cette action n'appelle rien d'autre.
 */
export async function retirerProgrammationAction(cle: string, confirmation: string): Promise<Resultat<{ creneauId: string; annulableJusquA: string; message: string }>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      if (confirmation !== "retirer") throw new ErreurStudio("RETRAIT_A_CONFIRMER", "Confirmez d'abord le retrait.");
      const k = lireCleFiche(cle);
      if (k?.origine !== "creneau") throw new ErreurStudio("RETRAIT_REFUSE", NON_RETIRABLE);
      const r = await retirerProgrammationServeur(k.id);
      if (!r.ok) {
        if (r.ecritures) revalidatePath("/calendrier"); // retrait partiel : l'écran doit refléter ce qui a bougé
        // Un code par cas, pour que l'écran distingue « à vérifier », « à retirer à la main », « reste programmé » et « refusé ».
        throw new ErreurStudio(CODES_RETRAIT[r.etat], r.message);
      }
      revalidatePath("/calendrier");
      return { creneauId: r.creneauId, annulableJusquA: r.annulableJusquA, message: r.message };
    }),
  );
}

/** « Annuler » le retrait, dans les 10 secondes : la publication revient à la même date, sans doublon. */
export async function annulerRetraitAction(creneauId: string): Promise<Resultat<{ creneauId: string; message: string }>> {
  await exigerSession();
  return essayer(() =>
    sousVerrou(async () => {
      const r = await annulerRetraitServeur(creneauId);
      if (!r.ok) throw new ErreurStudio("RETRAIT_ANNULATION_REFUSEE", r.message);
      revalidatePath("/calendrier");
      return { creneauId: r.creneauId, message: r.message };
    }),
  );
}
