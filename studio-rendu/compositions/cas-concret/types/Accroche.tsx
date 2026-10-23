/** Type d'écran `accroche` (R1) : étiquette, puis jusqu'à trois lignes d'affiche mot par mot. Dessine `plans/Accroche.ts`. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { planAccroche, type ProprietesAccroche } from "../plans/Accroche";
import { Etiquette } from "../socle/Etiquette";
import { lueurDuJeu } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

export function Accroche(p: ProprietesAccroche) {
  const plan = planAccroche(p, useCurrentFrame());
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...lueurDuJeu(p.jeu)} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque.boite} />
        {plan.etiquettePose ? <Etiquette pose={plan.etiquettePose} fond={p.fond} t={plan.t} /> : null}
        {plan.lignes.map((l) => (
          <MotParMot key={l.nom} pose={l.pose} fond={p.fond} ecoule={l.ecoule} pas={l.pas} lueur={l.lueur} />
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
