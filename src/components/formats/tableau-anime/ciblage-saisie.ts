import { libelleCibleValide } from "@/domaine/ciblage/controles";
import type { Ciblage, NiveauCible } from "@/domaine/ciblage/types";

/** Choix de cible de l'écran → ciblage et champ « public » prérempli avec le libellé (PUR). */
export function publicDepuisCible(niveau: NiveauCible, valeur: string): { public: string | undefined; ciblage: Ciblage | undefined } {
  const libelle = valeur.trim();
  if (!libelleCibleValide(libelle)) return { public: undefined, ciblage: undefined };
  return { public: libelle, ciblage: { niveau, libelle, origine: "saisie" } };
}
