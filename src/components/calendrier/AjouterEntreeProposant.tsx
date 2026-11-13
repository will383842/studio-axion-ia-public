"use client";

/** Hôte de « Ajouter » avec la proposition de texte : passe l'action serveur `proposer` (CAL-27). Le bouton reste facultatif. */
import { proposerTexteAction } from "@/app/(studio)/calendrier/actions/proposer";
import { AjouterEntree } from "./AjouterEntree";

export function AjouterEntreeProposant(props: Omit<Parameters<typeof AjouterEntree>[0], "proposer">) {
  return <AjouterEntree {...props} proposer={proposerTexteAction} />;
}
