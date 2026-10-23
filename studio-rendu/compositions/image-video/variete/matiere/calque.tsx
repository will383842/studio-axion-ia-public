import React from "react";
/**
 * Calque « matière » de la variété (lot APP-MAT, axe 9), le plus externe de l'habillage : il enveloppe toute la scène
 * (fond, toile ou objets, en-tête). Sans variété ou en MAT-A : le contenu tel quel.
 *  - MAT-B (papier) : grain d'encre posé en « produit » sur toute la scène ;
 *  - MAT-C (trait fait main) : sur une toile, les cartes et les fils tremblent eux-mêmes (`Noeud`, `Toile`) ; rien
 *    sur les autres scènes (un tremblé de toute la scène, essayé, laissait des pointillés aux bords du cadre et coûtait
 *    +55 % par image : leurs objets ne sont pas dans les fichiers du lot) ;
 *  - MAT-D (profondeur douce) : sur une toile, tranches et plateaux (`Noeud`, `Toile`) ; partout, une lumière douce
 *    (centre clair, bords assombris d'encre à 8 %).
 */
import type { ReactNode } from "react";
import { COULEURS_DUO } from "../../../../../src/briques/habillage/charte-duo";
import { teinte } from "../../../cas-concret/plans/commun";
import { useVariete } from "../ContexteVariete";
import { Papier } from "./Papier";
import { matiereDe } from "./trait";

export function CalqueMatiere({ children }: { children: ReactNode }) {
  const variete = useVariete();
  const code = matiereDe(variete);
  if (!code) return <>{children}</>;
  if (code === "MAT-B")
    return (
      <>
        {children}
        <Papier />
      </>
    );
  if (code === "MAT-C") return <>{children}</>;
  return (
    <>
      {children}
      <div
        data-matiere="profondeur"
        style={{ position: "absolute", inset: 0, pointerEvents: "none", background: `radial-gradient(ellipse 85% 70% at 50% 42%, ${teinte(COULEURS_DUO.encre, 0)} 55%, ${teinte(COULEURS_DUO.encre, 0.08)} 100%)` }}
      />
    </>
  );
}
