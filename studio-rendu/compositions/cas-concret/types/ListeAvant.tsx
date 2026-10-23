/** Type d'écran `liste-avant` (R2) : titre, fiche de tâches qui s'écrit rang par rang, pastille du total. Dessine `plans/ListeAvant.ts`. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { ListeTaches } from "../objets/ListeTaches";
import { planListeAvant, type ProprietesListeAvant } from "../plans/ListeAvant";
import { Biais } from "../socle/Biais";
import { Etiquette } from "../socle/Etiquette";
import { lueurDuJeu } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

export function ListeAvant(p: ProprietesListeAvant) {
  const plan = planListeAvant(p, useCurrentFrame());
  const tot = plan.total;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...lueurDuJeu(p.jeu)} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque.boite} />
        {plan.etiquettePose ? <Etiquette pose={plan.etiquettePose} fond={p.fond} t={plan.t} /> : null}
        <MotParMot pose={plan.titre.pose} fond={p.fond} ecoule={plan.titre.ecoule} pas={plan.titre.pas} />
        <Biais boite={plan.boiteListe} entree={plan.entreeListe} tVideo={plan.t + p.debutMs / 1000} rotY={6} rotX={3}>
          <ListeTaches {...plan.proprietesListe} />
        </Biais>
        {tot ? (
          <div style={{ position: "absolute", left: tot.boite.x, top: tot.boite.y, width: tot.boite.largeur, height: tot.boite.hauteur, boxSizing: "border-box", borderRadius: tot.rayon, background: tot.couleurFond, color: tot.couleurTexte, textAlign: "center", paddingTop: tot.taille * 0.15, opacity: tot.opacite, transform: `scale(${tot.echelle}) rotate(${tot.rotation}deg)` }}>
            <div style={{ fontFamily: tot.famille, fontSize: tot.taille, lineHeight: 1, textTransform: "uppercase" }}>{tot.valeur}</div>
            {tot.ligne ? <div style={{ fontFamily: tot.familleLigne, fontSize: tot.tailleLigne, marginTop: tot.taille * 0.05 }}>{tot.ligne}</div> : null}
          </div>
        ) : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
