"use client";

import { lancerFabricationAction } from "@/app/(studio)/nouvelle/[format]/actions";
import { confirmerPrix } from "@/components/ui/ConfirmationPrix";
import { avecSecondOuiVoyant } from "@/domaine/voyant-rouge";

/** Le oui donné au voyant rouge, gardé par l'écran pour toute la durée du brouillon (une seule question, même si le prix est redemandé). */
export type OuiVoyant = { current: boolean };

/**
 * `lancerFabricationAction` entouré du second oui du voyant rouge, quand le texte vient d'une version du générateur
 * (« Utiliser dans ma vidéo »). Le serveur répond « VOYANT_ROUGE » (rien créé ni payé) : une seule question, puis relance.
 */
export function lancerAvecVoyant(videoId: string, confirme: boolean | number, scriptRelu: string | undefined, oui: OuiVoyant) {
  return avecSecondOuiVoyant(
    (malgreVoyant) => lancerFabricationAction(videoId, confirme, scriptRelu, { malgreVoyant }),
    async (question) => (await confirmerPrix({ message: question })) !== null,
    oui,
  );
}
