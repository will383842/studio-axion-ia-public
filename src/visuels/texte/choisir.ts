import type { DemandeTexteCarrousel, FournisseurTexteCarrousel } from "../../domaine/visuels/contrats";
import { creerFournisseurSession } from "./session";
import { creerFournisseurSimulation } from "./simulation";

/** Sujet -> simulation ; paquet -> session. Ne renvoie JAMAIS le fournisseur API. */
export function fournisseurTexte(demande: DemandeTexteCarrousel): FournisseurTexteCarrousel {
  return demande.type === "sujet" ? creerFournisseurSimulation() : creerFournisseurSession();
}
