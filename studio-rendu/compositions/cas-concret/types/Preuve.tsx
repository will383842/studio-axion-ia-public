/** Type d'écran `preuve` (R2) : titre, bouclier à coche verte, deux puces qui surgissent. Dessine `plans/Preuve.ts`. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { BouclierCoche } from "../objets/BouclierCoche";
import { proprietesFond } from "../plans/fond-fort";
import { planPreuve, type ProprietesPreuve } from "../plans/Preuve";
import { Biais } from "../socle/Biais";
import { Fond } from "../socle/Fond";
import { Puce } from "../socle/Puce";
import { Surgir } from "../socle/Surgir";
import { piecesTexte } from "./Titre";

export function Preuve(p: ProprietesPreuve) {
  const plan = planPreuve(p, useCurrentFrame());
  const tVideo = plan.t + p.debutMs / 1000;
  const fond = proprietesFond(p.jeu);
  const { MotParMot, Marque, Etiquette } = piecesTexte(fond.fort === true);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...fond} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque.boite} />
        {plan.etiquettePose ? <Etiquette pose={plan.etiquettePose} fond={p.fond} t={plan.t} /> : null}
        <MotParMot pose={plan.titre.pose} fond={p.fond} ecoule={plan.titre.ecoule} pas={plan.titre.pas} />
        <Biais boite={plan.boiteBouclier} entree={plan.entreeBouclier} tVideo={tVideo} rotY={-7} rotX={4}>
          <BouclierCoche boite={{ ...plan.boiteBouclier, x: 0, y: 0 }} t={plan.t} tVideo={tVideo} fond={p.fond} debutCoche={plan.debutCoche} />
        </Biais>
        {plan.puces.map((q) => (
          <div key={q.nom} style={{ position: "absolute", left: q.boite.x, top: q.boite.y, width: q.boite.largeur, textAlign: "center" }}>
            <Surgir x={q.progres} rotation={q.rotationFinale}>
              <Puce texte={q.texte} taille={q.taille} />
            </Surgir>
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
