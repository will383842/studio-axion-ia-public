/**
 * Type d'écran `etape` : gabarit constant (« Étape 0n », titre mot par mot, une ligne, un visuel — objet redessiné ou
 * vrai écran dans un téléphone —, 0 à 2 puces, fil d'avancement). Composant mince : dessine `planEtape`.
 */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import type { ProprietesEcran } from "../../../../src/briques/ecrans-motion";
import { OBJETS } from "../objets/registre";
import { planEtape } from "../plans/Etape";
import { Etiquette } from "../socle/Etiquette";
import { lueurDuJeu } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { Ligne } from "../socle/Ligne";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";
import { Puce } from "../socle/Puce";

export function Etape(p: Extract<ProprietesEcran, { type: "etape" }>) {
  const e = planEtape(p, useCurrentFrame());
  const v = e.visuel;
  const Visuel = OBJETS[v.objet];
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...lueurDuJeu(p.jeu)} />
      <AbsoluteFill style={{ opacity: e.entree.opacite, transform: `scale(${e.entree.echelle})` }}>
        <Marque p={p} boite={e.marque.boite} />
        <Etiquette pose={e.etiquette.pose} fond={p.fond} t={e.t} />
        <MotParMot pose={e.titre.pose} fond={p.fond} ecoule={e.titre.ecoule} pas={e.titre.pas} />
        <Ligne pose={e.ligne.pose} fond={p.fond} t={e.t} debut={e.ligne.debut} />
        <div style={{ position: "absolute", left: v.boite.x, top: v.boite.y, width: v.boite.largeur, height: v.boite.hauteur, opacity: v.opacite, transform: `translateY(${v.decalageY}px) scale(${v.echelle}) perspective(${v.biais.perspective}px) rotateY(${v.biais.rotY}deg) rotateX(${v.biais.rotX}deg)` }}>
          <Visuel {...v.contexte} />
        </div>
        {e.puces.map((pu) => (
          <div key={pu.nom} style={{ position: "absolute", left: pu.boite.x, top: pu.boite.y, opacity: pu.opacite, transform: `scale(${pu.echelle}) rotate(${pu.rotation}deg)` }}>
            <Puce texte={pu.texte} taille={pu.taille} />
          </div>
        ))}
        <div style={{ position: "absolute", left: e.fil.boite.x, top: e.fil.boite.y, height: e.fil.boite.hauteur, width: e.fil.boite.largeur * e.fil.fraction, borderRadius: e.fil.boite.hauteur / 2, background: e.fil.couleur }} />
      </AbsoluteFill>
      {e.eclair.opacite > 0 ? <AbsoluteFill style={{ background: e.eclair.couleur, opacity: e.eclair.opacite, pointerEvents: "none" }} /> : null}
    </AbsoluteFill>
  );
}
