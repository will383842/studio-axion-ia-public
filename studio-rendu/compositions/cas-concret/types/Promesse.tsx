/** Type d'écran `promesse` (R4) : l'invite, le cadeau en orange avec lueur (sa suite en ligne s'il est coupé), une ligne. Dessine `plans/Promesse.ts`. */
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { planPromesse } from "../plans/Promesse";
import { Eclair } from "../socle/Eclair";
import { Fond } from "../socle/Fond";
import { Ligne } from "../socle/Ligne";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

export function Promesse(p: Extract<ProprietesEcran, { type: "promesse" }>) {
  const plan = planPromesse(p, useCurrentFrame());
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque} />
        <MotParMot pose={plan.invite.pose} fond={p.fond} ecoule={plan.invite.ecoule} pas={plan.invite.pas} />
        <MotParMot pose={plan.cadeau.pose} fond={p.fond} ecoule={plan.cadeau.ecoule} pas={plan.cadeau.pas} lueur={plan.cadeau.lueur} />
        {plan.suite ? <Ligne pose={plan.suite.pose} fond={p.fond} t={plan.t} debut={plan.suite.debut} /> : null}
        <Ligne pose={plan.ligne.pose} fond={p.fond} t={plan.t} debut={plan.ligne.debut} />
      </AbsoluteFill>
      <Eclair t={plan.t} debut={plan.eclair} />
    </AbsoluteFill>
  );
}
