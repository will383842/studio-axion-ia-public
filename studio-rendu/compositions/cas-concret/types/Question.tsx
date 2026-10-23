/** Type d'écran `question` (R2) : deux lignes d'affiche (la dernière dans la lueur), puis la question. Dessine `plans/Question.ts`. */
import React from "react";
import { AbsoluteFill, useCurrentFrame } from "remotion";
import { planQuestion, type ProprietesQuestion } from "../plans/Question";
import { lueurDuJeu } from "../plans/fond-fort";
import { Fond } from "../socle/Fond";
import { Marque } from "../socle/Marque";
import { MotParMot } from "../socle/MotParMot";

export function Question(p: ProprietesQuestion) {
  const plan = planQuestion(p, useCurrentFrame());
  const q = plan.question;
  return (
    <AbsoluteFill style={{ overflow: "hidden" }}>
      <Fond fond={p.fond} largeur={p.largeur} hauteur={p.hauteur} {...lueurDuJeu(p.jeu)} />
      <AbsoluteFill style={{ opacity: plan.entree.opacite, transform: `scale(${plan.entree.echelle})` }}>
        <Marque p={p} boite={plan.marque.boite} />
        {plan.lignes.map((l) => (
          <MotParMot key={l.nom} pose={l.pose} fond={p.fond} ecoule={l.ecoule} pas={l.pas} lueur={l.lueur} />
        ))}
        <div style={{ position: "absolute", left: q.boite.x, top: q.boite.y, width: q.boite.largeur, textAlign: "center", fontFamily: q.famille, fontSize: q.taille, lineHeight: q.pose.interligne, color: plan.couleurs.secondaire, opacity: q.opacite, transform: `translateY(${q.decalageY}px)` }}>
          {q.pose.lignes.map((x, i) => (
            <div key={i}>{x}</div>
          ))}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
}
