import React from "react";
import { EclatMot, EXEMPLE_ECLAT_MOT, INSTANTS_ECLAT_MOT } from "../EclatMot";
import { EclatChiffre, EXEMPLE_ECLAT_CHIFFRE, INSTANTS_ECLAT_CHIFFRE } from "../EclatChiffre";
import { OndeDeChoc, EXEMPLE_ONDE_DE_CHOC, INSTANTS_ONDE_DE_CHOC } from "../OndeDeChoc";
import { TraitsVitesse, EXEMPLE_TRAITS_VITESSE, INSTANTS_TRAITS_VITESSE } from "../TraitsVitesse";
import { GerbeFormes, EXEMPLE_GERBE_FORMES, INSTANTS_GERBE_FORMES } from "../GerbeFormes";

type C = React.FC<{ t: number; largeurImage: number; hauteurImage: number }>;
export const ELEMENTS: { id: string; C: C; instants: readonly number[]; debut: number }[] = [
  { id: "eclat-mot", C: EclatMot, instants: INSTANTS_ECLAT_MOT, debut: EXEMPLE_ECLAT_MOT.debut },
  { id: "eclat-chiffre", C: EclatChiffre, instants: INSTANTS_ECLAT_CHIFFRE, debut: EXEMPLE_ECLAT_CHIFFRE.debut },
  { id: "onde-de-choc", C: OndeDeChoc, instants: INSTANTS_ONDE_DE_CHOC, debut: EXEMPLE_ONDE_DE_CHOC.debut },
  { id: "traits-vitesse", C: TraitsVitesse, instants: INSTANTS_TRAITS_VITESSE, debut: EXEMPLE_TRAITS_VITESSE.debut },
  { id: "gerbe-formes", C: GerbeFormes, instants: INSTANTS_GERBE_FORMES, debut: EXEMPLE_GERBE_FORMES.debut },
];
