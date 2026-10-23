/**
 * RECETTE QUALITÉ · ÉCRIRE, face caméra (Will au téléprompteur). PUR.
 * Mêmes règles d'écriture que l'avocat (structures, plafonds), mais son propre débit : celui du téléprompteur
 * (`DEBITS_PAR_DEFAUT.teleprompteur`, 2,9 mots/s), jamais le débit du double.
 */
import { DEBITS_PAR_DEFAUT } from "@/formats/familles";
import type { RecetteQualite } from "../types";
import { RECETTE_ECRIRE_AVOCAT } from "./ecrire-avocat";

export const RECETTE_ECRIRE_FACECAM: RecetteQualite = {
  ...RECETTE_ECRIRE_AVOCAT,
  id: "ecrire-facecam",
  libelle: "Écrire · face caméra",
  debit: { unite: "mots", parSeconde: DEBITS_PAR_DEFAUT.teleprompteur },
};
