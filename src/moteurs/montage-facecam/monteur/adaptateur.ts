/**
 * ADAPTATEUR FACE CAMÉRA DE LA BRIQUE MONTEUR (mission H). PUR.
 *
 * Le face caméra garde EXACTEMENT son agent du lot D (vocabulaire complet, rôle Claude, règles fixes, application) :
 * cet adaptateur ne fait que le présenter sous le contrat commun (`AdaptateurMonteur`), pour que le registre
 * (`moteurs/monteurs.ts`) et les formats futurs le voient comme les autres. Rien n'est recopié ni modifié ici.
 */
import type { AdaptateurMonteur } from "@/briques/monteur/adaptateur";
import { CATALOGUE_MONTEUR, exemplesDemandes } from "./catalogue";
import { lireReponseMonteur, schemaReponseMonteur, TYPES_OPERATION_FACECAM, type OperationFacecam } from "./operations";
import { reglesFixes } from "./role";

export const adaptateurMonteurFacecam: AdaptateurMonteur<OperationFacecam> = {
  format: "facecam",
  catalogue: CATALOGUE_MONTEUR,
  typesSupportes: TYPES_OPERATION_FACECAM,
  schemaReponse: schemaReponseMonteur,
  lireReponse: lireReponseMonteur,
  reglesFixes: (consignes) => reglesFixes(consignes.map((c) => ({ id: c.id, texte: c.texte, origine: c.origine, ancre: c.ancre }))),
  exemples: (max) => exemplesDemandes(max),
};
