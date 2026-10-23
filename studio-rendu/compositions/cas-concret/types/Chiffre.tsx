/** Type d'écran `chiffre` (R1) : grand nombre dans la lueur (en zoom, ou compté dans un anneau), unité, pastilles. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { planChiffre, type ProprietesChiffre } from "../plans/Chiffre";
import { famille, graisse } from "../plans/commun";
import { proprietesFond } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { Particules, piecesTexte } from "./Titre";

export function Chiffre(p: ProprietesChiffre) {
  const plan = planChiffre(p, useCurrentFrame());
  const n = plan.nombre;
  const a = plan.anneau;
  const c = plan.couleurs;
  const fond = proprietesFond(p.jeu);
  const { MotParMot, Marque } = piecesTexte(fond.fort === true);
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...fond} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Particules particules={plan.particules} />
        <Marque p={p} boite={plan.marque.boite} />
        {a ? (
          <svg style={{ position: "absolute", left: 0, top: 0, filter: `drop-shadow(0 0 ${a.boite.largeur * 0.07}px ${c.lueur})` }} width={p.largeur} height={p.hauteur}>
            <circle cx={a.cx} cy={a.cy} r={a.rayon} fill="none" stroke={a.couleurPiste} strokeWidth={a.trait} />
            <circle cx={a.cx} cy={a.cy} r={a.rayon} fill="none" stroke={a.couleurTrait} strokeWidth={a.trait} strokeLinecap="round" strokeDasharray={a.circonference} strokeDashoffset={a.decalage} transform={`rotate(-90 ${a.cx} ${a.cy})`} />
          </svg>
        ) : null}
        <div
          style={{
            position: "absolute",
            left: n.boite.x,
            top: n.boite.y,
            width: n.boite.largeur,
            height: n.boite.hauteur,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            fontFamily: famille("anton"),
            fontWeight: graisse("anton"),
            fontSize: n.taille,
            lineHeight: 1,
            color: c.accent,
            opacity: n.opacite,
            transform: `scale(${n.echelle})`,
            filter: n.flou ? `blur(${n.flou}px)` : "none",
            textShadow: `0 0 ${n.taille * 0.08}px ${c.lueur}, 0 0 ${n.taille * 0.19}px ${c.lueurLarge}`,
          }}
        >
          {n.texte}
        </div>
        <MotParMot pose={plan.unite.pose} fond={p.fond} ecoule={plan.unite.ecoule} />
        {plan.pastilles.map((q, k) => (
          <div
            key={k}
            style={{
              position: "absolute",
              left: q.boite.x,
              top: q.boite.y,
              width: q.boite.largeur,
              height: q.boite.hauteur,
              boxSizing: "border-box",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              borderRadius: q.boite.hauteur,
              borderStyle: "solid",
              borderWidth: 2,
              borderColor: q.bordure,
              color: q.couleur,
              fontFamily: q.famille,
              fontSize: q.taille,
              whiteSpace: "nowrap",
              opacity: q.opacite,
              transform: `translateY(${q.decalageY}px)`,
            }}
          >
            {q.texte}
          </div>
        ))}
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
