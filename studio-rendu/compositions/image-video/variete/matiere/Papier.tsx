import React from "react";
/**
 * MAT-B · grain de papier (maquette validée `prototypes/d1-ouvertures-fins/matiere.tsx`) : grain fin + nuages très
 * larges (visibles en vignette) + bord assombri, en ENCRE (et lueur de la charte) transparente posée
 * sur la scène : aucune teinte hors charte, le blanc des cartes reste presque blanc. Couvre tout le cadre.
 *
 * Coût : le bruit n'est pas un filtre SVG (≈ +150 % de temps par image fixe, mesuré) mais deux tuiles PNG calculées
 * en JS (`bruit.ts`), répétées par le navigateur : grain 128 px, nuages 64 px étirés à 540 px (lissés).
 */
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";
import { tuilesPapier } from "./bruit";

export function Papier() {
  const { grain, nuages } = tuilesPapier();
  const vignette = `radial-gradient(ellipse 80% 80% at 50% 40%, ${teinte(COULEURS_DUO.encre, 0)} 50%, ${teinte(COULEURS_DUO.encre, 0.07)} 100%)`;
  return (
    <div
      data-matiere="papier"
      style={{ position: "absolute", inset: 0, pointerEvents: "none", backgroundImage: `${vignette}, url("${grain}"), url("${nuages}")`, backgroundRepeat: "no-repeat, repeat, repeat", backgroundSize: "100% 100%, 128px 128px, 540px 540px" }}
    />
  );
}
