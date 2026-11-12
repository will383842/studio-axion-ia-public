"use server";

/**
 * Actions du calendrier. Chaque action commence par exigerSession() : sans session, rien n'est lu ni écrit.
 * Rien ne part d'ici : ces actions n'appellent jamais l'outil de publication et ne valident rien.
 * Ce fichier ne garde que les deux actions de la fiche ; chaque autre geste du calendrier a son fichier dans actions/.
 * Les règles (clé, verrou, saisie) sont celles de la fiche (FicheEntree.tsx) ; le stockage est dans services/calendrier-fiche.ts.
 */
import { revalidatePath } from "next/cache";
import { PHRASES_VERROU, verifierSaisie, verrouFiche, type EntreeFiche, type FicheEnregistree, type SaisieFiche } from "@/components/calendrier/FicheEntree";
import { transitionner } from "@/domaine/plan-editorial/statuts";
import { cleJour } from "@/lib/dates";
import { exigerSession } from "@/services/auth";
import { chargerFiche, ecrireStockageFiche } from "@/services/calendrier-fiche";
import { creerVerrou, depots, ErreurStudio, essayer, type Resultat } from "@/services/_commun";

/** Une fiche à la fois : entre la relecture de l'entrée et l'écriture, rien d'autre ne passe par ici. */
const unALaFois = creerVerrou();

/** Lit la fiche d'une entrée (clé d'une carte : « creneau:<id>|<réseau> » ou « publication:<id>|<réseau> »). */
export async function lireFicheEntreeAction(cle: string): Promise<Resultat<EntreeFiche>> {
  await exigerSession();
  return essayer(async () => (await chargerFiche(cle)).entree);
}

/**
 * Enregistre le texte et le premier commentaire d'une entrée, tant que rien n'est envoyé. Refusé pour une entrée
 * publiée, passée (jour de Paris), programmée ou déjà confiée. Le statut ne change pas, sauf pour une entrée déjà
 * validée dont le contenu change : elle repasse « à valider » (une validation ne vaut que pour ce qui a été lu).
 */
export async function enregistrerFicheEntreeAction(cle: string, saisie: SaisieFiche): Promise<Resultat<FicheEnregistree>> {
  await exigerSession();
  return essayer(() =>
    unALaFois(async () => {
      const fiche = await chargerFiche(cle);
      const verrou = verrouFiche(fiche.entree, cleJour(new Date()));
      if (verrou) throw new ErreurStudio("FICHE_VERROUILLEE", PHRASES_VERROU[verrou]);
      const verifiee = verifierSaisie(saisie, fiche.cle.reseau);
      if (!verifiee.ok) throw new ErreurStudio("FICHE_FORMAT", verifiee.message);

      const avant = { texte: fiche.entree.texte, premierCommentaire: fiche.entree.premierCommentaire ?? "" };
      const apres = { texte: verifiee.saisie.texte, premierCommentaire: verifiee.saisie.premierCommentaire ?? avant.premierCommentaire };
      const rendu = { cle: fiche.cle.cle, texte: apres.texte, premierCommentaire: apres.premierCommentaire || null };
      if (apres.texte === avant.texte && apres.premierCommentaire === avant.premierCommentaire) return { ...rendu, modifie: false, aRevalider: false };

      let aRevalider = false;
      if (fiche.source.origine === "publication") {
        if (apres.texte !== avant.texte) await depots().publications.modifier(fiche.source.publication.id, { texte: apres.texte });
        await ecrireStockageFiche(fiche.cle, { premierCommentaire: apres.premierCommentaire });
      } else {
        await ecrireStockageFiche(fiche.cle, apres);
        if (fiche.source.creneau.statut === "valide") {
          const retour = transitionner(fiche.source.creneau, "a_valider", "studio");
          if (!retour.ok) throw new ErreurStudio("FICHE_VERROUILLEE", PHRASES_VERROU.etat);
          await depots().creneauxEditoriaux.enregistrer(retour.creneau);
          aRevalider = true;
        }
      }
      revalidatePath("/calendrier");
      return { ...rendu, modifie: true, aRevalider };
    }),
  );
}
