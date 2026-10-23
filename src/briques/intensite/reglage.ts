/**
 * RÉGLAGE GLOBAL D'INTENSITÉ ET DES BRUITAGES d'une vidéo, figé dans la commande au lancement (posé par l'architecte
 * le 02/10 ; propriétaire D1). Appelé par `services/fabrication.ts` (`construireCommande`), qui ne change plus pour
 * ce lot. PUR.
 *
 * Intensité : choix de la vidéo (`styles.intensite`) > ancien choix des sous-titres (`styles.sousTitresIntensite`)
 * > profil du format (`intensite`, puis `sousTitresIntensite`) > « equilibre ».
 * Bruitages : choix de la vidéo > profil du format > « aucun ». Un son n'est de toute façon posé que s'il a été
 * écouté et validé par Will (`ValeurElement.bruitage.ecoute === "validee"`) : c'est le moteur qui le vérifie.
 */
import type { NiveauIntensite, ReglageBruitages, StylesChoisis } from "@/domaine/types";
import type { ProfilRendu } from "@/formats/types";

export function reglageIntensite(styles: Pick<StylesChoisis, "intensite" | "sousTitresIntensite" | "bruitages">, profil: Pick<ProfilRendu, "intensite" | "sousTitresIntensite" | "bruitages"> | undefined): { niveau: NiveauIntensite; bruitages: ReglageBruitages } {
  return {
    niveau: styles.intensite ?? styles.sousTitresIntensite ?? profil?.intensite ?? profil?.sousTitresIntensite ?? "equilibre",
    bruitages: styles.bruitages ?? profil?.bruitages ?? "aucun",
  };
}
