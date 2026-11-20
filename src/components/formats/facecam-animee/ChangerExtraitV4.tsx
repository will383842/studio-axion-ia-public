"use client";

/**
 * FACE CAMÉRA ANIMÉE v4 · « Changer un extrait » : enveloppe du panneau. Montée nulle part. Elle affiche
 * `PanneauExtraitsV4`, envoie la demande à la fonction reçue en propriété (`demander`) et montre la réponse.
 * Aucune action serveur importée, aucun montant, aucune police neuve (Manrope héritée).
 */
import { useState } from "react";
import type { DemandePanneauV4, SourcePanneauV4, TelephonePanneauV4 } from "./extraits-v4";
import { PanneauExtraitsV4 } from "./PanneauExtraitsV4";

export type ReponseChangerExtraitV4 = { statut: "lancee" } | { statut: "refusee"; raison: string };

export interface ProprietesChangerExtraitV4 {
  telephones: TelephonePanneauV4[];
  sources: SourcePanneauV4[];
  demander: (d: DemandePanneauV4) => Promise<ReponseChangerExtraitV4>;
}

export const PHRASE_CHANGEMENT_LANCE_V4 = "Le changement est lancé : la vidéo est refaite gratuitement.";
const PHRASE_ECHEC_V4 = "Le changement n'a pas pu être envoyé. Réessayez dans un instant.";

export function ChangerExtraitV4({ telephones, sources, demander }: ProprietesChangerExtraitV4) {
  const [occupe, setOccupe] = useState(false);
  const [reponse, setReponse] = useState<ReponseChangerExtraitV4 | null>(null);

  async function surDemande(d: DemandePanneauV4) {
    setOccupe(true);
    setReponse(null);
    try {
      setReponse(await demander(d));
    } catch {
      setReponse({ statut: "refusee", raison: PHRASE_ECHEC_V4 });
    } finally {
      setOccupe(false);
    }
  }

  return (
    <div className="space-y-3">
      <PanneauExtraitsV4 telephones={telephones} sources={sources} occupe={occupe} surDemande={(d) => void surDemande(d)} />
      {reponse && (
        <p role="status" className={`text-[15px] font-semibold ${reponse.statut === "lancee" ? "text-texte" : "text-brique"}`}>
          {reponse.statut === "lancee" ? PHRASE_CHANGEMENT_LANCE_V4 : reponse.raison}
        </p>
      )}
    </div>
  );
}
