import { chargerReglesCarrousel } from "./regles/charger-regles";

// Bornes communes du schéma de carrousel (SEC-01 : toute chaîne est bornée).
// Les longueurs viennent du fichier de règles unique (M0-03) ; le reste est structurel.
const { longueurs } = chargerReglesCarrousel();

export const LIMITES = {
  altMax: longueurs.altMax,
  titreMax: longueurs.titreMax,
  sousTitreMax: 100,
  corpsMax: longueurs.corpsMax,
  pagesMin: 1,
  pagesMax: 10,
} as const;
