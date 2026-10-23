/** Type d'écran `objet` : titre mot par mot, ligne facultative, un objet animé. Composant mince : dessine `planObjet`. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { OBJETS } from "../objets/registre";
import { planObjet } from "../plans/Objet";
import { lueurDuJeu } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { Ligne } from "../socle/Ligne";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

export function Objet(p: Extract<ProprietesEcran, { type: "objet" }>) {
  const e = planObjet(p, useCurrentFrame());
  const v = e.visuel;
  const Visuel = OBJETS[v.objet];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...lueurDuJeu(p.jeu)} />
      <AbsoluteFill style={{ opacity: e.entree.opacite, transform: `scale(${e.entree.echelle})` }}>
        <Marque p={p} boite={e.marque.boite} />
        <MotParMot pose={e.titre.pose} fond={p.fond} ecoule={e.titre.ecoule} pas={e.titre.pas} />
        {e.ligne ? <Ligne pose={e.ligne.pose} fond={p.fond} t={e.t} debut={e.ligne.debut} /> : null}
        <div style={{ position: "absolute", left: v.boite.x, top: v.boite.y, width: v.boite.largeur, height: v.boite.hauteur, opacity: v.opacite, transform: `translateY(${v.decalageY}px) scale(${v.echelle}) perspective(${v.biais.perspective}px) rotateY(${v.biais.rotY}deg) rotateX(${v.biais.rotX}deg)` }}>
          <Visuel {...v.contexte} />
        </div>
      </AbsoluteFill>
      {e.eclair.opacite > 0 ? <AbsoluteFill style={{ background: e.eclair.couleur, opacity: e.eclair.opacite, pointerEvents: "none" }} /> : null}
    </AbsoluteFill>
  );
}
