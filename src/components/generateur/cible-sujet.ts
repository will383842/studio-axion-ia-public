/** Écran Sujet : règles pures de la cible (testées sans navigateur). */
import type { Ciblage, NiveauCible } from "@/domaine/ciblage/types";
import { ciblageSaisieValide } from "@/domaine/ciblage/saisie";
import { boutonPrincipalActif, type RefusAffiche } from "./sujet-deja-traite";

/** La cible choisie à l'écran : valable ou absente. */
export const ciblageSaisi = (niveau: NiveauCible | undefined, valeur: string): Ciblage | undefined => (niveau ? ciblageSaisieValide({ niveau, libelle: valeur }) : undefined);

/** Le bouton « Écrire » attend l'idée, le choix éventuel d'un refus ET la cible. */
export const boutonSujetActif = (pret: boolean, refus: RefusAffiche | undefined, ciblage: Ciblage | undefined): boolean => !!ciblage && boutonPrincipalActif(pret, refus);
