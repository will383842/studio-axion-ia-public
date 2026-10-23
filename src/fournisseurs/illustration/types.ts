/**
 * Extensions FACULTATIVES du fournisseur d'illustrations réel (lot A2), sans toucher au contrat figé
 * (`fournisseurs/types.ts`) : le moteur et les services les détectent par leur présence (capacités, jamais le nom).
 *  - `fabrication` : la fabrication payante par étapes (soumettre puis suivre), pour que le moteur n'attende jamais
 *    longtemps et qu'un redémarrage reprenne la même demande (elle est gardée dans le travail) sans la repayer ;
 *  - `recopierResultat` : la recherche dans les banques ne télécharge rien ; seul le résultat RETENU est recopié dans
 *    notre stockage (vidéo + vignette), au moment où il devient un élément de la Bibliothèque.
 */
import type { Montant, Ratio } from "@/domaine/types";
import type { ErreurFournisseur, FournisseurIllustration, ResultatBanque } from "../types";

export type DemandeFabrication =
  | { genre: "image"; requete: string; ratio: Ratio; cleIdempotence: string }
  | { genre: "clip"; imageUrl: string; requete: string; dureeSec: number; ratio: Ratio; cleIdempotence: string };

export type EtatFabrication =
  | { statut: "en_cours" }
  | { statut: "echec"; erreur: ErreurFournisseur }
  | {
      statut: "fait";
      /** Clé de NOTRE stockage (le fichier a été recopié). */
      fichierCle: string;
      mime: string;
      /** Adresse chez le fabricant (sert d'entrée au clip ; jamais affichée dans la console). */
      urlSource: string;
      cout: Montant;
      /** Coût exact en centimes de dollar (le relevé du rapport). */
      coutUsdCentimes: number;
      modele: string;
    };

export interface FabricationParEtapes {
  soumettre(demande: DemandeFabrication): Promise<{ idDemande: string }>;
  suivre(idDemande: string): Promise<EtatFabrication>;
}

export interface FournisseurIllustrationEtendu extends FournisseurIllustration {
  fabrication?: FabricationParEtapes;
  recopierResultat?(r: ResultatBanque): Promise<ResultatBanque>;
}

/** Un résultat de banque déjà recopié chez nous ? (sa clé n'est plus une adresse de la banque) */
export const estRecopie = (r: Pick<ResultatBanque, "fichierCle">) => !/^https?:\/\//.test(r.fichierCle);
